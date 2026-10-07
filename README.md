# NearDeal

A local commerce platform with smart bargaining: customers browse nearby
listings and negotiate prices with sellers, sellers manage products and
respond to offers, and admins oversee the marketplace.

The repository is a monorepo with two independently runnable applications.

```
NearDeal/
├── frontend/          React + Vite single-page app
├── backend/           Express + MongoDB REST API
├── .gitignore
└── README.md
```

---

## Backend (`backend/`)

Express API backed by MongoDB via Mongoose.

```
backend/
├── config/            db.js — Mongo connection
├── controllers/       auth, product, negotiation, order, review, admin
├── middleware/        authMiddleware, errorHandler, rateLimit
├── models/            User, Product, Order, Negotiation, Review
├── routes/            auth, products, negotiations, orders, reviews, admin
├── scripts/           maintenance, seeding and QA helpers
├── .env.example       configuration template
├── package.json
└── server.js          app entry point
```

### Setup

```bash
cd backend
npm install
copy .env.example .env      # Windows: `copy`, macOS/Linux: `cp`
```

Fill in `backend/.env`:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (defaults to `5000`) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Token signing secret, 32+ random characters |
| `CORS_ORIGIN` | Extra allowed browser origins, comma separated |
| `AUTH_RATE_LIMIT` / `AUTH_RATE_WINDOW_MS` | Login/register throttle budget |

`.env` is gitignored. Never commit real secrets — only `.env.example` is tracked.

### Run

```bash
npm run dev     # nodemon, restarts on change
npm start       # plain node server.js
```

The API serves JSON under `/api` and exposes `GET /api/health`, which reports
`503` until MongoDB is reachable.

### API surface

| Prefix | Coverage |
| --- | --- |
| `/api/auth` | register, login, current user, profile |
| `/api/products` | catalogue, seller CRUD, nearby search |
| `/api/negotiations` | offers, counters, accept/reject, seller queue |
| `/api/orders` | checkout, order history, seller orders |
| `/api/reviews` | product reviews |
| `/api/admin` | platform metrics and moderation |

> Scripts in `backend/scripts/` include seed and QA helpers that write to the
> database. Run them only against a development database.

---

## Frontend (`frontend/`)

React 19 SPA built with Vite, routed with React Router and styled with plain CSS.

```
frontend/
├── public/            favicons, icons, product and placeholder imagery
├── src/
│   ├── components/    bargaining, common UI, layout, router guards
│   ├── context/       AuthContext — session and role state
│   ├── data/          mock fallback data
│   ├── hooks/         useProducts and related hooks
│   ├── pages/         customer, seller and admin views
│   ├── routes/        AppRoutes
│   ├── services/      api.js — HTTP client layer
│   ├── styles/        variables and global styles
│   └── utils/         formatters, placeholder and photo helpers
├── tests/             end-to-end flow scripts
├── .env.example
├── package.json
└── vite.config.js
```

### Setup

```bash
cd frontend
npm install
copy .env.example .env      # optional, only if the API is not on the default URL
```

`VITE_API_URL` points at the backend and defaults to
`http://localhost:5000/api`. Vite only exposes variables prefixed with `VITE_`.

### Run

```bash
npm run dev       # start the Vite dev server
npm run lint      # oxlint
npm run build     # production build into frontend/dist
npm run preview   # serve the production build locally
```

### Verifying a checkout

```bash
cd frontend
npm run lint
npm run build
```

---

## Running both

Start the API first, then the SPA, in two terminals:

```bash
cd backend  && npm run dev      # http://localhost:5000
cd frontend && npm run dev      # http://localhost:5173
```

Localhost and `127.0.0.1` origins are allowed by CORS automatically; any other
origin must be listed in `CORS_ORIGIN`.

---

## Git hygiene

`node_modules/`, `.env` (except `.env.example`), `dist/`, logs and coverage
output are all ignored. Do not commit credentials, JWT secrets, database
connection strings or API keys.
