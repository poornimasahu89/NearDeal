const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Negotiation = require('../models/Negotiation');
const { projectOrder, ORDER_POPULATE } = require('./orderController');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// The platform's downtown reference point (Indore) — the same centre the
// frontend's city coordinates default to. Used for the "5 km zone" seller KPI.
const PLATFORM_CENTER = { lng: 75.8937, lat: 22.7533, radiusKm: 5 };

const notFound = (res, what) => res.status(404).json({ status: 'error', message: `${what} not found` });

/**
 * GET /api/admin/metrics
 *
 * Every number is aggregated from live documents — gross volume and the 2%
 * commission from real orders, the merchant count from real seller accounts
 * inside the downtown zone, the settlement count and average discount from
 * accepted bargain threads.
 */
const getMetrics = async (req, res, next) => {
  try {
    const [volumeAgg, localSellers, settlementAgg] = await Promise.all([
      Order.aggregate([
        { $match: { status: { $ne: 'CANCELLED' } } },
        {
          $group: {
            _id: null,
            volume: { $sum: '$totalAmount' },
            commission: { $sum: '$platformCommission' },
            orders: { $sum: 1 },
          },
        },
      ]),
      User.countDocuments({
        role: 'SELLER',
        status: 'ACTIVE',
        location: {
          $geoWithin: {
            $centerSphere: [
              [PLATFORM_CENTER.lng, PLATFORM_CENTER.lat],
              PLATFORM_CENTER.radiusKm / 6378.1,
            ],
          },
        },
      }),
      Negotiation.aggregate([
        {
          $match: {
            status: 'ACCEPTED',
            listedPrice: { $gt: 0 },
            finalAgreedPrice: { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            averageDiscount: {
              $avg: {
                $divide: [
                  { $subtract: ['$listedPrice', '$finalAgreedPrice'] },
                  '$listedPrice',
                ],
              },
            },
          },
        },
      ]),
    ]);

    const volume = volumeAgg[0] || { volume: 0, commission: 0, orders: 0 };
    const settlements = settlementAgg[0] || { count: 0, averageDiscount: 0 };
    // Negative "discounts" (a counter above list price) are still real data;
    // the KPI reports the average the marketplace actually settled at.
    const discountRate = Math.round(settlements.averageDiscount * 1000) / 10;

    res.status(200).json({
      status: 'success',
      data: {
        totalGrossVolume: volume.volume,
        totalPlatformCommission: volume.commission,
        totalOrders: volume.orders,
        activeLocalSellers: localSellers,
        totalCompletedNegotiations: settlements.count,
        averageDiscountRate: `${discountRate}%`,
      },
    });
  } catch (error) { next(error); }
};

/**
 * GET /api/admin/users  (ADMIN)
 */
const listUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select('name email role status businessName rating createdAt')
      .sort({ createdAt: -1 })
      .limit(500);

    res.status(200).json({
      status: 'success',
      count: users.length,
      data: users.map((u) => ({
        id: String(u._id),
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        businessName: u.businessName || '',
        rating: Number(u.rating) || 0,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) { next(error); }
};

/**
 * Safety rails shared by every suspension action, whether it arrives through
 * the current `PUT /users/:id/status` contract or the legacy
 * `PUT /users/:id/suspend` contract that `origin/main` shipped. Returns a
 * refusal descriptor when the change must be blocked, or `null` to proceed —
 * so the two routes can never drift apart on who is allowed to be suspended.
 */
const refusalForStatusChange = async (user, status, actorId) => {
  if (String(user._id) === String(actorId) && status === 'SUSPENDED') {
    return { code: 409, message: 'You cannot suspend your own account' };
  }

  if (status === 'SUSPENDED' && user.role === 'ADMIN') {
    const activeAdmins = await User.countDocuments({ role: 'ADMIN', status: 'ACTIVE' });
    if (activeAdmins <= 1) {
      return { code: 409, message: 'The last active administrator cannot be suspended' };
    }
  }

  return null;
};

/**
 * PUT /api/admin/users/:id/status  (ADMIN)
 *
 * Suspension/reinstatement. The administrator cannot lock themselves out, and
 * the platform can never be left without a usable admin account.
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ status: 'error', message: 'Invalid user id' });

    const status = String(req.body.status || '').toUpperCase();
    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Status must be ACTIVE or SUSPENDED' });
    }

    const user = await User.findById(id);
    if (!user) return notFound(res, 'User');

    const refusal = await refusalForStatusChange(user, status, req.user.id);
    if (refusal) return res.status(refusal.code).json({ status: 'error', message: refusal.message });

    user.status = status;
    await user.save();

    res.status(200).json({
      status: 'success',
      data: { id: String(user._id), status: user.status },
    });
  } catch (error) { next(error); }
};

// Coordinates arrive as GeoJSON `[lng, lat]`; the roster has no street-address
// field, so the honest thing to display is the coordinate pair.
const formatLocation = (location) => {
  const coordinates = location && Array.isArray(location.coordinates) ? location.coordinates : null;
  if (!coordinates || coordinates.length !== 2) return 'Location not set';
  const [lng, lat] = coordinates;
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
};

/**
 * GET /api/admin/sellers  (ADMIN)
 */
const listSellers = async (req, res, next) => {
  try {
    const sellers = await User.find({ role: 'SELLER' })
      .select('name businessName rating status location isVerifiedSeller createdAt')
      .sort({ rating: -1, createdAt: -1 })
      .limit(500);

    res.status(200).json({
      status: 'success',
      count: sellers.length,
      data: sellers.map((s) => ({
        id: String(s._id),
        _id: s._id,
        name: s.businessName || s.name,
        owner: s.name,
        location: formatLocation(s.location),
        rating: Number(s.rating) || 0,
        status: s.status,
        verified: !!s.isVerifiedSeller,
        // Real merchant accounts have no portrait; the client renders a
        // neutral placeholder instead of a stock photo pretending to be them.
        avatar: null,
      })),
    });
  } catch (error) { next(error); }
};

/**
 * GET /api/admin/products  (ADMIN)
 *
 * The whole catalogue including deactivated listings — the public endpoint
 * only ever shows ACTIVE stock, so moderation needs its own view.
 * `status` is exposed in the admin panel's vocabulary (approved / removed)
 * alongside the raw database state.
 */
const listProducts = async (req, res, next) => {
  try {
    const products = await Product.find()
      .populate('seller', 'name businessName')
      .sort({ createdAt: -1 })
      .limit(300);

    res.status(200).json({
      status: 'success',
      count: products.length,
      data: products.map((p) => {
        const seller = p.seller && typeof p.seller === 'object' ? p.seller : {};
        return {
          id: String(p._id),
          _id: p._id,
          title: p.name,
          name: p.name,
          status: p.status === 'ACTIVE' ? 'approved' : 'removed',
          statusRaw: p.status,
          price: Number(p.price) || 0,
          stock: Number(p.stock) || 0,
          category: p.category,
          sellerId: seller._id ? String(seller._id) : String(p.seller || ''),
          sellerName: seller.businessName || seller.name || 'Local Merchant',
        };
      }),
    });
  } catch (error) { next(error); }
};

/**
 * PUT /api/admin/products/:id/status  (ADMIN)
 *
 * Publish / unpublish a listing. ACTIVE restores it to the public catalogue;
 * INACTIVE hides it from every customer-facing query.
 */
const updateProductStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ status: 'error', message: 'Invalid product id' });

    const raw = String(req.body.status || '').toUpperCase();
    const status = raw === 'APPROVED' ? 'ACTIVE' : raw === 'REMOVED' ? 'INACTIVE' : raw;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Status must be ACTIVE or INACTIVE' });
    }

    const product = await Product.findByIdAndUpdate(id, { status }, { new: true });
    if (!product) return notFound(res, 'Product');

    res.status(200).json({
      status: 'success',
      data: { id: String(product._id), status: product.status },
    });
  } catch (error) { next(error); }
};

/**
 * GET /api/admin/orders  (ADMIN)
 *
 * Recent transactions behind the "Recent Settlements & 2% Fee Cut" card,
 * projected with the exact same shape both market sides already render.
 */
const listOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate(ORDER_POPULATE)
      .sort({ createdAt: -1 })
      .limit(25);

    res.status(200).json({
      status: 'success',
      count: orders.length,
      data: orders.map(projectOrder),
    });
  } catch (error) { next(error); }
};

/**
 * GET /api/admin/transactions  (ADMIN)
 *
 * COMPATIBILITY ENDPOINT — kept exactly as `origin/main` (PR #2) shipped it,
 * because external clients may still read this path: raw order documents (not
 * the `projectOrder` projection) plus `totalRevenue`, the sum of the stored 2%
 * commission. The newer `GET /api/admin/orders` remains the paginated,
 * projected feed for this repository's admin panel.
 */
const getTransactions = async (req, res, next) => {
  try {
    const orders = await Order.find({})
      .populate('customer', 'name email')
      .populate('seller', 'name businessName')
      .populate('product', 'name price')
      .sort('-createdAt');

    // Legacy rows may predate `platformCommission` being written on every
    // order, so each entry is coerced instead of letting one `undefined`
    // turn the whole total into `NaN`.
    const totalRevenue = orders.reduce(
      (acc, order) => acc + (Number(order.platformCommission) || 0),
      0
    );

    res.status(200).json({
      status: 'success',
      count: orders.length,
      totalRevenue,
      data: orders,
    });
  } catch (error) { next(error); }
};

/**
 * PUT /api/admin/users/:id/suspend  (ADMIN)
 *
 * COMPATIBILITY ENDPOINT — the original `origin/main` contract
 * (`{ isSuspended: boolean }` -> message + `{_id,name,email,status}`), now
 * running behind the same safety rails as `PUT /users/:id/status`: a bad id is
 * a 400, an administrator cannot suspend themselves, and the last active
 * administrator can never be suspended. Unlike `origin/main`, the body must be
 * an explicit boolean — a mistyped payload used to be read as `false` and
 * silently *reactivate* the account.
 */
const suspendUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ status: 'error', message: 'Invalid user id' });

    const { isSuspended } = req.body;
    if (typeof isSuspended !== 'boolean') {
      return res.status(400).json({ status: 'error', message: 'isSuspended must be a boolean' });
    }
    const status = isSuspended ? 'SUSPENDED' : 'ACTIVE';

    const user = await User.findById(id);
    if (!user) return notFound(res, 'User');

    const refusal = await refusalForStatusChange(user, status, req.user.id);
    if (refusal) return res.status(refusal.code).json({ status: 'error', message: refusal.message });

    user.status = status;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: `User ${user.name} has been ${isSuspended ? 'suspended' : 'reactivated'}`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) { next(error); }
};

module.exports = {
  getMetrics,
  listUsers,
  updateUserStatus,
  listSellers,
  listProducts,
  updateProductStatus,
  listOrders,
  // Compatibility surface inherited from origin/main:
  getTransactions,
  suspendUser,
};
