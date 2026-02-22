const WebSocket = require('ws');
const { updatePrice } = require('../priceStore');
const { getRate } = require('../fxStore');

const SYMBOL_ID_MAP = {
  'BTC/USDT': 1,
  'ETH/USDT': 2,
  'BNB/USDT': 33
};

function connectBitkub(symbols, onUpdate) {
  const connections = [];

  function createManager(symbol) {
    const id = SYMBOL_ID_MAP[symbol];
    if (!id) return null;

    let ws;
    let reconnectTimeout;
    const localBook = { bids: [], asks: [] };

    function connect() {
      ws = new WebSocket(`wss://api.bitkub.com/websocket-api/orderbook/${id}`);

      ws.on('open', () => console.log(`[Bitkub] Connected: ${symbol} (ID: ${id})`));

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw);
          const { event, data } = msg;
          if (!event || !data) return;

          const THB_TO_USD = getRate('THB');
          let updated = false;

          if (event === 'tradeschanged') {
            // Initial snapshot: data[1] is bids, data[2] is asks
            if (data[1]) {
              localBook.bids = data[1].map(b => ({ price: parseFloat(b[1]) * THB_TO_USD, qty: parseFloat(b[2]) }));
            }
            if (data[2]) {
              localBook.asks = data[2].map(a => ({ price: parseFloat(a[1]) * THB_TO_USD, qty: parseFloat(a[2]) }));
            }
            updated = true;
          } else if (event === 'bidschanged') {
            localBook.bids = data.map(b => ({ price: parseFloat(b[1]) * THB_TO_USD, qty: parseFloat(b[2]) }));
            updated = true;
          } else if (event === 'askschanged') {
            localBook.asks = data.map(a => ({ price: parseFloat(a[1]) * THB_TO_USD, qty: parseFloat(a[2]) }));
            updated = true;
          }

          if (updated) {
            updatePrice('bitkub', symbol, localBook.bids, localBook.asks);
            onUpdate('bitkub', symbol);
          }
        } catch (e) {
          console.error(`[Bitkub] Error parsing ${symbol} update:`, e.message);
        }
      });

      ws.on('error', (err) => {
        console.error(`[Bitkub] Error on ${symbol}:`, err.message);
        ws.terminate();
      });

      ws.on('close', () => {
        console.log(`[Bitkub] Closed ${symbol}, reconnecting...`);
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, 5000);
      });
    }

    connect();

    return {
      close: () => {
        clearTimeout(reconnectTimeout);
        if (ws) ws.terminate();
      }
    };
  }

  symbols.forEach(s => {
    const manager = createManager(s);
    if (manager) connections.push(manager);
  });

  return {
    close: () => connections.forEach(c => c.close())
  };
}

module.exports = { connectBitkub };
