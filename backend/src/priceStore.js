/**
 * In-memory price store
 * Structure: { 'BTC/USDT': { binance: { bid, ask, ts }, coindcx: {...}, bitkub: {...} } }
 */
const store = {};

function updatePrice(exchange, symbol, bid, ask) {
  if (!store[symbol]) store[symbol] = {};
  store[symbol][exchange] = {
    bid: parseFloat(bid),
    ask: parseFloat(ask),
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
