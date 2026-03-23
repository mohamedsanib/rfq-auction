const express = require('express');
const { submitBid } = require('../controllers/bidController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();

router.post('/:auction_id/bid', authMiddleware, requireRole('carrier'), submitBid);

module.exports = router;
