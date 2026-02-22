/**
 * In-memory price store
 * Structure: { 'BTC/USDT': { binance: { bid, ask, ts }, coindcx: {...}, bitkub: {...} } }
 */
const store = {};

function updatePrice(exchange, symbol, bids, asks) {
  if (!store[symbol]) store[symbol] = {};
  store[symbol][exchange] = {
    bids, // Array of { price: number, qty: number }
    asks, // Array of { price: number, qty: number }
    ts: Date.now()
  };
}

function getPrice(symbol) {
  return store[symbol] || {};
}

function getAllPrices() {
  return store;
}

module.exports = { updatePrice, getPrice, getAllPrices };
