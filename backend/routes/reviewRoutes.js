const express = require('express');
const router = express.Router();
const { createReview, getProductReviews } = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/authMiddleware');

// A written review always belongs to the signed-in customer; the controller
// proves the purchase from the order book instead of trusting ids from the
// browser. Reading approved opinions is public.
router.post('/', protect, authorize('CUSTOMER'), createReview);
router.get('/product/:productId', getProductReviews);

module.exports = router;
