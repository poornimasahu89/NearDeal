'use strict';

/**
 * sync-catalog-images.js — Phase 1 catalog image sync (tracked, reviewable, dry-run by default)
 *
 * Purpose: bring MongoDB `images` for the GENUINE demo catalog in line with the verified
 * image plan in frontend/src/data/mockData.js (MOCK_PRODUCTS). This is a corrective data
 * migration for existing rows: it does not insert/delete products, does not change the
 * schema, and does not touch any field other than `images`.
 *
 * Safety properties:
 *  - DRY RUN by default: prints BEFORE/AFTER for every match and writes nothing unless
 *    `--apply` is passed.
 *  - Matches products by EXACT MOCK_PRODUCTS title only, so E2E/QA/test records are
 *    never matched and never modified.
 *  - Requires explicit ALLOW_DEV_IMAGE_SYNC=true and a localhost-only MONGO_URI.
 *  - Every planned URL must satisfy the same http(s) regex the product API enforces.
 *
 * Usage:
 *   node scripts/sync-catalog-images.js            # dry run (no writes)
 *   node scripts/sync-catalog-images.js --apply    # write the plan to MongoDB
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { MOCK_PRODUCTS } = require('../../frontend/src/data/mockData');

const APPLY = process.argv.includes('--apply');

// Explicit guard against accidental runs against shared/production databases
if (process.env.ALLOW_DEV_IMAGE_SYNC !== 'true') {
  console.error('SYNC_ERROR: Refusing to run. Set ALLOW_DEV_IMAGE_SYNC=true to authorize this local data sync.');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('SYNC_ERROR: MONGO_URI environment variable is not configured.');
  process.exit(1);
}

// Strict safeguard: hostname must be exactly localhost or 127.0.0.1
try {
  const parsedUri = new URL(process.env.MONGO_URI);
  if (parsedUri.hostname !== 'localhost' && parsedUri.hostname !== '127.0.0.1') {
    console.error(`SYNC_ERROR: Refusing to connect. Hostname is '${parsedUri.hostname}'. MONGO_URI must exactly target localhost or 127.0.0.1.`);
    process.exit(1);
  }
} catch (e) {
  console.error('SYNC_ERROR: MONGO_URI is malformed and cannot be parsed.');
  process.exit(1);
}

// Same URL constraint enforced by validateProductFields in backend/controllers/productController.js
const API_IMAGE_URL_PATTERN = /^https?:\/\/\S{5,2048}$/;

const plan = MOCK_PRODUCTS.map((mp) => ({ title: mp.title, images: mp.images }));

// Fail fast if any planned URL would be rejected by the product API
for (const { title, images } of plan) {
  for (const url of images) {
    if (typeof url !== 'string' || !API_IMAGE_URL_PATTERN.test(url)) {
      console.error(`SYNC_ERROR: Planned image URL for "${title}" fails the API pattern: ${JSON.stringify(url)}`);
      process.exit(1);
    }
  }
}

const imagesEqual = (a, b) => a.length === b.length && a.every((url, i) => url === b[i]);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log(`Connected to DB (${APPLY ? 'APPLY mode' : 'DRY RUN mode'})`);

    const titles = plan.map((p) => p.title);
    const docs = await Product.find({ name: { $in: titles } }).select('name images status seller').lean();
    const planByTitle = new Map(plan.map((p) => [p.title, p.images]));

    const ops = [];
    let changed = 0;
    let unchanged = 0;

    for (const doc of docs) {
      const target = planByTitle.get(doc.name);
      const current = Array.isArray(doc.images) ? doc.images : [];
      if (imagesEqual(current, target)) {
        unchanged += 1;
        console.log(`OK    "${doc.name}" [${doc._id}] already matches plan`);
        continue;
      }
      changed += 1;
      console.log(`DIFF  "${doc.name}" [${doc._id}] status=${doc.status}`);
      console.log(`  before: ${JSON.stringify(current)}`);
      console.log(`  after:  ${JSON.stringify(target)}`);
      if (APPLY) {
        // Only the `images` field is ever written.
        ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { images: target } } } });
      }
    }

    const foundTitles = new Set(docs.map((d) => d.name));
    for (const title of titles) {
      if (!foundTitles.has(title)) {
        console.log(`MISS  "${title}" — no matching DB product (nothing to sync)`);
      }
    }

    console.log(`\nSummary: ${docs.length} matched, ${changed} differ, ${unchanged} already correct`);

    if (APPLY && ops.length > 0) {
      const res = await Product.bulkWrite(ops);
      console.log(`APPLIED: ${res.modifiedCount} product(s) updated (images field only).`);
    } else if (!APPLY) {
      console.log('DRY RUN: no changes written. Re-run with --apply to write the plan.');
    } else {
      console.log('APPLY: nothing to write.');
    }
  } catch (err) {
    console.error('SYNC_ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
