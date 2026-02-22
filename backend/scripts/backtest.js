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

            if (trade.status === 'EXECUTED') {
                executed++;
                totalNetProfit += trade.executedPnl;
                totalVolume += trade.executedAmount;

                // Pair stats
                if (!pairStats[trade.symbol]) pairStats[trade.symbol] = { count: 0, profit: 0 };
                pairStats[trade.symbol].count++;
                pairStats[trade.symbol].profit += trade.executedPnl;

                // Exchange strategy
                const route = `${trade.buyOn} → ${trade.sellOn}`;
                if (!exchangeStats[route]) exchangeStats[route] = { count: 0, profit: 0 };
                exchangeStats[route].count++;
                exchangeStats[route].profit += trade.executedPnl;

            } else if (trade.status === 'FAILED_SLIPPAGE') {
                failedSlippage++;
            } else if (trade.status === 'FAILED_BALANCE') {
                failedBalance++;
            }
        } catch (e) {
            // ignore parse errors
        }
    }

    return {
        overview: {
            totalTrades,
            executed,
            failedSlippage,
            failedBalance,
        },
        financials: {
            totalVolume,
            totalNetProfit,
            roi: totalVolume > 0 ? (totalNetProfit / totalVolume) * 100 : 0
        },
        topRoutes: Object.entries(exchangeStats)
            .map(([route, stat]) => ({ route, ...stat }))
            .sort((a, b) => b.profit - a.profit),
        topPairs: Object.entries(pairStats)
            .map(([symbol, stat]) => ({ symbol, ...stat }))
            .sort((a, b) => b.profit - a.profit),
    };
}

async function runCli() {
    const report = await runBacktest();
    if (!report) return;

    console.log('--- 📊 HISTORICAL BACKTEST REPORT ---');
    console.log(`Analyzing: trades.jsonl\n`);

    console.log(`Total Opportunities Detected: ${report.overview.totalTrades}`);
    console.log(`✅ Executed Successfully:    ${report.overview.executed} (${((report.overview.executed / report.overview.totalTrades) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed (Slippage):        ${report.overview.failedSlippage} (${((report.overview.failedSlippage / report.overview.totalTrades) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed (Low Balance):     ${report.overview.failedBalance} (${((report.overview.failedBalance / report.overview.totalTrades) * 100).toFixed(1)}%)`);

    console.log('\n--- FINANCIALS ---');
    console.log(`Total Traded Volume:         $${report.financials.totalVolume.toFixed(2)}`);
    console.log(`Net Profit (After Fees):     $${report.financials.totalNetProfit.toFixed(2)}`);
    console.log(`Net ROI on Volume:           ${report.financials.roi.toFixed(4)}%`);

    console.log('\n--- TOP PERFORMING ROUTES ---');
    for (const stat of report.topRoutes) {
        console.log(`${stat.route.padEnd(20)} | Trades: ${stat.count.toString().padEnd(4)} | P&L: $${stat.profit.toFixed(2)}`);
    }

    console.log('\n--- BY SYMBOL ---');
    for (const stat of report.topPairs) {
        console.log(`${stat.symbol.padEnd(10)} | Trades: ${stat.count.toString().padEnd(4)} | P&L: $${stat.profit.toFixed(2)}`);
    }
}

if (require.main === module) {
    runCli();
}

module.exports = { runBacktest };
