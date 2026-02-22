/**
 * CoinDCX — REST polling for ticker + real L2 order book depth
 *
 * Ticker:    https://api.coindcx.com/exchange/ticker  (poll every 2s)
 * Orderbook: https://public.coindcx.com/market_data/orderbook?pair=B-BTC_USDT  (poll every 3s)
 *
 * USDT pairs (BTCUSDT, ETHUSDT, BNBUSDT) are priced in USD — NO INR conversion needed.
 * Bids/asks returned as { "price_str": "qty_str" } objects → converted to [{price, qty}] arrays.
 */
const axios = require('axios');
const { updatePrice } = require('../priceStore');

// Ticker market keys (for /exchange/ticker)
const TICKER_MAP = {
  'BTC/USDT': 'BTCUSDT',
  'ETH/USDT': 'ETHUSDT',
  'BNB/USDT': 'BNBUSDT',
};

// Order book pair keys (for /market_data/orderbook?pair=...)
const ORDERBOOK_MAP = {
  'BTC/USDT': 'B-BTC_USDT',
  'ETH/USDT': 'B-ETH_USDT',
  'BNB/USDT': 'B-BNB_USDT',
};

/**
 * Convert CoinDCX orderbook object format { "price": "qty", ... }
 * into the standard [{price, qty}] array format used by priceStore.
 * Sorted bids descending, asks ascending.
 */
function parseOrderBookSide(obj, descending = false) {
  return Object.entries(obj)
    .map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) }))
    .filter(({ price, qty }) => price > 0 && qty > 0)
    .sort((a, b) => descending ? b.price - a.price : a.price - b.price)
    .slice(0, 20); // keep top 20 levels — enough for realistic slippage sim
}

function connectCoinDCX(symbols, onUpdate) {
  let running = true;
  let tickerTimeout;
  let bookTimeout;

  // Per-symbol depth cache — starts with fallback mock until first real book arrives
  const depthCache = {};
  symbols.forEach(sym => {
    depthCache[sym] = { bids: null, asks: null };
  });

  // ─── Ticker poll (price signal + triggers arbitrage engine) ──────────────
  async function pollTicker() {
    try {
      const res = await axios.get('https://api.coindcx.com/exchange/ticker', { timeout: 5000 });
      const tickers = res.data;

      symbols.forEach(symbol => {
        const ticker = tickers.find(t => t.market === TICKER_MAP[symbol]);
        if (!ticker) return;

        const mid = parseFloat(ticker.last_price);
        if (isNaN(mid) || mid <= 0) return;

        const cached = depthCache[symbol];

        // If real depth is available, use it; otherwise synthesise ±1 level from ticker
        const bids = cached.bids || [{ price: mid * 0.9995, qty: 999999 }];
        const asks = cached.asks || [{ price: mid * 1.0005, qty: 999999 }];

        updatePrice('coindcx', symbol, bids, asks);
        onUpdate('coindcx', symbol);
      });
    } catch (e) {
      console.error('[CoinDCX] Ticker poll error:', e.message);
    }

    if (running) tickerTimeout = setTimeout(pollTicker, 2000);
  }

  // ─── Order book poll (real L2 depth, staggered from ticker) ─────────────
  async function pollOrderBooks() {
    for (const symbol of symbols) {
      if (!running) break;
      const pair = ORDERBOOK_MAP[symbol];
      try {
        const res = await axios.get(
          `https://public.coindcx.com/market_data/orderbook?pair=${pair}`,
          { timeout: 5000 }
        );
        const { bids, asks } = res.data;
        if (bids && asks) {
          depthCache[symbol].bids = parseOrderBookSide(bids, true);   // descending
          depthCache[symbol].asks = parseOrderBookSide(asks, false);  // ascending
        }
      } catch (e) {
        // Non-fatal — ticker will use mock fallback
        console.warn(`[CoinDCX] Orderbook fetch failed for ${symbol}: ${e.message}`);
      }
      // Small gap between requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    if (running) bookTimeout = setTimeout(pollOrderBooks, 3000);
  }

  pollTicker();
  pollOrderBooks();
  console.log('[CoinDCX] Polling started (ticker: 2s, orderbook: 3s with real L2 depth)');

  return {
    close: () => {
      running = false;
      clearTimeout(tickerTimeout);
      clearTimeout(bookTimeout);
    }
  };
}

module.exports = { connectCoinDCX };
