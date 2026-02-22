const { getPrice } = require('./priceStore');
const { FEES, MIN_PROFIT_THRESHOLD, SIMULATION_CAPITAL } = require('./config');

function simulatePnL(buyExchange, sellExchange, buyPrice, sellPrice) {
  const capital = SIMULATION_CAPITAL;
  const coinsBought = capital / buyPrice;
  const grossRevenue = coinsBought * sellPrice;
  const buyFee = capital * (FEES[buyExchange] / 100);
  const sellFee = grossRevenue * (FEES[sellExchange] / 100);
  const netProfit = grossRevenue - capital - buyFee - sellFee;

  return {
    capital,
    grossRevenue: parseFloat(grossRevenue.toFixed(4)),
    totalFees: parseFloat((buyFee + sellFee).toFixed(4)),
    netProfit: parseFloat(netProfit.toFixed(4)),
    roi: parseFloat(((netProfit / capital) * 100).toFixed(4))
  };
}

function detectArbitrage(symbol) {
  const prices = getPrice(symbol);
  const exchanges = Object.keys(prices);
  const opportunities = [];

  if (exchanges.length < 2) return opportunities;

  for (const buyEx of exchanges) {
    for (const sellEx of exchanges) {
      if (buyEx === sellEx) continue;

      const buyData = prices[buyEx];
      const sellData = prices[sellEx];

      if (!buyData || !sellData) continue;

      // Data staleness check — ignore if older than 30s
      const now = Date.now();
      if (now - buyData.ts > 30000 || now - sellData.ts > 30000) continue;

      const buyPrice = buyData.ask;  // we buy at the ask
      const sellPrice = sellData.bid; // we sell at the bid

      if (buyPrice <= 0 || sellPrice <= 0) continue;

      const grossSpread = ((sellPrice - buyPrice) / buyPrice) * 100;
      const feeCost = FEES[buyEx] + FEES[sellEx];
      const netProfit = grossSpread - feeCost;

      if (netProfit >= MIN_PROFIT_THRESHOLD) {
        const pnl = simulatePnL(buyEx, sellEx, buyPrice, sellPrice);
        opportunities.push({
          id: `${Date.now()}-${buyEx}-${sellEx}-${symbol}`,
          symbol,
          buyOn: buyEx,
          sellOn: sellEx,
          buyPrice,
          sellPrice,
          grossSpread: parseFloat(grossSpread.toFixed(4)),
          feeCost: parseFloat(feeCost.toFixed(4)),
          netProfit: parseFloat(netProfit.toFixed(4)),
          pnl,
          timestamp: Date.now()
        });
      }
    }
  }

  return opportunities;
}

module.exports = { detectArbitrage };
