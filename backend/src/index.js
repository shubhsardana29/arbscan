const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { connectBinance } = require('./connectors/binance');
const { connectCoinDCX } = require('./connectors/coindcx');
const { connectBitkub } = require('./connectors/bitkub');
const { detectArbitrage, engineEvents } = require('./arbitrageEngine');
const { getAllPrices } = require('./priceStore');
const { getAllBalances } = require('./balanceStore');
const { logTrade } = require('./tradeLogger');
const { runBacktest } = require('../scripts/backtest');
const { startFxStore, getRates, fxEvents } = require('./fxStore');
const { SYMBOLS } = require('./config');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// REST: get current prices snapshot
app.get('/api/prices', (req, res) => {
  res.json(getAllPrices());
});

// REST: get current virtual balances
app.get('/api/balances', (req, res) => {
  res.json(getAllBalances());
});

// REST: health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// REST: run backtest
app.get('/api/backtest', async (req, res) => {
  try {
    const report = await runBacktest();
    res.json(report);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// REST: get live FX rates
app.get('/api/fx-rates', (req, res) => {
  res.json(getRates());
});

// REST: return EXECUTED trades from trades.jsonl for P&L chart
app.get('/api/trades', (req, res) => {
  const logPath = path.join(__dirname, '../data/trades.jsonl');
  if (!fs.existsSync(logPath)) return res.json([]);
  try {
    const lines = fs.readFileSync(logPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(t => t && t.status === 'EXECUTED');
    res.json(lines);
  } catch (e) {
    res.json([]);
  }
});

// REST: live route stats
app.get('/api/route-stats', (req, res) => {
  res.json(Object.fromEntries(routeStats));
});

// Stats tracking
const stats = {
  totalOpportunities: 0,
  totalSimulatedProfit: 0,
  bestOpportunity: null,
  opportunityHistory: [] // last 100
};

// Route stats: routeKey -> { count, totalSpread, bestSpread, totalPnl, lastSeen }
// e.g. 'coindcx->bitkub:BTC/USDT'
const routeStats = new Map();

// Called every time any exchange updates a price
// Handle execution events
engineEvents.on('trade_executed', (opp) => {
  stats.totalOpportunities++;
  stats.totalSimulatedProfit += opp.executedPnl;

  if (!stats.bestOpportunity || opp.executedPnl > (stats.bestOpportunity.executedPnl || stats.bestOpportunity.netProfit)) {
    stats.bestOpportunity = opp;
  }

  stats.opportunityHistory.unshift(opp);
  if (stats.opportunityHistory.length > 100) {
    stats.opportunityHistory.pop();
  }

  // Update per-route stats
  const routeKey = `${opp.buyOn}->${opp.sellOn}:${opp.symbol}`;
  const rs = routeStats.get(routeKey) || { count: 0, totalSpread: 0, bestSpread: 0, totalPnl: 0, lastSeen: null };
  rs.count++;
  rs.totalSpread += opp.netProfit || 0;
  rs.bestSpread = Math.max(rs.bestSpread, opp.netProfit || 0);
  rs.totalPnl += opp.executedPnl || 0;
  rs.lastSeen = new Date().toISOString();
  routeStats.set(routeKey, rs);

  io.emit('opportunity', opp);
  io.emit('balances', getAllBalances());
  io.emit('stats', {
    totalOpportunities: stats.totalOpportunities,
    totalSimulatedProfit: parseFloat(stats.totalSimulatedProfit.toFixed(4)),
    bestOpportunity: stats.bestOpportunity
  });
  io.emit('route-stats', Object.fromEntries(routeStats));

  logTrade(opp);
});

engineEvents.on('trade_failed', (opp) => {
  // Still log failed trades for analytics
  logTrade(opp);
});

// Called every time any exchange updates a price
function onPriceUpdate(exchange, symbol) {
  // detectArbitrage evaluates and optionally pushes to the 100ms queue
  detectArbitrage(symbol);

  // Always emit latest prices
  io.emit('prices', getAllPrices());
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('[Socket.io] Client connected:', socket.id);

  // Send initial state
  socket.emit('prices', getAllPrices());
  socket.emit('balances', getAllBalances());
  socket.emit('stats', {
    totalOpportunities: stats.totalOpportunities,
    totalSimulatedProfit: parseFloat(stats.totalSimulatedProfit.toFixed(4)),
    bestOpportunity: stats.bestOpportunity
  });
  socket.emit('history', stats.opportunityHistory);
  socket.emit('route-stats', Object.fromEntries(routeStats));

  socket.on('disconnect', () => {
    console.log('[Socket.io] Client disconnected:', socket.id);
  });
});

// Start FX rate store — broadcast updates over socket
console.log('[Server] Starting exchange connectors...');
startFxStore();
fxEvents.on('update', (rates) => io.emit('fx-rates', rates));

// Send current FX rates on new socket connections
const _ioOnConn = io.on.bind(io, 'connection');
io.on('connection', (socket) => {
  socket.emit('fx-rates', getRates());
});

connectBinance(SYMBOLS, onPriceUpdate);
connectCoinDCX(SYMBOLS, onPriceUpdate);
connectBitkub(SYMBOLS, onPriceUpdate);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log('[Server] Running on http://localhost:' + PORT);
});
