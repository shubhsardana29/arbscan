// Trading fees per exchange (maker and taker fee %)
const FEES = {
  binance: { maker: 0.1, taker: 0.1 },
  coindcx: { maker: 0.2, taker: 0.2 },
  bitkub: { maker: 0.25, taker: 0.25 }
};

// Symbols to track — normalized format
const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];

// Minimum net profit % to flag as opportunity
const MIN_PROFIT_THRESHOLD = 0.05;

// Starting virtual balances per exchange
const STARTING_BALANCES = {
  binance: { USDT: 5000, BTC: 0.5, ETH: 5, BNB: 50 },
  coindcx: { USDT: 5000, BTC: 0.5, ETH: 5, BNB: 50 },
  bitkub: { USDT: 5000, BTC: 0.5, ETH: 5, BNB: 50 }
};

module.exports = { FEES, SYMBOLS, MIN_PROFIT_THRESHOLD, SIMULATION_CAPITAL: 1000, STARTING_BALANCES };
