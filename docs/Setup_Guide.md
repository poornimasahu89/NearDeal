# NearDeal — Setup Guide

Step-by-step instructions for cloning and running the complete project on a
developer machine.

---

## 1. Prerequisites

| Requirement | Notes |
| --- | --- |
| Node.js 18+ | Verified on Node 20/22 (`node --version`) |
| npm 9+ | Ships with Node |
| MongoDB 6+ | Local install **or** a MongoDB Atlas free tier |
| Git | To clone the repository |

Check your toolchain:

```bash
node --version
npm --version
mongod --version    # only if running MongoDB locally
```

No other services, message queues or cloud accounts are required.

---

## 2. Clone the repository

```bash
git clone https://github.com/poornimasahu89/NearDeal.git
cd NearDeal
```

Repository layout:

```
NearDeal/
├── frontend/     React + Vite SPA
├── backend/      Express + Mongoose REST API
├── docs/         Project documentation
├── README.md
└── .gitignore
```

> Do **not** install dependencies at the repository root — there is no root
> `package.json`. `frontend/` and `backend/` are installed separately.

---

## 3. Configure MongoDB

**Option A — local MongoDB**

Start the daemon, then the default connection string in `.env.example` already
points at it:

```
mongodb://127.0.0.1:27017/neardeal
```

**Option B — MongoDB Atlas**

Create a free cluster, allow your IP in Network Access, and copy the connection
string. Replace the `MONGO_URI` value in `backend/.env`.

The application creates its collections and indexes on first write — there is no
separate migration step.

> Seeding is **optional** and never required to run the app. If you want demo
> data, read the warning in [`docs/Project_Report.md`](Project_Report.md)
> before running anything in `backend/scripts/`. Seed scripts write to the
> database you point them at.

---

## 4. Install dependencies

```bash
# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..
```

---

## 5. Configure the backend environment

```bash
cd backend
copy .env.example .env      # macOS/Linux: cp .env.example .env
```

Edit `backend/.env` and fill in your own values:

```
PORT=5000
MONGO_URI=<your MongoDB connection string>
JWT_SECRET=<a long random string, 32+ characters>
CORS_ORIGIN=
AUTH_RATE_WINDOW_MS=900000
AUTH_RATE_LIMIT=50
```

**Generate a real JWT secret** (do not reuse the placeholder):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No — defaults to `5000` | Port the API listens on |
| `MONGO_URI` | **Yes** | MongoDB connection string |
| `JWT_SECRET` | **Yes** | Signs and verifies JWTs; server refuses to start without it |
| `CORS_ORIGIN` | No | Extra allowed browser origins, comma separated |
| `AUTH_RATE_LIMIT` / `AUTH_RATE_WINDOW_MS` | No | Login/register throttle budget |

`.env` is gitignored. Only `.env.example` (placeholders) is committed.

---

## 6. Configure the frontend environment (optional)

```bash
cd frontend
copy .env.example .env      # macOS/Linux: cp .env.example .env
```

```
VITE_API_URL=http://localhost:5000/api
```

This step is optional — when the variable is unset the API client falls back to
`http://localhost:5000/api` automatically. Create the file only if your API runs
somewhere else.

> Vite exposes **only** variables prefixed with `VITE_`. Never put backend
> secrets in the frontend environment.

---

## 7. Start the backend

```bash
cd backend
npm run dev        # nodemon, restarts on change
# or
npm start          # plain node server.js
```

Expected output:

```
Server running in development mode on port 5000
```

Health check:

```bash
curl http://localhost:5000/api/health
```

- `200` → API up **and** MongoDB connected
- `503` → API up but the database is unreachable

---

## 8. Start the frontend

In a **second terminal**:

```bash
cd frontend
npm run dev
```

Vite prints the local URL (default `http://localhost:5173`). Open it in a
browser.

Both processes must be running at the same time for the app to work.

---

## 9. Verify the build

```bash
# Frontend lint (oxlint)
cd frontend && npm run lint

# Frontend production build
cd frontend && npm run build

# Backend syntax check across every source file
cd backend && node --check server.js
```

### End-to-end test scripts

Two Playwright scripts exist under `frontend/tests/`:

| Script | Covers |
| --- | --- |
| `phase4-checkout-flow.cjs` | Cart, checkout and order flow |
| `phase6-dashboards.cjs` | Seller and admin dashboards |

They are **not** wired to `npm test` and require both servers to be running:

```bash
# Backend on :5000 and Vite on :5173 must already be up
NODE_PATH=<dir containing playwright-core> node frontend/tests/phase4-checkout-flow.cjs
```

> **Warning:** these scripts create real QA accounts, listings, orders and
> offers in the database you point them at. Use a disposable development
> database — never a shared or production one.

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `FATAL: JWT_SECRET is not set` | `backend/.env` missing or empty | Create it from `.env.example` and set a 32+ character secret |
| `Unable to connect to server` in the browser | Backend not running | Start `npm run dev` in `backend/` |
| `503` from `/api/health` | MongoDB not running / bad `MONGO_URI` | Start `mongod` or fix the connection string |
| CORS errors in the browser | API on a non-local origin | Add the origin to `CORS_ORIGIN` in `backend/.env` |
| `EADDRINUSE: port 5000` | A backend is already running | Stop it, or set another `PORT` |
| `429 Too many requests` on login | Auth rate limit reached | Wait for the window to reset, or tune `AUTH_RATE_LIMIT` |

---

## Next steps

- [`docs/Setup_Guide.md`](Setup_Guide.md) (this file)
- [`docs/System_Architecture.md`](System_Architecture.md) — how the layers fit together
- [`docs/API_Documentation.md`](API_Documentation.md) — every endpoint
- [`docs/Bargaining_Workflow.md`](Bargaining_Workflow.md) — the negotiation engine
