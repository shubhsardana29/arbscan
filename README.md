<div align="center">

```
 █████╗ ██████╗ ██████╗ ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██████╔╝██████╔╝███████╗██║     ███████║██╔██╗ ██║
██╔══██║██╔══██╗██╔══██╗╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║██║  ██║██████╔╝███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝
```

**Real-time Crypto Arbitrage Detection Engine**

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7-010101?style=flat-square&logo=socket.io)](https://socket.io)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

*Monitors Binance, CoinDCX, and Bitkub simultaneously — detects price gaps, calculates net profit after fees, simulates P&L in real time.*

[What is Arbitrage?](#-what-is-arbitrage) · [Quick Start](#-quick-start) · [Architecture](#-architecture) · [How It Works](#-how-it-works) · [API Reference](#-api-reference) · [Configuration](#-configuration) · [Deployment](#-deployment)

---

</div>

## 🧠 What is Arbitrage?

> **The short version:** Buy cheap on one exchange, sell expensive on another — pocket the difference.

Imagine Bitcoin costs **$67,200** on Binance and **$67,500** on Bitkub at the same moment. If you could buy on Binance and simultaneously sell on Bitkub, you'd make $300 on that trade. That gap is called an **arbitrage opportunity**.

These gaps exist because:
- Exchanges operate independently across different countries and time zones
- Bitkub (Thailand) trades in Thai Baht — currency isolation creates natural price drift
- Supply and demand differs per exchange's user base

ARBSCAN watches all three exchanges simultaneously, detects these gaps the moment they appear, and shows you exactly what you'd have made — after all fees are deducted.

> **⚠️ Important:** ARBSCAN is a **paper trading simulator**. It detects and quantifies opportunities but does not execute live trades. Use it to learn, backtest, and build on top of.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔴 **Live Price Feeds** | Binance via WebSocket, CoinDCX & Bitkub via REST polling |
| ⚡ **Sub-100ms Detection** | Arbitrage engine runs on every price tick |
| 💰 **Fee-Aware Calculation** | Subtracts taker fees from all three exchanges before flagging |
| 📊 **P&L Simulation** | Shows simulated profit/loss on $1,000 capital per trade |
| 📈 **Cumulative Chart** | Live Recharts area chart of simulated profit over time |
| 🔢 **Spread Matrix** | Every buy→sell combo displayed as a color-coded grid |
| 🔔 **Live Ticker Bar** | Flashes latest opportunity at the top of the dashboard |
| 🐳 **Docker Ready** | One command to run the full stack |
| 🎨 **OKLCH Design System** | Perceptually uniform colors, `IBM Plex Mono`, Bloomberg Terminal aesthetic |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) v20 or higher
- npm v9 or higher
- (Optional) [Docker](https://docker.com) + Docker Compose

### Option 1 — Local Development

**Step 1: Clone and install**

```bash
git clone https://github.com/shubhsardana29/arbscan.git
cd arbscan
```

**Step 2: Start the backend**

```bash
cd backend
npm install
npm run dev
# ✅ Backend running at http://localhost:4000
```

**Step 3: Start the frontend** (new terminal)

```bash
cd frontend
npm install
npm start
# ✅ Dashboard at http://localhost:3000
```

### Option 2 — Docker Compose (Recommended)

```bash
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Health Check | http://localhost:4000/api/health |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                            │
│                                                                 │
│  ┌─────────────┐   ┌─────────────────┐   ┌──────────────────┐  │
│  │   BINANCE   │   │    COINDCX      │   │     BITKUB       │  │
│  │  WebSocket  │   │  REST poll/2s   │   │  REST poll/3s    │  │
│  │  bookTicker │   │ /exchange/ticker│   │ /market/ticker   │  │
│  └──────┬──────┘   └────────┬────────┘   └────────┬─────────┘  │
└─────────┼────────────────────┼────────────────────┼────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    PRICE STORE      │
                    │  In-memory JS map   │
                    │  { symbol: {        │
                    │    exchange: {       │
                    │      bid, ask, ts   │
                    │    }                │
                    │  } }                │
                    └──────────┬──────────┘
                               │  on every update
                    ┌──────────▼──────────┐
                    │  ARBITRAGE ENGINE   │
                    │                     │
                    │  • Check all pairs  │
                    │  • Calc gross spread│
                    │  • Subtract fees    │
                    │  • Filter threshold │
                    │  • Simulate P&L     │
                    └──────────┬──────────┘
                               │  opportunities
                    ┌──────────▼──────────┐
                    │   EXPRESS + SOCKET  │
                    │   REST API + WS     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   REACT DASHBOARD   │
                    │                     │
                    │  • Price table      │
                    │  • Spread matrix    │
                    │  • Opportunity feed │
                    │  • P&L chart        │
                    │  • Stats bar        │
                    └─────────────────────┘
```

### Project Structure

```
arbscan/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server + Socket.io
│   │   ├── config.js             # Fees, symbols, thresholds
│   │   ├── priceStore.js         # In-memory state management
│   │   ├── arbitrageEngine.js    # Core detection + P&L simulation
│   │   └── connectors/
│   │       ├── binance.js        # WebSocket connector (real-time)
│   │       ├── coindcx.js        # REST polling (2s interval)
│   │       └── bitkub.js         # REST polling + THB→USD conversion
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.js                # Full dashboard — all components
│   │   └── index.js
│   ├── public/
│   │   └── index.html
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## ⚙️ How It Works

### 1. Price Normalization

Each exchange has a different API format. Every incoming price update gets normalized to a unified schema before being stored:

```js
// Unified format — regardless of source exchange
{
  exchange: "binance",   // or "coindcx" / "bitkub"
  symbol:   "BTC/USDT",
  bid:      67200.50,    // highest price someone will buy at
  ask:      67201.00,    // lowest price someone will sell at
  ts:       1714000000000
}
```

> **Bid vs Ask:** When you buy, you pay the **ask** (seller's price). When you sell, you receive the **bid** (buyer's price). The spread between them is where the exchange makes money.

### 2. Bitkub Currency Conversion

Bitkub is a Thai exchange — all prices are in Thai Baht (THB). The connector fetches a live USD/THB exchange rate every 5 minutes from `exchangerate-api.com` and multiplies all prices before storing them.

```js
const bid_usd = ticker.highestBid * THB_TO_USD;
const ask_usd = ticker.lowestAsk  * THB_TO_USD;
```

This is what makes Bitkub interesting — currency friction creates persistent, predictable gaps vs. global exchanges.

### 3. Arbitrage Detection

After every price update, the engine checks all buy→sell combinations across exchanges:

```js
function detectArbitrage(symbol) {
  for (const buyExchange of exchanges) {
    for (const sellExchange of exchanges) {
      if (buyExchange === sellExchange) continue;

      const buyPrice  = prices[buyExchange].ask;  // you pay the ask price to buy
      const sellPrice = prices[sellExchange].bid;  // you receive the bid price when selling

      const grossSpread = ((sellPrice - buyPrice) / buyPrice) * 100;
      const netProfit   = grossSpread - FEES[buyExchange] - FEES[sellExchange];

      if (netProfit >= MIN_PROFIT_THRESHOLD) {
        // 🚨 Opportunity detected
      }
    }
  }
}
```

**Key insight:** You always buy at the *ask* (higher price) and sell at the *bid* (lower price). The gap between ask on one exchange and bid on another is your gross spread — minus fees.

### 4. P&L Simulation

Every detected opportunity runs a $1,000 capital simulation:

```
Coins bought  = $1,000 ÷ buyPrice
Gross revenue = coins × sellPrice
Buy fee       = $1,000 × FEES[buyExchange] / 100
Sell fee      = grossRevenue × FEES[sellExchange] / 100
Net profit    = grossRevenue − $1,000 − buyFee − sellFee
```

### 5. Staleness Check

Price data older than **30 seconds** is ignored. Stale prices create false opportunities.

```js
if (Date.now() - priceData.ts > 30_000) continue;
```

---

## 📡 API Reference

### REST Endpoints

#### `GET /api/health`
Returns server status.

```json
{ "status": "ok", "timestamp": 1714000000000 }
```

#### `GET /api/prices`
Returns the current price snapshot across all exchanges and symbols.

```json
{
  "BTC/USDT": {
    "binance":  { "bid": 67200.50, "ask": 67201.00, "ts": 1714000000000 },
    "coindcx":  { "bid": 67150.00, "ask": 67155.00, "ts": 1714000000000 },
    "bitkub":   { "bid": 67480.00, "ask": 67490.00, "ts": 1714000000000 }
  },
  "ETH/USDT": { ... },
  "BNB/USDT": { ... }
}
```

### Socket.io Events

Connect to `http://localhost:4000` with Socket.io client.

#### Events emitted by server → client

| Event | Payload | Frequency | Description |
|-------|---------|-----------|-------------|
| `prices` | Price map (see above) | Every price tick | Full price state update |
| `opportunity` | Opportunity object | On detection | New arbitrage opportunity found |
| `stats` | Stats object | Every tick | Running totals |
| `history` | Array of opportunities | On connect | Last 100 opportunities |

#### `opportunity` payload

```json
{
  "id":          "1714000000000-binance-bitkub-BTC/USDT",
  "symbol":      "BTC/USDT",
  "buyOn":       "binance",
  "sellOn":      "bitkub",
  "buyPrice":    67201.00,
  "sellPrice":   67480.00,
  "grossSpread": 0.415,
  "feeCost":     0.350,
  "netProfit":   0.065,
  "pnl": {
    "capital":      1000,
    "grossRevenue": 1004.15,
    "totalFees":    3.51,
    "netProfit":    0.64,
    "roi":          0.064
  },
  "timestamp": 1714000000000
}
```

#### `stats` payload

```json
{
  "totalOpportunities":  42,
  "totalSimulatedProfit": 28.64,
  "bestOpportunity": { ...opportunity object... }
}
```

#### Subscribing (client example)

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

socket.on('opportunity', (opp) => {
  console.log(`${opp.symbol}: Buy ${opp.buyOn} @ $${opp.buyPrice}`);
  console.log(`  Sell ${opp.sellOn} @ $${opp.sellPrice}`);
  console.log(`  Net profit: ${opp.netProfit}% ($${opp.pnl.netProfit} on $1k)`);
});

socket.on('prices', (prices) => {
  // Real-time full price map
});
```

---

## 🔧 Configuration

All configuration lives in `backend/src/config.js`:

```js
// Trading fees per exchange (taker fee %)
const FEES = {
  binance:  0.10,   // 0.075% with BNB discount
  coindcx:  0.20,
  bitkub:   0.25,
};

// Symbols to track
const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];

// Minimum net profit % to flag as an opportunity
const MIN_PROFIT_THRESHOLD = 0.05;

// Capital used in P&L simulation (USDT)
const SIMULATION_CAPITAL = 1000;
```

### Adding a New Symbol

1. Add to `SYMBOLS` array in `config.js`
2. Add the exchange-specific symbol mapping in each connector file:

```js
// In connectors/binance.js
const SYMBOL_MAP = {
  'BTC/USDT': 'btcusdt',
  'ETH/USDT': 'ethusdt',
  'SOL/USDT': 'solusdt',  // ← add here
};
```

### Adding a New Exchange

1. Create `backend/src/connectors/yourexchange.js`
2. Follow the connector interface — export a `connect(symbols, onUpdate)` function
3. Call `updatePrice(exchange, symbol, bid, ask)` on each tick
4. Import and call in `backend/src/index.js`
5. Add fee to `FEES` in `config.js`

```js
// Connector interface
function connectYourExchange(symbols, onUpdate) {
  // ... connect to WS or start polling

  // On every price update:
  updatePrice('yourexchange', 'BTC/USDT', bid, ask);
  onUpdate('yourexchange', 'BTC/USDT');

  return {
    close: () => { /* cleanup */ }
  };
}
```

---

## 🚢 Deployment

### Azure 

```bash
# Build images
docker build -t arbscan-backend ./backend
docker build -t arbscan-frontend ./frontend

# Tag and push to Azure Container Registry
az acr login --name yourregistry
docker tag arbscan-backend yourregistry.azurecr.io/arbscan-backend:latest
docker push yourregistry.azurecr.io/arbscan-backend:latest

# Deploy to Azure Container Apps or ACI
az containerapp create \
  --name arbscan-backend \
  --resource-group yourRG \
  --image yourregistry.azurecr.io/arbscan-backend:latest \
  --target-port 4000 \
  --ingress external
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend server port |
| `NODE_ENV` | `development` | Environment mode |
| `REACT_APP_BACKEND_URL` | `http://localhost:4000` | Backend URL for frontend |

---


## 🛣️ Roadmap

- [ ] **Execution layer** — integrate exchange APIs to paper-trade with fake capital
- [ ] **Historical replay** — record price data and replay to test strategies
- [ ] **Alert system** — Telegram/Discord webhook when opportunity exceeds threshold
- [ ] **More exchanges** — WazirX, KuCoin, OKX
- [ ] **Rust rewrite of core engine** — sub-millisecond detection latency
- [ ] **Database persistence** — PostgreSQL + Prisma for opportunity history
- [ ] **Strategy builder** — define custom conditions beyond simple spread

---

## 📚 Further Reading

- [Binance WebSocket API Docs](https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams)
- [CoinDCX API Reference](https://docs.coindcx.com/)
- [Bitkub API Reference](https://github.com/bitkub/bitkub-official-api-docs)
- [Arbitrage: Investopedia](https://www.investopedia.com/terms/a/arbitrage.asp)

---

## 🤝 License

MIT — use it, learn from it, build on it.

---

<div align="center">

Built by **Shubh Sardana** · [GitHub](https://github.com/shubhsardana) · [LinkedIn](https://linkedin.com/in/shubhsardana) · [Portfolio](https://shubhsardana.dev)

*"The edge isn't in finding opportunities. It's in finding them faster."*

</div>
