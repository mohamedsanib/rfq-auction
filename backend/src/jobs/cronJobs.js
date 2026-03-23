const cron = require('node-cron');
const pool = require('../config/db');
const { activateAuction, closeAuction } = require('../services/auctionService');

let ioInstance = null;

const startCronJobs = (io) => {
  ioInstance = io;

  // Run every 30 seconds to check auction state transitions
  cron.schedule('*/30 * * * * *', async () => {
    const now = new Date();

    try {
      // 1. Activate draft auctions whose start_time has passed
      const draftsToActivate = await pool.query(
        `SELECT id FROM auctions WHERE status = 'draft' AND start_time <= $1`,
        [now]
      );
      for (const row of draftsToActivate.rows) {
        await activateAuction(row.id, ioInstance);
      }

      // 2. Close active auctions whose current_end_time has passed (but forced_end_time not yet)
      const toClose = await pool.query(
        `SELECT id FROM auctions WHERE status = 'active' AND current_end_time <= $1 AND forced_end_time > $1`,
        [now]
      );
      for (const row of toClose.rows) {
        await closeAuction(row.id, false, ioInstance);
      }

      // 3. Force close active auctions whose forced_end_time has passed
      const toForceClose = await pool.query(
        `SELECT id FROM auctions WHERE status = 'active' AND forced_end_time <= $1`,
        [now]
      );
      for (const row of toForceClose.rows) {
        await closeAuction(row.id, true, ioInstance);
      }
    } catch (err) {
      console.error('Cron error:', err.message);
    }
  });

  console.log('✅ Cron jobs started (every 30s)');
};

module.exports = { startCronJobs };
