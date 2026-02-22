/**
 * In-memory price store
 * Structure: { 'BTC/USDT': { binance: { bid, ask, ts }, coindcx: {...}, bitkub: {...} } }
 */
const store = {};

function updatePrice(exchange, symbol, bids, asks) {
  if (!store[symbol]) store[symbol] = {};

  const existing = store[symbol][exchange] || {};
  store[symbol][exchange] = {
    bids: bids || existing.bids || [],
    asks: asks || existing.asks || [],
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
