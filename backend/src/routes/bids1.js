const router = require('express').Router();
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// check trigger window and extend if needed
async function checkAndExtend(rfq, io) {
  const now = new Date();
  const endDate = new Date(rfq.end_date);
  const forcedEnd = new Date(rfq.forced_end_date);
  const triggerWindowMs = rfq.trigger_window * 60 * 1000;
  const extensionMs = rfq.extension_time * 60 * 1000;

  const windowStart = new Date(endDate.getTime() - triggerWindowMs);
  const inTriggerWindow = now >= windowStart && now <= endDate;
  if (!inTriggerWindow) return;

  // Get bids placed in the trigger window
  const recentBids = await pool.query(
    `SELECT b.*, u.name as carrier_name FROM bids b
     JOIN users u ON b.user_id = u.id
     WHERE b.rfq_id = $1 AND b.is_active = true AND b.created_at >= $2
     ORDER BY b.total_cost ASC`,
    [rfq.id, windowStart]
  );

  // Get all active bids for ranking
  const allBids = await pool.query(
    `SELECT b.*, u.name as carrier_name FROM bids b
     JOIN users u ON b.user_id = u.id
     WHERE b.rfq_id = $1 AND b.is_active = true
     ORDER BY b.total_cost ASC`,
    [rfq.id]
  );

  let shouldExtend = false;
  let extReason = '';

  // Condition a: any bid received in trigger window
  if (recentBids.rows.length > 0) {
    shouldExtend = true;
    extReason = `New bid received by ${recentBids.rows[0].carrier_name} during trigger window`;
  }

  // Condition c: L1 changed — new lowest bidder appeared in window
  if (!shouldExtend && allBids.rows.length > 0 && recentBids.rows.length > 0) {
    const currentL1 = allBids.rows[0];
    const recentL1Bid = recentBids.rows.find(b => b.user_id === currentL1.user_id);
    if (recentL1Bid) {
      shouldExtend = true;
      extReason = `Lowest bidder (L1) changed to ${currentL1.carrier_name} during trigger window`;
    }
  }

  if (!shouldExtend) return;

  // Calculate new end time, capped at forced_end_date
  const newEndDate = new Date(endDate.getTime() + extensionMs);
  const cappedEndDate = newEndDate > forcedEnd ? forcedEnd : newEndDate;

  if (cappedEndDate <= endDate) return; // already at forced end, no extension possible

  await pool.query('UPDATE rfqs SET end_date=$1 WHERE id=$2', [cappedEndDate, rfq.id]);

  const logDesc = `${extReason}. Extended by ${rfq.extension_time} min. New close: ${cappedEndDate.toISOString()}`;
  await pool.query(
    'INSERT INTO logs (rfq_id, action, description) VALUES ($1,$2,$3)',
    [rfq.id, 'bid_extension', logDesc]
  );

  if (io) {
    const updatedRfq = await pool.query('SELECT * FROM rfqs WHERE id=$1', [rfq.id]);
    io.to(`rfq_${rfq.id}`).emit('rfq_updated', { rfq: updatedRfq.rows[0], reason: logDesc });
  }
}

// POST /api/bids/:rfqId — place or update bid
router.post('/:rfqId', authenticate, requireRole('carrier'), async (req, res) => {
  const { rfqId } = req.params;
  const { freight_charges, origin_charges, destination_charges, transit_time, validity_of_quote } = req.body;

  if (!freight_charges || !origin_charges || !destination_charges || !transit_time || !validity_of_quote)
    return res.status(400).json({ error: 'All bid fields are required' });

  try {
    const rfqResult = await pool.query('SELECT * FROM rfqs WHERE id=$1', [rfqId]);
    if (!rfqResult.rows.length) return res.status(404).json({ error: 'RFQ not found' });
    const rfq = rfqResult.rows[0];

    if (rfq.status !== 'active') return res.status(400).json({ error: 'Auction is not active' });

    const now = new Date();
    if (now < new Date(rfq.start_date)) return res.status(400).json({ error: 'Auction has not started yet' });
    if (now > new Date(rfq.end_date)) return res.status(400).json({ error: 'Auction has ended' });

    // Deactivate previous bid if exists
    await pool.query(
      'UPDATE bids SET is_active=false WHERE rfq_id=$1 AND user_id=$2',
      [rfqId, req.user.id]
    );

    // Insert new bid
    const bidResult = await pool.query(
      `INSERT INTO bids (rfq_id, user_id, freight_charges, origin_charges, destination_charges, transit_time, validity_of_quote)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [rfqId, req.user.id, freight_charges, origin_charges, destination_charges, transit_time, validity_of_quote]
    );
    const bid = bidResult.rows[0];

    // Log the bid
    const total = parseFloat(freight_charges) + parseFloat(origin_charges) + parseFloat(destination_charges);
    await pool.query(
      'INSERT INTO logs (rfq_id, action, description) VALUES ($1,$2,$3)',
      [rfqId, 'bid', `Bid placed by ${req.user.name} with total cost $${total.toFixed(2)}`]
    );

    // Check trigger window and extend if needed
    const io = req.app.get('io');
    await checkAndExtend(rfq, io);

    // Emit updated rankings to all in room
    if (io) {
      const bidsResult = await pool.query(
        `SELECT b.*, u.name as carrier_name,
          RANK() OVER (ORDER BY b.total_cost ASC) as rank
         FROM bids b JOIN users u ON b.user_id = u.id
         WHERE b.rfq_id=$1 AND b.is_active=true ORDER BY b.total_cost ASC`,
        [rfqId]
      );
      const logsResult = await pool.query(
        'SELECT * FROM logs WHERE rfq_id=$1 ORDER BY created_at DESC LIMIT 20',
        [rfqId]
      );
      io.to(`rfq_${rfqId}`).emit('bids_updated', {
        bids: bidsResult.rows,
        logs: logsResult.rows,
        newBid: { ...bid, carrier_name: req.user.name }
      });
    }

    res.status(201).json({ bid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/bids/:rfqId — cancel bid
router.delete('/:rfqId', authenticate, requireRole('carrier'), async (req, res) => {
  const { rfqId } = req.params;
  try {
    const rfqResult = await pool.query('SELECT * FROM rfqs WHERE id=$1', [rfqId]);
    if (!rfqResult.rows.length) return res.status(404).json({ error: 'RFQ not found' });
    if (rfqResult.rows[0].status !== 'active')
      return res.status(400).json({ error: 'Auction is not active' });

    await pool.query(
      'UPDATE bids SET is_active=false WHERE rfq_id=$1 AND user_id=$2',
      [rfqId, req.user.id]
    );

    await pool.query(
      'INSERT INTO logs (rfq_id, action, description) VALUES ($1,$2,$3)',
      [rfqId, 'bid', `Bid cancelled by ${req.user.name}`]
    );

    const io = req.app.get('io');
    if (io) {
      const bidsResult = await pool.query(
        `SELECT b.*, u.name as carrier_name,
          RANK() OVER (ORDER BY b.total_cost ASC) as rank
         FROM bids b JOIN users u ON b.user_id = u.id
         WHERE b.rfq_id=$1 AND b.is_active=true ORDER BY b.total_cost ASC`,
        [rfqId]
      );
      const logsResult = await pool.query(
        'SELECT * FROM logs WHERE rfq_id=$1 ORDER BY created_at DESC LIMIT 20',
        [rfqId]
      );
      io.to(`rfq_${rfqId}`).emit('bids_updated', { bids: bidsResult.rows, logs: logsResult.rows });
    }

    res.json({ message: 'Bid cancelled' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, checkAndExtend };