const io = require('socket.io-client');
const socket = io('wss://stream.coindcx.com', { transports: ['websocket'] });

socket.on('connect', () => {
    console.log('Connected');
    socket.emit('join', { channelName: 'B-BTC_USDT' });
    socket.emit('join', { channelName: 'depth' });
});

socket.on('depth-update', (msg) => {
    console.log('Depth Update:', msg);
});

socket.on('ticker', (msg) => {
    console.log('Ticker:', msg);
});

socket.on('connect_error', (err) => {
    console.error('Error:', err.message);
});
