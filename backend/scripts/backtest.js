const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function runBacktest() {
    const logPath = path.join(__dirname, '../data/trades.jsonl');

    if (!fs.existsSync(logPath)) {
        console.error(`[Error] No trades found at ${logPath}. Let the simulator run for a bit first!`);
        return null;
    }

    let totalTrades = 0;
    let executed = 0;
    let failedSlippage = 0;
    let failedBalance = 0;

    let totalNetProfit = 0;
    let totalVolume = 0;
    let bestTrade = -Infinity;
    let worstTrade = Infinity;

    const profits = [];
    const hourlyDistribution = new Array(24).fill(0);
    const pairStats = {};
    const exchangeStats = {};

    const rl = readline.createInterface({
        input: fs.createReadStream(logPath),
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (!line.trim()) continue;

        try {
            const trade = JSON.parse(line);
            totalTrades++;

            // Tracking hourly distribution
            if (trade.timestamp) {
                const hour = new Date(trade.timestamp).getHours();
                hourlyDistribution[hour]++;
            }

            // Route stats initialization (before status check)
            const route = `${trade.buyOn} → ${trade.sellOn}`;
            if (!exchangeStats[route]) exchangeStats[route] = { count: 0, executed: 0, profit: 0 };
            exchangeStats[route].count++;

            if (!pairStats[trade.symbol]) pairStats[trade.symbol] = { count: 0, executed: 0, profit: 0 };
            pairStats[trade.symbol].count++;

            if (trade.status === 'EXECUTED') {
                executed++;
                const pnl = trade.executedPnl || 0;
                totalNetProfit += pnl;
                totalVolume += trade.executedAmount || 0;
                profits.push(pnl);

                if (pnl > bestTrade) bestTrade = pnl;
                if (pnl < worstTrade) worstTrade = pnl;

                // Pair stats
                pairStats[trade.symbol].executed++;
                pairStats[trade.symbol].profit += pnl;

                // Exchange strategy
                exchangeStats[route].executed++;
                exchangeStats[route].profit += pnl;

            } else if (trade.status === 'FAILED_SLIPPAGE') {
                failedSlippage++;
            } else if (trade.status === 'FAILED_BALANCE') {
                failedBalance++;
            }
        } catch (e) {
            // ignore parse errors
        }
    }

    // Advanced Metrics Calculation
    let maxDrawdown = 0;
    let peak = 0;
    let currentPnl = 0;
    profits.forEach(p => {
        currentPnl += p;
        if (currentPnl > peak) peak = currentPnl;
        const dd = peak - currentPnl;
        if (dd > maxDrawdown) maxDrawdown = dd;
    });

    const avgProfit = executed > 0 ? totalNetProfit / executed : 0;
    const stdDev = executed > 1
        ? Math.sqrt(profits.reduce((sq, p) => sq + Math.pow(p - avgProfit, 2), 0) / executed)
        : 0;
    const sharpe = stdDev > 0 ? (avgProfit / stdDev) : 0;

    return {
        overview: {
            totalTrades,
            executed,
            failedSlippage,
            failedBalance,
            successRate: totalTrades > 0 ? (executed / totalTrades) * 100 : 0
        },
        financials: {
            totalVolume,
            totalNetProfit,
            roi: totalVolume > 0 ? (totalNetProfit / totalVolume) * 100 : 0,
            avgProfit,
            bestTrade: bestTrade === -Infinity ? 0 : bestTrade,
            worstTrade: worstTrade === Infinity ? 0 : worstTrade
        },
        risk: {
            maxDrawdown,
            sharpeRatio: sharpe,
            profitVolatility: stdDev
        },
        distribution: {
            hourly: hourlyDistribution
        },
        topRoutes: Object.entries(exchangeStats)
            .map(([route, stat]) => ({
                route,
                ...stat,
                hitRate: (stat.executed / stat.count) * 100
            }))
            .sort((a, b) => b.profit - a.profit),
        topPairs: Object.entries(pairStats)
            .map(([symbol, stat]) => ({
                symbol,
                ...stat,
                hitRate: (stat.executed / stat.count) * 100
            }))
            .sort((a, b) => b.profit - a.profit),
    };
}

async function runCli() {
    const report = await runBacktest();
    if (!report) return;

    console.log('\n=============================================');
    console.log('--- 📊 HISTORICAL BACKTEST REPORT ---');
    console.log('=============================================\n');

    console.log(`Total Opportunities Detected: ${report.overview.totalTrades}`);
    console.log(`✅ Executed Successfully:    ${report.overview.executed} (${report.overview.successRate.toFixed(1)}%)`);
    console.log(`❌ Failed (Slippage):        ${report.overview.failedSlippage}`);
    console.log(`❌ Failed (Low Balance):     ${report.overview.failedBalance}`);

    console.log('\n--- 💰 FINANCIAL PERFORMANCE ---');
    console.log(`Total Traded Volume:         $${report.financials.totalVolume.toFixed(2)}`);
    console.log(`Net Profit (After Fees):     $${report.financials.totalNetProfit.toFixed(2)}`);
    console.log(`Net ROI on Volume:           ${report.financials.roi.toFixed(4)}%`);
    console.log(`Avg Profit per Trade:        $${report.financials.avgProfit.toFixed(4)}`);
    console.log(`Best / Worst Trade:          +$${report.financials.bestTrade.toFixed(2)} / -$${Math.abs(report.financials.worstTrade).toFixed(2)}`);

    console.log('\n--- 🛡️ RISK METRICS ---');
    console.log(`Maximum Drawdown:            $${report.risk.maxDrawdown.toFixed(2)}`);
    console.log(`Sharpe Ratio (Proxy):        ${report.risk.sharpeRatio.toFixed(2)}`);
    console.log(`P&L Volatility:             ${report.risk.profitVolatility.toFixed(4)}`);

    console.log('\n--- 🚀 TOP PERFORMING ROUTES (by P&L) ---');
    console.log(`${'ROUTE'.padEnd(25)} | ${'HIT %'.padEnd(6)} | ${'TRADES'.padEnd(6)} | ${'P&L'.padEnd(8)}`);
    console.log('-'.repeat(55));
    for (const stat of report.topRoutes.slice(0, 10)) {
        console.log(`${stat.route.padEnd(25)} | ${stat.hitRate.toFixed(0).padEnd(5)}% | ${stat.executed.toString().padEnd(6)} | $${stat.profit.toFixed(2)}`);
    }

    console.log('\n--- 📈 BY SYMBOL ---');
    for (const stat of report.topPairs.slice(0, 10)) {
        console.log(`${stat.symbol.padEnd(10)} | Hit Rate: ${stat.hitRate.toFixed(0).padEnd(3)}% | Trades: ${stat.executed.toString().padEnd(4)} | P&L: $${stat.profit.toFixed(2)}`);
    }
    console.log('\n');
}

if (require.main === module) {
    runCli();
}

module.exports = { runBacktest };
