/**
 * FX Rate Store — Centralized live currency conversion
 *
 * Polls exchangerate-api.com every 30 seconds for USD-pegged rates.
 * All exchange connectors read from here to get the freshest rate
 * at the EXACT moment a price tick arrives.
 */
const axios = require('axios');
const EventEmitter = require('events');

const fxEvents = new EventEmitter();

// Fallback rates in case the fetch fails on startup
const rates = {
    THB: 0.0283,   // Thai Baht → USD
    INR: 0.01195,  // Indian Rupee → USD
    updatedAt: null,
    source: 'fallback'
};

async function refreshRates() {
    try {
        const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
            timeout: 6000
        });
        const data = res.data.rates;

        // rates are USD-to-X, so invert to get X-to-USD
        if (data.THB && data.THB > 0) rates.THB = 1 / data.THB;
        if (data.INR && data.INR > 0) rates.INR = 1 / data.INR;

        rates.updatedAt = new Date().toISOString();
        rates.source = 'live';

        console.log(`[FX] Updated — 1 THB = $${rates.THB.toFixed(5)} | 1 INR = $${rates.INR.toFixed(6)}`);
        fxEvents.emit('update', getRates());
    } catch (e) {
        console.warn('[FX] Rate refresh failed, using last known values:', e.message);
    }
}

/**
 * Get the latest conversion rate for a given fiat currency to USD.
 * @param {string} currency - e.g. 'THB', 'INR'
 * @returns {number} - USD per 1 unit of currency
 */
function getRate(currency) {
    return rates[currency] || 1;
}

function getRates() {
    return {
        THB: rates.THB,
        INR: rates.INR,
        updatedAt: rates.updatedAt,
        source: rates.source
    };
}

function startFxStore() {
    // Immediately fetch on startup
    refreshRates();
    // Then refresh every 30 seconds
    const interval = setInterval(refreshRates, 30 * 1000);
    return () => clearInterval(interval);
}

module.exports = { startFxStore, getRate, getRates, fxEvents };
