const router = require('express').Router();
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// get current ranked bids
async function getRankedBids(rfqId) {
  const result = await pool.query(
    `SELECT b.*, u.name as carrier_name,
      RANK() OVER (ORDER BY b.total_cost ASC) as rank
     FROM bids b JOIN users u ON b.user_id = u.id
     WHERE b.rfq_id = $1 AND b.is_active = true
     ORDER BY b.total_cost ASC`,
    [rfqId]
  );
  return result.rows;
}

//check trigger window and extend if needed
async function checkAndExtend(rfq, io, previousBids) {
  const now = new Date();
  const endDate = new Date(rfq.end_date);
  const forcedEnd = new Date(rfq.forced_end_date);
  const triggerWindowMs = rfq.trigger_window * 60 * 1000;
  const extensionMs = rfq.extension_time * 60 * 1000;

  const windowStart = new Date(endDate.getTime() - triggerWindowMs);
  const inTriggerWindow = now >= windowStart && now <= endDate;
  if (!inTriggerWindow) return;

  // Get current ranked bids after the action
  const currentBids = await getRankedBids(rfq.id);

  // Get bids placed/modified in the trigger window (new active bids created in window)
  const recentBids = await pool.query(
    `SELECT b.*, u.name as carrier_name FROM bids b
     JOIN users u ON b.user_id = u.id
     WHERE b.rfq_id = $1 AND b.is_active = true AND b.created_at >= $2
     ORDER BY b.total_cost ASC`,
    [rfq.id, windowStart]
  );

  // Get bids deactivated (cancelled or replaced) in the trigger window
  const recentDeactivated = await pool.query(
    `SELECT b.*, u.name as carrier_name FROM bids b
     JOIN users u ON b.user_id = u.id
     WHERE b.rfq_id = $1 AND b.is_active = false AND b.created_at >= $2
     ORDER BY b.created_at DESC`,
    [rfq.id, windowStart]
  );

  let shouldExtend = false;
  let extReason = '';

  // Condition A: Any new bid OR bid cancellation in trigger window .

  // A new active bid was placed in the window
  const newBidInWindow = recentBids.rows.length > 0;
  // A bid was cancelled/deactivated in the window
  const cancellationInWindow = recentDeactivated.rows.length > 0;

  if (newBidInWindow) {
    shouldExtend = true;
    extReason = `Condition A: New bid received by ${recentBids.rows[0].carrier_name} during trigger window`;
  } else if (cancellationInWindow) {
    shouldExtend = true;
    extReason = `Condition A: Bid cancelled by ${recentDeactivated.rows[0].carrier_name} during trigger window`;
  }

  // --- Condition B: Any supplier rank change in trigger window ---
  // Compare previous ranks with current ranks
  if (!shouldExtend && previousBids && previousBids.length > 0) {
    const prevRankMap = {};
    previousBids.forEach(b => { prevRankMap[b.user_id] = parseInt(b.rank); });

    const currRankMap = {};
    currentBids.forEach(b => { currRankMap[b.user_id] = parseInt(b.rank); });

    // Check if any user's rank changed, or if a user entered/left the rankings
    const allUserIds = new Set([
      ...Object.keys(prevRankMap),
      ...Object.keys(currRankMap)
    ]);

    for (const userId of allUserIds) {
      const prevRank = prevRankMap[userId];
      const currRank = currRankMap[userId];
      if (prevRank !== currRank) {
        const changedCarrier = currentBids.find(b => b.user_id == userId)
          || previousBids.find(b => b.user_id == userId);
        shouldExtend = true;
        extReason = `Condition B: Supplier rank changed for ${changedCarrier?.carrier_name || 'a carrier'} during trigger window`;
        break;
      }
    }
  }

  // --- Condition C: L1 (lowest bidder) changed in trigger window ---
  if (!shouldExtend && previousBids && previousBids.length > 0 && currentBids.length > 0) {
    const prevL1UserId = previousBids[0]?.user_id;
    const currL1UserId = currentBids[0]?.user_id;

    if (prevL1UserId !== currL1UserId) {
      shouldExtend = true;
      extReason = `Condition C: Lowest bidder (L1) changed from ${previousBids[0]?.carrier_name} to ${currentBids[0]?.carrier_name} during trigger window`;
    }
  }

  // Also handle edge case: if previousBids was empty but now there are bids (first bid = L1 appeared)
  if (!shouldExtend && previousBids && previousBids.length === 0 && currentBids.length > 0) {
    shouldExtend = true;
    extReason = `Condition C: First bid placed — L1 established by ${currentBids[0].carrier_name} during trigger window`;
  }

  // Also handle: if all bids removed (L1 disappeared)
  if (!shouldExtend && previousBids && previousBids.length > 0 && currentBids.length === 0) {
    shouldExtend = true;
    extReason = `Condition B: All bids removed during trigger window — rankings cleared`;
  }

  if (!shouldExtend) return;

  // Calculate new end time, capped at forced_end_date
  const newEndDate = new Date(endDate.getTime() + extensionMs);
  const cappedEndDate = newEndDate > forcedEnd ? forcedEnd : newEndDate;

  if (cappedEndDate <= endDate) return; 

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

    // Snapshot rankings BEFORE the action for condition B and C comparison
    const previousBids = await getRankedBids(rfqId);

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

    // Log the bid with ₹ symbol
    const total = parseFloat(freight_charges) + parseFloat(origin_charges) + parseFloat(destination_charges);
    await pool.query(
      'INSERT INTO logs (rfq_id, action, description) VALUES ($1,$2,$3)',
      [rfqId, 'bid', `Bid placed by ${req.user.name} with total cost ₹${total.toFixed(2)}`]
    );

    // Check trigger window and extend if needed, passing previous snapshot
    const io = req.app.get('io');
    await checkAndExtend(rfq, io, previousBids);

    // Emit updated rankings to all in room
    if (io) {
      const bidsResult = await getRankedBids(rfqId);
      const logsResult = await pool.query(
        'SELECT * FROM logs WHERE rfq_id=$1 ORDER BY created_at DESC LIMIT 20',
        [rfqId]
      );
      io.to(`rfq_${rfqId}`).emit('bids_updated', {
        bids: bidsResult,
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
    const rfq = rfqResult.rows[0];

    if (rfq.status !== 'active') return res.status(400).json({ error: 'Auction is not active' });

    // Snapshot rankings BEFORE cancellation for condition B and C comparison
    const previousBids = await getRankedBids(rfqId);

    // Get carrier name for log before deactivating
    const carrierBid = previousBids.find(b => b.user_id === req.user.id);

    await pool.query(
      'UPDATE bids SET is_active=false WHERE rfq_id=$1 AND user_id=$2',
      [rfqId, req.user.id]
    );

    // Log the cancellation with ₹ symbol
    const cancelledAmount = carrierBid ? `₹${parseFloat(carrierBid.total_cost).toFixed(2)}` : '';
    await pool.query(
      'INSERT INTO logs (rfq_id, action, description) VALUES ($1,$2,$3)',
      [rfqId, 'bid', `Bid cancelled by ${req.user.name}${cancelledAmount ? ` (was ${cancelledAmount})` : ''}`]
    );

    // Check trigger window and extend if needed, passing previous snapshot
    const io = req.app.get('io');
    await checkAndExtend(rfq, io, previousBids);

    // Emit updated rankings to all in room
    if (io) {
      const bidsResult = await getRankedBids(rfqId);
      const logsResult = await pool.query(
        'SELECT * FROM logs WHERE rfq_id=$1 ORDER BY created_at DESC LIMIT 20',
        [rfqId]
      );
      io.to(`rfq_${rfqId}`).emit('bids_updated', {
        bids: bidsResult,
        logs: logsResult.rows
      });
    }

    res.json({ message: 'Bid cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, checkAndExtend };