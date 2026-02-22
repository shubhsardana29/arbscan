// Trading fees per exchange (maker and taker fee %)
const FEES = {
  binance: { maker: 0.1, taker: 0.1 },
  coindcx: { maker: 0.2, taker: 0.2 },
  bitkub: { maker: 0.25, taker: 0.25 },
  okx: { maker: 0.08, taker: 0.1 },
  kraken: { maker: 0.16, taker: 0.26 }
};

// Symbols to track — normalized format
const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];

// Minimum net profit % to flag as opportunity (after all fees).
// Combined fees: Binance 0.1% + CoinDCX 0.2% + Bitkub 0.25% — need margin above that.
// 0.3% filters noise while still catching real micro-arb.
const MIN_PROFIT_THRESHOLD = 0.02;

// Per-route cooldown: once a route fires, block the same buyEx→sellEx+symbol for this long.
// Prevents hammering the same opportunity hundreds of times per second.
const ROUTE_COOLDOWN_MS = 30 * 1000; // 30 seconds

// Starting virtual balances per exchange
const STARTING_BALANCES = {
  binance: { USDT: 5000, BTC: 0.5, ETH: 5, BNB: 50 },
  coindcx: { USDT: 5000, BTC: 0.5, ETH: 5, BNB: 50 },
  bitkub: { USDT: 5000, BTC: 0.5, ETH: 5, BNB: 50 },
  okx: { USDT: 5000, BTC: 0.5, ETH: 5, BNB: 50 },
  kraken: { USDT: 5000, BTC: 0.5, ETH: 5, BNB: 50 }
};

module.exports = { FEES, SYMBOLS, MIN_PROFIT_THRESHOLD, ROUTE_COOLDOWN_MS, SIMULATION_CAPITAL: 1000, STARTING_BALANCES };
