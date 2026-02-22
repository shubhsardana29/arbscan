const WebSocket = require('ws');
const { updatePrice } = require('../priceStore');

const SYMBOL_MAP = {
    'BTC/USDT': 'XBT/USDT',
    'ETH/USDT': 'ETH/USDT',
    'BNB/USDT': 'BNB/USDT'
};

function connectKraken(symbols, onUpdate) {
    const ws = new WebSocket('wss://ws.kraken.com');
    const localBooks = {};
    symbols.forEach(s => {
        localBooks[SYMBOL_MAP[s]] = { bids: {}, asks: {} };
    });

    let pingInterval;

    ws.on('open', () => {
        console.log('[Kraken] WebSocket connected');
        ws.send(JSON.stringify({
            event: 'subscribe',
            pair: symbols.map(s => SYMBOL_MAP[s]),
            subscription: { name: 'book', depth: 10 }
        }));

        // Kraken requires pings to keep connection alive
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ event: 'ping' }));
            }
        }, 30000);
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data);

        if (msg.event === 'subscriptionStatus') {
            if (msg.status === 'subscribed') {
                console.log(`[Kraken] Subscribed to ${msg.pair}`);
            } else if (msg.status === 'error') {
                console.error(`[Kraken] Subscription error for ${msg.pair}:`, msg.errorMessage);
            }
            return;
        }
        if (msg.event === 'heartbeat' || msg.event === 'pong') return;
        if (msg.event) return;

        // Handle data messages: [channelID, payload1, payload2?, channelName, pair]
        if (Array.isArray(msg) && msg.length >= 4) {
            const krakenSymbol = msg[msg.length - 1];
            const normalizedSymbol = Object.keys(SYMBOL_MAP).find(k => SYMBOL_MAP[k] === krakenSymbol);
            if (!normalizedSymbol || !localBooks[krakenSymbol]) return;

            const book = localBooks[krakenSymbol];
            let updated = false;

            for (let i = 1; i < msg.length - 2; i++) {
                const payload = msg[i];

                // Snapshots
                if (payload.as) {
                    book.asks = {};
                    payload.as.forEach(a => { book.asks[a[0]] = a[1]; });
                    updated = true;
                }
                if (payload.bs) {
                    book.bids = {};
                    payload.bs.forEach(b => { book.bids[b[0]] = b[1]; });
                    updated = true;
                }

                // Incremental updates
                if (payload.a) {
                    payload.a.forEach(a => {
                        if (parseFloat(a[1]) === 0) delete book.asks[a[0]];
                        else book.asks[a[0]] = a[1];
                    });
                    updated = true;
                }
                if (payload.b) {
                    payload.b.forEach(b => {
                        if (parseFloat(b[1]) === 0) delete book.bids[b[0]];
                        else book.bids[b[0]] = b[1];
                    });
                    updated = true;
                }
            }

            if (updated) {
                const bids = Object.entries(book.bids)
                    .map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) }))
                    .sort((a, b) => b.price - a.price)
                    .slice(0, 10);
                const asks = Object.entries(book.asks)
                    .map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) }))
                    .sort((a, b) => a.price - b.price)
                    .slice(0, 10);

                updatePrice('kraken', normalizedSymbol, bids, asks);
                onUpdate('kraken', normalizedSymbol);
            }
        }
    });

    ws.on('error', (err) => console.error('[Kraken] WebSocket error:', err.message));
    ws.on('close', () => {
        console.log('[Kraken] WebSocket closed');
        clearInterval(pingInterval);
    });

    return ws;
}

module.exports = { connectKraken };
