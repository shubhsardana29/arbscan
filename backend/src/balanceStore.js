const { STARTING_BALANCES } = require('./config');

// In-memory balance store initialized with starter config
const balances = JSON.parse(JSON.stringify(STARTING_BALANCES));

// Auto-reset balances every 5 minutes to prevent permanent depletion
const RESET_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
    const fresh = JSON.parse(JSON.stringify(STARTING_BALANCES));
    Object.keys(fresh).forEach(exchange => {
        Object.keys(fresh[exchange]).forEach(asset => {
            balances[exchange][asset] = fresh[exchange][asset];
        });
    });
    console.log('[Balances] Auto-reset to starting values');
}, RESET_INTERVAL_MS);

function getBalance(exchange, asset) {
    if (!balances[exchange]) return 0;
    return balances[exchange][asset] || 0;
}

function getAllBalances() {
    return balances;
}

/**
 * Validates if the exchange has enough of the given asset.
 */
function hasSufficientBalance(exchange, asset, amount) {
    const current = getBalance(exchange, asset);
    return current >= amount;
}

/**
 * Deducts `amount` from the `asset` balance on `exchange`.
 */
function debitBalance(exchange, asset, amount) {
    if (!balances[exchange]) balances[exchange] = {};
    if (!balances[exchange][asset]) balances[exchange][asset] = 0;

    if (balances[exchange][asset] < amount) {
        throw new Error(`Insufficient balance: ${exchange} ${asset}. Have ${balances[exchange][asset]}, need ${amount}`);
    }

    balances[exchange][asset] -= amount;
    return balances[exchange][asset];
}

/**
 * Adds `amount` to the `asset` balance on `exchange`.
 */
function creditBalance(exchange, asset, amount) {
    if (!balances[exchange]) balances[exchange] = {};
    if (!balances[exchange][asset]) balances[exchange][asset] = 0;

    balances[exchange][asset] += amount;
    return balances[exchange][asset];
}

module.exports = {
    getBalance,
    getAllBalances,
    hasSufficientBalance,
    debitBalance,
    creditBalance
};
