const pool = require('../config/db');
const { addAuctionLog, computeRanks } = require('../services/auctionService');

const createAuction = async (req, res) => {
  const { rfq_name, start_time, end_time, forced_end_time, pickup_date, trigger_window, extension_duration } = req.body;
  const buyer_id = req.user.id;

  if (!rfq_name || !start_time || !end_time || !forced_end_time || !pickup_date) {
    return res.status(400).json({ error: 'All fields are required: rfq_name, start_time, end_time, forced_end_time, pickup_date' });
  }

  const now = new Date();
  const start = new Date(start_time);
  const end = new Date(end_time);
  const forced = new Date(forced_end_time);
  const pickup = new Date(pickup_date);

  if (isNaN(start.getTime())) return res.status(400).json({ error: 'Invalid start_time format' });
  if (isNaN(end.getTime())) return res.status(400).json({ error: 'Invalid end_time format' });
  if (isNaN(forced.getTime())) return res.status(400).json({ error: 'Invalid forced_end_time format' });

  if (start <= now) return res.status(400).json({ error: 'Start time must be in the future' });
  if (end <= start) return res.status(400).json({ error: 'End time must be after start time' });
  if (forced <= end) return res.status(400).json({ error: 'Forced end time must be after end time' });

  const tw = parseInt(trigger_window) || 5;
  const ed = parseInt(extension_duration) || 5;

  if (tw < 1) return res.status(400).json({ error: 'Trigger window must be at least 1 minute' });
  if (ed < 1) return res.status(400).json({ error: 'Extension duration must be at least 1 minute' });

  try {
    const result = await pool.query(
      `INSERT INTO auctions (rfq_name, buyer_id, start_time, end_time, forced_end_time, pickup_date, trigger_window, extension_duration, status, current_end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $4) RETURNING *`,
      [rfq_name, buyer_id, start, end, forced, pickup_date, tw, ed]
    );

    const auction = result.rows[0];
    await addAuctionLog(auction.id, 'CREATED', `Auction "${rfq_name}" created as draft, scheduled to start at ${start.toISOString()}`);

    res.status(201).json({ auction });
  } catch (err) {
    console.error('Create auction error:', err);
    res.status(500).json({ error: 'Server error creating auction' });
  }
};

const getBuyerAuctions = async (req, res) => {
  const buyer_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT a.*, 
        (SELECT MIN(b.total_amount) FROM bids b WHERE b.auction_id = a.id) as lowest_bid,
        (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) as total_bids
       FROM auctions a WHERE a.buyer_id = $1 ORDER BY a.created_at DESC`,
      [buyer_id]
    );
    res.json({ auctions: result.rows });
  } catch (err) {
    console.error('Get buyer auctions error:', err);
    res.status(500).json({ error: 'Server error fetching auctions' });
  }
};

const getAllAuctions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name as buyer_name,
        (SELECT MIN(b.total_amount) FROM bids b WHERE b.auction_id = a.id) as lowest_bid,
        (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) as total_bids
       FROM auctions a 
       JOIN users u ON a.buyer_id = u.id
       WHERE a.status IN ('active', 'closed', 'force_closed')
       ORDER BY a.created_at DESC`
    );
    res.json({ auctions: result.rows });
  } catch (err) {
    console.error('Get all auctions error:', err);
    res.status(500).json({ error: 'Server error fetching auctions' });
  }
};

const getAuctionDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const auctionResult = await pool.query(
      `SELECT a.*, u.name as buyer_name FROM auctions a 
       JOIN users u ON a.buyer_id = u.id WHERE a.id = $1`,
      [id]
    );
    if (auctionResult.rows.length === 0) return res.status(404).json({ error: 'Auction not found' });

    const auction = auctionResult.rows[0];

    const bidsResult = await pool.query(
      `SELECT b.*, u.email as carrier_email,
        ROW_NUMBER() OVER (
          PARTITION BY b.carrier_id 
          ORDER BY b.total_amount ASC, b.created_at DESC
        ) as is_latest
       FROM bids b JOIN users u ON b.carrier_id = u.id
       WHERE b.auction_id = $1
       ORDER BY b.total_amount ASC, b.created_at DESC`,
      [id]
    );

    const logsResult = await pool.query(
      'SELECT * FROM auction_logs WHERE auction_id = $1 ORDER BY created_at DESC',
      [id]
    );

    // Get best bid per carrier with rank
    const rankedBids = await computeRanks(id);

    res.json({ auction, bids: bidsResult.rows, ranked_bids: rankedBids, logs: logsResult.rows });
  } catch (err) {
    console.error('Get auction details error:', err);
    res.status(500).json({ error: 'Server error fetching auction details' });
  }
};

module.exports = { createAuction, getBuyerAuctions, getAllAuctions, getAuctionDetails };
