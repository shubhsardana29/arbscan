const WebSocket = require('ws');
const { updatePrice } = require('../priceStore');

const SYMBOL_MAP = {
    'BTC/USDT': 'BTC-USDT',
    'ETH/USDT': 'ETH-USDT',
    'BNB/USDT': 'BNB-USDT'
};

function connectOKX(symbols, onUpdate) {
    const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');

    ws.on('open', () => {
        console.log('[OKX] WebSocket connected');
        const args = symbols.map(s => ({
            channel: 'books5',
            instId: SYMBOL_MAP[s]
        }));
        ws.send(JSON.stringify({ op: 'subscribe', args }));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.event === 'subscribe') return;
        if (msg.data && msg.arg && msg.arg.channel === 'books5') {
            const okxSymbol = msg.arg.instId;
            const normalizedSymbol = Object.keys(SYMBOL_MAP).find(k => SYMBOL_MAP[k] === okxSymbol);
            if (!normalizedSymbol) return;

            const book = msg.data[0];
            const bids = book.bids.map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));
            const asks = book.asks.map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));

            updatePrice('okx', normalizedSymbol, bids, asks);
            onUpdate('okx', normalizedSymbol);
        }
    });

    ws.on('error', (err) => console.error('[OKX] WebSocket error:', err.message));
    ws.on('close', () => console.log('[OKX] WebSocket closed'));

    return ws;
}

module.exports = { connectOKX };
