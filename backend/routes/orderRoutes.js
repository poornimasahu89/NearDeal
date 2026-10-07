const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getSellerOrders,
  getOrderById,
  updateOrderStatus,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Checkout and personal order history are CUSTOMER territory; a merchant
// reads the orders for their own store through `/seller`. Both still require
// an authenticated session, and identity always comes from the JWT.
router.post('/checkout', protect, authorize('CUSTOMER'), createOrder);

// Order history lives in MongoDB, not in the browser. `/mine` and `/seller`
// must be declared before `/:id` so they are not captured by the param route.
router.get('/mine', protect, authorize('CUSTOMER', 'ADMIN'), getMyOrders);
router.get('/seller', protect, authorize('SELLER', 'ADMIN'), getSellerOrders);

// Lifecycle transitions: only the merchant on the order (or an admin) may
// advance it, and the controller validates the transition itself.
router.put('/:id/status', protect, authorize('SELLER', 'ADMIN'), updateOrderStatus);

router.get('/:id', protect, getOrderById);

module.exports = router;
