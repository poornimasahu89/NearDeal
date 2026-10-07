'use strict';

/**
 * backfill-order-totals.js — one-off, idempotent migration for orders created
 * before `quantity` / `totalAmount` / `isNegotiated` / `listPrice` existed.
 *
 * Why it is needed:
 *   `GET /api/admin/metrics` sums `$totalAmount` and `$platformCommission`
 *   with MongoDB aggregation. `$sum` silently skips documents where the field
 *   is missing, so every pre-change order is invisible to the gross-volume KPI,
 *   and a later validated `save()` on such a document would fail Mongoose's
 *   `required: true` check on `totalAmount`.
 *
 * What it writes (ONLY where the field is currently missing — nothing that is
 * already present is ever overwritten):
 *   quantity      -> 1                       (the old checkout bought one unit)
 *   totalAmount   -> finalAgreedPrice * quantity
 *   isNegotiated  -> true/false from the presence of a `negotiation` reference
 *   listPrice     -> finalAgreedPrice for a NON-negotiated order (the charged
 *                    unit price was the listed price). For a negotiated order
 *                    the historical list price is unrecoverable from the
 *                    document, so it is left unset and the API keeps its
 *                    existing fallback (the product's current price).
 *
 * What it deliberately does NOT touch:
 *   `platformCommission` stays exactly as it was recorded. Legacy rows hold
 *   "2% of the unit price" while new rows hold "2% of the line total"; that
 *   difference is historical fact, not corruption, and silently rewriting a
 *   stored fee would change the platform's books. Drift is reported instead.
 *
 * Safety model:
 *   - DRY RUN BY DEFAULT. Nothing is written unless `--apply` is passed.
 *   - `--apply` additionally requires ALLOW_ORDER_BACKFILL=true in the
 *     environment, so a stray flag on a shared machine cannot migrate data.
 *   - Every write re-checks "field still missing" inside its own filter, so an
 *     order created or updated concurrently while the script runs is skipped
 *     rather than overwritten.
 *   - Reports the target host before doing anything and refuses to run with no
 *     MONGO_URI configured.
 *
 * Usage:
 *   node scripts/backfill-order-totals.js             # dry run (no writes)
 *   ALLOW_ORDER_BACKFILL=true node scripts/backfill-order-totals.js --apply
 *
 * Exit code 0 = completed (including a dry run), 1 = refused or failed.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Order = require('../models/Order');

const APPLY = process.argv.includes('--apply');

const targetHost = () => {
  try {
    return new URL(process.env.MONGO_URI).host;
  } catch {
    return null;
  }
};

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('BACKFILL_ERROR: MONGO_URI is not configured.');
    process.exit(1);
  }

  const host = targetHost();
  console.log(`Order totals backfill -> host: ${host}`);
  console.log(`Mode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)'}`);

  if (APPLY && process.env.ALLOW_ORDER_BACKFILL !== 'true') {
    console.error('BACKFILL_ERROR: refusing to write. Set ALLOW_ORDER_BACKFILL=true to confirm.');
    console.error('Re-run without --apply to preview the changes first.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });

  try {
    // Only documents the new fields never reached. `$or` on missing-or-null
    // matches legacy rows without touching a single modern order.
    const missingTotal = { $or: [{ totalAmount: { $exists: false } }, { totalAmount: null }] };
    const legacyOrders = await Order.find(missingTotal).sort({ createdAt: 1 });

    if (!legacyOrders.length) {
      console.log('Nothing to do: every order already carries totalAmount.');
      await mongoose.disconnect();
      process.exit(0);
    }

    let planned = 0;
    const ops = [];
    const notes = [];
    let commissionDrift = 0;

    for (const order of legacyOrders) {
      const unit = Number(order.finalAgreedPrice);
      if (!Number.isFinite(unit)) {
        // Cannot invent a price the document never recorded: skip loudly.
        notes.push(`SKIP ${order._id}: no numeric finalAgreedPrice (unit=${order.finalAgreedPrice})`);
        continue;
      }

      const quantity = Number.isFinite(Number(order.quantity)) && Number(order.quantity) >= 1
        ? Math.floor(Number(order.quantity))
        : 1;
      const totalAmount = Math.round(unit * quantity * 100) / 100;
      const isNegotiated = !!order.negotiation;

      const $set = { quantity, totalAmount, isNegotiated };
      if (!isNegotiated && (order.listPrice === undefined || order.listPrice === null)) {
        $set.listPrice = unit;
      }

      planned += 1;
      notes.push(
        `PLAN ${order._id}: qty ${order.quantity === undefined ? '(missing)' : order.quantity} -> ${quantity}, ` +
        `totalAmount (missing) -> ${totalAmount}` +
        (isNegotiated ? ', listPrice left unset (negotiated order)' : `, listPrice -> ${unit}`)
      );

      // Expected legacy commission = 2% of the UNIT price; new rows use the
      // line total. Report the difference, never rewrite it.
      const expectedLegacyFee = Math.round(unit * 0.02 * 100) / 100;
      const stored = Number(order.platformCommission);
      if (Number.isFinite(stored) && Math.abs(stored - expectedLegacyFee) > 0.011) {
        commissionDrift += 1;
      }

      if (APPLY) {
        ops.push({
          updateOne: {
            // "still missing" re-checked at write time — a concurrently
            // written modern order is never clobbered.
            filter: { _id: order._id, $or: missingTotal.$or },
            update: { $set },
          },
        });
      }
    }

    console.log('');
    for (const line of notes) console.log(`  ${line}`);
    console.log('');
    console.log(`Legacy orders missing totalAmount: ${legacyOrders.length}`);
    console.log(`Eligible to backfill:              ${planned}`);
    console.log(`Stored fee differs from 2% of unit price: ${commissionDrift} (informational, never rewritten)`);

    if (!APPLY) {
      console.log('');
      console.log('DRY RUN — nothing was written. Re-run with --apply (and ALLOW_ORDER_BACKFILL=true) to apply.');
      await mongoose.disconnect();
      process.exit(0);
    }

    if (ops.length) {
      const result = await Order.bulkWrite(ops, { ordered: false });
      console.log('');
      console.log(`Applied: ${result.modifiedCount} order(s) updated, ${result.matchedCount} matched.`);
    } else {
      console.log('');
      console.log('Applied: 0 orders (nothing eligible at write time).');
    }

    const remaining = await Order.countDocuments(missingTotal);
    console.log(`Orders still missing totalAmount after the run: ${remaining}`);
    await mongoose.disconnect();
    process.exit(remaining === 0 ? 0 : 1);
  } catch (error) {
    console.error('BACKFILL_ERROR:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
})();
