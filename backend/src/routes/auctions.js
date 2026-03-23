const express = require('express');
const { createAuction, getBuyerAuctions, getAllAuctions, getAuctionDetails } = require('../controllers/auctionController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();

router.post('/', authMiddleware, requireRole('buyer'), createAuction);
router.get('/my', authMiddleware, requireRole('buyer'), getBuyerAuctions);
router.get('/all', authMiddleware, getAllAuctions);
router.get('/:id', authMiddleware, getAuctionDetails);

module.exports = router;
