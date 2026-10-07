const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Product',
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      // Denormalised owner of the reviewed product, so moderation and the
      // seller's aggregate rating do not need an extra join.
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      // The purchase that entitled this customer to write the review.
    },
    rating: {
      type: Number,
      required: [true, 'Please add a rating'],
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5'],
      validate: {
        validator: (value) => Number.isInteger(value),
        message: 'Rating must be a whole number between 1 and 5',
      },
    },
    comment: {
      type: String,
      required: [true, 'Please add a comment'],
      trim: true,
      maxlength: [500, 'Comment cannot be longer than 500 characters'],
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      // Moderation mirrors the existing admin review queue: nothing is public
      // (or counted toward a seller's rating) until it is approved.
    },
  },
  { timestamps: true }
);

// One written opinion per customer per product — a duplicate submit is a
// conflict, not a second document.
reviewSchema.index({ product: 1, customer: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
