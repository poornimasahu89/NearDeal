/* NearDeal Phase 5 — VERIFY AND REPAIR BARGAINING (API walkthrough).
 *
 * Walks the bargaining flow exactly as the phase describes, against the
 * already-running development API (default http://localhost:5000/api):
 *   1. submit an offer
 *   2. saved ONCE and linked to the right product / customer / seller
 *   3. visible in the customer's negotiations and the seller's pending list
 *   4. seller accept / reject / counter
 *   5. updated status + counter visible on BOTH sides after a fresh read
 *      (a fresh GET is what the UI does after navigation and refresh)
 *   6. invalid actions and repeated submissions are handled safely
 *   7. final sale price + order creation consistent with the accepted offer
 *      (2% commission is seller-side and never part of the customer total)
 *
 * Uses isolated QA accounts/products created by this run and marked `qaph5`
 * in the e-mail address. It never deletes user data and never touches
 * accounts it did not create.
 *
 * Usage:  node scripts/phase5-bargain-verify.js
 * Exit code 0 = every check passed, 1 = at least one failure.
 */
const BASE = process.env.API_URL || 'http://localhost:5000/api';
const TS = Date.now();

const PASS = [];
const FAIL = [];
const check = (name, cond, detail = '') => {
  if (cond) PASS.push(name);
  else FAIL.push(`${name}${detail ? ` :: ${detail}` : ''}`);
};

const call = async (method, path, { token, body } = {}) => {
  try {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: { message: e.message } };
  }
};

const msg = (r) => (r.data && r.data.message) || '';
const PWD = 'QaPhase5-Test-2026';

/** Fresh read of both sides — this is what the UI does after navigation/refresh. */
const readBothSides = async (tC, tS) => ({
  customer: (await call('GET', '/negotiations/mine', { token: tC })).data?.data || [],
  seller: (await call('GET', '/negotiations/seller', { token: tS })).data?.data || [],
});

const findThread = (list, id) => list.find((n) => n._id === id);

(async () => {
  console.log(`NearDeal Phase 5 bargaining verification -> ${BASE}\n`);

  // ---------------------------------------------------------------- setup
  const cust = { email: `qaph5_c_${TS}@example.com`, password: PWD, name: 'QA Phase5 Customer', role: 'CUSTOMER' };
  const sell = { email: `qaph5_s_${TS}@example.com`, password: PWD, name: 'QA Phase5 Merchant', role: 'SELLER', businessName: 'QA Phase5 Furniture' };
  const out = { email: `qaph5_other_${TS}@example.com`, password: PWD, name: 'QA Phase5 Outsider', role: 'CUSTOMER' };

  let tC = (await call('POST', '/auth/register', { body: cust })).data?.data?.token;
  let tS = (await call('POST', '/auth/register', { body: sell })).data?.data?.token;
  let tO = (await call('POST', '/auth/register', { body: out })).data?.data?.token;
  check('setup: customer/seller/outsider registered with tokens', !!tC && !!tS && !!tO);

  await call('PUT', '/auth/profile', { token: tS, body: { lng: 75.8937, lat: 22.7533 } });

  const mkProduct = async (name, price, stock) => {
    const r = await call('POST', '/products', { token: tS, body: {
      name, category: 'Office', price, stock,
      description: `Phase 5 verification listing: ${name}.`,
      isNegotiable: true, images: [],
    }});
    return r.data?.data?._id;
  };
  const prodAccept = await mkProduct('Phase5 Accept Desk', 10000, 5);
  const prodReject = await mkProduct('Phase5 Reject Chair', 4000, 5);
  const prodCounter = await mkProduct('Phase5 Counter Shelf', 8000, 5);
  check('setup: three negotiable listings created', !!prodAccept && !!prodReject && !!prodCounter);

  // ---------------------------------------------------------------- 1 + 2
  let negAccept, negReject, negCounter;
  {
    const r = await call('POST', '/negotiations/offer', { token: tC, body: {
      productId: prodAccept, offerPrice: 8500, quantity: 2,
    }});
    negAccept = r.data?.data?._id;
    check('1. offer submitted -> 201 PENDING', r.status === 201 && r.data?.data?.status === 'PENDING', `got ${r.status}`);

    // 2. saved ONCE and linked to the correct product / customer / seller
    const me = (await call('GET', '/auth/me', { token: tC })).data?.data;
    const custId = String(me?._id || '');
    const sellerId = String((await call('GET', '/auth/me', { token: tS })).data?.data?._id || '');
    const mine = (await call('GET', '/negotiations/mine', { token: tC })).data?.data || [];
    const forProduct = mine.filter((n) => String(n.product?._id || n.product) === String(prodAccept));
    check('2. exactly ONE thread exists for the product after submit', forProduct.length === 1, `got ${forProduct.length}`);
    const linked = forProduct[0];
    check('2. linked to the correct product id', linked && String(linked.product?._id || linked.product) === String(prodAccept), '');
    check('2. linked to the correct customer (buyer)',
      linked && String(linked.customer?._id || linked.customer) === custId && linked.customer?.email === cust.email,
      `got ${linked?.customer?.email}`);
    check('2. linked to the correct seller',
      linked && String(linked.seller?._id || linked.seller) === sellerId,
      `got ${linked?.seller?._id || linked?.seller}`);
    check('2. offer price + quantity recorded on the thread', linked?.currentOfferPrice === 8500 && linked?.initialOfferPrice === 8500 && linked?.quantity === 2, `got ${linked?.currentOfferPrice}/${linked?.initialOfferPrice}/${linked?.quantity}`);

    // repeated submission of the same offer must not create a second record
    const dup = await call('POST', '/negotiations/offer', { token: tC, body: { productId: prodAccept, offerPrice: 8500, quantity: 2 } });
    check('6. repeated submission rejected 409 (no duplicate record)', dup.status === 409, `got ${dup.status}`);
    const mineAfter = (await call('GET', '/negotiations/mine', { token: tC })).data?.data || [];
    check('6. still exactly ONE thread after the repeat', mineAfter.filter((n) => String(n.product?._id || n.product) === String(prodAccept)).length === 1, '');
  }

  // ---------------------------------------------------------------- 3
  {
    const { customer, seller } = await readBothSides(tC, tS);
    const inCustomer = findThread(customer, negAccept);
    const inSeller = findThread(seller, negAccept);
    check('3. thread appears in the CUSTOMER negotiations list', !!inCustomer, '');
    check('3. thread appears in the SELLER negotiations list', !!inSeller, '');
    check('3. status reads PENDING for the seller (pending queue)', inSeller?.status === 'PENDING', `got ${inSeller?.status}`);
    check('3. status reads PENDING for the customer', inCustomer?.status === 'PENDING', `got ${inCustomer?.status}`);

    const outList = (await call('GET', '/negotiations/mine', { token: tO })).data?.data || [];
    check('3. an unrelated customer cannot see the thread', !findThread(outList, negAccept), '');
  }

  // ---------------------------------------------------------------- 4/5a: REJECT
  {
    const r = await call('POST', '/negotiations/offer', { token: tC, body: { productId: prodReject, offerPrice: 3000 } });
    negReject = r.data?.data?._id;
    check('4. reject-flow offer opened 201', r.status === 201, `got ${r.status}`);

    const act = await call('POST', `/negotiations/${negReject}/respond`, { token: tS, body: { action: 'REJECT' } });
    check('4. seller REJECT -> 200 REJECTED', act.status === 200 && act.data?.data?.status === 'REJECTED', `got ${act.status}/${act.data?.data?.status}`);

    const { customer, seller } = await readBothSides(tC, tS);
    check('5. REJECTED status visible to the customer after fresh read', findThread(customer, negReject)?.status === 'REJECTED', `got ${findThread(customer, negReject)?.status}`);
    check('5. REJECTED status visible to the seller after fresh read', findThread(seller, negReject)?.status === 'REJECTED', `got ${findThread(seller, negReject)?.status}`);

    const again = await call('POST', `/negotiations/${negReject}/respond`, { token: tS, body: { action: 'ACCEPT' } });
    check('6. acting on a closed thread -> 409', again.status === 409, `got ${again.status}`);
  }

  // ---------------------------------------------------------------- 4/5b: COUNTER round trip
  {
    const r = await call('POST', '/negotiations/offer', { token: tC, body: { productId: prodCounter, offerPrice: 6400 } });
    negCounter = r.data?.data?._id;
    check('4. counter-flow offer opened 201', r.status === 201, `got ${r.status}`);

    const c = await call('POST', `/negotiations/${negCounter}/respond`, { token: tS, body: { action: 'COUNTER', counterPrice: 7200 } });
    check('4. seller COUNTER -> 200 COUNTERED at 7200', c.status === 200 && c.data?.data?.status === 'COUNTERED' && c.data?.data?.currentOfferPrice === 7200, `got ${c.status}/${c.data?.data?.status}/${c.data?.data?.currentOfferPrice}`);

    const { customer, seller } = await readBothSides(tC, tS);
    const cSide = findThread(customer, negCounter);
    const sSide = findThread(seller, negCounter);
    check('5. counter price visible to the CUSTOMER after fresh read', cSide?.status === 'COUNTERED' && cSide?.currentOfferPrice === 7200, `got ${cSide?.status}/${cSide?.currentOfferPrice}`);
    check('5. counter price visible to the SELLER after fresh read', sSide?.status === 'COUNTERED' && sSide?.currentOfferPrice === 7200, `got ${sSide?.status}/${sSide?.currentOfferPrice}`);
    const lastCustomer = [...(cSide?.history || [])].reverse().find((h) => h.actionBy === 'CUSTOMER');
    const lastSeller = [...(cSide?.history || [])].reverse().find((h) => h.actionBy === 'SELLER');
    check('5. customer history carries BOTH the 6400 offer and the 7200 counter',
      lastCustomer?.offerPrice === 6400 && lastSeller?.offerPrice === 7200,
      `got ${lastCustomer?.offerPrice}/${lastSeller?.offerPrice}`);

    // customer counters again on the SAME thread (never a second document)
    const c2 = await call('POST', `/negotiations/${negCounter}/respond`, { token: tC, body: { action: 'COUNTER', counterPrice: 6800 } });
    check('4. customer counter-again -> 200 COUNTERED at 6800', c2.status === 200 && c2.data?.data?.currentOfferPrice === 6800, `got ${c2.status}/${c2.data?.data?.currentOfferPrice}`);
    const mine = (await call('GET', '/negotiations/mine', { token: tC })).data?.data || [];
    check('6. counter-again did NOT create a second thread for the product',
      mine.filter((n) => String(n.product?._id || n.product) === String(prodCounter)).length === 1, '');
    const both = await readBothSides(tC, tS);
    check('5. seller sees the customer counter at 6800 after fresh read',
      findThread(both.seller, negCounter)?.currentOfferPrice === 6800 && findThread(both.seller, negCounter)?.status === 'COUNTERED', '');
  }

  // ---------------------------------------------------------------- 4/5c: ACCEPT
  {
    const a = await call('POST', `/negotiations/${negAccept}/respond`, { token: tS, body: { action: 'ACCEPT' } });
    check('4. seller ACCEPT -> 200 ACCEPTED with finalAgreedPrice 8500',
      a.status === 200 && a.data?.data?.status === 'ACCEPTED' && a.data?.data?.finalAgreedPrice === 8500,
      `got ${a.status}/${a.data?.data?.status}/${a.data?.data?.finalAgreedPrice}`);

    const { customer, seller } = await readBothSides(tC, tS);
    const cSide = findThread(customer, negAccept);
    const sSide = findThread(seller, negAccept);
    check('5. ACCEPTED status visible to the CUSTOMER after fresh read',
      cSide?.status === 'ACCEPTED' && cSide?.finalAgreedPrice === 8500, `got ${cSide?.status}/${cSide?.finalAgreedPrice}`);
    check('5. ACCEPTED status visible to the SELLER after fresh read',
      sSide?.status === 'ACCEPTED' && sSide?.finalAgreedPrice === 8500, `got ${sSide?.status}/${sSide?.finalAgreedPrice}`);
  }

  // ---------------------------------------------------------------- 6: invalid actions
  {
    let r = await call('POST', `/negotiations/${negCounter}/respond`, { token: tO, body: { action: 'ACCEPT' } });
    check('6. non-participant respond -> 403', r.status === 403, `got ${r.status}`);

    r = await call('POST', `/negotiations/${negCounter}/respond`, { token: tC, body: { action: 'ACCEPT' } });
    check('6. customer cannot answer their own counter -> 409', r.status === 409, `got ${r.status}`);

    r = await call('POST', `/negotiations/${negCounter}/respond`, { token: tS, body: { action: 'TEAPOT' } });
    check('6. unknown action -> 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', `/negotiations/${negCounter}/respond`, { token: tS, body: { action: 'COUNTER', counterPrice: -5 } });
    check('6. invalid counter price -> 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', `/negotiations/${negCounter}/respond`, { token: tS, body: { action: 'COUNTER', counterPrice: 'abc' } });
    check('6. non-numeric counter price -> 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/negotiations/offer', { token: tC, body: { productId: prodReject, offerPrice: 0 } });
    check('6. zero offer -> 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/negotiations/offer', { token: tC, body: { productId: 'not-an-id', offerPrice: 100 } });
    check('6. malformed product id -> 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/negotiations/offer', { token: tC, body: { productId: prodAccept, offerPrice: 7000, quantity: 99 } });
    check('6. offer beyond stock -> 409', r.status === 409, `got ${r.status}`);

    r = await call('POST', '/negotiations/offer', { token: tS, body: { productId: prodAccept, offerPrice: 7000 } });
    check('6. seller offering on own product -> 403/400', r.status === 403 || r.status === 400, `got ${r.status}`);

    r = await call('POST', '/negotiations/offer', {});
    check('6. missing session -> 401', r.status === 401, `got ${r.status}`);
  }

  // ---------------------------------------------------------------- 7: order consistency
  {
    const r = await call('POST', '/orders/checkout', { token: tC, body: {
      productId: prodAccept, negotiationId: negAccept, quantity: 2, paymentMethod: 'CASH_ON_DELIVERY',
    }});
    const order = r.data?.data;
    check('7. checkout of the accepted deal -> 201', r.status === 201 && !!order, `got ${r.status} ${msg(r)}`);
    check('7. order unit price == accepted offer (8500), list price kept (10000)',
      order?.finalAgreedPrice === 8500 && order?.listPrice === 10000, `got ${order?.finalAgreedPrice}/${order?.listPrice}`);
    check('7. customer payable total == 8500 x 2 = 17000 (no commission added)',
      order?.totalAmount === 17000, `got ${order?.totalAmount}`);
    check('7. 2% commission = 340.00 stored as a SEPARATE seller-side field',
      order?.platformCommission === 340, `got ${order?.platformCommission}`);
    check('7. commission is not part of the payable total',
      order?.totalAmount === 17000 && order?.totalAmount !== 17000 + order?.platformCommission, '');

    const dup = await call('POST', '/orders/checkout', { token: tC, body: {
      productId: prodAccept, negotiationId: negAccept, quantity: 2, paymentMethod: 'CASH_ON_DELIVERY',
    }});
    check('7. converting the same accepted deal twice -> 409', dup.status === 409, `got ${dup.status}`);

    const mine = (await call('GET', '/negotiations/mine', { token: tC })).data?.data || [];
    const converted = findThread(mine, negAccept);
    check('7. thread stamped convertedToOrder (single conversion survives refresh)',
      !!converted?.convertedToOrder, `got ${converted?.convertedToOrder}`);

    const hist = (await call('GET', '/orders/mine', { token: tC })).data?.data || [];
    const row = hist.find((o) => String(o.id) === String(order?._id));
    check('7. order visible in customer history with agreed price + separate commission',
      !!row && row.totalAmount === 17000 && row.platformCommission === 340 && row.negotiatedPrice === 8500,
      `got ${row?.totalAmount}/${row?.platformCommission}/${row?.negotiatedPrice}`);

    const prod = await call('GET', `/products/${prodAccept}`);
    check('7. stock reserved 5 -> 3', prod.data?.data?.stock === 3, `got ${prod.data?.data?.stock}`);
  }

  // ---------------------------------------------------------------- cleanup: delist this run's fixtures
  // The bargaining and checkout tests need these listings ACTIVE while they run,
  // so they would otherwise stay in the shopper-facing catalog for good. Delist
  // them through the owner's own delete endpoint — the platform's soft delete sets
  // `status: 'INACTIVE'` — so the records survive for the order and negotiation
  // rows that reference them while `GET /api/products` stops returning them.
  for (const [label, id] of [
    ['Phase5 Accept Desk', prodAccept],
    ['Phase5 Reject Chair', prodReject],
    ['Phase5 Counter Shelf', prodCounter],
  ]) {
    const r = await call('DELETE', `/products/${id}`, { token: tS });
    check(`cleanup: "${label}" delisted from the public catalog`, r.status === 200, `got ${r.status} ${msg(r)}`);
  }

  // ---------------------------------------------------------------- report
  console.log('----------------------------------------');
  for (const p of PASS) console.log(`PASS  ${p}`);
  for (const f of FAIL) console.log(`FAIL  ${f}`);
  console.log('----------------------------------------');
  console.log(`${PASS.length} passed, ${FAIL.length} failed`);
  process.exit(FAIL.length ? 1 : 0);
})().catch((e) => {
  console.error('HARNESS_ERROR:', e);
  process.exit(1);
});
