/**
 * CoinDCX — uses polling since their public WS is limited
 * Polls /api/v1/ticker every 2 seconds
 */
const axios = require('axios');
const { updatePrice } = require('../priceStore');

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
          // CoinDCX gives bid, ask directly
          const bid = parseFloat(ticker.bid || ticker.last_price);
          const ask = parseFloat(ticker.ask || ticker.last_price);
          if (!isNaN(bid) && !isNaN(ask)) {
            updatePrice('coindcx', symbol, bid, ask);
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
