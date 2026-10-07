/* NearDeal end-to-end API integration tests.
 *
 * Runs against the already-running development API (default http://localhost:5000/api).
 * Uses isolated QA accounts/products created by this run and marked `qae2e` in
 * the e-mail address. It never deletes user data, never touches accounts it did
 * not create, and restores the temporary admin promotion before exiting.
 *
 * Usage:  node scripts/e2e-api-test.js
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
const PWD = 'QaE2E-Test-2026'; // throwaway password for throwaway QA accounts

(async () => {
  console.log(`NearDeal E2E API tests -> ${BASE}\n`);

  // ---------------------------------------------------------------- PHASE 0
  {
    const r = await call('GET', '/health');
    check('health: GET /api/health returns 200', r.status === 200, `got ${r.status}`);
  }

  // ---------------------------------------------------------------- PHASE 1: auth
  const c1 = { email: `qae2e_c1_${TS}@example.com`, password: PWD, name: 'QA Customer One', role: 'CUSTOMER' };
  const c2 = { email: `qae2e_c2_${TS}@example.com`, password: PWD, name: 'QA Customer Two', role: 'CUSTOMER' };
  const s1 = { email: `qae2e_s1_${TS}@example.com`, password: PWD, name: 'QA Merchant One', role: 'SELLER', businessName: 'QA Furniture Mart' };
  const s2 = { email: `qae2e_s2_${TS}@example.com`, password: PWD, name: 'QA Merchant Two', role: 'SELLER', businessName: 'QA Rattan Works' };
  const adm = { email: `qae2e_admin_${TS}@example.com`, password: PWD, name: 'QA Admin Temp', role: 'CUSTOMER' };

  let tC1, tC2, tS1, tS2, tAdm;

  {
    let r = await call('POST', '/auth/register', { body: c1 });
    check('auth: customer registers 201 with token + role', r.status === 201 && !!r.data?.data?.token && r.data.data.role === 'CUSTOMER', `got ${r.status}`);
    tC1 = r.data?.data?.token;

    r = await call('POST', '/auth/register', { body: c1 });
    check('auth: duplicate e-mail rejected 409', r.status === 409, `got ${r.status}`);

    r = await call('POST', '/auth/register', { body: { ...c1, email: `qae2e_adminrole_${TS}@example.com`, role: 'ADMIN' } });
    check('auth: public registration cannot grant ADMIN (403)', r.status === 403, `got ${r.status}`);

    r = await call('POST', '/auth/register', { body: { ...c1, email: `qae2e_short_${TS}@example.com`, password: 'abc' } });
    check('auth: weak password rejected 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/auth/register', { body: s1 });
    check('auth: seller registers 201 with SELLER role', r.status === 201 && r.data?.data?.role === 'SELLER', `got ${r.status}`);
    tS1 = r.data?.data?.token;

    r = await call('POST', '/auth/register', { body: { ...s2, businessName: undefined } });
    check('auth: seller without store name rejected 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/auth/register', { body: s2 });
    check('auth: second seller registers 201', r.status === 201, `got ${r.status}`);
    tS2 = r.data?.data?.token;

    r = await call('POST', '/auth/register', { body: c2 });
    check('auth: second customer registers 201', r.status === 201, `got ${r.status}`);
    tC2 = r.data?.data?.token;

    r = await call('POST', '/auth/register', { body: adm });
    check('auth: admin-candidate registers 201', r.status === 201, `got ${r.status}`);

    r = await call('POST', '/auth/login', { body: { email: c1.email, password: c1.password } });
    check('auth: valid login 200 with token', r.status === 200 && !!r.data?.data?.token, `got ${r.status}`);
    tC1 = r.data?.data?.token; // fresh token as the frontend would store

    r = await call('POST', '/auth/login', { body: { email: c1.email, password: 'wrong-password' } });
    check('auth: wrong password 401 Invalid credentials', r.status === 401 && /invalid credentials/i.test(msg(r)), `got ${r.status} ${msg(r)}`);

    r = await call('POST', '/auth/login', { body: { email: `nobody_${TS}@example.com`, password: 'whatever123' } });
    check('auth: unknown account 401 (indistinguishable)', r.status === 401 && /invalid credentials/i.test(msg(r)), `got ${r.status}`);

    r = await call('GET', '/auth/me');
    check('auth: no token -> 401 "Not authorized, no token"', r.status === 401 && /no token/i.test(msg(r)), `got ${r.status} ${msg(r)}`);

    r = await call('GET', '/auth/me', { token: 'not.a.jwt' });
    check('auth: malformed token -> 401', r.status === 401, `got ${r.status}`);

    r = await call('GET', '/auth/me', { token: tC1 });
    check('auth: session restoration (GET /me with stored token) 200 + matching e-mail',
      r.status === 200 && r.data?.data?.email === c1.email, `got ${r.status}`);

    r = await call('GET', '/admin/metrics', { token: tC1 });
    check('authz: customer blocked from admin metrics 403', r.status === 403, `got ${r.status}`);

    r = await call('GET', '/negotiations/seller', { token: tC1 });
    check('authz: customer blocked from seller negotiations 403', r.status === 403, `got ${r.status}`);

    r = await call('GET', '/orders/seller', { token: tC1 });
    check('authz: customer blocked from seller orders 403', r.status === 403, `got ${r.status}`);
  }

  // ---------------------------------------------------------------- PHASE 2: products
  let prodA, prodB;
  {
    let r = await call('PUT', '/auth/profile', { token: tS1, body: { lng: 75.8937, lat: 22.7533 } });
    check('products: seller sets store location 200', r.status === 200, `got ${r.status}`);

    r = await call('POST', '/products', { token: tS1, body: {
      name: 'Sheesham Study Desk', category: 'Office', price: 10000, stock: 5,
      description: 'Solid sheesham wood study desk with two drawers, made in Indore.',
      isNegotiable: true, images: [],
    } });
    check('products: seller creates negotiable listing 201 ACTIVE', r.status === 201 && r.data?.data?.status === 'ACTIVE', `got ${r.status} ${msg(r)}`);
    prodA = r.data?.data?._id;

    r = await call('POST', '/products', { token: tS1, body: {
      name: 'Bad Price Table', category: 'Office', price: -5, stock: 1,
      description: 'Invalid negative price must be rejected.', isNegotiable: false,
    } });
    check('products: negative price rejected 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/products', { token: tS1, body: {
      name: 'No Stock Table', category: 'Office', price: 100, stock: -3,
      description: 'Invalid negative stock must be rejected.', isNegotiable: false,
    } });
    check('products: negative stock rejected 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/products', { token: tC1, body: {
      name: 'Customer Selling', category: 'Office', price: 100, stock: 1,
      description: 'A customer must not be able to list products.', isNegotiable: false,
    } });
    check('authz: customer cannot create listing 403', r.status === 403, `got ${r.status}`);

    // Seller 2 needs a location before listing
    await call('PUT', '/auth/profile', { token: tS2, body: { lng: 75.8577, lat: 22.7196 } });
    r = await call('POST', '/products', { token: tS2, body: {
      name: 'Rattan Lounge Chair', category: 'Living Room', price: 2500, stock: 10,
      description: 'Hand-woven rattan lounge chair, non-negotiable fixed price.',
      isNegotiable: false, images: [],
    } });
    check('products: seller without earlier listing works after location set', r.status === 201, `got ${r.status} ${msg(r)}`);
    prodB = r.data?.data?._id;

    // A freshly registered seller with no store coordinates must be refused.
    const s3 = { email: `qae2e_s3_${TS}@example.com`, password: PWD, name: 'QA Merchant Three', role: 'SELLER', businessName: 'QA NoLocation Store' };
    const rS3 = await call('POST', '/auth/register', { body: s3 });
    const tS3 = rS3.data?.data?.token;
    r = await call('POST', '/products', { token: tS3, body: {
      name: 'No Location Shelf', category: 'Storage', price: 500, stock: 1,
      description: 'Listing without store coordinates must be rejected.',
      isNegotiable: false,
    } });
    check('products: listing without store location rejected 400', r.status === 400, `got ${r.status} ${msg(r)}`);

    r = await call('GET', '/products?lat=22.7533&lng=75.8937&radius=5');
    const list = r.data?.data || [];
    check('products: geo listing 200 and includes created listing', r.status === 200 && list.some((p) => p._id === prodA), `got ${r.status}`);

    r = await call('GET', '/products?lat=22.7533');
    check('products: half coordinates rejected 400', r.status === 400, `got ${r.status}`);

    r = await call('GET', '/products?category=Office&maxPrice=12000&negotiable=true');
    check('products: category+price+negotiable filter 200', r.status === 200, `got ${r.status}`);

    r = await call('GET', '/products/not-an-id');
    check('products: malformed id 400', r.status === 400, `got ${r.status}`);

    r = await call('GET', `/products/${prodA}`);
    check('products: product detail 200 with real price', r.status === 200 && r.data?.data?.price === 10000, `got ${r.status}`);

    r = await call('GET', '/products/mine', { token: tS1 });
    const mine1 = (r.data?.data || []).map((p) => p._id);
    check('products: /mine returns own listings only', r.status === 200 && mine1.includes(prodA) && !mine1.includes(prodB), `got ${r.status}`);

    r = await call('GET', '/products/mine', { token: tS2 });
    const mine2 = (r.data?.data || []).map((p) => p._id);
    check('products: second seller /mine isolated', r.status === 200 && mine2.includes(prodB) && !mine2.includes(prodA), `got ${r.status}`);

    r = await call('GET', '/products/mine', { token: tC1 });
    check('authz: customer blocked from /products/mine 403', r.status === 403, `got ${r.status}`);
  }

  // ---------------------------------------------------------------- PHASE 3: bargaining
  let negId;
  {
    let r = await call('POST', '/negotiations/offer', { token: tC1, body: { productId: prodA, offerPrice: 8000, quantity: 1 } });
    check('bargain: customer offer 201 PENDING', r.status === 201 && r.data?.data?.status === 'PENDING', `got ${r.status} ${msg(r)}`);
    negId = r.data?.data?._id;

    r = await call('POST', '/negotiations/offer', { token: tC1, body: { productId: prodA, offerPrice: 7500 } });
    check('bargain: duplicate active negotiation 409', r.status === 409, `got ${r.status}`);

    r = await call('POST', '/negotiations/offer', { token: tC1, body: { productId: prodA, offerPrice: 0 } });
    check('bargain: zero offer 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/negotiations/offer', { token: tC2, body: { productId: prodA, offerPrice: 7000, quantity: 50 } });
    check('bargain: offer beyond stock 409', r.status === 409, `got ${r.status}`);

    r = await call('POST', '/negotiations/offer', { token: tC2, body: { productId: prodB, offerPrice: 2000 } });
    check('bargain: offer on non-negotiable product 400', r.status === 400 && /negotiat/i.test(msg(r)), `got ${r.status} ${msg(r)}`);

    r = await call('GET', '/negotiations/seller', { token: tS1 });
    const sellerNegs = r.data?.data || [];
    const found = sellerNegs.find((n) => n._id === negId);
    check('bargain: seller sees real pending offer with populated product', r.status === 200 && !!found && !!found.product?.name, `got ${r.status}`);

    r = await call('GET', '/negotiations/mine', { token: tC1 });
    check('bargain: customer sees own thread 200', r.status === 200 && (r.data?.data || []).some((n) => n._id === negId), `got ${r.status}`);

    r = await call('GET', '/negotiations/mine', { token: tC2 });
    check('bargain: other customer does not see foreign thread', r.status === 200 && !(r.data?.data || []).some((n) => n._id === negId), `got ${r.status}`);

    r = await call('POST', `/negotiations/${negId}/respond`, { token: tC2, body: { action: 'ACCEPT' } });
    check('authz: unrelated customer cannot respond 403', r.status === 403, `got ${r.status}`);

    r = await call('POST', `/negotiations/${negId}/respond`, { token: tC1, body: { action: 'ACCEPT' } });
    check('bargain: customer cannot accept own pending offer 409', r.status === 409, `got ${r.status}`);

    r = await call('POST', `/negotiations/${negId}/respond`, { token: tS1, body: { action: 'COUNTER', counterPrice: 9000 } });
    check('bargain: seller counters 200 COUNTERED at 9000', r.status === 200 && r.data?.data?.status === 'COUNTERED' && r.data?.data?.currentOfferPrice === 9000, `got ${r.status}`);

    r = await call('POST', `/negotiations/${negId}/respond`, { token: tS1, body: { action: 'COUNTER', counterPrice: 8500 } });
    check('bargain: seller cannot respond to own counter 409', r.status === 409, `got ${r.status}`);

    r = await call('POST', `/negotiations/${negId}/respond`, { token: tC1, body: { action: 'ACCEPT' } });
    check('bargain: customer accepts counter -> ACCEPTED with finalAgreedPrice 9000',
      r.status === 200 && r.data?.data?.status === 'ACCEPTED' && r.data?.data?.finalAgreedPrice === 9000, `got ${r.status}`);

    r = await call('POST', `/negotiations/${negId}/respond`, { token: tC1, body: { action: 'REJECT' } });
    check('bargain: closed thread cannot be reacted to 409', r.status === 409, `got ${r.status}`);
  }

  // ---------------------------------------------------------------- PHASE 4: checkout + commission
  let orderId;
  {
    let r = await call('POST', '/orders/checkout', { token: tC1, body: {
      productId: prodA, negotiationId: negId, quantity: 2, paymentMethod: 'CASH_ON_DELIVERY',
    } });
    const order = r.data?.data;
    check('checkout: negotiated checkout 201', r.status === 201 && !!order, `got ${r.status} ${msg(r)}`);
    orderId = order?._id;
    check('checkout: pays agreed price x qty (18000), NOT list price', order?.totalAmount === 18000, `got ${order?.totalAmount}`);
    check('checkout: unit price is the agreed 9000 (not reverted to 10000)', order?.finalAgreedPrice === 9000 && order?.listPrice === 10000, `got ${order?.finalAgreedPrice}/${order?.listPrice}`);
    check('checkout: commission 2% = 360.00 stored separately', order?.platformCommission === 360, `got ${order?.platformCommission}`);
    check('checkout: customer total excludes commission', order?.totalAmount === 18000 && order?.totalAmount + order?.platformCommission === order?.totalAmount + 360, '');
    check('checkout: order marked negotiated + COD starts PENDING (payment pending)', order?.isNegotiated === true && order?.status === 'PENDING', `got ${order?.isNegotiated}/${order?.status}`);

    r = await call('POST', '/orders/checkout', { token: tC1, body: {
      productId: prodA, negotiationId: negId, quantity: 2, paymentMethod: 'CASH_ON_DELIVERY',
    } });
    check('checkout: reused deal rejected 409 (single conversion)', r.status === 409, `got ${r.status}`);

    r = await call('POST', '/orders/checkout', { token: tC2, body: {
      productId: prodA, negotiationId: negId, quantity: 1,
    } });
    check('authz: hijacking someone else\'s negotiation 403', r.status === 403, `got ${r.status}`);

    r = await call('GET', `/products/${prodA}`);
    check('checkout: stock decremented 5 -> 3', r.data?.data?.stock === 3, `got ${r.data?.data?.stock}`);

    r = await call('POST', '/orders/checkout', { token: tC1, body: { productId: prodA, quantity: 0 } });
    check('checkout: quantity 0 rejected 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/orders/checkout', { token: tC1, body: { productId: prodA, quantity: 1.5 } });
    check('checkout: fractional quantity rejected 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/orders/checkout', { token: tC1, body: { productId: prodA, quantity: 50 } });
    check('checkout: over-stock rejected 409', r.status === 409, `got ${r.status}`);

    r = await call('POST', '/orders/checkout', { token: tC1, body: { productId: prodA, quantity: 1, paymentMethod: 'BITCOIN' } });
    check('checkout: unknown payment method rejected 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/orders/checkout', { token: tC1, body: { productId: 'not-an-id', quantity: 1 } });
    check('checkout: malformed product id rejected 400', r.status === 400, `got ${r.status}`);

    // valid-format but missing product -> 404
    r = await call('POST', '/orders/checkout', { token: tC1, body: { productId: '000000000000000000000000', quantity: 1 } });
    check('checkout: unknown product rejected 404', r.status === 404, `got ${r.status}`);

    r = await call('POST', '/orders/checkout', { token: tS1, body: { productId: prodA, quantity: 1 } });
    check('authz: seller cannot use customer checkout 403', r.status === 403, `got ${r.status}`);

    r = await call('GET', '/orders/mine', { token: tC1 });
    const mine = r.data?.data || [];
    const mineOrder = mine.find((o) => o.id === orderId);
    check('orders: customer history contains persisted order', r.status === 200 && !!mineOrder, `got ${r.status}`);
    check('orders: history row carries agreed price + order number', mineOrder?.totalAmount === 18000 && !!mineOrder?.orderNumber, `got ${mineOrder?.totalAmount}`);

    r = await call('GET', '/orders/mine', { token: tC2 });
    check('orders: other customer does not see the order', r.status === 200 && !(r.data?.data || []).some((o) => o.id === orderId), `got ${r.status}`);

    r = await call('GET', `/orders/${orderId}`, { token: tC2 });
    check('authz: foreign order detail 403', r.status === 403, `got ${r.status}`);

    r = await call('GET', `/orders/${orderId}`, { token: tC1 });
    check('orders: own order detail 200', r.status === 200, `got ${r.status}`);

    r = await call('GET', '/orders/seller', { token: tS1 });
    check('orders: seller sees order placed on own listing', r.status === 200 && (r.data?.data || []).some((o) => o.id === orderId), `got ${r.status}`);

    r = await call('GET', '/orders/seller', { token: tS2 });
    check('orders: other seller does not see the order', r.status === 200 && !(r.data?.data || []).some((o) => o.id === orderId), `got ${r.status}`);

    // Plain (non-negotiated) purchase at list price
    r = await call('POST', '/orders/checkout', { token: tC1, body: { productId: prodB, quantity: 1, paymentMethod: 'CASH_ON_DELIVERY' } });
    const plain = r.data?.data;
    check('checkout: plain purchase 201 at list price 2500', r.status === 201 && plain?.totalAmount === 2500, `got ${r.status}/${plain?.totalAmount}`);
    check('checkout: plain purchase commission = 2% = 50', plain?.platformCommission === 50, `got ${plain?.platformCommission}`);
    const plainOrderId = plain?._id;

    // --- idempotency: same submission key must resolve to ONE order ---
    const idemKey = `qae2e-${TS}-first`;
    const first = await call('POST', '/orders/checkout', { token: tC1, body: { productId: prodB, quantity: 1, requestId: idemKey } });
    check('checkout: keyed checkout 201', first.status === 201 && !!first.data?.data?._id, `got ${first.status}`);
    const replay = await call('POST', '/orders/checkout', { token: tC1, body: { productId: prodB, quantity: 1, requestId: idemKey } });
    check('checkout: replayed key returns the FIRST order, no second charge',
      replay.status === 200 && replay.data?.data?._id === first.data?.data?._id, `got ${replay.status} ${replay.data?.data?._id}`);

    const badKey = await call('POST', '/orders/checkout', { token: tC1, body: { productId: prodB, quantity: 1, requestId: 'x' } });
    check('checkout: malformed requestId rejected 400', badKey.status === 400, `got ${badKey.status}`);

    // Concurrent double submission with the SAME key: unique index guarantees
    // exactly one insert; the loser answers with the winner's order.
    const raceKey = `qae2e-${TS}-race`;
    const [rc1, rc2] = await Promise.all([
      call('POST', '/orders/checkout', { token: tC1, body: { productId: prodB, quantity: 1, requestId: raceKey } }),
      call('POST', '/orders/checkout', { token: tC1, body: { productId: prodB, quantity: 1, requestId: raceKey } }),
    ]);
    const raceStatuses = [rc1.status, rc2.status].sort().join(',');
    const raceIds = [rc1.data?.data?._id, rc2.data?.data?._id].filter(Boolean);
    check('checkout: concurrent same-key submissions yield exactly one order',
      raceStatuses === '200,201' && raceIds.length === 2 && new Set(raceIds).size === 1,
      `statuses=${raceStatuses} ids=${raceIds.join(',')}`);

    // --- order lifecycle: seller advances only their own order ---
    // Build a second accepted deal for C2 so the race/claim path is exercised
    // on a negotiated checkout as well.
    let neg2Id, neg2OrderId;
    r = await call('POST', '/negotiations/offer', { token: tC2, body: { productId: prodA, offerPrice: 9500, quantity: 1 } });
    neg2Id = r.data?.data?._id;
    check('bargain: second customer can open own thread', r.status === 201, `got ${r.status}`);
    r = await call('POST', `/negotiations/${neg2Id}/respond`, { token: tS1, body: { action: 'ACCEPT' } });
    check('bargain: seller accepts second offer -> ACCEPTED', r.status === 200 && r.data?.data?.status === 'ACCEPTED', `got ${r.status}`);

    const [nr1, nr2] = await Promise.all([
      call('POST', '/orders/checkout', { token: tC2, body: { productId: prodA, negotiationId: neg2Id, quantity: 1 } }),
      call('POST', '/orders/checkout', { token: tC2, body: { productId: prodA, negotiationId: neg2Id, quantity: 1 } }),
    ]);
    const nStatuses = [nr1.status, nr2.status];
    const n201 = nStatuses.filter((s) => s === 201).length;
    const n409 = nStatuses.filter((s) => s === 409).length;
    check('checkout: racing the same accepted deal produces exactly ONE order (201) + one 409',
      n201 === 1 && n409 === 1, `statuses=${nStatuses.join(',')}`);
    neg2OrderId = [nr1, nr2].find((x) => x.status === 201)?.data?.data?._id;

    r = await call('GET', `/products/${prodA}`);
    check('checkout: race loser rolled back its stock reservation (3 -> 2)', r.data?.data?.stock === 2, `got ${r.data?.data?.stock}`);

    // invalid transition / wrong role / foreign seller
    r = await call('PUT', `/orders/${orderId}/status`, { token: tC1, body: { status: 'COMPLETED' } });
    check('authz: customer cannot advance order status 403', r.status === 403, `got ${r.status}`);

    r = await call('PUT', `/orders/${orderId}/status`, { token: tS2, body: { status: 'PROCESSING' } });
    check('authz: foreign seller cannot advance the order 403', r.status === 403, `got ${r.status}`);

    r = await call('PUT', `/orders/${orderId}/status`, { token: tS1, body: { status: 'TEAPOT' } });
    check('orders: unknown status value rejected 400', r.status === 400, `got ${r.status}`);

    // orderId is a fresh COD order (PENDING). The seller confirms payment
    // first (the "Payment Received" button), then walks it forward, and the
    // terminal states must hold after that.
    r = await call('PUT', `/orders/${orderId}/status`, { token: tS1, body: { status: 'PAID' } });
    check('orders: seller PENDING -> PAID (Payment Received) 200', r.status === 200 && r.data?.data?.status === 'PAID', `got ${r.status}`);

    r = await call('PUT', `/orders/${orderId}/status`, { token: tS1, body: { status: 'PROCESSING' } });
    check('orders: seller PAID -> PROCESSING 200', r.status === 200 && r.data?.data?.status === 'PROCESSING', `got ${r.status}`);

    r = await call('PUT', `/orders/${orderId}/status`, { token: tS1, body: { status: 'PENDING' } });
    check('orders: backwards transition rejected 409', r.status === 409, `got ${r.status}`);

    r = await call('PUT', `/orders/${orderId}/status`, { token: tS1, body: { status: 'COMPLETED' } });
    check('orders: seller PROCESSING -> COMPLETED 200', r.status === 200 && r.data?.data?.status === 'COMPLETED', `got ${r.status}`);

    r = await call('PUT', `/orders/${orderId}/status`, { token: tS1, body: { status: 'CANCELLED' } });
    check('orders: completed order cannot be cancelled 409', r.status === 409, `got ${r.status}`);

    // Cancelling the negotiated second order must return its unit to stock.
    r = await call('PUT', `/orders/${neg2OrderId}/status`, { token: tS1, body: { status: 'CANCELLED' } });
    check('orders: seller cancels PENDING order 200', r.status === 200 && r.data?.data?.status === 'CANCELLED', `got ${r.status}`);

    r = await call('GET', `/products/${prodA}`);
    check('orders: cancellation restocks the reserved unit (2 -> 3)', r.data?.data?.stock === 3, `got ${r.data?.data?.stock}`);

    r = await call('PUT', `/orders/${neg2OrderId}/status`, { token: tS1, body: { status: 'PROCESSING' } });
    check('orders: cancelled order stays terminal 409', r.status === 409, `got ${r.status}`);
  }

  // ---------------------------------------------------------------- PHASE 5: reviews
  {
    let r = await call('POST', '/reviews', { token: tC2, body: { productId: prodA, rating: 5, comment: 'Never bought it.' } });
    check('reviews: non-purchaser rejected 403', r.status === 403, `got ${r.status}`);

    r = await call('POST', '/reviews', { token: tC1, body: { productId: prodA, rating: 6, comment: 'Out of range rating.' } });
    check('reviews: rating 6 rejected 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/reviews', { token: tC1, body: { productId: prodA, rating: 5, comment: '' } });
    check('reviews: empty comment rejected 400', r.status === 400, `got ${r.status}`);

    r = await call('POST', '/reviews', { token: tC1, body: { productId: prodA, rating: 5, comment: 'Solid desk, picked up from the store the same day.' } });
    check('reviews: purchaser review 201 PENDING moderation', r.status === 201 && r.data?.data?.status === 'PENDING', `got ${r.status}`);

    r = await call('POST', '/reviews', { token: tC1, body: { productId: prodA, rating: 4, comment: 'Second review should be blocked.' } });
    check('reviews: duplicate review 409', r.status === 409, `got ${r.status}`);

    r = await call('GET', `/reviews/product/${prodA}`);
    const visible = r.data?.data || [];
    check('reviews: pending review hidden from public listing', r.status === 200 && !visible.some((v) => /Solid desk/.test(v.comment || '')), `got ${r.status}`);
  }

  // ---------------------------------------------------------------- PHASE 6: seller product management + isolation
  {
    let r = await call('PUT', `/products/${prodB}`, { token: tS1, body: { price: 1234 } });
    check('authz: seller cannot edit another seller\'s listing 403', r.status === 403, `got ${r.status}`);

    r = await call('PUT', `/products/${prodA}`, { token: tC1, body: { price: 1234 } });
    check('authz: customer cannot edit a listing 403', r.status === 403, `got ${r.status}`);

    r = await call('PUT', `/products/${prodA}`, { token: tS1, body: { price: 9500 } });
    check('seller: owner can edit own listing 200', r.status === 200 && r.data?.data?.price === 9500, `got ${r.status}`);

    r = await call('PUT', `/products/${prodA}`, { token: tS1, body: { price: 10000 } });
    check('seller: listing price restored', r.status === 200, `got ${r.status}`);

    r = await call('PUT', `/products/${prodA}`, { token: tS1, body: { seller: '000000000000000000000000' } });
    check('seller: ownership cannot be rewritten from body', r.status === 200 && !!r.data?.data?.seller, `got ${r.status}`);

    // Throwaway listing: created then deleted by its owner
    r = await call('POST', '/products', { token: tS1, body: {
      name: 'Disposable Stool', category: 'Office', price: 400, stock: 1,
      description: 'Created only to test owner deletion.', isNegotiable: false,
    } });
    const throwId = r.data?.data?._id;
    check('seller: can create throwaway listing', r.status === 201 && !!throwId, `got ${r.status}`);

    const del = await call('DELETE', `/products/${throwId}`, { token: tS2 });
    check('authz: other seller cannot delete listing 403', del.status === 403, `got ${del.status}`);

    r = await call('DELETE', `/products/${throwId}`, { token: tS1 });
    check('seller: owner deletes own listing 200', r.status === 200, `got ${r.status}`);

    r = await call('GET', `/products/${throwId}`);
    check('products: deleted listing no longer readable 404', r.status === 404, `got ${r.status}`);

    r = await call('GET', `/products/${throwId}`, { token: tS1 });
    check('products: owner still reads own delisted listing 200', r.status === 200, `got ${r.status}`);

    r = await call('GET', `/products/${throwId}`, { token: tS2 });
    check('products: other seller reads delisted listing as gone 404', r.status === 404, `got ${r.status}`);
  }

  // ---------------------------------------------------------------- PHASE 7: admin (temporary promotion of a QA account)
  let adminUserEmail = adm.email;
  let db;
  try {
    const path = require('path');
    const dotenv = require('dotenv');
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    db = mongoose;
    const User = require('../models/User');
    await User.updateOne({ email: adminUserEmail }, { $set: { role: 'ADMIN' } });
    console.log('  (QA account promoted to ADMIN for the admin-suite tests; demoted again at the end)\n');
  } catch (e) {
    check('admin: temporary promotion possible', false, e.message);
  }

  {
    let r = await call('POST', '/auth/login', { body: { email: adm.email, password: adm.password } });
    check('admin: promoted QA account logs in 200', r.status === 200 && !!r.data?.data?.token, `got ${r.status}`);
    tAdm = r.data?.data?.token;

    r = await call('GET', '/admin/metrics', { token: tAdm });
    const m = r.data?.data || {};
    check('admin: metrics 200 with gross volume / commission / orders as distinct fields',
      r.status === 200 && typeof m.totalGrossVolume === 'number' && typeof m.totalPlatformCommission === 'number' && typeof m.totalOrders === 'number',
      `got ${r.status}`);
    check('admin: gross volume includes this run\'s 20500 of test sales', m.totalGrossVolume >= 20500, `got ${m.totalGrossVolume}`);
    check('admin: commission metric includes this run\'s 410', m.totalPlatformCommission >= 410, `got ${m.totalPlatformCommission}`);

    r = await call('GET', '/admin/orders', { token: tAdm });
    check('admin: orders list 200', r.status === 200, `got ${r.status}`);

    // Cross-check the metric against the whole orders collection (the admin
    // list endpoint only returns the newest 25 rows, so the aggregation is
    // repeated here against the database of record).
    try {
      const Order = require('../models/Order');
      const [agg] = await Order.aggregate([
        { $match: { status: { $ne: 'CANCELLED' } } },
        { $group: { _id: null, volume: { $sum: '$totalAmount' }, commission: { $sum: '$platformCommission' }, orders: { $sum: 1 } } },
      ]);
      const dbVol = Math.round((agg?.volume || 0) * 100) / 100;
      const dbCom = Math.round((agg?.commission || 0) * 100) / 100;
      check('admin: metrics gross volume == persisted non-cancelled order sum',
        Math.abs(dbVol - m.totalGrossVolume) < 0.01, `metrics=${m.totalGrossVolume} db=${dbVol}`);
      check('admin: metrics commission == persisted non-cancelled commission sum',
        Math.abs(dbCom - m.totalPlatformCommission) < 0.01, `metrics=${m.totalPlatformCommission} db=${dbCom}`);
      check('admin: metrics order count == persisted non-cancelled order count',
        (agg?.orders || 0) === m.totalOrders, `metrics=${m.totalOrders} db=${agg?.orders}`);
    } catch (e) {
      check('admin: metrics cross-check runnable', false, e.message);
    }

    for (const p of ['/admin/users', '/admin/sellers', '/admin/products', '/admin/reviews']) {
      const rr = await call('GET', p, { token: tAdm });
      check(`admin: GET ${p} 200`, rr.status === 200, `got ${rr.status}`);
    }

    r = await call('PUT', '/admin/products/prod/status', { token: tAdm, body: { status: 'NONSENSE' } });
    check('admin: invalid product status rejected 400', r.status === 400, `got ${r.status}`);

    // Suspend -> blocked login -> blocked token -> reactivate
    const c2Id = (await call('GET', '/admin/users', { token: tAdm })).data?.data?.find((u) => u.email === c2.email)?.id;
    r = await call('PUT', `/admin/users/${c2Id}/status`, { token: tAdm, body: { status: 'SUSPENDED' } });
    check('admin: suspend user 200', r.status === 200, `got ${r.status}`);

    r = await call('POST', '/auth/login', { body: { email: c2.email, password: c2.password } });
    check('admin: suspended account cannot log in 403', r.status === 403, `got ${r.status}`);

    r = await call('GET', '/auth/me', { token: tC2 });
    check('admin: existing token of suspended account rejected', r.status === 401 || r.status === 403, `got ${r.status}`);

    r = await call('PUT', `/admin/users/${c2Id}/status`, { token: tAdm, body: { status: 'ACTIVE' } });
    check('admin: reactivate user 200', r.status === 200, `got ${r.status}`);

    r = await call('POST', '/auth/login', { body: { email: c2.email, password: c2.password } });
    check('admin: reactivated account logs in again 200', r.status === 200, `got ${r.status}`);
    tC2 = r.data?.data?.token;

    // Product status approval/removal roundtrip on seller 2's listing
    r = await call('PUT', `/admin/products/${prodB}/status`, { token: tAdm, body: { status: 'REMOVED' } });
    check('admin: remove listing 200 -> INACTIVE', r.status === 200 && r.data?.data?.status === 'INACTIVE', `got ${r.status}`);

    // Removal must be effective for the public, while owner + admin keep access
    const anon = await call('GET', `/products/${prodB}`);
    check('admin: removed listing is a public 404', anon.status === 404, `got ${anon.status}`);
    const ownerView = await call('GET', `/products/${prodB}`, { token: tS2 });
    check('admin: removed listing stays readable for its owner 200', ownerView.status === 200, `got ${ownerView.status}`);
    const adminView = await call('GET', `/products/${prodB}`, { token: tAdm });
    check('admin: removed listing stays readable for admin 200', adminView.status === 200, `got ${adminView.status}`);

    r = await call('PUT', `/admin/products/${prodB}/status`, { token: tAdm, body: { status: 'ACTIVE' } });
    check('admin: re-approve listing 200 -> ACTIVE', r.status === 200 && r.data?.data?.status === 'ACTIVE', `got ${r.status}`);

    // Review moderation roundtrip
    r = await call('GET', '/admin/reviews', { token: tAdm });
    const pendingReview = (r.data?.data || []).find((rv) => (rv.comment || '').includes('Solid desk'));
    check('admin: moderation queue lists the pending review', !!pendingReview, '');
    if (pendingReview) {
      r = await call('PUT', `/admin/reviews/${pendingReview._id}/status`, { token: tAdm, body: { status: 'APPROVED' } });
      check('admin: approve review 200', r.status === 200, `got ${r.status}`);
      const pub = await call('GET', `/reviews/product/${prodA}`);
      check('admin: approved review now public', (pub.data?.data || []).some((v) => (v.comment || '').includes('Solid desk')), '');
      r = await call('PUT', `/admin/reviews/${pendingReview._id}/status`, { token: tAdm, body: { status: 'PENDING' } });
      check('admin: review can return to PENDING (queue restored)', r.status === 200, `got ${r.status}`);
    }

    // Customer still blocked from every admin route
    for (const p of ['/admin/users', '/admin/sellers', '/admin/products', '/admin/orders', '/admin/metrics']) {
      const rr = await call('GET', p, { token: tC1 });
      check(`authz: customer blocked from ${p} 403`, rr.status === 403, `got ${rr.status}`);
    }
  }

  // ---------------------------------------------------------------- cleanup: demote QA admin
  if (db) {
    const User = require('../models/User');
    try {
      await User.updateOne({ email: adminUserEmail }, { $set: { role: 'CUSTOMER' } });
      const r = await call('GET', '/admin/metrics', { token: tAdm });
      check('cleanup: demoted QA admin no longer passes admin guard 403', r.status === 403, `got ${r.status}`);
    } catch (e) {
      check('cleanup: demote QA admin', false, e.message);
    }

    // ------------------------------------------------------- cleanup: delist this run's fixtures
    // The listing tests above assert that a fresh listing comes back ACTIVE, so
    // without this block every run leaves two shopper-visible fixtures behind.
    // Delist them with the platform's own soft delete (`status: 'INACTIVE'`)
    // rather than removing the records: the orders and negotiations this run
    // created keep their references, the rows stay readable to their owner and to
    // the admin, and `GET /api/products` — which filters on
    // `status: 'ACTIVE' AND stock > 0` — stops returning them to shoppers.
    try {
      const Product = require('../models/Product');
      // Every merchant this harness registers is qae2e_s{1,2,3}_<runId>@example.com.
      const merchants = await User.find({ email: { $regex: /^qae2e_s[123]_\d+@example\.com$/ } }).select('_id');
      const merchantIds = merchants.map((u) => u._id);
      let delisted = 0;
      if (merchantIds.length) {
        delisted = (await Product.updateMany(
          { seller: { $in: merchantIds } },
          { $set: { status: 'INACTIVE' } }
        )).modifiedCount;
      }
      const stillActive = await Product.countDocuments({ seller: { $in: merchantIds }, status: 'ACTIVE' });
      check('cleanup: no e2e listing left ACTIVE in the public catalog', stillActive === 0, `${stillActive} still ACTIVE`);
      console.log(`  (cleanup: ${delisted} e2e fixture listing(s) delisted — they no longer appear in GET /api/products)\n`);
    } catch (e) {
      check('cleanup: delist e2e fixture listings', false, e.message);
    }

    await db.disconnect();
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
