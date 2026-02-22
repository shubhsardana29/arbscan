const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

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

// Stats tracking
const stats = {
  totalOpportunities: 0,
  totalSimulatedProfit: 0,
  bestOpportunity: null,
  opportunityHistory: [] // last 100
};

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

  io.emit('opportunity', opp);
  io.emit('balances', getAllBalances());
  io.emit('stats', {
    totalOpportunities: stats.totalOpportunities,
    totalSimulatedProfit: parseFloat(stats.totalSimulatedProfit.toFixed(4)),
    bestOpportunity: stats.bestOpportunity
  });

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
