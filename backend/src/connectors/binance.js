const WebSocket = require('ws');
const { updatePrice } = require('../priceStore');

const SYMBOL_MAP = {
  'BTC/USDT': 'btcusdt',
  'ETH/USDT': 'ethusdt',
  'BNB/USDT': 'bnbusdt'
};

function connectBinance(symbols, onUpdate) {
  const streams = symbols
    .map(s => SYMBOL_MAP[s])
    .filter(Boolean)
    .map(s => s + '@bookTicker')
    .join('/');

  const url = 'wss://stream.binance.com:9443/stream?streams=' + streams;
  let ws;
  let reconnectTimeout;

  function connect() {
    ws = new WebSocket(url);

    ws.on('open', () => console.log('[Binance] Connected'));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const data = msg.data || msg;
        const symRaw = (data.s || '').toLowerCase();
        const symbol = Object.keys(SYMBOL_MAP).find(k => SYMBOL_MAP[k] === symRaw);
        if (symbol && data.b && data.a) {
          updatePrice('binance', symbol, data.b, data.a);
          onUpdate('binance', symbol);
        }
      } catch (e) {}
    });

    ws.on('close', () => {
      console.log('[Binance] Closed, reconnecting...');
      reconnectTimeout = setTimeout(connect, 3000);
    });

    ws.on('error', (err) => {
      console.error('[Binance] Error:', err.message);
      ws.terminate();
    });
  }

  connect();
  return { close: () => { clearTimeout(reconnectTimeout); ws && ws.terminate(); } };
}

module.exports = { connectBinance };
