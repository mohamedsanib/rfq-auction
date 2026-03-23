const pool = require('../config/db');
const { addAuctionLog, computeRanks, checkAndExtend } = require('../services/auctionService');

const submitBid = async (req, res) => {
  const { auction_id } = req.params;
  const carrier_id = req.user.id;
  const carrier_name = req.user.name;

  const { freight_charges, origin_charges, destination_charges, transit_time, quote_validity } = req.body;

  if (!freight_charges || !transit_time || !quote_validity) {
    return res.status(400).json({ error: 'freight_charges, transit_time, and quote_validity are required' });
  }

  const freight = parseFloat(freight_charges) || 0;
  const origin = parseFloat(origin_charges) || 0;
  const destination = parseFloat(destination_charges) || 0;
  const total = freight + origin + destination;

  if (total <= 0) return res.status(400).json({ error: 'Total bid amount must be greater than 0' });

  try {
    const auctionResult = await pool.query('SELECT * FROM auctions WHERE id = $1', [auction_id]);
    if (auctionResult.rows.length === 0) return res.status(404).json({ error: 'Auction not found' });

    const auction = auctionResult.rows[0];
    const now = new Date();

    if (auction.status !== 'active') {
      return res.status(400).json({ error: `Cannot bid on an auction with status: ${auction.status}` });
    }

    const currentEnd = new Date(auction.current_end_time);
    if (now > currentEnd) {
      return res.status(400).json({ error: 'Auction bidding period has ended' });
    }

    // Check previous best bid by this carrier
    const prevBidResult = await pool.query(
      'SELECT MIN(total_amount) as best FROM bids WHERE auction_id = $1 AND carrier_id = $2',
      [auction_id, carrier_id]
    );
    const prevBest = prevBidResult.rows[0]?.best;

    if (prevBest !== null && prevBest !== undefined && total >= parseFloat(prevBest)) {
      return res.status(400).json({ error: `Your new bid (₹${total.toFixed(2)}) must be less than your previous best bid (₹${parseFloat(prevBest).toFixed(2)})` });
    }

    // Check validity date
    const validity = new Date(quote_validity);
    if (isNaN(validity.getTime())) return res.status(400).json({ error: 'Invalid quote_validity date' });

    // Insert bid
    const bidResult = await pool.query(
      `INSERT INTO bids (auction_id, carrier_id, carrier_name, freight_charges, origin_charges, destination_charges, total_amount, transit_time, quote_validity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [auction_id, carrier_id, carrier_name, freight, origin, destination, total, transit_time, quote_validity]
    );

    const bid = bidResult.rows[0];

    // Log the bid
    await addAuctionLog(auction_id, 'BID_SUBMITTED', `${carrier_name} submitted a bid of ₹${total.toFixed(2)} (Freight: ₹${freight}, Origin: ₹${origin}, Destination: ₹${destination})`);

    // Update lowest bid on auction
    await pool.query(
      'UPDATE auctions SET lowest_bid = (SELECT MIN(total_amount) FROM bids WHERE auction_id = $1), updated_at = NOW() WHERE id = $1',
      [auction_id]
    );

    // Compute ranks
    const rankedBids = await computeRanks(auction_id);

    // Check and extend auction if needed
    const extended = await checkAndExtend(auction_id, carrier_id, bid, rankedBids, auction);

    // Get updated auction
    const updatedAuction = await pool.query('SELECT * FROM auctions WHERE id = $1', [auction_id]);
    const logs = await pool.query('SELECT * FROM auction_logs WHERE auction_id = $1 ORDER BY created_at DESC LIMIT 20', [auction_id]);

    const io = req.app.get('io');
    if (io) {
      io.to(`auction_${auction_id}`).emit('bid_update', {
        auction: updatedAuction.rows[0],
        ranked_bids: rankedBids,
        new_bid: bid,
        extended,
        logs: logs.rows
      });
      io.emit('auction_list_update', { auction: updatedAuction.rows[0] });
    }

    res.status(201).json({ bid, extended, ranked_bids: rankedBids, auction: updatedAuction.rows[0] });
  } catch (err) {
    console.error('Submit bid error:', err);
    res.status(500).json({ error: 'Server error submitting bid' });
  }
};

module.exports = { submitBid };
