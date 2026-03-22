const router = require('express').Router();
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// POST /api/rfqs — create RFQ (buyer only)
router.post('/', authenticate, requireRole('buyer'), async (req, res) => {
  const { name, start_date, end_date, forced_end_date, pickup_date, trigger_window = 10, extension_time = 5 } = req.body;
  if (!name || !start_date || !end_date || !forced_end_date || !pickup_date)
    return res.status(400).json({ error: 'All fields are required' });

  const start = new Date(start_date);
  const end = new Date(end_date);
  const forced = new Date(forced_end_date);

  if (start >= end) return res.status(400).json({ error: 'start_date must be before end_date' });
  if (end >= forced) return res.status(400).json({ error: 'end_date must be before forced_end_date' });

  try {
    const result = await pool.query(
      `INSERT INTO rfqs (buyer_id, name, start_date, end_date, forced_end_date, pickup_date, trigger_window, extension_time, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft') RETURNING *`,
      [req.user.id, name, start_date, end_date, forced_end_date, pickup_date, trigger_window, extension_time]
    );
    res.status(201).json({ rfq: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rfqs — buyer: their own RFQs; carrier: all RFQs
router.get('/', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'buyer') {
      result = await pool.query(
        `SELECT r.*, 
          (SELECT MIN(b.total_cost) FROM bids b WHERE b.rfq_id = r.id AND b.is_active = true) as lowest_bid
         FROM rfqs r WHERE r.buyer_id = $1 ORDER BY r.created_at DESC`,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `SELECT r.*, 
          (SELECT MIN(b.total_cost) FROM bids b WHERE b.rfq_id = r.id AND b.is_active = true) as lowest_bid
         FROM rfqs r ORDER BY r.created_at DESC`
      );
    }
    res.json({ rfqs: result.rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rfqs/:id — full details with rankings and logs
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const rfqResult = await pool.query('SELECT * FROM rfqs WHERE id=$1', [id]);
    if (!rfqResult.rows.length) return res.status(404).json({ error: 'RFQ not found' });
    const rfq = rfqResult.rows[0];

    if (req.user.role === 'buyer' && rfq.buyer_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

    const bidsResult = await pool.query(
      `SELECT b.*, u.name as carrier_name,
        RANK() OVER (ORDER BY b.total_cost ASC) as rank
       FROM bids b
       JOIN users u ON b.user_id = u.id
       WHERE b.rfq_id = $1 AND b.is_active = true
       ORDER BY b.total_cost ASC`,
      [id]
    );

    const logsResult = await pool.query(
      'SELECT * FROM logs WHERE rfq_id=$1 ORDER BY created_at DESC',
      [id]
    );

    let myBid = null;
    if (req.user.role === 'carrier') {
      const myBidResult = await pool.query(
        'SELECT * FROM bids WHERE rfq_id=$1 AND user_id=$2 AND is_active=true',
        [id, req.user.id]
      );
      myBid = myBidResult.rows[0] || null;
    }

    res.json({ rfq, bids: bidsResult.rows, logs: logsResult.rows, myBid });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/rfqs/:id/activate — buyer activates RFQ
router.patch('/:id/activate', authenticate, requireRole('buyer'), async (req, res) => {
  const { id } = req.params;
  try {
    const rfqResult = await pool.query('SELECT * FROM rfqs WHERE id=$1 AND buyer_id=$2', [id, req.user.id]);
    if (!rfqResult.rows.length) return res.status(404).json({ error: 'RFQ not found' });
    if (rfqResult.rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft RFQs can be activated' });

    const result = await pool.query(
      "UPDATE rfqs SET status='active' WHERE id=$1 RETURNING *",
      [id]
    );
    res.json({ rfq: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;