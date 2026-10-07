const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const notFound = (res) => res.status(404).json({ status: 'error', message: 'Review not found' });

/**
 * Recomputes a merchant's public rating from their APPROVED reviews.
 *
 * The seller card, the product card and the rating filter all read
 * `User.rating`; it must therefore only ever reflect reviews that actually
 * exist and passed moderation, never a default number.
 */
const recalculateSellerRating = async (sellerId) => {
  const [result] = await Review.aggregate([
    { $match: { seller: new mongoose.Types.ObjectId(String(sellerId)), status: 'APPROVED' } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  await User.updateOne(
    { _id: sellerId },
    { rating: result ? Math.round(result.average * 10) / 10 : 0 }
  );
};

/**
 * POST /api/reviews  (CUSTOMER)
 *
 * A review is only valid when it is about a product the authenticated
 * customer actually bought, so neither the product id nor the order id can be
 * borrowed from somebody else's purchase.
 */
const createReview = async (req, res, next) => {
  try {
    const { productId, rating, comment, orderId } = req.body;

    if (!isObjectId(productId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid product id' });
    }
    if (orderId !== undefined && orderId !== null && orderId !== '' && !isObjectId(orderId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid order id' });
    }

    const ratingNumber = Number(rating);
    if (!Number.isInteger(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
      return res.status(400).json({
        status: 'error',
        message: 'Rating must be a whole number between 1 and 5',
      });
    }
    if (typeof comment !== 'string' || !comment.trim()) {
      return res.status(400).json({ status: 'error', message: 'Please add a comment' });
    }
    if (comment.trim().length > 500) {
      return res.status(400).json({ status: 'error', message: 'Comment cannot be longer than 500 characters' });
    }

    const product = await Product.findById(productId);
    if (!product || product.status !== 'ACTIVE') {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }

    // Proof of purchase, always read from the order book: the browser cannot
    // assert that it bought something.
    const purchaseQuery = {
      customer: req.user.id,
      product: productId,
      status: { $ne: 'CANCELLED' },
    };
    if (orderId) purchaseQuery._id = orderId;

    const purchase = await Order.findOne(purchaseQuery).sort({ createdAt: -1 });
    if (!purchase) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only review products you have purchased',
      });
    }

    const duplicate = await Review.findOne({ product: productId, customer: req.user.id });
    if (duplicate) {
      return res.status(409).json({
        status: 'error',
        message: 'You have already reviewed this product',
      });
    }

    const review = await Review.create({
      product: productId,
      seller: product.seller,
      customer: req.user.id,
      order: purchase._id,
      rating: ratingNumber,
      comment: comment.trim().slice(0, 500),
      // Reviews enter the moderation queue; the admin panel approves them.
      status: 'PENDING',
    });

    res.status(201).json({ status: 'success', data: review });
  } catch (error) {
    // The unique index is the last line of defence against a double submit.
    if (error && error.code === 11000) {
      return res.status(409).json({
        status: 'error',
        message: 'You have already reviewed this product',
      });
    }
    next(error);
  }
};

/**
 * GET /api/reviews/product/:productId  (public)
 *
 * Only approved opinions are visible; a pending or rejected review never
 * appears on a product page or feeds into the seller's rating.
 */
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!isObjectId(productId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid product id' });
    }

    const reviews = await Review.find({ product: productId, status: 'APPROVED' })
      .populate('customer', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ status: 'success', data: reviews, count: reviews.length });
  } catch (error) { next(error); }
};

/**
 * GET /api/admin/reviews  (ADMIN)
 *
 * The moderation queue behind the existing admin "Reviews" section: every
 * review, in any state, newest first.
 */
const listReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find()
      .populate('product', 'name images')
      .populate('customer', 'name email')
      .populate('seller', 'name businessName')
      .sort({ createdAt: -1 })
      .limit(200);

    res.status(200).json({ status: 'success', data: reviews, count: reviews.length });
  } catch (error) { next(error); }
};

/**
 * PUT /api/admin/reviews/:id/status  (ADMIN)
 *
 * Moderation action from the admin panel. The resulting rating of the seller
 * is recomputed so approval/rejection always matches the public number.
 */
const updateReviewStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return notFound(res);

    const status = String(req.body.status || '').toUpperCase();
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Status must be PENDING, APPROVED or REJECTED',
      });
    }

    const review = await Review.findByIdAndUpdate(id, { status }, { new: true });
    if (!review) return notFound(res);

    await recalculateSellerRating(review.seller);

    res.status(200).json({ status: 'success', data: review });
  } catch (error) { next(error); }
};

module.exports = {
  createReview,
  getProductReviews,
  listReviews,
  updateReviewStatus,
  recalculateSellerRating,
};
