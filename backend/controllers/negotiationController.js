const mongoose = require('mongoose');
const Negotiation = require('../models/Negotiation');
const Product = require('../models/Product');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const invalidId = (res, what) =>
  res.status(400).json({ status: 'error', message: `Invalid ${what} id` });

const createOffer = async (req, res, next) => {
  try {
    const { productId, offerPrice, quantity } = req.body;

    if (!isObjectId(productId)) return invalidId(res, 'product');

    const offer = Number(offerPrice);
    if (!isFinite(offer) || offer <= 0) {
      return res.status(400).json({ status: 'error', message: 'Offer price must be greater than zero' });
    }

    const qty = Math.max(1, Math.floor(Number(quantity) || 1));

    const product = await Product.findById(productId);
    if (!product || product.status !== 'ACTIVE') {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }
    if (!product.isNegotiable) {
      return res.status(400).json({ status: 'error', message: 'This product is not open for negotiation' });
    }
    // Bargaining for units that cannot be delivered is a dead thread: the
    // customer would agree a price checkout could never honour.
    if (product.stock < qty) {
      return res.status(409).json({
        status: 'error',
        message: 'Product does not have enough stock available',
      });
    }

    // FIX 1: Cannot offer on own product
    if (product.seller.toString() === req.user.id) {
      return res.status(400).json({ status: 'error', message: 'You cannot make an offer on your own product' });
    }

    // FIX 2: Prevent multiple active negotiations for same product by same customer.
    // Two live threads for one pairing is a state conflict, not malformed input.
    const existingNegotiation = await Negotiation.findOne({
      product: productId,
      customer: req.user.id,
      status: { $in: ['PENDING', 'COUNTERED', 'ACCEPTED'] }
    });
    
    if (existingNegotiation) {
      return res.status(409).json({ status: 'error', message: 'You already have an active negotiation for this product' });
    }

    let status = 'PENDING';
    let lastActionBy = 'CUSTOMER';
    
    if (product.hiddenMinimumPrice && offer < product.hiddenMinimumPrice) {
      status = 'REJECTED';
      lastActionBy = 'SYSTEM';
    }

    const negotiation = await Negotiation.create({
      product: productId, customer: req.user.id, seller: product.seller, currentOfferPrice: offer,
      // Everything the thread is judged against later: what it was listed at,
      // what the customer first asked for, and how many units it covers.
      listedPrice: product.price,
      initialOfferPrice: offer,
      quantity: qty,
      lastActionBy, status,
      history: [{ offerPrice: offer, actionBy: 'CUSTOMER', status: 'PENDING' }]
    });

    if (status === 'REJECTED') {
      negotiation.history.push({ offerPrice: offer, actionBy: 'SYSTEM', status: 'REJECTED' });
      await negotiation.save();
      return res.status(200).json({ status: 'success', message: 'Offer was too low and automatically rejected', data: negotiation });
    }

    res.status(201).json({ status: 'success', data: negotiation });
  } catch (error) { next(error); }
};

const respondToOffer = async (req, res, next) => {
  try {
    const { action, counterPrice } = req.body;

    if (!isObjectId(req.params.id)) return invalidId(res, 'negotiation');

    const negotiation = await Negotiation.findById(req.params.id);

    if (!negotiation) return res.status(404).json({ status: 'error', message: 'Negotiation not found' });

    if (req.user.id !== negotiation.seller.toString() && req.user.id !== negotiation.customer.toString()) {
       return res.status(403).json({ status: 'error', message: 'Not authorized' });
    }

    const actionBy = req.user.id === negotiation.seller.toString() ? 'SELLER' : 'CUSTOMER';

    // A settled or declined thread is closed for good: reacting to it again is
    // a conflict with the record's current state, never a fresh transition.
    if (negotiation.status === 'ACCEPTED' || negotiation.status === 'REJECTED' || negotiation.status === 'EXPIRED') {
      return res.status(409).json({ status: 'error', message: 'This negotiation is already closed' });
    }

    // FIX 3: Prevent responding to your own action (e.g. Customer can't ACCEPT a PENDING offer they just made)
    if (negotiation.lastActionBy === actionBy) {
      return res.status(409).json({ status: 'error', message: 'You cannot respond to your own offer/counter' });
    }

    if (action === 'ACCEPT') {
      negotiation.status = 'ACCEPTED';
      negotiation.lastActionBy = actionBy;
      // The settlement price is recorded on the thread itself so the order can
      // be reconciled against it later.
      negotiation.finalAgreedPrice = negotiation.currentOfferPrice;
    } else if (action === 'REJECT') {
      negotiation.status = 'REJECTED';
      negotiation.lastActionBy = actionBy;
    } else if (action === 'COUNTER') {
      const counter = Number(counterPrice);
      if (!isFinite(counter) || counter <= 0) {
        return res.status(400).json({ status: 'error', message: 'Valid counter price is required' });
      }
      negotiation.status = 'COUNTERED';
      negotiation.currentOfferPrice = counter;
      negotiation.lastActionBy = actionBy;
    } else {
      return res.status(400).json({ status: 'error', message: 'Invalid action' });
    }

    negotiation.history.push({
      offerPrice: action === 'COUNTER' ? Number(counterPrice) : negotiation.currentOfferPrice,
      actionBy, status: negotiation.status
    });

    await negotiation.save();
    res.status(200).json({ status: 'success', data: negotiation });
  } catch (error) { next(error); }
};

// Documents the marketplace UI renders next to every bargaining thread.
// `product` is populated because the schema stores no original/display price of
// its own — the listed price only lives on the Product record.
const THREAD_POPULATE = [
  { path: 'product', select: 'name price images isNegotiable stock' },
  { path: 'customer', select: 'name email' },
  { path: 'seller', select: 'name businessName' },
];

// GET /api/negotiations/mine — every negotiation this customer opened
const getMyNegotiations = async (req, res, next) => {
  try {
    const negotiations = await Negotiation.find({ customer: req.user.id })
      .populate(THREAD_POPULATE)
      .sort({ updatedAt: -1 });

    res.status(200).json({ status: 'success', data: negotiations });
  } catch (error) { next(error); }
};

// GET /api/negotiations/seller — every negotiation opened on this seller's products
const getSellerNegotiations = async (req, res, next) => {
  try {
    const negotiations = await Negotiation.find({ seller: req.user.id })
      .populate(THREAD_POPULATE)
      .sort({ updatedAt: -1 });

    res.status(200).json({ status: 'success', data: negotiations });
  } catch (error) { next(error); }
};

module.exports = { createOffer, respondToOffer, getMyNegotiations, getSellerNegotiations };
