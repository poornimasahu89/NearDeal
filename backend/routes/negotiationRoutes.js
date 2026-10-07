const express = require('express');
const router = express.Router();
const {
  createOffer,
  respondToOffer,
  getMyNegotiations,
  getSellerNegotiations
} = require('../controllers/negotiationController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Read routes — the single source of truth for both sides of a bargaining thread
router.get('/mine', protect, authorize('CUSTOMER'), getMyNegotiations);
router.get('/seller', protect, authorize('SELLER'), getSellerNegotiations);

router.post('/offer', protect, authorize('CUSTOMER'), createOffer);
router.post('/:id/respond', protect, respondToOffer);

module.exports = router;
