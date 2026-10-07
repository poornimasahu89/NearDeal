const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer')) {
    return res.status(401).json({ status: 'error', message: 'Not authorized, no token' });
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Not authorized, token failed' });
  }

  // Every downstream handler trusts `req.user`, so a token that resolves to a
  // deleted account must stop here instead of reaching `authorize` as null.
  const user = await User.findById(decoded.id).select('-password');
  if (!user) {
    return res.status(401).json({ status: 'error', message: 'Not authorized, account no longer exists' });
  }

  // A suspended account keeps a cryptographically valid token for up to 30 days;
  // suspension has to be re-checked on every request to mean anything.
  if (user.status === 'SUSPENDED') {
    return res.status(403).json({ status: 'error', message: 'This account has been suspended' });
  }

  req.user = user;
  return next();
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Not authorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    return next();
  };
};

// Attaches `req.user` when a valid token is presented, but never rejects the
// request. Public reads that must behave differently for the record's owner
// (the product detail page for a delisted listing) need identity without
// forcing anonymous visitors to authenticate. An absent, malformed or expired
// token simply leaves the caller anonymous — the handler then decides what an
// anonymous caller may see.
const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer')) return next();

  const token = header.split(' ')[1];
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user && user.status !== 'SUSPENDED') {
      req.user = user;
    }
  } catch {
    /* invalid token -> stay anonymous */
  }
  return next();
};

module.exports = { protect, authorize, optionalAuth };
