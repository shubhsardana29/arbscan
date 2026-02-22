const { FEES, MIN_PROFIT_THRESHOLD, SIMULATION_CAPITAL } = require('./config');
const { getBalance, checkSufficientBalance, debitBalance, creditBalance } = require('./balanceStore');
const EventEmitter = require('events');

const engineEvents = new EventEmitter();
const pendingQueue = [];
const EXECUTION_LATENCY_MS = 100;

setInterval(() => {
  const now = Date.now();
  for (let i = pendingQueue.length - 1; i >= 0; i--) {
    const trade = pendingQueue[i];
    if (now >= trade.executeAt) {
      pendingQueue.splice(i, 1);
      processExecution(trade);
    }
  }
}, 10);

function processExecution(opp) {
  // Re-evaluate against the EXACT moment's order book
  const currentPrices = require('./priceStore').getPrice(opp.symbol);
  if (!currentPrices[opp.buyOn] || !currentPrices[opp.sellOn]) return;

  const buyAsks = currentPrices[opp.buyOn].asks;
  const sellBids = currentPrices[opp.sellOn].bids;
  if (!buyAsks || !sellBids) return;

  const [baseCoin, quoteCoin] = opp.symbol.split('/');

  const availableUSDT = getBalance(opp.buyOn, quoteCoin);
  const availableCrypto = getBalance(opp.sellOn, baseCoin);

  let tradeCapital = Math.min(SIMULATION_CAPITAL, availableUSDT);
  if (tradeCapital <= 10) return;

  const buyResult = simulateBuyMarketOrder(buyAsks, tradeCapital);
  if (!buyResult) return;

  let cryptoToSell = Math.min(buyResult.coinsObtained, availableCrypto);
  if (cryptoToSell <= 0.0001) return;

  const sellResult = simulateSellMarketOrder(sellBids, cryptoToSell);
  if (!sellResult) return;

  const buyPrice = buyResult.avgPrice;
  const sellPrice = sellResult.avgPrice;

  const grossSpread = ((sellPrice - buyPrice) / buyPrice) * 100;
  const feeCost = FEES[opp.buyOn].taker + FEES[opp.sellOn].taker;
  const netProfit = grossSpread - feeCost;

  if (netProfit >= MIN_PROFIT_THRESHOLD) {
    const capitalSpent = buyResult.capitalSpent;
    const grossRevenue = sellResult.capitalRecovered;
    const buyFee = capitalSpent * (FEES[opp.buyOn].taker / 100);
    const sellFee = grossRevenue * (FEES[opp.sellOn].taker / 100);
    const actualNetProfit = grossRevenue - capitalSpent - buyFee - sellFee;

    // Deduct and credit balances
    try {
      debitBalance(opp.buyOn, quoteCoin, capitalSpent + buyFee);
      creditBalance(opp.buyOn, baseCoin, buyResult.coinsObtained);

      debitBalance(opp.sellOn, baseCoin, cryptoToSell);
      creditBalance(opp.sellOn, quoteCoin, grossRevenue - sellFee);

      opp.status = 'EXECUTED';
      opp.executedPnl = actualNetProfit;
      opp.finalSpread = netProfit;
      opp.executedAmount = capitalSpent;
      engineEvents.emit('trade_executed', opp);
    } catch (e) {
      // Balance error
      opp.status = 'FAILED_BALANCE';
      engineEvents.emit('trade_failed', opp);
    }
  } else {
    opp.status = 'FAILED_SLIPPAGE';
    engineEvents.emit('trade_failed', opp);
  }
}

// simulatePnL merged into detectArbitrage inline

function simulateBuyMarketOrder(asks, maxCapitalStr) {
  let maxCapital = parseFloat(maxCapitalStr) || 0;
  if (maxCapital <= 0) return null;

  let remainingCapital = maxCapital;
  let coinsBought = 0;

  // Asks should be sorted ascending by price
  const sortedAsks = [...asks].sort((a, b) => a.price - b.price);

  for (const level of sortedAsks) {
    if (remainingCapital <= 0) break;
    const levelCost = level.price * level.qty;

    // We can fulfill this entire level
    if (remainingCapital >= levelCost) {
      coinsBought += level.qty;
      remainingCapital -= levelCost;
    } else {
      // Partial fill at this level
      const qtyToBuy = remainingCapital / level.price;
      coinsBought += qtyToBuy;
      remainingCapital = 0;
    }
  }

  // If we couldn't buy anything (extreme lack of liquidity)
  if (coinsBought === 0) return null;

  const actualCapitalSpent = maxCapital - remainingCapital;
  const avgExecutionPrice = actualCapitalSpent / coinsBought;

  return {
    capitalSpent: actualCapitalSpent,
    coinsObtained: coinsBought,
    avgPrice: avgExecutionPrice
  };
}

function simulateSellMarketOrder(bids, maxCoinsStr) {
  let maxCoins = parseFloat(maxCoinsStr) || 0;
  if (maxCoins <= 0) return null;

  let remainingCoins = maxCoins;
  let capitalGained = 0;

  // Bids should be sorted descending by price
  const sortedBids = [...bids].sort((a, b) => b.price - a.price);

  for (const level of sortedBids) {
    if (remainingCoins <= 0) break;

    if (remainingCoins >= level.qty) {
      capitalGained += level.qty * level.price;
      remainingCoins -= level.qty;
    } else {
      capitalGained += remainingCoins * level.price;
      remainingCoins = 0;
    }
  }

  if (remainingCoins === maxCoins) return null;

  const actualCoinsSold = maxCoins - remainingCoins;
  const avgSellPrice = capitalGained / actualCoinsSold;

  return {
    capitalRecovered: capitalGained,
    coinsSold: actualCoinsSold,
    avgPrice: avgSellPrice
  };
}

function detectArbitrage(symbol) {
  const prices = require('./priceStore').getPrice(symbol);
  const exchanges = Object.keys(prices);
  const opportunities = [];

  if (exchanges.length < 2) return opportunities;

  const [baseCoin, quoteCoin] = symbol.split('/');

  for (const buyEx of exchanges) {
    for (const sellEx of exchanges) {
      if (buyEx === sellEx) continue;

      const buyData = prices[buyEx];
      const sellData = prices[sellEx];

      if (!buyData || !sellData) continue;

      // Data staleness check — ignore if older than 30s
      const now = Date.now();
      if (now - buyData.ts > 30000 || now - sellData.ts > 30000) continue;

      if (!buyData.asks || !sellData.bids || buyData.asks.length === 0 || sellData.bids.length === 0) continue;

      // 1. Check balances
      const availableUSDT = getBalance(buyEx, quoteCoin);
      const availableCrypto = getBalance(sellEx, baseCoin);

      // We cap the trade at SIMULATION_CAPITAL, or whatever USDT we actually have
      let tradeCapital = Math.min(SIMULATION_CAPITAL, availableUSDT);
      if (tradeCapital <= 10) continue; // too small to trade

      // 2. Simulate Buy (IOC)
      const buyResult = simulateBuyMarketOrder(buyData.asks, tradeCapital);
      if (!buyResult) continue;

      // We can only sell as much crypto as we just bought, capped by what we ACTUALLY hold on the sell exchange 
      // (to simulate simultaneous execution without transfers)
      let cryptoToSell = Math.min(buyResult.coinsObtained, availableCrypto);
      if (cryptoToSell <= 0.0001) continue;

      // 3. Simulate Sell (IOC)
      const sellResult = simulateSellMarketOrder(sellData.bids, cryptoToSell);
      if (!sellResult) continue;

      const buyPrice = buyResult.avgPrice;
      const sellPrice = sellResult.avgPrice;

      // PNL Math
      // We evaluate the gross spread using the effective execution prices
      const grossSpread = ((sellPrice - buyPrice) / buyPrice) * 100;
      const feeCost = FEES[buyEx].taker + FEES[sellEx].taker;
      const netProfit = grossSpread - feeCost;

      if (netProfit >= MIN_PROFIT_THRESHOLD) {

        // Calculate exact P&L on this specific volume
        const capitalSpent = buyResult.capitalSpent;
        const grossRevenue = sellResult.capitalRecovered;
        const buyFee = capitalSpent * (FEES[buyEx].taker / 100);
        const sellFee = grossRevenue * (FEES[sellEx].taker / 100);
        const actualNetProfit = grossRevenue - capitalSpent - buyFee - sellFee;

        const pnl = {
          capital: parseFloat(capitalSpent.toFixed(4)),
          grossRevenue: parseFloat(grossRevenue.toFixed(4)),
          totalFees: parseFloat((buyFee + sellFee).toFixed(4)),
          netProfit: parseFloat(actualNetProfit.toFixed(4)),
          roi: parseFloat(((actualNetProfit / capitalSpent) * 100).toFixed(4))
        };

        const opp = {
          id: `${Date.now()}-${buyEx}-${sellEx}-${symbol}`,
          symbol,
          buyOn: buyEx,
          sellOn: sellEx,
          buyPrice: parseFloat(buyPrice.toFixed(4)),
          sellPrice: parseFloat(sellPrice.toFixed(4)),
          executedAmount: parseFloat(pnl.capital.toFixed(4)),
          grossSpread: parseFloat(grossSpread.toFixed(4)),
          feeCost: parseFloat(feeCost.toFixed(4)),
          netProfit: parseFloat(netProfit.toFixed(4)),
          pnl,
          timestamp: Date.now(),
          executeAt: Date.now() + EXECUTION_LATENCY_MS,
          status: 'DETECTED'
        };

        opportunities.push(opp);
        // Only push to execution queue if we haven't just queued the identical arb
        const isQueued = pendingQueue.some(q => q.buyOn === buyEx && q.sellOn === sellEx && q.symbol === symbol);
        if (!isQueued) pendingQueue.push(opp);
      }
    }
  }

  return opportunities;
}

// simulatePnL is now deprecated since pnl is calculated inline per matched volume

module.exports = { detectArbitrage, engineEvents };
