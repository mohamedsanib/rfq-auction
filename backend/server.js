require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const initSchema = require('./src/config/schema');
const authRoutes = require('./src/routes/auth');
const auctionRoutes = require('./src/routes/auctions');
const bidRoutes = require('./src/routes/bids');
const { startCronJobs } = require('./src/jobs/cronJobs');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors({ origin: '*' }));
app.use(express.json());

app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/auctions', bidRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Socket.IO
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join_auction', (auction_id) => {
    socket.join(`auction_${auction_id}`);
    console.log(`Socket ${socket.id} joined auction_${auction_id}`);
  });

  socket.on('leave_auction', (auction_id) => {
    socket.leave(`auction_${auction_id}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await initSchema();
    startCronJobs(io);
    server.listen(PORT, () => {
      console.log(`🚀 RFQ Auction server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

start();
