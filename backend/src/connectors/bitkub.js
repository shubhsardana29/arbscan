/**
 * Bitkub — uses REST polling (THB pairs, we convert to USDT equivalent)
 * Note: Bitkub trades in THB. We use USD/THB rate to normalize.
 * For MVP we poll their ticker endpoint.
 */
const axios = require('axios');
const { updatePrice } = require('../priceStore');

// Bitkub symbol format uses THB base
const SYMBOL_MAP = {
  'BTC/USDT': 'THB_BTC',
  'ETH/USDT': 'THB_ETH',
  'BNB/USDT': 'THB_BNB'
};

let THB_TO_USD = 0.028; // fallback rate, updated periodically

async function updateFxRate() {
  try {
    const res = await axios.get('https://api.exchangerate-api.com/v4/latest/THB', { timeout: 5000 });
    THB_TO_USD = res.data.rates.USD || THB_TO_USD;
  } catch (e) {
    // use fallback
  }
}

function connectBitkub(symbols, onUpdate) {
  let running = true;
  let timeout;
  let fxInterval;

  // Update FX rate every 5 minutes
  updateFxRate();
  fxInterval = setInterval(updateFxRate, 5 * 60 * 1000);

  async function poll() {
    try {
      const res = await axios.get('https://api.bitkub.com/api/market/ticker', {
        timeout: 5000
      });
      const data = res.data;

      symbols.forEach(symbol => {
        const key = SYMBOL_MAP[symbol];
        const ticker = data[key];
        if (ticker) {
          // Convert THB prices to USD
          const bid = parseFloat(ticker.highestBid) * THB_TO_USD;
          const ask = parseFloat(ticker.lowestAsk) * THB_TO_USD;
          if (!isNaN(bid) && !isNaN(ask) && bid > 0 && ask > 0) {
            updatePrice('bitkub', symbol, bid, ask);
            onUpdate('bitkub', symbol);
          }
        }
      });
    } catch (e) {
      console.error('[Bitkub] Poll error:', e.message);
    }

    if (running) {
      timeout = setTimeout(poll, 3000);
    }
  }

  poll();
  console.log('[Bitkub] Polling started');

  return {
    close: () => {
      running = false;
      clearTimeout(timeout);
      clearInterval(fxInterval);
    }
  };
}

module.exports = { connectBitkub };
