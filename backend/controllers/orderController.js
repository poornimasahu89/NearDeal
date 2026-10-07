const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Negotiation = require('../models/Negotiation');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const createOrder = async (req, res, next) => {
  try {
    const { productId, negotiationId, paymentMethod, quantity, requestId } = req.body;

    if (!isObjectId(productId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid product id' });
    }
    if (negotiationId !== undefined && negotiationId !== null && negotiationId !== '' && !isObjectId(negotiationId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid negotiation id' });
    }

    // Idempotency key: the browser creates one random key per checkout
    // submission, so a double click, a retried fetch or a second tab replaying
    // the same request resolves to the FIRST order instead of billing twice.
    // The key is scoped to the customer, never accepted across accounts.
    let replayKey = null;
    if (requestId !== undefined && requestId !== null && requestId !== '') {
      if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(requestId.trim())) {
        return res.status(400).json({
          status: 'error',
          message: 'requestId must be an 8-64 character alphanumeric key',
        });
      }
      replayKey = requestId.trim();
      const prior = await Order.findOne({ customer: req.user.id, requestId: replayKey });
      if (prior) {
        return res.status(200).json({ status: 'success', data: prior, message: 'Order already placed' });
      }
    }

    // The bag carries a quantity; one checkout line must record and reserve
    // exactly that many units, otherwise the customer is shown a total the
    // database never stored. A missing, fractional or negative quantity is
    // malformed input and is rejected: defaulting it to 1 silently used to let
    // an incomplete request create a real order and reserve the wrong stock.
    const qtyNumber = Number(quantity);
    if (!Number.isFinite(qtyNumber) || Math.floor(qtyNumber) !== qtyNumber || qtyNumber < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'quantity must be a positive whole number',
      });
    }
    const qty = qtyNumber;

    // Payment method is an enum, not free text: an unknown value used to flow
    // straight into the document and decide the initial status by accident.
    const method = String(paymentMethod || 'CASH_ON_DELIVERY').toUpperCase();
    if (!['CASH_ON_DELIVERY', 'ONLINE'].includes(method)) {
      return res.status(400).json({
        status: 'error',
        message: 'paymentMethod must be CASH_ON_DELIVERY or ONLINE',
      });
    }

    const product = await Product.findById(productId);
    if (!product || product.status !== 'ACTIVE') {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }

    // FIX 1: Prevent sellers from buying their own products
    if (product.seller.toString() === req.user.id) {
       return res.status(400).json({ status: 'error', message: 'You cannot purchase your own product' });
    }

    let finalPrice = product.price;
    let negotiation = null;

    if (negotiationId) {
      negotiation = await Negotiation.findById(negotiationId);
      if (!negotiation) return res.status(404).json({ status: 'error', message: 'Negotiation not found' });

      // FIX 2: Prevent someone else from hijacking the negotiation checkout
      if (negotiation.customer.toString() !== req.user.id) {
         return res.status(403).json({ status: 'error', message: 'This negotiation does not belong to you' });
      }

      if (negotiation.status !== 'ACCEPTED') {
        return res.status(409).json({ status: 'error', message: 'Negotiation is not accepted yet' });
      }

      // One accepted bargain converts to exactly one order. Without this,
      // replaying the checkout request reserved stock and billed for the same
      // deal twice (double click, retried fetch, two tabs).
      if (negotiation.convertedToOrder) {
        return res.status(409).json({
          status: 'error',
          message: 'This deal has already been converted into an order',
          orderId: String(negotiation.convertedToOrder),
        });
      }

      // FIX 4: The agreed price only applies to the product it was agreed on.
      if (String(negotiation.product) !== String(productId)) {
         return res.status(400).json({ status: 'error', message: 'That negotiation belongs to a different product' });
      }

      // The settled amount is read from the document of record. Whatever price
      // the browser believes it agreed is ignored.
      finalPrice = negotiation.finalAgreedPrice ?? negotiation.currentOfferPrice;
    }

    // FIX 3: Atomic stock update to prevent Race Conditions (Overselling)
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { new: true }
    );

    if (!updatedProduct) {
       return res.status(409).json({ status: 'error', message: 'Product is out of stock or unavailable' });
    }

    if (updatedProduct.stock === 0) {
       updatedProduct.status = 'INACTIVE';
       await updatedProduct.save();
    }

    // What the customer pays: agreed unit price x quantity. The 2% platform
    // commission is the SELLER's fee — it is stored separately and never added
    // to the customer's payable amount.
    const totalAmount = finalPrice * qty;
    const platformCommission = parseFloat((totalAmount * 0.02).toFixed(2));

    const order = await (async () => {
      try {
        return await Order.create({
          customer: req.user.id,
          seller: updatedProduct.seller,
          product: productId,
          negotiation: negotiationId || undefined,
          listPrice: product.price,
          isNegotiated: !!negotiation,
          finalAgreedPrice: finalPrice,
          quantity: qty,
          totalAmount,
          platformCommission,
          paymentMethod: method,
          // No payment provider is wired, so nothing can honestly be "paid"
          // at checkout: BOTH methods start PENDING ("Payment Pending"). The
          // seller confirms real money with "Payment Received" (PENDING ->
          // PAID) at pickup. Creating the order PAID here claimed a payment
          // (and pickup readiness) that never happened, and made the
          // PENDING-state seller actions unreachable for every real order.
          status: 'PENDING',
          requestId: replayKey || undefined,
        });
      } catch (error) {
        // The units are already reserved above. If the order document cannot
        // be written, hand the stock straight back so a failed checkout never
        // shrinks inventory (or leaves a sold-out product hidden forever).
        await Product.updateOne({ _id: productId }, { $inc: { stock: qty } });
        if (updatedProduct.stock === 0) {
          await Product.updateOne(
            { _id: productId, stock: { $gt: 0 } },
            { $set: { status: 'ACTIVE' } }
          );
        }

        // Two concurrent submissions carrying the same idempotency key: the
        // unique index lets exactly one insert win. The loser restores the
        // stock above and answers with the winner's order instead of failing.
        if (replayKey && error && error.code === 11000) {
          const winner = await Order.findOne({ customer: req.user.id, requestId: replayKey });
          if (winner) {
            res.status(200).json({ status: 'success', data: winner, message: 'Order already placed' });
            return null;
          }
        }
        throw error;
      }
    })();
    // Response already sent by the duplicate-key path above.
    if (!order) return;

    if (negotiation) {
      // Atomic claim: of two racing checkouts on the same accepted deal, only
      // one can move `convertedToOrder` from unset to its order id. The loser
      // rolls its own order back instead of double-billing the bargain.
      const claim = await Negotiation.findOneAndUpdate(
        { _id: negotiation._id, convertedToOrder: null },
        { $set: { convertedToOrder: order._id } },
        { new: true }
      );
      if (!claim) {
        await Order.deleteOne({ _id: order._id });
        await Product.updateOne({ _id: productId }, { $inc: { stock: qty } });
        if (updatedProduct.stock === 0) {
          await Product.updateOne(
            { _id: productId, stock: { $gt: 0 } },
            { $set: { status: 'ACTIVE' } }
          );
        }
        const winner = await Negotiation.findById(negotiation._id).select('convertedToOrder');
        return res.status(409).json({
          status: 'error',
          message: 'This deal has already been converted into an order',
          orderId: winner && winner.convertedToOrder ? String(winner.convertedToOrder) : undefined,
        });
      }
    }

    res.status(201).json({ status: 'success', data: order });
  } catch (error) {
    next(error);
  }
};

// Everything both sides of a transaction need to render one row, in the shape
// the order screens already consume: a single line item with its original and
// negotiated price, plus the order-level totals and commission.
const ORDER_POPULATE = [
  { path: 'product', select: 'name images price stock' },
  { path: 'seller', select: 'name businessName' },
  { path: 'customer', select: 'name email' },
  { path: 'negotiation', select: 'status currentOfferPrice finalAgreedPrice' },
];

const STATUS_LABELS = {
  PENDING: 'Payment Pending',
  PAID: 'Ready for Pickup',
  PROCESSING: 'Preparing for Pickup',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const projectOrder = (doc) => {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  const product = o.product && typeof o.product === 'object' ? o.product : {};
  const seller = o.seller && typeof o.seller === 'object' ? o.seller : {};
  const customer = o.customer && typeof o.customer === 'object' ? o.customer : {};
  const negotiation = o.negotiation && typeof o.negotiation === 'object' ? o.negotiation : null;

  const unitPrice = Number(o.finalAgreedPrice) || 0;
  // Prefer the snapshot taken at purchase time; older records fall back to the
  // product's current list price.
  const originalPrice = Number(o.listPrice) || Number(product.price) || unitPrice;
  const negotiated = !!o.isNegotiated || !!negotiation;
  const quantity = Number(o.quantity) || 1;

  const productId = product._id ? String(product._id) : String(o.product || '');
  const sellerId = seller._id ? String(seller._id) : String(o.seller || '');
  const sellerName = seller.businessName || seller.name || 'Local Merchant';
  const title = product.name || '';
  const image = (Array.isArray(product.images) && product.images[0]) || '';
  const negotiationId = negotiation ? String(negotiation._id) : null;

  return {
    ...o,
    id: String(o._id),
    productId,
    sellerId,
    customerName: customer.name || '',
    sellerName,
    productName: title,
    productImage: image,
    quantity,
    unitPrice,
    totalAmount: Number(o.totalAmount) || unitPrice * quantity,
    platformCommission: Number(o.platformCommission) || 0,
    originalPrice,
    finalPrice: unitPrice,
    negotiatedPrice: negotiated ? unitPrice : null,
    negotiated,
    isNegotiated: negotiated,
    negotiationId,
    offerId: negotiationId,
    offerStatus: negotiation ? negotiation.status : null,
    date: o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : '',
    // Short, quotable reference derived from the immutable `_id` so order rows
    // read like order numbers instead of raw 24-character hashes.
    orderNumber: String(o._id).slice(-8).toUpperCase(),
    statusLabel: STATUS_LABELS[o.status] || o.status,
    paymentStatus: o.paymentMethod === 'ONLINE' ? 'Paid Online' : 'Pay on Pickup (Cash / UPI)',
    fulfillmentType: 'Store Pickup',
    items: [
      {
        productId,
        sellerId,
        sellerName,
        title,
        quantity,
        unitPrice,
        negotiated,
        originalPrice,
        negotiatedPrice: negotiated ? unitPrice : null,
        offerId: negotiationId,
        offerStatus: negotiation ? negotiation.status : null,
        image,
      },
    ],
  };
};

// GET /api/orders/mine — the authenticated customer's order history in MongoDB.
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ customer: req.user.id })
      .populate(ORDER_POPULATE)
      .sort({ createdAt: -1 });
    res.status(200).json({
      status: 'success',
      count: orders.length,
      data: orders.map(projectOrder),
    });
  } catch (error) { next(error); }
};

// GET /api/orders/seller — the orders placed on this merchant's listings.
const getSellerOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ seller: req.user.id })
      .populate(ORDER_POPULATE)
      .sort({ createdAt: -1 });
    res.status(200).json({
      status: 'success',
      count: orders.length,
      data: orders.map(projectOrder),
    });
  } catch (error) { next(error); }
};

// GET /api/orders/:id — readable only by the two parties to the transaction.
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid order id' });
    }
    const order = await Order.findById(id).populate(ORDER_POPULATE);
    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }
    const customerId = order.customer && order.customer._id
      ? String(order.customer._id)
      : String(order.customer);
    const sellerId = order.seller && order.seller._id
      ? String(order.seller._id)
      : String(order.seller);
    const requester = String(req.user.id);
    if (req.user.role !== 'ADMIN' && requester !== customerId && requester !== sellerId) {
      return res.status(403).json({ status: 'error', message: 'This order does not belong to you' });
    }
    res.status(200).json({ status: 'success', data: projectOrder(order) });
  } catch (error) { next(error); }
};

// The order lifecycle, one direction only. A finished or cancelled
// transaction can never be reopened, and every step a merchant may take is
// declared here rather than trusted from the request body.
const ORDER_STATUSES = ['PENDING', 'PAID', 'PROCESSING', 'COMPLETED', 'CANCELLED'];
const ALLOWED_TRANSITIONS = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'COMPLETED', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * PUT /api/orders/:id/status  (SELLER / ADMIN)
 *
 * The merchant advances their own order through the lifecycle above. Record
 * ownership is read from the order document — the browser never supplies the
 * seller — and cancelling returns the reserved units to the shelf because
 * checkout decremented stock when the order was placed.
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid order id' });
    }

    const nextStatus = String(req.body.status || '').toUpperCase();
    if (!ORDER_STATUSES.includes(nextStatus)) {
      return res.status(400).json({
        status: 'error',
        message: `Status must be one of ${ORDER_STATUSES.join(', ')}`,
      });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

    const owner = String(order.seller);
    if (req.user.role !== 'ADMIN' && String(req.user.id) !== owner) {
      return res.status(403).json({ status: 'error', message: 'You can only update orders for your own store' });
    }

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(nextStatus)) {
      return res.status(409).json({
        status: 'error',
        message: order.status === nextStatus
          ? `Order is already ${nextStatus}`
          : `Cannot move an order from ${order.status} to ${nextStatus}`,
      });
    }

    // Cancellation hands the reserved units back. The `stock === 0` condition
    // only re-opens a listing that checkout itself hid by selling it out; a
    // listing the admin removed (any other stock level) stays removed.
    if (nextStatus === 'CANCELLED') {
      const product = await Product.findById(order.product);
      if (product) {
        const wasSoldOut = product.stock === 0;
        product.stock += order.quantity;
        if (wasSoldOut && product.status === 'INACTIVE') product.status = 'ACTIVE';
        await product.save();
      }
    }

    order.status = nextStatus;
    await order.save();

    const populated = await Order.findById(order._id).populate(ORDER_POPULATE);
    res.status(200).json({ status: 'success', data: projectOrder(populated) });
  } catch (error) { next(error); }
};

module.exports = {
  createOrder,
  getMyOrders,
  getSellerOrders,
  getOrderById,
  updateOrderStatus,
  // Reused by the admin controller so platform-wide transaction rows and
  // order-screen rows are produced by one and the same projection.
  projectOrder,
  ORDER_POPULATE,
};
