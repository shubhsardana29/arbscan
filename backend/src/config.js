// Trading fees per exchange (taker fee %)
const FEES = {
  binance: 0.1,
  coindcx: 0.2,
  bitkub: 0.25
};

// Symbols to track — normalized format
const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];

// Minimum net profit % to flag as opportunity
const MIN_PROFIT_THRESHOLD = 0.05;

// Capital to simulate P&L with (USDT)
const SIMULATION_CAPITAL = 1000;

module.exports = { FEES, SYMBOLS, MIN_PROFIT_THRESHOLD, SIMULATION_CAPITAL };
