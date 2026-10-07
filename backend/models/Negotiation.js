const mongoose = require('mongoose');

const negotiationSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Product',
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    // Snapshot of the product's listed price when the offer was opened. The
    // product's own price can be edited later; this thread must keep showing
    // the price the two sides were actually bargaining from.
    listedPrice: {
      type: Number,
    },
    // The customer's very first proposal, which history[0] also carries but
    // only as an untyped log entry.
    initialOfferPrice: {
      type: Number,
    },
    // The amount both sides settled on. Set only when status becomes ACCEPTED.
    finalAgreedPrice: {
      type: Number,
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    currentOfferPrice: {
      type: Number,
      required: true,
    },
    // Set once this deal has been turned into a real order. Checkout refuses a
    // thread that already carries one, so a single accepted bargain can never
    // be converted twice (which would reserve stock and bill twice).
    convertedToOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    lastActionBy: {
      type: String,
      enum: ['CUSTOMER', 'SELLER', 'SYSTEM'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
      default: 'PENDING',
    },
    history: [
      {
        offerPrice: Number,
        actionBy: String,
        status: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Negotiation', negotiationSchema);
