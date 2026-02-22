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

  const streams = symbols.map(s => `market.ticker.${SYMBOL_MAP[s].toLowerCase()}`).join(',');
  const url = `wss://api.bitkub.com/websocket-api/${streams}`;


  function connect() {
    ws = new WebSocket(url);

    ws.on('open', () => console.log('[Bitkub] Connected'));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.stream && msg.stream.startsWith('market.ticker.')) {
          const symRaw = msg.stream.replace('market.ticker.', '').toUpperCase();
          const symbol = Object.keys(SYMBOL_MAP).find(k => SYMBOL_MAP[k] === symRaw);

          if (symbol && msg.highestBid && msg.lowestAsk) {
            const THB_TO_USD = getRate('THB'); // live rate from central fxStore
            const bid = parseFloat(msg.highestBid) * THB_TO_USD;
            const ask = parseFloat(msg.lowestAsk) * THB_TO_USD;

            if (!isNaN(bid) && !isNaN(ask) && bid > 0 && ask > 0) {
              const bids = [{ price: bid, qty: 999999 }];
              const asks = [{ price: ask, qty: 999999 }];
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
