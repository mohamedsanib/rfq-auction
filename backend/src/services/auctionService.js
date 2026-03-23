const pool = require('../config/db');

const addAuctionLog = async (auction_id, action, description) => {
  try {
    await pool.query(
      'INSERT INTO auction_logs (auction_id, action, description) VALUES ($1, $2, $3)',
      [auction_id, action, description]
    );
  } catch (err) {
    console.error('Log error:', err.message);
  }
};

/**
 * Returns the best (lowest) bid per carrier for an auction, with correct
 * shared-rank assignment.
 *
 * Tie-rank rule:
 *   If two carriers have the same total_amount they both get the same rank
 *   number, and the next rank skips accordingly.
 *   e.g. ₹100, ₹100, ₹150  →  L1, L1, L3  (L2 is skipped)
 */
const computeRanks = async (auction_id) => {
  const result = await pool.query(
    `SELECT DISTINCT ON (carrier_id)
       b.id, b.auction_id, b.carrier_id, b.carrier_name, b.freight_charges,
       b.origin_charges, b.destination_charges, b.total_amount,
       b.transit_time, b.quote_validity, b.created_at,
       u.email as carrier_email
     FROM bids b
     JOIN users u ON b.carrier_id = u.id
     WHERE b.auction_id = $1
     ORDER BY b.carrier_id, b.total_amount ASC`,
    [auction_id]
  );

  // Sort all best-bids by total ascending
  const sorted = result.rows.sort(
    (a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount)
  );

  // Assign dense-competition ranks: same amount → same rank, next rank = position+1
  return sorted.map((bid, idx) => {
    let rank;
    if (idx === 0) {
      rank = 1;
    } else if (
      parseFloat(bid.total_amount) === parseFloat(sorted[idx - 1].total_amount)
    ) {
      // Tie with previous → same rank as previous (carry it forward)
      rank = sorted[idx - 1]._rank;
    } else {
      // Different amount → rank = actual 1-based position
      rank = idx + 1;
    }
    bid._rank = rank; // temp field used by the next iteration
    return { ...bid, rank, rank_label: `L${rank}` };
  });
};

/**
 * Extension logic (called after a new bid is inserted and ranks recomputed).
 *
 * Rules — all four must be covered:
 *
 *  1. No previous bids at all (this is the very first bid on the auction)
 *     → EXTEND.  Reason: L1 set changed from {} to {bidder}.
 *
 *  2. Bidder was NOT in L1 before, and IS in L1 now
 *     → EXTEND.  Reason: new entrant to L1.
 *
 *  3. Bidder WAS in L1 before (alone or shared) AND IS still in L1 now,
 *     but the previous L1 set had MORE members than the current L1 set
 *     → EXTEND.  Reason: bidder evicted co-L1 holders.
 *
 *  4. Bidder WAS in L1 alone before AND IS still in L1 alone after
 *     (they just bid lower, but were already the only L1 holder)
 *     → EXTEND.  Reason: they are still the active L1 bidder making a new bid.
 *
 * Unified rule that covers all four:
 *   IF in trigger window AND bidder is L1 in the CURRENT rankings → EXTEND.
 *   (The only imaginable non-extend case — bidder not at L1 and no change to
 *    who holds L1 — is already excluded by checking bidder's current rank.)
 */
const checkAndExtend = async (auction_id, carrier_id, newBid, rankedBids, auction) => {
  const now = new Date();
  const currentEnd = new Date(auction.current_end_time);
  const forcedEnd = new Date(auction.forced_end_time);
  const triggerWindow = parseInt(auction.trigger_window);
  const extensionDuration = parseInt(auction.extension_duration);

  // ── Step 1: is this bid inside the trigger window? ──────────────────────
  const windowStart = new Date(currentEnd.getTime() - triggerWindow * 60 * 1000);
  const inTriggerWindow = now >= windowStart && now <= currentEnd;

  if (!inTriggerWindow) return false;

  // ── Step 2: how many bids existed BEFORE this new one? ──────────────────
  const prevCountResult = await pool.query(
    'SELECT COUNT(*) FROM bids WHERE auction_id = $1 AND id != $2',
    [auction_id, newBid.id]
  );
  const prevBidCount = parseInt(prevCountResult.rows[0].count);

  let shouldExtend = false;
  let reason = '';

  if (prevBidCount === 0) {
    // ── Rule 1: first ever bid on this auction ─────────────────────────────
    shouldExtend = true;
    reason = `First bid on auction by ${newBid.carrier_name} (₹${parseFloat(newBid.total_amount).toFixed(2)}) in trigger window`;

  } else {
    // ── Rules 2 / 3 / 4: check whether the bidder is L1 right now ─────────
    //
    // rankedBids is already computed AFTER the new bid was inserted,
    // so it reflects the current state of the auction including this bid.
    //
    // The current minimum total across all carriers:
    const currentMin = Math.min(
      ...rankedBids.map(b => parseFloat(b.total_amount))
    );

    // Is this bidder at L1 in the current standings?
    const bidderCurrentBest = rankedBids.find(b => b.carrier_id === carrier_id);
    const bidderIsCurrentlyL1 =
      bidderCurrentBest &&
      parseFloat(bidderCurrentBest.total_amount) === currentMin;

    if (bidderIsCurrentlyL1) {
      // Now figure out the extend reason for logging clarity
      // Compute what L1 looked like BEFORE this bid (excluding newBid)
      const prevBestRows = await pool.query(
        `SELECT DISTINCT ON (carrier_id) carrier_id, total_amount
         FROM bids
         WHERE auction_id = $1 AND id != $2
         ORDER BY carrier_id, total_amount ASC`,
        [auction_id, newBid.id]
      );
      const prevBids = prevBestRows.rows;
      const prevMin = Math.min(...prevBids.map(b => parseFloat(b.total_amount)));
      const prevL1Set = new Set(
        prevBids
          .filter(b => parseFloat(b.total_amount) === prevMin)
          .map(b => b.carrier_id)
      );
      const currentL1Set = new Set(
        rankedBids
          .filter(b => parseFloat(b.total_amount) === currentMin)
          .map(b => b.carrier_id)
      );

      const wasInL1Before = prevL1Set.has(carrier_id);
      const prevL1Count = prevL1Set.size;
      const currentL1Count = currentL1Set.size;

      if (!wasInL1Before) {
        // Rule 2: new entrant to L1
        reason =
          `${newBid.carrier_name} entered L1 with ₹${parseFloat(newBid.total_amount).toFixed(2)}, ` +
          `displacing previous L1 holder(s) at ₹${prevMin.toFixed(2)}`;
      } else if (prevL1Count > currentL1Count) {
        // Rule 3: was sharing L1, now has it alone (evicted co-holders)
        reason =
          `${newBid.carrier_name} was sharing L1 with ${prevL1Count} carrier(s) at ₹${prevMin.toFixed(2)}, ` +
          `now sole L1 at ₹${parseFloat(newBid.total_amount).toFixed(2)} — co-holders evicted`;
      } else {
        // Rule 4: was already sole L1, bid lower, still sole L1
        reason =
          `${newBid.carrier_name} improved their L1 bid from ₹${prevMin.toFixed(2)} ` +
          `to ₹${parseFloat(newBid.total_amount).toFixed(2)}, retaining sole L1`;
      }

      shouldExtend = true;
    }
    // If bidder is NOT currently L1 → no extension (their bid didn't affect
    // who holds L1 at all — someone else is still lowest)
  }

  // ── Step 3: apply extension if needed ───────────────────────────────────
  if (shouldExtend) {
    const newEnd = new Date(currentEnd.getTime() + extensionDuration * 60 * 1000);
    // Never exceed forced close time
    const finalEnd = newEnd > forcedEnd ? forcedEnd : newEnd;

    if (finalEnd > currentEnd) {
      await pool.query(
        'UPDATE auctions SET current_end_time = $1, updated_at = NOW() WHERE id = $2',
        [finalEnd, auction_id]
      );
      await addAuctionLog(
        auction_id,
        'TIME_EXTENDED',
        `Auction extended by ${extensionDuration} min → new end: ${finalEnd.toISOString()}. Reason: ${reason}`
      );
      return { extended: true, new_end_time: finalEnd, reason };
    } else {
      // Already at forced close — log it but don't extend
      await addAuctionLog(
        auction_id,
        'EXTENSION_BLOCKED',
        `Extension triggered (${reason}) but forced close time already reached — no extension applied`
      );
    }
  }

  return false;
};

const activateAuction = async (auction_id, io) => {
  try {
    const result = await pool.query(
      `UPDATE auctions SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'draft' RETURNING *`,
      [auction_id]
    );
    if (result.rows.length > 0) {
      const auction = result.rows[0];
      await addAuctionLog(auction_id, 'ACTIVATED', 'Auction is now active and accepting bids');
      if (io) {
        io.emit('auction_activated', { auction });
        io.emit('auction_list_update', { auction });
      }
      console.log(`✅ Auction ${auction_id} activated`);
    }
  } catch (err) {
    console.error('Activate auction error:', err.message);
  }
};

const closeAuction = async (auction_id, forced, io) => {
  try {
    const newStatus = forced ? 'force_closed' : 'closed';
    const result = await pool.query(
      `UPDATE auctions SET status = $1, updated_at = NOW() WHERE id = $2 AND status = 'active' RETURNING *`,
      [newStatus, auction_id]
    );
    if (result.rows.length > 0) {
      const auction = result.rows[0];
      const action = forced ? 'FORCE_CLOSED' : 'CLOSED';
      const desc = forced ? 'Auction force closed at forced end time' : 'Auction closed at end time';
      await addAuctionLog(auction_id, action, desc);
      if (io) {
        io.to(`auction_${auction_id}`).emit('auction_closed', { auction, status: newStatus });
        io.emit('auction_list_update', { auction });
      }
      console.log(`✅ Auction ${auction_id} ${newStatus}`);
    }
  } catch (err) {
    console.error('Close auction error:', err.message);
  }
};

module.exports = { addAuctionLog, computeRanks, checkAndExtend, activateAuction, closeAuction };