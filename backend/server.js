const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimit } = require('./middleware/rateLimit');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Fail fast: a JWT signed with a missing secret would be signed with
// `undefined`, which is effectively a public signing key. A short secret is
// only warned about so an existing local setup keeps booting.
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Add it to backend/.env before starting the API.');
  process.exit(1);
}
if (String(process.env.JWT_SECRET).length < 32) {
  console.warn('WARNING: JWT_SECRET is shorter than 32 characters. Use a long random value.');
}

// Connect to database
connectDB();

const app = express();

// The framework header advertises the stack for no benefit.
app.disable('x-powered-by');

// Middleware
app.use(helmet());

// Browser origins. The marketplace is consumed by the local dev frontend, so
// localhost/127.0.0.1 on any port is allowed; any other origin has to be
// listed explicitly in CORS_ORIGIN (comma separated). Non-browser clients
// (curl, tests) send no Origin header and are always allowed.
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
      if (isLocalDevOrigin || configuredOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  })
);

// Explicit body cap: product images are URLs, so nothing legitimate is close
// to this size, and an unbounded payload is a denial-of-service vector.
app.use(express.json({ limit: '256kb' }));

// Brute-force protection on the two endpoints that mint sessions. The budget
// is per IP and generous enough for a shared local dev address.
const authRateLimit = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT) || 50,
  message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
});
app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/register', authRateLimit);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/negotiations', require('./routes/negotiationRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.get('/api/health', (req, res) => {
  // Only "healthy" when MongoDB is actually reachable: a green health check
  // over a dead database would mislead every monitor that believes it.
  // readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'success' : 'error',
    message: dbConnected ? 'API is running, database connected' : 'API is running, database unavailable',
    database: dbConnected ? 'connected' : 'unavailable',
  });
});

// Unknown API routes must answer with JSON, not Express' default HTML error
// page -- every caller in this app reads `data.message` from the body.
app.use('/api', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
  });
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
