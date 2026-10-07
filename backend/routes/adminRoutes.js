const express = require('express');
const router = express.Router();
const {
  getMetrics,
  listUsers,
  updateUserStatus,
  listSellers,
  listProducts,
  updateProductStatus,
  listOrders,
  // Compatibility routes inherited from origin/main (PR #2):
  getTransactions,
  suspendUser,
} = require('../controllers/adminController');
const { listReviews, updateReviewStatus } = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Everything behind this router is platform governance: metrics, accounts,
// listings, transactions and review moderation. The guard is applied once, to
// every path below, so a new admin route can never be added unprotected.
router.use(protect, authorize('ADMIN'));

router.get('/metrics', getMetrics);

router.get('/users', listUsers);
router.put('/users/:id/status', updateUserStatus);

// Legacy contract from origin/main: `{isSuspended}` body on its own path. Kept
// so any client written against PR #2 keeps working; both routes share the
// same suspension guards in the controller.
router.put('/users/:id/suspend', suspendUser);

router.get('/sellers', listSellers);

router.get('/products', listProducts);
router.put('/products/:id/status', updateProductStatus);

router.get('/orders', listOrders);

// Legacy analytics feed from origin/main (`totalRevenue` + raw order rows).
router.get('/transactions', getTransactions);

router.get('/reviews', listReviews);
router.put('/reviews/:id/status', updateReviewStatus);

module.exports = router;
