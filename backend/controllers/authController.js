const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Hashed once at start-up so the "unknown e-mail" branch of login can do the
// same amount of work as a real password comparison.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 10);

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Self-service registration may only ever create marketplace participants.
// Without this whitelist anyone could POST `role: "ADMIN"` and walk straight
// into the admin area — the ADMIN account is provisioned out of band instead.
const SELF_SERVICE_ROLES = ['CUSTOMER', 'SELLER'];

// `businessName` is part of what the frontend reads off the login payload to
// build the merchant's store name. Without it the client falls back to a
// hardcoded placeholder, which is a mock value leaking into a real session.
const toSessionData = (user) => ({
  _id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  businessName: user.businessName || undefined,
  token: generateToken(user._id),
});

// Registration/login bodies arrive straight from the browser, so every field
// is checked before it reaches the database. Anything that fails here is a
// malformed request (400), never a server error.
const EMAIL_PATTERN = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
const isFilledString = (value) => typeof value === 'string' && value.trim().length > 0;
const cleanString = (value, maxLength) => String(value).trim().slice(0, maxLength);

const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role, businessName } = req.body;

    if (!isFilledString(name)) {
      return res.status(400).json({ status: 'error', message: 'Please add a name' });
    }
    if (!isFilledString(email) || !EMAIL_PATTERN.test(email.trim()) || email.trim().length > 254) {
      return res.status(400).json({ status: 'error', message: 'Please provide a valid email address' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long',
      });
    }

    const requestedRole = String(role || 'CUSTOMER').toUpperCase();
    if (requestedRole === 'ADMIN') {
      return res.status(403).json({
        status: 'error',
        message: 'Administrative accounts cannot be created through public registration',
      });
    }
    if (!SELF_SERVICE_ROLES.includes(requestedRole)) {
      return res.status(400).json({ status: 'error', message: 'Role must be CUSTOMER or SELLER' });
    }
    // A merchant without a store name cannot be displayed anywhere in the
    // marketplace, and the client used to paper over the gap with a hard coded
    // placeholder store name.
    if (requestedRole === 'SELLER' && !isFilledString(businessName)) {
      return res.status(400).json({
        status: 'error',
        message: 'A store name is required to register a seller account',
      });
    }

    const trimmedEmail = cleanString(email, 254);
    const userExists = await User.findOne({ email: trimmedEmail });
    if (userExists) {
      // An e-mail that is already taken is a conflict with existing state, not
      // malformed input — clients distinguish retry-a-login (409) from fix-your
      // -request (400).
      return res.status(409).json({ status: 'error', message: 'User already exists' });
    }

    const user = await User.create({
      name: cleanString(name, 100),
      email: trimmedEmail,
      password,
      role: requestedRole,
      businessName: requestedRole === 'SELLER' ? cleanString(businessName, 120) : undefined,
    });

    if (user) {
      res.status(201).json({ status: 'success', data: toSessionData(user) });
    } else {
      res.status(400).json({ status: 'error', message: 'Invalid user data' });
    }
  } catch (error) { next(error); }
};

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Type checks first: bcrypt throws on non-string input, which would turn a
    // malformed payload into a 500 instead of a validation answer.
    if (!isFilledString(email) || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: cleanString(email, 254) }).select('+password');
    if (!user) {
      // Same work as a failed comparison so a missing account and a wrong
      // password are indistinguishable from the outside.
      await bcrypt.compare('timing-equaliser', DUMMY_PASSWORD_HASH);
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }
    if (!(await user.matchPassword(password))) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        status: 'error',
        message: 'This account has been suspended. Contact the platform administrator.',
      });
    }
    res.json({ status: 'success', data: toSessionData(user) });
  } catch (error) { next(error); }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ status: 'success', data: user });
  } catch (error) { next(error); }
};

// NEW FIX: Allow updating location so sellers can actually list products
const updateProfile = async (req, res, next) => {
  try {
    const { lng, lat, businessName } = req.body;
    if (businessName !== undefined && (typeof businessName !== 'string' || !businessName.trim())) {
      return res.status(400).json({ status: 'error', message: 'Store name must be a non-empty string' });
    }
    const user = await User.findById(req.user.id);
    
    if (lng !== undefined && lat !== undefined) {
      // Validate after conversion, not before: `parseFloat('abc')` is NaN, and
      // NaN fails every `<`/`>` comparison, so the old bounds check let a
      // non-numeric pair through as coordinates the geo queries could never
      // use. GeoJSON stores [longitude, latitude] — the order used below and
      // everywhere else in this codebase.
      const parsedLng = Number(lng);
      const parsedLat = Number(lat);
      if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
        return res.status(400).json({ status: 'error', message: 'Latitude and longitude must be numbers' });
      }
      if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
        return res.status(400).json({ status: 'error', message: 'Invalid coordinates' });
      }
      user.location = {
        type: 'Point',
        coordinates: [parsedLng, parsedLat]
      };
    }
    if (businessName && user.role === 'SELLER') user.businessName = businessName;
    
    await user.save();
    res.status(200).json({ status: 'success', data: user });
  } catch (error) { next(error); }
};

module.exports = { registerUser, loginUser, getMe, updateProfile };
