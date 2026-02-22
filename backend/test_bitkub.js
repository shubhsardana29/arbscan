const WebSocket = require('ws');
const ws = new WebSocket('wss://api.bitkub.com/websocket-api/market.ticker.thb_btc');

ws.on('open', () => {
    console.log('Bitkub Connected');
});

ws.on('message', (data) => {
    console.log('Bitkub Message:', data.toString());
    ws.terminate();
});

ws.on('error', (err) => {
    console.error('Bitkub Error:', err);
});
