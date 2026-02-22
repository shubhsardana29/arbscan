const WebSocket = require('ws');
const { updatePrice } = require('../priceStore');

const SYMBOL_MAP = {
    'BTC/USDT': 'BTC/USDT',
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
        if (msg.event) return; // heartbeats, systemStatus, subscriptionStatus

        if (Array.isArray(msg) && msg[msg.length - 1] === 'book-10') {
            const krakenSymbol = msg[msg.length - 2];
            const normalizedSymbol = Object.keys(SYMBOL_MAP).find(k => SYMBOL_MAP[k] === krakenSymbol);
            if (!normalizedSymbol) return;

            const payload = msg[1];
            if (payload.b || payload.a) {
                // Kraken sends snapshots followed by diffs.
                // For simplicity in this L2 connector, we treat b/a as top of book levels if sent
                const bids = payload.b ? payload.b.map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) })) : null;
                const asks = payload.a ? payload.a.map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) })) : null;

                if (bids || asks) {
                    updatePrice('kraken', normalizedSymbol, bids, asks);
                    onUpdate('kraken', normalizedSymbol);
                }
            } else if (payload.as || payload.bs) {
                // Snapshot
                const bids = payload.bs.map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));
                const asks = payload.as.map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));
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
