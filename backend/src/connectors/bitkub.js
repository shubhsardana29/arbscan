/**
 * Bitkub WebSocket Stream
 */
const WebSocket = require('ws');
const { updatePrice } = require('../priceStore');
const { getRate } = require('../fxStore');

const SYMBOL_MAP = {
  'BTC/USDT': 'THB_BTC',
  'ETH/USDT': 'THB_ETH',
  'BNB/USDT': 'THB_BNB'
};

function connectBitkub(symbols, onUpdate) {
  let ws;
  let reconnectTimeout;

  const streams = symbols.map(s => `market.books.${SYMBOL_MAP[s].toLowerCase()}`).join(',');
  const url = `wss://api.bitkub.com/websocket-api/${streams}`;


  function connect() {
    ws = new WebSocket(url);

    ws.on('open', () => console.log('[Bitkub] Connected to Books stream'));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.stream && msg.stream.startsWith('market.books.')) {
          const symRaw = msg.stream.replace('market.books.', '').toUpperCase();
          const symbol = Object.keys(SYMBOL_MAP).find(k => SYMBOL_MAP[k] === symRaw);

          if (symbol && msg.bids && msg.asks) {
            const THB_TO_USD = getRate('THB');

            const bids = msg.bids.map(b => ({
              price: parseFloat(b[0]) * THB_TO_USD,
              qty: parseFloat(b[1])
            }));
            const asks = msg.asks.map(a => ({
              price: parseFloat(a[0]) * THB_TO_USD,
              qty: parseFloat(a[1])
            }));

            if (bids.length > 0 || asks.length > 0) {
              updatePrice('bitkub', symbol, bids, asks);
              onUpdate('bitkub', symbol);
            }
          }
        }
      } catch (e) { }
    });

    ws.on('close', () => {
      console.log('[Bitkub] Closed, reconnecting...');
      reconnectTimeout = setTimeout(connect, 3000);
    });

    ws.on('error', (err) => {
      console.error('[Bitkub] Error:', err.message);
      ws.terminate();
    });
  }

  connect();
  return {
    close: () => {
      clearTimeout(reconnectTimeout);
      ws && ws.terminate();
    }
  };
}

module.exports = { connectBitkub };
