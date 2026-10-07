const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductById,
  getMyProducts,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, authorize, optionalAuth } = require('../middleware/authMiddleware');

router.route('/')
  .get(getProducts)
  .post(protect, authorize('SELLER', 'ADMIN'), createProduct);

// `/mine` must be declared before `/:id`, otherwise it is swallowed by the
// parameter route.
router.get('/mine', protect, authorize('SELLER', 'ADMIN'), getMyProducts);

router.route('/:id')
  // optionalAuth: a delisted record is readable only by its merchant and the
  // admin, so the public detail read needs identity when it is offered —
  // without ever requiring it from an anonymous visitor.
  .get(optionalAuth, getProductById)
  .put(protect, authorize('SELLER', 'ADMIN'), updateProduct)
  .delete(protect, authorize('SELLER', 'ADMIN'), deleteProduct);

module.exports = router;
