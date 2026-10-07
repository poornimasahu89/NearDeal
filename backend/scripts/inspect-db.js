/* Read-only inspection of the NearDeal database.
   Prints counts and non-sensitive role/status summaries only — no passwords,
   no tokens, no connection string. Node script using the backend's mongoose. */
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    const db = mongoose.connection.db;
    const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
    console.log('COLLECTIONS:', names.join(', '));

    const User = require('../models/User');
    const Product = require('../models/Product');
    const Order = require('../models/Order');
    const Negotiation = require('../models/Negotiation');
    const Review = require('../models/Review');

    const users = await User.find().select('name email role status businessName isVerifiedSeller rating').lean();
    console.log('USERS:', users.length);
    for (const u of users) {
      console.log(`  - role=${u.role} status=${u.status} verified=${!!u.isVerifiedSeller} rating=${u.rating} email=${u.email} business=${u.businessName || '-'} name=${u.name}`);
    }

    const products = await Product.find().select('name price stock status category isNegotiable seller').lean();
    console.log('PRODUCTS:', products.length);
    const byStatus = {};
    for (const p of products) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    console.log('  byStatus:', JSON.stringify(byStatus));

    const orders = await Order.find().select('status totalAmount platformCommission isNegotiated quantity').lean();
    console.log('ORDERS:', orders.length, JSON.stringify(orders.map((o) => ({ s: o.status, t: o.totalAmount, c: o.platformCommission, n: o.isNegotiated, q: o.quantity }))));

    const negs = await Negotiation.find().select('status currentOfferPrice finalAgreedPrice convertedToOrder listedPrice').lean();
    console.log('NEGOTIATIONS:', negs.length, JSON.stringify(negs.map((n) => ({ s: n.status, cur: n.currentOfferPrice, final: n.finalAgreedPrice, listed: n.listedPrice, conv: !!n.convertedToOrder }))));

    const reviews = await Review.find().select('status rating').lean();
    console.log('REVIEWS:', reviews.length, JSON.stringify(reviews.map((r) => ({ s: r.status, r: r.rating }))));

    await mongoose.disconnect();
  } catch (e) {
    console.error('INSPECT_ERROR:', e.message);
    process.exit(1);
  }
})();
