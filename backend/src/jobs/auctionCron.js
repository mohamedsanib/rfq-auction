const cron = require('node-cron');
const { pool } = require('../db');

function startAuctionCron(io) {
  // Runs every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Get all active RFQs where end_date has passed
      const result = await pool.query(
        "SELECT * FROM rfqs WHERE status='active' AND end_date <= $1",
        [now]
      );

      for (const rfq of result.rows) {
        const forcedEnd = new Date(rfq.forced_end_date);
        let newStatus;
        let logDesc;

        if (now >= forcedEnd) {
          newStatus = 'force_closed';
          logDesc = 'Auction force closed — reached forced end time';
        } else {
          newStatus = 'closed';
          logDesc = 'Auction closed — bidding period ended';
        }

        await pool.query('UPDATE rfqs SET status=$1 WHERE id=$2', [newStatus, rfq.id]);
        await pool.query(
          'INSERT INTO logs (rfq_id, action, description) VALUES ($1,$2,$3)',
          [rfq.id, 'status_change', logDesc]
        );

        console.log(`RFQ ${rfq.id} marked as ${newStatus}`);

        if (io) {
          const updatedRfq = await pool.query('SELECT * FROM rfqs WHERE id=$1', [rfq.id]);
          io.to(`rfq_${rfq.id}`).emit('rfq_updated', {
            rfq: updatedRfq.rows[0],
            reason: logDesc
          });
          io.to(`rfq_${rfq.id}`).emit('auction_ended', { status: newStatus });
        }
      }

      // Auto-activate draft RFQs whose start_date has arrived
      const activated = await pool.query(
        "UPDATE rfqs SET status='active' WHERE status='draft' AND start_date <= $1 RETURNING id, name",
        [now]
      );

      for (const rfq of activated.rows) {
        console.log(`RFQ ${rfq.id} (${rfq.name}) auto-activated`);
        await pool.query(
          'INSERT INTO logs (rfq_id, action, description) VALUES ($1,$2,$3)',
          [rfq.id, 'status_change', 'Auction automatically activated — start time reached']
        );
      }

    } catch (err) {
      console.error('Cron error:', err);
    }
  });

  console.log('Auction cron job started');
}

module.exports = { startAuctionCron };