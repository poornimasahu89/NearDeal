/**
 * Fixed-window rate limiter for the authentication endpoints.
 *
 * Deliberately dependency-free and in-memory: this deployment is a single local
 * Node process, so a shared store would be complexity without a benefit. Every
 * hit is tracked per client IP *per limiter instance*, so the login limiter and
 * the registration limiter never drain each other's budget.
 *
 * `windowMs` / `max` are configurable through the environment so a stricter
 * production value can be chosen without a code change.
 */
const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 50, message } = {}) => {
  const hits = new Map();

  // Drop expired buckets on a timer; otherwise a long-running process keeps
  // one dead entry per IP that ever touched the endpoint.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, Math.max(windowMs, 60 * 1000));
  if (typeof sweeper.unref === 'function') sweeper.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        status: 'error',
        message:
          message ||
          `Too many attempts. Please wait ${Math.ceil(retryAfterSeconds / 60)} minute(s) and try again.`,
      });
    }

    return next();
  };
};

module.exports = { rateLimit };
