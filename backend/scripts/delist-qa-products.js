'use strict';

/**
 * delist-qa-products.js — soft-delist confirmed QA/test catalog records
 * (tracked, reviewable, dry-run by default)
 *
 * Purpose: exclude the QA/test/E2E product fixtures created during development
 * from the customer-facing catalog WITHOUT deleting them. It uses the platform's
 * own existing delisting mechanism — the `status` field — which `GET /api/products`
 * already filters on (`status: 'ACTIVE' AND stock > 0`, see getProducts in
 * backend/controllers/productController.js). Sellers (`GET /api/products/mine`)
 * and the admin panel keep returning every status, so nothing is lost, and the
 * change is fully reversible with a single `$set: { status: 'ACTIVE' }`.
 *
 * Safety properties:
 *  - DRY RUN by default: prints every record it would delist and writes nothing
 *    unless `--apply` is passed.
 *  - Only records POSITIVELY identified as test fixtures are touched: a product
 *    qualifies only when its owning store matches a documented test-store pattern
 *    or its name matches a documented test-name pattern. Every match prints the
 *    reason it was classified as test.
 *  - Hard guard: a title from frontend/src/data/mockData.js (MOCK_PRODUCTS) is
 *    never delisted, even if a test-store heuristic would match it. Any conflict
 *    aborts the run instead of writing.
 *  - Only the `status` field is ever written. Names, descriptions, images, prices,
 *    stock, sellers, ratings and locations are untouched. No record is deleted.
 *  - Requires explicit ALLOW_DEV_QA_DELIST=true and a localhost-only MONGO_URI.
 *
 * Usage:
 *   node scripts/delist-qa-products.js            # dry run (no writes)
 *   node scripts/delist-qa-products.js --apply    # delist the confirmed test records
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
const { MOCK_PRODUCTS } = require('../../frontend/src/data/mockData');

const APPLY = process.argv.includes('--apply');

// Explicit guard against accidental runs against shared/production databases
if (process.env.ALLOW_DEV_QA_DELIST !== 'true') {
  console.error('DELIST_ERROR: Refusing to run. Set ALLOW_DEV_QA_DELIST=true to authorize this local data change.');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('DELIST_ERROR: MONGO_URI environment variable is not configured.');
  process.exit(1);
}

// Strict safeguard: hostname must be exactly localhost or 127.0.0.1
try {
  const parsedUri = new URL(process.env.MONGO_URI);
  if (parsedUri.hostname !== 'localhost' && parsedUri.hostname !== '127.0.0.1') {
    console.error(`DELIST_ERROR: Refusing to connect. Hostname is '${parsedUri.hostname}'. MONGO_URI must exactly target localhost or 127.0.0.1.`);
    process.exit(1);
  }
} catch (e) {
  console.error('DELIST_ERROR: MONGO_URI is malformed and cannot be parsed.');
  process.exit(1);
}

// The real demo catalog. These titles are NEVER delisted.
const GENUINE_TITLES = new Set(MOCK_PRODUCTS.map((mp) => mp.title));

/**
 * Stores that were created by development/test work, evidenced by their account
 * (qae2e_*, qa4_*, qa5_*, qa6_*, qa7_*, qa7b_*, vs_*, smks_*, rt_*@… emails), by
 * the scripts that created them (backend/scripts/e2e-api-test.js,
 * backend/scripts/phase5-bargain-verify.js, frontend/tests/phase4-checkout-flow.cjs,
 * frontend/tests/phase6-dashboards.cjs) or by hand-typed dev listings.
 * Broad patterns first, then the two stores that carry an explicit dev-only record.
 */
const TEST_STORE_PATTERNS = [
  { re: /^QA/i, why: 'store name starts with "QA"' },
  { re: /^Phase\s*\d/i, why: 'store name starts with a phase label' },
  { re: /^(Validate|Verify|Smoke|RoundTrip|UI Test)\b/i, why: 'store name is a validation/smoke/round-trip/UI-test store' },
  { re: /^Test\b/i, why: 'store name starts with "Test"' },
  { re: /'s Store$/, why: 'store name is a generated "<test>…’s Store" account' },
  { re: /^Indore Central Furniture$/, why: 'dev-seeded seller1@example.com store (record already delisted during development)' },
  { re: /^ram's Store$/, why: 'hand-typed development listing store' },
];

// Name-level signals that identify fixtures regardless of the store name.
const TEST_NAME_PATTERNS = [
  { re: /^QA\d?\s/i, why: 'name starts with a QA prefix' },
  { re: /^Phase\s*\d/i, why: 'name starts with a phase label' },
  { re: /^(Validate|RoundTrip|Smoke|UI Test|Test)\s/i, why: 'name starts with a test verb/label' },
  { re: /\s1\d{12}$/, why: 'name ends with an epoch-ms run timestamp' },
  { re: /\s+mup[a-z0-9]{4,8}$/, why: 'name ends with a UI-test random suffix' },
];

// Fixtures created by backend/scripts/e2e-api-test.js — generic furniture titles
// that only ever come from that script's two QA sellers, so store+name must both match.
const E2E_FIXTURE_TITLES = ['Sheesham Study Desk', 'Rattan Lounge Chair', 'Disposable Stool'];

const classify = (doc, store) => {
  if (GENUINE_TITLES.has(doc.name)) return null;

  for (const { re, why } of TEST_STORE_PATTERNS) {
    if (re.test(store || '')) return `store: ${why} (store "${store || 'unknown'}")`;
  }
  for (const { re, why } of TEST_NAME_PATTERNS) {
    if (re.test(doc.name)) return `name: ${why}`;
  }
  if (E2E_FIXTURE_TITLES.includes(doc.name) && /^QA/i.test(store || '')) {
    return 'e2e-api-test.js fixture owned by a QA store';
  }
  return null;
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log(`Connected to DB (${APPLY ? 'APPLY mode' : 'DRY RUN mode'})`);

    const sellers = await User.find({ role: { $in: ['SELLER', 'ADMIN'] } })
      .select('businessName name email')
      .lean();
    const storeById = new Map(sellers.map((s) => [String(s._id), s.businessName || s.name || '']));

    const docs = await Product.find().select('name status stock seller').sort({ createdAt: 1 }).lean();

    const testDocs = [];
    const genuineDocs = [];
    const unclassified = [];

    for (const doc of docs) {
      const store = storeById.get(String(doc.seller)) || '';
      const reason = classify(doc, store);
      if (reason) testDocs.push({ doc, store, reason });
      else if (GENUINE_TITLES.has(doc.name)) genuineDocs.push(doc);
      else unclassified.push({ doc, store });
    }

    // Hard guard: a genuine catalog title must never be classified as test data.
    const conflicts = testDocs.filter(({ doc }) => GENUINE_TITLES.has(doc.name));
    if (conflicts.length > 0) {
      console.error(`DELIST_ERROR: ${conflicts.length} genuine catalog title(s) classified as test — aborting without writing.`);
      conflicts.forEach(({ doc }) => console.error(`  - "${doc.name}" [${doc._id}]`));
      process.exit(1);
    }

    // Anything unclassified is left completely alone and reported for review.
    if (unclassified.length > 0) {
      console.log(`\nUNCLASSIFIED — left untouched (${unclassified.length}):`);
      unclassified.forEach(({ doc, store }) =>
        console.log(`  [${doc._id}] status=${doc.status} store="${store}" "${doc.name}"`)
      );
    }

    const toDelist = testDocs.filter(({ doc }) => doc.status === 'ACTIVE');
    const alreadyInactive = testDocs.filter(({ doc }) => doc.status !== 'ACTIVE');

    console.log(`\nCONFIRMED TEST RECORDS: ${testDocs.length} (of ${docs.length} total)`);
    console.log(`  ${toDelist.length} currently ACTIVE → would be set to INACTIVE`);
    console.log(`  ${alreadyInactive.length} already INACTIVE → no write needed`);
    console.log(`GENUINE CATALOG RECORDS: ${genuineDocs.length} (never touched)`);

    console.log('\nRecords to delist:');
    for (const { doc, store, reason } of toDelist) {
      console.log(`  ${doc._id} | stock=${doc.stock} | ${store} | "${doc.name}" | ${reason}`);
    }

    if (alreadyInactive.length > 0) {
      console.log('\nAlready delisted (reported only):');
      for (const { doc, store, reason } of alreadyInactive) {
        console.log(`  ${doc._id} | ${store} | "${doc.name}" | ${reason}`);
      }
    }

    if (APPLY && toDelist.length > 0) {
      // Only the `status` field is ever written. No deletes, no other fields.
      const ops = toDelist.map(({ doc }) => ({
        updateOne: { filter: { _id: doc._id }, update: { $set: { status: 'INACTIVE' } } },
      }));
      const res = await Product.bulkWrite(ops);
      console.log(`\nAPPLIED: ${res.modifiedCount} product(s) set to INACTIVE (status field only).`);

      const publicCount = await Product.countDocuments({ status: 'ACTIVE', stock: { $gt: 0 } });
      console.log(`POST-CHECK: customer-facing listings now = ${publicCount} (expected ${genuineDocs.length}).`);
      if (publicCount !== genuineDocs.length) {
        console.error(`POST-CHECK_WARNING: expected ${genuineDocs.length}, got ${publicCount} — inspect the UNCLASSIFIED list above.`);
        process.exitCode = 1;
      }
    } else if (!APPLY) {
      console.log('\nDRY RUN: no changes written. Re-run with --apply to delist these records.');
    } else {
      console.log('\nAPPLY: nothing to write.');
    }
  } catch (err) {
    console.error('DELIST_ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
