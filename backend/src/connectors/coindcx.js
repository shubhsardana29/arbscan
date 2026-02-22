/**
 * CoinDCX — uses REST polling since their public WS requires legacy Socket.io v2
 * Polls /exchange/ticker every 2 seconds
 */
const axios = require('axios');
const { updatePrice } = require('../priceStore');
const { getRate } = require('../fxStore');

const SYMBOL_MAP = {
  'BTC/USDT': 'BTCUSDT',
  'ETH/USDT': 'ETHUSDT',
  'BNB/USDT': 'BNBUSDT'
};

function connectCoinDCX(symbols, onUpdate) {
  let running = true;
  let timeout;

  async function poll() {
    try {
      const res = await axios.get('https://api.coindcx.com/exchange/ticker', {
        timeout: 5000
      });
      const tickers = res.data;

      symbols.forEach(symbol => {
        const key = SYMBOL_MAP[symbol];
        const ticker = tickers.find(t => t.market === key);
        if (ticker) {
          // CoinDCX prices are in INR — convert to USD via live fxStore rate
          const INR_TO_USD = getRate('INR');
          const bid = parseFloat(ticker.bid || ticker.last_price) * INR_TO_USD;
          const ask = parseFloat(ticker.ask || ticker.last_price) * INR_TO_USD;
          if (!isNaN(bid) && !isNaN(ask) && bid > 0 && ask > 0) {
            // Mocking depth since public API only gives top of book
            const bids = [{ price: bid, qty: 999999 }];
            const asks = [{ price: ask, qty: 999999 }];
            updatePrice('coindcx', symbol, bids, asks);
            onUpdate('coindcx', symbol);
          }
        }
      });
    } catch (e) {
      console.error('[CoinDCX] Poll error:', e.message);
    }

    if (running) {
      timeout = setTimeout(poll, 2000);
    }
  }

  poll();
  console.log('[CoinDCX] Polling started');

  return {
    close: () => {
      running = false;
      clearTimeout(timeout);
    }
  };
}

module.exports = { connectCoinDCX };
