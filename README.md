# NearDeal

**Local Commerce & Smart Bargaining Platform** — a location-based marketplace
where customers discover products from nearby sellers and negotiate the price
directly, in a structured multi-turn bargaining flow built into the app.

> Search Local. Bargain Better. Find Nearby. Make the Deal.

---

## Overview

NearDeal connects customers with local stores and adds what ordinary
e-commerce does not: **a real negotiation**. Shoppers compare listings by
price, distance and seller rating, then either buy at the listed price or open
a bargaining thread. The seller accepts, declines or counters. When both sides
agree, that price is locked and carried into checkout — verified by the
server, so a buyer can never be charged a number the seller did not accept.

It is a full-stack **MERN** application: React + Vite frontend, Express REST
API, MongoDB via Mongoose.

### Problem

Buying locally is slow and opaque — visiting several shops, calling around to
ask prices, comparing by hand, judging whether a quote is fair, then bargaining
in person at each one. Meanwhile fixed-price e-commerce gives customers no way
to bargain and gives good local merchants no way to be discovered.

### Solution

```
Search → Find Nearby → Negotiate → Buy → Review
```

One place to discover nearby inventory, compare it honestly, negotiate a fair
price, and complete the purchase — with the platform funded by a flat 2%
seller-side commission instead of customer fees or advertising.

---

## Key features

- **Hyperlocal discovery** — server-side radius search with real straight-line
  (Haversine) distances, up to 50 km
- **Rich filtering** — text search, category, price range, minimum seller
  rating, "negotiable only", plus 6 sort modes and pagination
- **Smart bargaining** — offer → counter → accept/decline state machine with a
  full audit history and a **hidden seller floor** that auto-rejects low balls
  without revealing the threshold
- **Three roles** — Customer, Seller and Admin, each with its own interface
  and server-side authorisation
- **Seller storefront** — product CRUD, inventory, hide/publish, incoming
  offers, order fulfilment
- **Safe checkout** — server-side price verification, idempotent submissions,
  atomic stock reservation, one-bargain-one-order guarantee
- **Order lifecycle** — validated status transitions; cancelling restores stock
- **Reviews** — purchase-verified, moderated, feeding a recomputed seller rating
- **Admin dashboard** — live KPIs, account/listing/review moderation
- **Security** — JWT + bcrypt, role guards, rate limiting, helmet, CORS
  allow-list, centralised JSON error handling

---

## How it works

### Customer
Browse home and catalogue → filter by distance/price/rating → open a product →
**Buy Now** or **Negotiate Price** → track threads at `/negotiations` →
checkout at the agreed price → follow the order at `/orders`.

### Seller
Register with a store name → set store location → create listings with a
negotiable toggle and optional hidden minimum price → respond to offers with
**Accept / Decline / Counter** → advance orders
`Payment Pending → Ready for Pickup → Preparing → Completed` → watch the 2%
commission accumulate.

### Admin
Sign in at `/admin/login` → read live KPIs (gross volume, total commission,
order count, active local sellers, completed negotiations, average discount
rate) → moderate accounts, listings and reviews.

### Smart bargaining

```
Customer submits offer
  → backend authenticates, loads product
  → validates: negotiable · stock · not own listing · no duplicate thread
  → offer < hidden minimum?   yes → REJECTED by SYSTEM (floor never revealed)
                            no  → PENDING (listed price snapshotted)
  → seller responds  →  ACCEPT (price locked) | REJECT | COUNTER
  → customer responds to any counter
  → ACCEPTED thread goes to checkout
  → server re-reads the agreed price from the database
  → order created at that exact price
```

States: `PENDING · COUNTERED · ACCEPTED · REJECTED · EXPIRED`.
Only the two parties may respond, a party cannot answer its own move, and each
accepted bargain converts to exactly one order.

Full detail: [`docs/Bargaining_Workflow.md`](docs/Bargaining_Workflow.md).

### The 2% seller commission

`platformCommission = round(totalAmount × 0.02, 2)`

- Charged on the **final transaction value** — the negotiated price when the
  purchase came from a bargain, the list price otherwise, × quantity.
- **Never added to the customer's bill.** `totalAmount` carries no fee.
- Stored per order and summed in MongoDB for the admin KPI.

| Listed | Agreed | Customer pays | Commission (2%) | Seller nets |
| --- | --- | --- | --- | --- |
| ₹30,000 | ₹27,000 | ₹27,000 | **₹540** | ₹26,460 |

---

## Architecture

```
React (Vite) SPA
      │  HTTP JSON  +  Authorization: Bearer <JWT>
      ▼
Express REST API
  helmet → CORS → 256 KB body cap → auth rate limit → routers
      │
      ▼
protect / authorize / optionalAuth        ← JWT + role + ownership checks
      │
      ▼
Controllers (business rules, validation)
      │
      ▼
Mongoose models (User · Product · Negotiation · Order · Review)
      │
      ▼
MongoDB   (2dsphere geo indexes · unique requestId · unique review)
```

**Technology:** React 19 · Vite 8 · React Router 7 · oxlint · Node.js 18+ ·
Express 4 · Mongoose 8 · MongoDB 6+ · jsonwebtoken · bcryptjs · helmet · cors ·
nodemon · playwright-core (opt-in e2e)

---

## Project structure

```
NearDeal/
├── frontend/
│   ├── public/          product and placeholder imagery, icons
│   ├── src/
│   │   ├── components/  bargaining modal, UI kit, layout, route guard
│   │   ├── context/     AuthContext — session, cart, negotiations, orders
│   │   ├── pages/       customer / seller / admin / auth
│   │   ├── routes/      AppRoutes
│   │   ├── services/    api.js HTTP client
│   │   └── styles/      variables, global CSS
│   ├── tests/           phase4 checkout + phase6 dashboard scripts
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── config/          db.js
│   ├── controllers/     auth · product · negotiation · order · review · admin
│   ├── middleware/      authMiddleware · errorHandler · rateLimit
│   ├── models/          User · Product · Negotiation · Order · Review
│   ├── routes/          auth · products · negotiations · orders · reviews · admin
│   ├── scripts/         maintenance, QA and optional seed helpers
│   ├── package.json
│   └── server.js
├── docs/                full documentation set
├── .gitignore
└── README.md
```

---

## Installation

Full walkthrough: **[`docs/Setup_Guide.md`](docs/Setup_Guide.md)**

**Prerequisites:** Node.js 18+, npm, MongoDB (local or Atlas), Git.

```bash
git clone https://github.com/poornimasahu89/NearDeal.git
cd NearDeal

# 1. dependencies (no root package.json — install each app)
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..

# 2. backend environment
cd backend
copy .env.example .env        # macOS/Linux: cp .env.example .env
#    edit .env → set MONGO_URI and a 32+ character JWT_SECRET
cd ..

# 3. frontend environment (optional — defaults to localhost:5000/api)
cd frontend
copy .env.example .env        # macOS/Linux: cp .env.example .env
cd ..
```

**Run both** (two terminals):

```bash
cd backend  && npm run dev     # API  → http://localhost:5000
cd frontend && npm run dev     # SPA  → http://localhost:5173
```

Health check: `GET http://localhost:5000/api/health` returns `200` when the API
and database are both up, `503` when the database is unreachable.

> `.env` is gitignored. Never commit real secrets — only the placeholder
> `.env.example` files are tracked.

---

## Documentation

| Document | Contents |
| --- | --- |
| [Project Report](docs/Project_Report.md) | Full overview, workflows, business model, implementation status |
| [SRS](docs/SRS.md) | Role-based requirements (frontend, backend, database) |
| [System Architecture](docs/System_Architecture.md) | Layers, JWT auth, error handling |
| [Database Design](docs/Database_Design.md) | Models, indexes, relationships |
| [API Documentation](docs/API_Documentation.md) | Every endpoint with contracts |
| [Bargaining Workflow](docs/Bargaining_Workflow.md) | The negotiation state machine |
| [Setup Guide](docs/Setup_Guide.md) | Clone, configure, run, troubleshoot |
| [Original Specification](docs/Detail_Project.md) | Initial business concept and website spec |

---

## Testing status

| Check | Command | Result |
| --- | --- | --- |
| Frontend lint | `npm run lint` | ✅ exit 0 (oxlint warnings only, no errors) |
| Frontend build | `npm run build` | ✅ exit 0 — 1937 modules, production bundle emitted |
| Backend syntax | `node --check` on all sources | ✅ 39/39 passed |
| Backend module load | require all routes/middleware/models | ✅ 6/6 · 3/3 · 5/5 loaded |
| E2E scripts | `frontend/tests/*.cjs` | ⚙️ Available, **not run** — see below |

Two Playwright scripts exist (`phase4-checkout-flow.cjs` for cart/checkout,
`phase6-dashboards.cjs` for seller/admin dashboards). They are not wired to
`npm test`: they need a live backend on `:5000` and Vite on `:5173`, and they
**create real QA data** in the target database, so they should only be run
against a disposable development database.

No unit-test framework is configured in either package.

---

## Implementation status

**✅ Implemented:** geo-filtered catalogue with distance and sorting · JWT auth
with three-role RBAC · seller product CRUD · full bargaining state machine with
hidden-floor auto-rejection · cart with negotiated-price carry-through ·
idempotent checkout with server-side price verification and atomic stock ·
order lifecycle with stock restoration · 2% commission computed and aggregated
server-side · review model with purchase verification and moderation · admin
dashboard and live KPIs · helmet/CORS/rate-limiting/error handling · health
endpoint.

**⚠️ Partially implemented:** customer review submit/show UI (API and admin
moderation exist, no customer-facing screen) · real-time updates (refresh on
load, no push) · `EXPIRED` status reserved but never assigned · seller
verification flag displayed but never set · delivery address collected in the
form but not persisted · payment methods are labels only.

**❌ Planned:** image upload · payment gateway · notifications · in-thread
messaging · offer expiry · geocoding · unit tests.

Full breakdown: [`docs/Project_Report.md`](docs/Project_Report.md)
§ *Current Implementation Status*.

---

## Security

JWT sessions (30-day) · bcrypt password hashing with `select: false` ·
registration restricted to `CUSTOMER`/`SELLER` (no self-service admin) ·
suspension re-checked on every request · `protect`/`authorize`/`optionalAuth`
guards on every non-public route · rate limiting on login and registration ·
`helmet` headers and disabled `x-powered-by` · CORS allow-list · 256 KB JSON
body cap · prices read from the database, never the client · idempotent
checkout · atomic stock decrement · JSON-only errors with stack traces only in
development · `.env` excluded from Git.

---

## Future improvements

Real-time negotiation updates and notifications · customer review UI ·
persisted delivery addresses · payment gateway · cloud image upload · offer
expiry · unit test coverage and an opt-in e2e CI job · shared rate-limit store
before horizontal scaling · featured listings and seller subscriptions.

---

## License

No license file has been published with this repository yet. All rights
reserved by the author unless a license is added.
