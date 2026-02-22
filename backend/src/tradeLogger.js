const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../data');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const tradeLogPath = path.join(logDir, 'trades.jsonl');

function logTrade(opp) {
    const logLine = JSON.stringify({
        timestamp: new Date().toISOString(),
        id: opp.id,
        status: opp.status,
        symbol: opp.symbol,
        buyOn: opp.buyOn,
        sellOn: opp.sellOn,
        buyPrice: opp.buyPrice,
        sellPrice: opp.sellPrice,
        executedAmount: opp.executedAmount || 0,
        grossSpread: opp.grossSpread,
        finalSpread: opp.finalSpread || opp.grossSpread,
        executedPnl: opp.executedPnl || 0
    }) + '\n';

    fs.appendFile(tradeLogPath, logLine, (err) => {
        if (err) console.error('[Logger] Failed to write trade:', err);
    });
}

module.exports = { logTrade };
