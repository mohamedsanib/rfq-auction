require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { initDB } = require('./db');
const { setupSocket } = require('./socket');
const { startAuctionCron } = require('./jobs/auctionCron');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.set('io', io);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/rfqs', require('./routes/rfqs'));
app.use('/api/bids', require('./routes/bids').router);

setupSocket(io);

const PORT = process.env.PORT || 3001;

initDB().then(() => {
  startAuctionCron(io);
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(console.error);