const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
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
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Product',
    },
    negotiation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Negotiation',
    },
    listPrice: {
      type: Number,
      // The product's listed price when this order was placed — the "original"
      // price shown next to a bargain, independent of later price edits.
    },
    isNegotiated: {
      type: Boolean,
      default: false,
      // True when the price came from an accepted negotiation rather than the
      // product's list price.
    },
    finalAgreedPrice: {
      type: Number,
      required: true,
      // Agreed price for ONE unit (list price for a normal purchase, the
      // negotiated price for a bargain). `quantity` tells us how many.
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    totalAmount: {
      type: Number,
      required: true,
      // finalAgreedPrice * quantity — what the customer actually pays.
    },
    platformCommission: {
      type: Number,
      required: true,
      // 2% of totalAmount. This is the SELLER's platform fee and is never
      // added to what the customer pays.
    },
    requestId: {
      type: String,
      // Idempotency key the browser generates once per checkout submission.
      // The unique index turns "did I already send this?" into a database
      // question, so a double click or a retried request can never bill twice.
      // Legacy orders predate the field and are untouched (sparse index).
      index: { unique: true, sparse: true },
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'PROCESSING', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
    },
    paymentMethod: {
      type: String,
      default: 'CASH_ON_DELIVERY', // Or STRIPE, etc.
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
