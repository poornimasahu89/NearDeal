/**
 * Seed persistent demo accounts for NearDeal.
 * 
 * STRICT LOCAL DEVELOPMENT USE ONLY.
 * 
 * Safe to run multiple times — skips any account that already exists.
 * Never resets existing data or modifies passwords that are already set.
 *
 * Accounts created:
 *   customer@neardeal.com / password123  (CUSTOMER)
 *   seller@neardeal.com   / password123  (SELLER — "NearDeal Demo Store")
 *   admin@neardeal.com    / (see .env ADMIN_SEED_PASSWORD)
 *
 * Usage:
 *   ALLOW_DEV_SEEDING=true node backend/scripts/seed-demo-accounts.js
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

// Explicitly guard against accidental runs in shared/production databases
if (process.env.ALLOW_DEV_SEEDING !== 'true') {
  console.error('SEED_ERROR: Refusing to run. Target environment is not explicitly authorized.');
  console.error('To run this locally, set ALLOW_DEV_SEEDING=true in your environment.');
  process.exit(1);
}

const adminPassword = process.env.ADMIN_SEED_PASSWORD;
if (!adminPassword) {
  console.error('SEED_ERROR: ADMIN_SEED_PASSWORD environment variable is required to seed the admin account.');
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

const DEMO_ACCOUNTS = [
  {
    name: 'Demo Customer',
    email: 'customer@neardeal.com',
    password: 'password123',
    role: 'CUSTOMER',
    location: { type: 'Point', coordinates: [75.8937, 22.7533] }
  },
  {
    name: 'Demo Seller',
    email: 'seller@neardeal.com',
    password: 'password123',
    role: 'SELLER',
    businessName: 'NearDeal Demo Store',
    // We intentionally omit isVerifiedSeller to respect the real User model's 
    // default (false). The demo seller will need manual approval, mirroring reality.
    location: { type: 'Point', coordinates: [75.8937, 22.7533] }
  },
  {
    name: 'Platform Admin',
    email: 'admin@neardeal.com',
    password: adminPassword,
    role: 'ADMIN',
    location: { type: 'Point', coordinates: [75.8937, 22.7533] }
  }
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('Connected to MongoDB');

    for (const acct of DEMO_ACCOUNTS) {
      const existing = await User.findOne({ email: acct.email });
      if (existing) {
        console.log(`SKIP  ${acct.role.padEnd(8)} ${acct.email} — already exists`);
        continue;
      }
      
      // User model's pre-save hook handles bcrypt hashing automatically
      await User.create({
        name: acct.name,
        email: acct.email,
        password: acct.password,
        role: acct.role,
        businessName: acct.businessName,
        location: acct.location,
        status: 'ACTIVE'
      });
      console.log(`CREATE ${acct.role.padEnd(8)} ${acct.email}  account created`);
    }

    console.log('\nDone. All demo accounts are ready.');
  } catch (err) {
    console.error('SEED_ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('MongoDB connection closed.');
    }
  }
}

run();
