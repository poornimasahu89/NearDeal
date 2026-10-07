'use strict';

/**
 * sync-catalog-descriptions.js — catalog copy sync (tracked, reviewable, dry-run by default)
 *
 * Purpose: bring MongoDB `description` for the GENUINE demo catalog in line with the
 * product copy in frontend/src/data/mockData.js (MOCK_PRODUCTS). This is a corrective
 * data migration for existing rows: it does not insert/delete products, does not change
 * the schema, and does not touch any field other than `description`.
 *
 * Safety properties:
 *  - DRY RUN by default: prints BEFORE/AFTER for every match and writes nothing unless
 *    `--apply` is passed.
 *  - Matches products by EXACT MOCK_PRODUCTS title only, so E2E/QA/test records are
 *    never matched and never modified.
 *  - Requires explicit ALLOW_DEV_DESCRIPTION_SYNC=true and a localhost-only MONGO_URI.
 *  - Every planned description must satisfy the same 10-2000 character rule the product
 *    API enforces (see validateProductFields in backend/controllers/productController.js),
 *    so a record written here can never be rejected by a later API update.
 *
 * Usage:
 *   node scripts/sync-catalog-descriptions.js            # dry run (no writes)
 *   node scripts/sync-catalog-descriptions.js --apply    # write the plan to MongoDB
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { MOCK_PRODUCTS } = require('../../frontend/src/data/mockData');

const APPLY = process.argv.includes('--apply');

// Explicit guard against accidental runs against shared/production databases
if (process.env.ALLOW_DEV_DESCRIPTION_SYNC !== 'true') {
  console.error('SYNC_ERROR: Refusing to run. Set ALLOW_DEV_DESCRIPTION_SYNC=true to authorize this local data sync.');
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

// Same length constraint enforced by validateProductFields in backend/controllers/productController.js
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 2000;

const plan = MOCK_PRODUCTS.map((mp) => ({ title: mp.title, description: mp.description }));

// Fail fast if any planned copy would be rejected by the product API
for (const { title, description } of plan) {
  if (typeof description !== 'string') {
    console.error(`SYNC_ERROR: Planned description for "${title}" is not a string.`);
    process.exit(1);
  }
  const length = description.trim().length;
  if (length < MIN_DESCRIPTION_LENGTH || length > MAX_DESCRIPTION_LENGTH) {
    console.error(`SYNC_ERROR: Planned description for "${title}" is ${length} characters (allowed ${MIN_DESCRIPTION_LENGTH}-${MAX_DESCRIPTION_LENGTH}).`);
    process.exit(1);
  }
}

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log(`Connected to DB (${APPLY ? 'APPLY mode' : 'DRY RUN mode'})`);

    const titles = plan.map((p) => p.title);
    const docs = await Product.find({ name: { $in: titles } }).select('name description status seller').lean();
    const planByTitle = new Map(plan.map((p) => [p.title, p.description]));

    const ops = [];
    let changed = 0;
    let unchanged = 0;

    for (const doc of docs) {
      const target = planByTitle.get(doc.name);
      const current = typeof doc.description === 'string' ? doc.description : '';
      if (current === target) {
        unchanged += 1;
        console.log(`OK    "${doc.name}" [${doc._id}] already matches plan`);
        continue;
      }
      changed += 1;
      console.log(`DIFF  "${doc.name}" [${doc._id}] status=${doc.status}`);
      console.log(`  before: ${JSON.stringify(current)}`);
      console.log(`  after:  ${JSON.stringify(target)}`);
      if (APPLY) {
        // Only the `description` field is ever written.
        ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { description: target } } } });
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
      console.log(`APPLIED: ${res.modifiedCount} product(s) updated (description field only).`);
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
