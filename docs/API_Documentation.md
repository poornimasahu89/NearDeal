# NearDeal — API Documentation

Reference for the REST API served by `backend/server.js`.

- **Base URL (local):** `http://localhost:5000/api`
- **Content type:** `application/json`
- **Auth:** `Authorization: Bearer <JWT>` (30-day expiry)

### Response envelope

Every response carries a `status` field; failures always carry `message`.

```json
// success
{ "status": "success", "data": { ... } }

// failure
{ "status": "error", "message": "Product not found" }
```

### Legend

| Symbol | Meaning |
| --- | --- |
| 🔓 | Public — no token required |
| 🔒 | Token required (`protect`) |
| 👤 | `CUSTOMER` only |
| 🏪 | `SELLER` (or `ADMIN`) |
| 🛡️ | `ADMIN` only |
| ◐ | Optional token (`optionalAuth`) — anonymous access allowed |

### Common status codes

| Code | Meaning |
| --- | --- |
| `400` | Malformed input, validation failure, invalid id |
| `401` | Missing / invalid / expired token, or suspended account at login |
| `403` | Authenticated but not allowed (wrong role or not the owner) |
| `404` | Resource does not exist |
| `409` | Conflict with current state (duplicate, already converted, illegal transition) |
| `429` | Auth rate limit exceeded (`Retry-After` header set) |
| `500` | Unhandled server error |
| `503` | `/health` — API up but database unreachable |

---

## 1. Authentication — `/api/auth`

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | 🔓 | Create a customer or seller account |
| `POST` | `/auth/login` | 🔓 | Exchange credentials for a JWT |
| `GET` | `/auth/me` | 🔒 | Restore the session |
| `PUT` | `/auth/profile` | 🔒 | Update location and/or store name |

### `POST /auth/register`

Body:

| Field | Rules |
| --- | --- |
| `name` | required |
| `email` | required, unique, format validated |
| `password` | required, min 6 characters |
| `role` | `CUSTOMER` or `SELLER` only — **`ADMIN` is rejected** |
| `businessName` | optional, used for `SELLER` |

`201` →

```json
{ "status": "success", "data": { "_id": "...", "name": "...", "email": "...",
  "role": "CUSTOMER", "businessName": "...", "token": "<jwt>" } }
```

Errors: `400` invalid body · `409` duplicate e-mail.

### `POST /auth/login`

Body: `email`, `password`. **Rate limited** (default 50 requests / 15 min per IP).

- `200` → session payload with `token`
- `400` missing fields
- `401` `Invalid credentials` (same response for unknown e-mail and wrong password)
- `403` `This account has been suspended...`
- `429` too many attempts

### `GET /auth/me`

`200` → the full user document (never includes `password`).

### `PUT /auth/profile`

Body (any subset): `lng`, `lat`, `businessName`.

- Coordinates must be finite and within `±90` / `±180`; stored as GeoJSON
  `[longitude, latitude]`.
- `businessName` only applies when `role === 'SELLER'`.
- `200` → updated user · `400` invalid coordinates or empty store name.

---

## 2. Products — `/api/products`

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/products` | 🔓 | Filterable, sortable, paginated catalogue |
| `POST` | `/products` | 🏪 | Create a listing |
| `GET` | `/products/mine` | 🏪 | The merchant's own listings (incl. inactive) |
| `GET` | `/products/:id` | ◐ | Product detail |
| `PUT` | `/products/:id` | 🏪 | Edit own listing |
| `DELETE` | `/products/:id` | 🏪 | Delist own listing (soft delete) |

### `GET /products`

Query parameters:

| Param | Type | Notes |
| --- | --- | --- |
| `lat`, `lng` | number | Must be supplied **together**; otherwise `400` |
| `radius` | km | Defaults to `10`, capped at `50` |
| `category` | string | Canonical name or legacy alias |
| `minPrice`, `maxPrice` | number ≥ 0 | `minPrice > maxPrice` → `400` |
| `negotiable` | `true` \| `false` | |
| `search` | string ≤ 100 | Matches product name/description/category **or** store name |
| `minRating` | 0–5 | Filters by the seller's approved-rating average |
| `sort` | see below | Default `relevance` |
| `page`, `limit` | integer | Default `limit` 12, max `100` |

**Sort values:** `relevance`, `newest`, `price_asc`, `price_desc`, `nearest`,
`rating_desc`. Legacy aliases are accepted (`distance` → `nearest`,
`priceLowHigh` → `price_asc`, `rating` → `rating_desc`, …). An unknown value
returns `400`.

`200` →

```json
{
  "status": "success",
  "count": 12,
  "data": [ { "name": "...", "price": 30000, "distanceKm": 2.1, "seller": { ... } } ],
  "meta": {
    "page": 1, "limit": 12, "total": 48, "pages": 4,
    "radiusKm": 10, "centre": { "lat": 22.72, "lng": 75.89 },
    "sort": "relevance",
    "distance": { "type": "straight-line", "formula": "Haversine great-circle", "unit": "km" },
    "categoryCounts": { ... },
    "filters": { ... }
  }
}
```

Notes:

- The geo filter is a **server-side** `$geoWithin $centerSphere`. Listings with
  no usable coordinates are excluded when a centre is supplied and counted in
  `meta.excludedNoLocation`.
- `distanceKm` is straight-line, computed with Haversine — never a driving
  distance.

### `POST /products` 🏪

Body: `name` (3–120), `description` (10–2000), `category` (canonical),
`price` (> 0), `stock` (≥ 0), `images` (≤ 6 http(s) URLs),
`isNegotiable`, `hiddenMinimumPrice` (**must be < price**), `location`
(`{type:"Point", coordinates:[lng, lat]}`).

`201` → the created product. `400` on any validation failure.

### `GET /products/:id` ◐

`200` → product with `seller` populated (`name`, `businessName`, `rating`).
`404` if missing, inactive **and** the caller is not the owner/admin.

### `PUT /products/:id` 🏪

Ownership is re-read from the document (`ADMIN` or the owning seller);
otherwise `403`. Only updatable fields are applied and re-validated.
`200` → updated product.

### `DELETE /products/:id` 🏪

Sets `status: 'INACTIVE'` — a deactivation, not a drop, because orders and
negotiations reference the `_id`.
`200` → `{ _id, name, status }` plus a message.

---

## 3. Negotiations / Bargaining — `/api/negotiations`

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/negotiations/offer` | 👤 | Open a bargaining thread |
| `POST` | `/negotiations/:id/respond` | 🔒 *(customer or seller of that thread)* | Accept / reject / counter |
| `GET` | `/negotiations/mine` | 👤 | The customer's threads |
| `GET` | `/negotiations/seller` | 🏪 | Threads on this store's products |

### `POST /negotiations/offer`

Body: `productId`, `offerPrice` (> 0), `quantity` (default 1).

- `201` → new thread, `status: "PENDING"`
- `200` → thread created `REJECTED` when the offer was below
  `hiddenMinimumPrice`, with
  `message: "Offer was too low and automatically rejected"`
- `400` invalid id / non-positive offer / product not negotiable / own listing
- `404` product missing or not `ACTIVE`
- `409` insufficient stock, or an active thread already exists for this
  customer + product

### `POST /negotiations/:id/respond`

Body: `action` = `ACCEPT` | `REJECT` | `COUNTER`; `counterPrice` required for
`COUNTER`.

- `200` → the updated thread (every action appends to `history`)
- `400` invalid id or invalid counter price / unknown action
- `403` caller is neither the thread's customer nor its seller
- `404` thread not found
- `409` thread already closed, **or** caller is `lastActionBy`
  (you cannot respond to your own move)

On `ACCEPT`, `finalAgreedPrice` is set to `currentOfferPrice`.

### `GET /negotiations/mine` / `GET /negotiations/seller`

`200` → `{ status, data: [...] }`, newest first, with `product`, `customer` and
`seller` populated.

---

## 4. Cart / Checkout — `/api/orders`

> There is **no server-side cart.** The cart is browser state
> (`sessionStorage`); the server only ever receives a single-line checkout
> request per item.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/orders/checkout` | 👤 | Turn a cart line (optionally a bargain) into an order |

### `POST /orders/checkout`

Body:

| Field | Rules |
| --- | --- |
| `productId` | required, valid ObjectId |
| `quantity` | required, positive whole number |
| `negotiationId` | optional — must be `ACCEPTED`, owned by the caller, for this product, and not already converted |
| `paymentMethod` | `CASH_ON_DELIVERY` (default) or `ONLINE` |
| `requestId` | optional idempotency key, 8–64 chars `[A-Za-z0-9_-]` |

The unit price is **never** accepted from the client — it is read from
`negotiation.finalAgreedPrice ?? currentOfferPrice`, or from `product.price`.

`201` → order with `totalAmount` and `platformCommission` (= 2% of
`totalAmount`, the seller's fee).

Replay handling:

- A repeated `requestId` returns `200` with the **first** order and
  `message: "Order already placed"`.

Errors: `400` invalid ids/quantity/payment method, or buying your own listing ·
`404` product/negotiation missing · `403` negotiation not yours ·
`409` negotiation not accepted, already converted, wrong product, or out of
stock.

---

## 5. Orders — `/api/orders`

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/orders/mine` | 👤 🛡️ | Customer order history |
| `GET` | `/orders/seller` | 🏪 🛡️ | Orders on this store |
| `GET` | `/orders/:id` | 🔒 *(parties only)* | One order |
| `PUT` | `/orders/:id/status` | 🏪 🛡️ | Advance the lifecycle |

`GET` responses are projected for the UI: `orderNumber`, `statusLabel`,
`unitPrice`, `originalPrice`, `negotiatedPrice`, `platformCommission`,
`items[]`, `paymentStatus`, `fulfillmentType`.

### `PUT /orders/:id/status`

Body: `status`.

Allowed transitions (enforced server-side):

```
PENDING     → PAID | CANCELLED
PAID        → PROCESSING | COMPLETED | CANCELLED
PROCESSING  → COMPLETED | CANCELLED
COMPLETED   → (none)
CANCELLED   → (none)
```

- `400` unknown status · `404` order not found
- `403` caller is not the order's seller (unless `ADMIN`)
- `409` illegal transition, or "already <status>"
- `200` → updated, fully projected order

Cancelling returns `quantity` units to `Product.stock`.

---

## 6. Reviews — `/api/reviews`

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/reviews` | 👤 | Write a review for a purchased product |
| `GET` | `/reviews/product/:productId` | 🔓 | Approved reviews for a product |

### `POST /reviews`

Body: `productId`, `rating` (integer 1–5), `comment` (≤ 500 chars),
`orderId` (optional).

Purchase is proven by querying the order book for a non-cancelled order for
this customer and product — the browser cannot assert it.

- `201` → review created with `status: "PENDING"` (enters the moderation queue)
- `400` invalid id / rating / comment
- `403` `You can only review products you have purchased`
- `404` product missing or inactive
- `409` duplicate review (also enforced by a unique index)

### `GET /reviews/product/:productId`

`200` → only `APPROVED` reviews, newest first, limited to 50.

> **Frontend note:** these two endpoints are implemented in the API and wrapped
> in `frontend/src/services/api.js`, but no customer-facing review UI has been
> built yet. Reviews currently reach the system only through the API and are
> moderated in the admin panel. See
> [`Project_Report.md`](Project_Report.md).

---

## 7. Admin — `/api/admin` 🛡️

The entire router is behind `protect` + `authorize('ADMIN')`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/admin/metrics` | Platform KPIs |
| `GET` | `/admin/users` | All accounts |
| `PUT` | `/admin/users/:id/status` | `ACTIVE` / `SUSPENDED` |
| `PUT` | `/admin/users/:id/suspend` | Legacy `{isSuspended}` contract |
| `GET` | `/admin/sellers` | Seller roster with location + verification flag |
| `GET` | `/admin/products` | All listings |
| `PUT` | `/admin/products/:id/status` | `ACTIVE` / `INACTIVE` (accepts `APPROVED`/`REMOVED` aliases) |
| `GET` | `/admin/orders` | Platform-wide orders |
| `GET` | `/admin/transactions` | Legacy revenue feed |
| `GET` | `/admin/reviews` | Moderation queue (all statuses) |
| `PUT` | `/admin/reviews/:id/status` | `PENDING` / `APPROVED` / `REJECTED` |

### `GET /admin/metrics`

`200` →

```json
{ "status": "success", "data": {
  "totalGrossVolume": 0,
  "totalPlatformCommission": 0,
  "totalOrders": 0,
  "activeLocalSellers": 0,
  "totalCompletedNegotiations": 0,
  "averageDiscountRate": "0%"
}}
```

All values are aggregated live from MongoDB:

- volume, commission and order count from non-cancelled orders;
- `activeLocalSellers` counts active sellers inside the configured local
  radius using a `$geoWithin` query;
- `averageDiscountRate` is derived from accepted negotiations'
  `(listedPrice − finalAgreedPrice) / listedPrice`.

Approving or rejecting a review recalculates the seller's `User.rating`.

---

## 8. Utility — `/api/health`

### `GET /api/health` 🔓

| Condition | Status | Body |
| --- | --- | --- |
| API up, MongoDB `readyState === 1` | `200` | `database: "connected"` |
| API up, MongoDB unreachable | `503` | `database: "unavailable"` |

```json
{ "status": "success", "message": "API is running, database connected",
  "database": "connected" }
```

### Unknown routes

Any unmatched path under `/api` returns JSON (never HTML):

```json
{ "status": "error", "message": "Route GET /api/nope does not exist" }
```

---

## 9. Rate limiting

Applies to `POST /api/auth/login` and `POST /api/auth/register` only.

| Setting | Default | Env var |
| --- | --- | --- |
| Window | 15 minutes | `AUTH_RATE_WINDOW_MS` |
| Max requests / IP | 50 | `AUTH_RATE_LIMIT` |

Over the budget → `429` with a `Retry-After` header. The limiter is in-memory
and per-process, which matches the single-process deployment.

---

## 10. Related documents

- [`Bargaining_Workflow.md`](Bargaining_Workflow.md) — negotiation endpoints in context
- [`Database_Design.md`](Database_Design.md) — the models behind each response
- [`System_Architecture.md`](System_Architecture.md) — middleware and guards
