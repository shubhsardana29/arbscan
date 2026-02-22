const WebSocket = require('ws');
const { updatePrice } = require('../priceStore');

const SYMBOL_MAP = {
    'BTC/USDT': 'XBT/USDT',
    'ETH/USDT': 'ETH/USDT',
    'BNB/USDT': 'BNB/USDT'
};

function connectKraken(symbols, onUpdate) {
    const ws = new WebSocket('wss://ws.kraken.com');

    ws.on('open', () => {
        console.log('[Kraken] WebSocket connected');
        ws.send(JSON.stringify({
            event: 'subscribe',
            pair: symbols.map(s => SYMBOL_MAP[s]),
            subscription: { name: 'book', depth: 10 }
        }));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data);

        // Handle system events
        if (msg.event === 'subscriptionStatus') {
            if (msg.status === 'subscribed') {
                console.log(`[Kraken] Subscribed to ${msg.pair}`);
            } else if (msg.status === 'error') {
                console.error(`[Kraken] Subscription error for ${msg.pair}:`, msg.errorMessage);
            }
            return;
        }
        if (msg.event) return;

        // Handle data messages: [channelID, payload, (payload?), channelName, pair]
        if (Array.isArray(msg) && msg.length >= 4) {
            const krakenSymbol = msg[msg.length - 1]; // Pair is the last element
            const normalizedSymbol = Object.keys(SYMBOL_MAP).find(k => SYMBOL_MAP[k] === krakenSymbol);
            if (!normalizedSymbol) return;

            let bids = null, asks = null;

            // Kraken can send 1 or 2 payload objects in updates
            for (let i = 1; i < msg.length - 2; i++) {
                const payload = msg[i];
                if (payload.as) asks = payload.as.map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));
                if (payload.bs) bids = payload.bs.map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));
                if (payload.a) asks = payload.a.map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));
                if (payload.b) bids = payload.b.map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));
            }

            if (bids || asks) {
                updatePrice('kraken', normalizedSymbol, bids, asks);
                onUpdate('kraken', normalizedSymbol);
            }
        }
    });

    ws.on('error', (err) => console.error('[Kraken] WebSocket error:', err.message));
    ws.on('close', () => console.log('[Kraken] WebSocket closed'));

    return ws;
}

module.exports = { connectKraken };
