'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const { MOCK_PRODUCTS } = require('../../frontend/src/data/mockData');

// Explicitly guard against accidental runs in shared/production databases
if (process.env.ALLOW_DEV_SEEDING !== 'true') {
  console.error('SEED_ERROR: Refusing to run. Target environment is not explicitly authorized.');
  console.error('To run this locally, set ALLOW_DEV_SEEDING=true in your environment.');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('SEED_ERROR: MONGO_URI environment variable is not configured.');
  process.exit(1);
}

// Strict safeguard: parse URI and ensure hostname is exactly localhost or 127.0.0.1
try {
  const parsedUri = new URL(process.env.MONGO_URI);
  if (parsedUri.hostname !== 'localhost' && parsedUri.hostname !== '127.0.0.1') {
    console.error(`SEED_ERROR: Refusing to connect. Hostname is '${parsedUri.hostname}'. MONGO_URI must exactly target localhost or 127.0.0.1.`);
    process.exit(1);
  }
} catch (e) {
  console.error('SEED_ERROR: MONGO_URI is malformed and cannot be parsed.');
  process.exit(1);
}

const seedProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('Connected to DB');

    const seller = await User.findOne({ email: 'seller@neardeal.com' });
    if (!seller) {
      console.error('Seller not found! Run seed-demo-accounts.js first.');
      await mongoose.disconnect();
      process.exit(1);
    }

    // The Product schema has no reliable demo/seed marker field (such as isDemo).
    // In accordance with safety rules, no destructive cleanup is performed.
    // Existing products are preserved untouched.
    const demoTitles = MOCK_PRODUCTS.map((mp) => mp.title);
    const existing = await Product.find({ seller: seller._id, name: { $in: demoTitles } }).select('name').lean();
    const existingNames = new Set(existing.map((p) => p.name));

    console.warn('WARNING: Generated product coordinates are synthetic demo-only offsets around Vijay Nagar, Indore ([75.8937, 22.7533]) for local distance-filter testing only.');

    const productsToInsert = [];
    for (const mp of MOCK_PRODUCTS) {
      if (existingNames.has(mp.title)) {
        console.log(`SKIP "${mp.title}" — already exists`);
        continue;
      }
      // Demo-only: Add small coordinate offsets around Vijay Nagar, Indore ([75.8937, 22.7533])
      // so products simulate varied physical locations across the local Indore discovery radius.
      const lngOffset = (Math.random() - 0.5) * 0.05;
      const latOffset = (Math.random() - 0.5) * 0.05;
      productsToInsert.push({
        name: mp.title,
        description: mp.description,
        price: mp.price,
        originalPrice: mp.originalPrice,
        category: mp.category,
        images: mp.images,
        stock: mp.stock,
        isNegotiable: mp.bargainable,
        hiddenMinimumPrice: mp.minAcceptablePrice,
        seller: seller._id,
        location: {
          type: 'Point',
          coordinates: [75.8937 + lngOffset, 22.7533 + latOffset]
        },
        status: 'ACTIVE'
      });
    }

    if (productsToInsert.length > 0) {
      await Product.insertMany(productsToInsert);
      console.log(`Seeded ${productsToInsert.length} varied products successfully.`);
    } else {
      console.log('All demo seed products already exist. No new products inserted.');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding products:', error);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
};

seedProducts();
