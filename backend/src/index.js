const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { connectBinance } = require('./connectors/binance');
const { connectCoinDCX } = require('./connectors/coindcx');
const { connectBitkub } = require('./connectors/bitkub');
const { detectArbitrage } = require('./arbitrageEngine');
const { getAllPrices } = require('./priceStore');
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

// REST: health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Stats tracking
const stats = {
  totalOpportunities: 0,
  totalSimulatedProfit: 0,
  bestOpportunity: null,
  opportunityHistory: [] // last 100
};

// Called every time any exchange updates a price
function onPriceUpdate(exchange, symbol) {
  const opportunities = detectArbitrage(symbol);

  if (opportunities.length > 0) {
    opportunities.forEach(opp => {
      stats.totalOpportunities++;
      stats.totalSimulatedProfit += opp.pnl.netProfit;

      if (!stats.bestOpportunity || opp.netProfit > stats.bestOpportunity.netProfit) {
        stats.bestOpportunity = opp;
      }

      stats.opportunityHistory.unshift(opp);
      if (stats.opportunityHistory.length > 100) {
        stats.opportunityHistory.pop();
      }

      // Emit to all connected clients
      io.emit('opportunity', opp);
    });
  }

  // Always emit latest prices
  io.emit('prices', getAllPrices());
  io.emit('stats', {
    totalOpportunities: stats.totalOpportunities,
    totalSimulatedProfit: parseFloat(stats.totalSimulatedProfit.toFixed(4)),
    bestOpportunity: stats.bestOpportunity
  });
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('[Socket.io] Client connected:', socket.id);

  // Send initial state
  socket.emit('prices', getAllPrices());
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

// Start exchange connectors
console.log('[Server] Starting exchange connectors...');
connectBinance(SYMBOLS, onPriceUpdate);
connectCoinDCX(SYMBOLS, onPriceUpdate);
connectBitkub(SYMBOLS, onPriceUpdate);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log('[Server] Running on http://localhost:' + PORT);
});
