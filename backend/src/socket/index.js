const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

function setupSocket(io) {
  // Auth middleware for every socket connection
  io.use((socket, next) => {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.cookie
        ?.split(';')
        .find(c => c.trim().startsWith('token='))
        ?.split('=')[1];

    if (!token) return next(new Error('Unauthorized'));
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.user.name} (${socket.user.role})`);

    // Join a specific RFQ room to receive live updates
    socket.on('join_rfq', (rfqId) => {
      socket.join(`rfq_${rfqId}`);
      console.log(`${socket.user.name} joined rfq_${rfqId}`);
    });

    // Leave a specific RFQ room
    socket.on('leave_rfq', (rfqId) => {
      socket.leave(`rfq_${rfqId}`);
      console.log(`${socket.user.name} left rfq_${rfqId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.user.name}`);
    });
  });
}

module.exports = { setupSocket };