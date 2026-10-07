const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const SELLER_FIELDS = 'name businessName rating';

// Ownership rule for every mutation: the authenticated merchant may only touch
// records whose `seller` is their own `_id`. The browser never supplies the
// owner — it comes from the product document, which is read before any write.
const canManage = (product, user) =>
  user.role === 'ADMIN' || product.seller.toString() === user.id;

const notFound = (res) => res.status(404).json({ status: 'error', message: 'Product not found' });

// ---------------------------------------------------------------------------
// Category vocabulary. The public filters, the seller form and every seeded
// listing speak one canonical set of names (mirrors the frontend category
// list). Short aliases that older records and API callers still send
// ("Office", "Dining", "Storage") are normalised to the canonical name on
// write and on filter, and unknown values are rejected — so the catalogue
// can never drift into one-off categories that no filter chip can find.
// ---------------------------------------------------------------------------
const CANONICAL_CATEGORIES = [
  'Living Room',
  'Bedroom',
  'Dining Room',
  'Office Furniture',
  'Outdoor Furniture',
  'Storage & Cabinets',
  'Decor & Furnishings',
];

const CATEGORY_ALIASES = {
  living: 'Living Room',
  'living room': 'Living Room',
  bedroom: 'Bedroom',
  'bedroom furniture': 'Bedroom',
  dining: 'Dining Room',
  'dining room': 'Dining Room',
  'dining set': 'Dining Room',
  'dining sets': 'Dining Room',
  office: 'Office Furniture',
  'office furniture': 'Office Furniture',
  outdoor: 'Outdoor Furniture',
  'outdoor furniture': 'Outdoor Furniture',
  storage: 'Storage & Cabinets',
  'storage & cabinets': 'Storage & Cabinets',
  decor: 'Decor & Furnishings',
  'decor & furnishings': 'Decor & Furnishings',
  'home decor': 'Decor & Furnishings',
};

const normalizeCategory = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (CANONICAL_CATEGORIES.includes(trimmed)) return trimmed;
  return CATEGORY_ALIASES[trimmed.toLowerCase()] || null;
};

// Shared field validation for create and update. Mutates the supplied body
// into its normalised form and returns an error message, or null when valid.
// Only fields that are present are checked, so partial updates stay partial.
// `existingPrice` supplies the comparison value for the hidden-minimum check
// when the update does not also change the price.
const validateProductFields = (body, existingPrice) => {
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 3 || name.length > 120) {
      return 'Product name must be between 3 and 120 characters';
    }
    body.name = name;
  }
  if (body.description !== undefined) {
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (description.length < 10 || description.length > 2000) {
      return 'Description must be between 10 and 2000 characters';
    }
    body.description = description;
  }
  if (body.category !== undefined) {
    const category = normalizeCategory(body.category);
    if (!category) return `Invalid category. Allowed: ${CANONICAL_CATEGORIES.join(', ')}`;
    body.category = category;
  }
  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || body.images.length > 6) {
      return 'Images must be an array of at most 6 URLs';
    }
    for (const image of body.images) {
      if (typeof image !== 'string' || !/^https?:\/\/\S{5,2048}$/.test(image.trim())) {
        return 'Each image must be an http(s) URL';
      }
    }
    body.images = body.images.map((image) => image.trim());
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!isFinite(price) || price <= 0) return 'Price must be a positive number';
    body.price = price;
  }
  if (body.stock !== undefined) {
    const stock = Math.floor(Number(body.stock));
    if (!isFinite(stock) || stock < 0) return 'Stock cannot be negative';
    body.stock = stock;
  }
  if (body.hiddenMinimumPrice !== undefined && body.hiddenMinimumPrice !== null && body.hiddenMinimumPrice !== '') {
    const min = Number(body.hiddenMinimumPrice);
    const priceForCheck = body.price !== undefined ? body.price : existingPrice;
    if (!isFinite(min) || min <= 0) return 'Hidden minimum price must be a positive number';
    if (priceForCheck !== undefined && min >= Number(priceForCheck)) {
      return 'Hidden minimum price must be below the selling price';
    }
    body.hiddenMinimumPrice = min;
  } else if (body.hiddenMinimumPrice === '' || body.hiddenMinimumPrice === null) {
    delete body.hiddenMinimumPrice;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Distance: the listing card, the distance chip and the radius filter all
// display a real kilometre value. It is computed from the product's GeoJSON
// position against the centre the caller asked for — never invented client
// side. Haversine on the WGS-84 mean radius (same value Mongo uses above).
// ---------------------------------------------------------------------------
const EARTH_RADIUS_KM = 6378.1;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

const distanceKmBetween = (from, to) => {
  const dLat = toRadians(to[1] - from[1]);
  const dLng = toRadians(to[0] - from[0]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from[1])) * Math.cos(toRadians(to[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
};

const serializeProduct = (product, centre) => {
  const data = product.toObject ? product.toObject() : { ...product };
  const coordinates = data.location && Array.isArray(data.location.coordinates)
    ? data.location.coordinates
    : null;

  if (centre && coordinates && coordinates.length === 2) {
    const distance = distanceKmBetween(centre, coordinates);
    data.distanceKm = Math.round(distance * 10) / 10;
  }
  return data;
};

const createProduct = async (req, res, next) => {
  try {
    const seller = await User.findById(req.user.id);
    if (!seller.location || !seller.location.coordinates || seller.location.coordinates.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Seller location not set. Please update profile with coordinates (lng, lat) first.' });
    }
    const { name, category, description, price, stock, isNegotiable, hiddenMinimumPrice, images } = req.body;
    const payload = { name, category, description, price, stock, isNegotiable, hiddenMinimumPrice, images };
    const invalid = validateProductFields(payload);
    if (invalid) return res.status(400).json({ status: 'error', message: invalid });
    if (!payload.category) {
      return res.status(400).json({ status: 'error', message: `Invalid category. Allowed: ${CANONICAL_CATEGORIES.join(', ')}` });
    }
    // `seller` is always the authenticated identity — a `sellerId` in the body
    // is ignored, so a token can never be used to list stock under someone else.
    const product = await Product.create({
      seller: req.user.id,
      name: payload.name,
      category: payload.category,
      description: payload.description,
      price: payload.price,
      stock: payload.stock,
      isNegotiable: payload.isNegotiable,
      hiddenMinimumPrice: payload.isNegotiable ? payload.hiddenMinimumPrice : undefined,
      images: payload.images,
      location: seller.location,
    });
    res.status(201).json({ status: 'success', data: product });
  } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// GET /api/products — every parameter is optional, so the original contract
// (`GET /api/products` returning every ACTIVE, in-stock listing) still holds:
//
//   lat/lng    centre point; must be supplied together
//   radius     straight-line radius in km (0 < r <= 50, default 10)
//   category   category name or a legacy alias (normalised above)
//   minPrice / maxPrice   inclusive bounds, non-negative numbers
//   negotiable 'true' | 'false'
//   search     free text over product name/description/category and store name
//   minRating  minimum seller rating, 0-5
//   sort       relevance | nearest | newest | price_asc | price_desc | rating_desc
//   page/limit pagination. Omit `limit` and every match is returned exactly as
//              before; asking for a `page` without a `limit` defaults it to
//              DEFAULT_PAGE_SIZE.
//
// The answer keeps `{ status, count, data }`: `count` stays "rows in `data`",
// while `meta.total` carries the number of listings that matched every filter
// — the number the UI shows as the result count.
// ---------------------------------------------------------------------------
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;
const MAX_RADIUS_KM = 50;
const DEFAULT_RADIUS_KM = 10;

const isProvided = (value) => value !== undefined && String(value).trim() !== '';

// Regular expressions arrive from the search box, so every metacharacter is
// escaped: searching for "c++" must look for those characters, not throw.
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True only for a usable GeoJSON position: `type` is "Point" and `coordinates`
 * is an array of exactly two numbers whose first entry (longitude) lies in
 * ±180 and second entry (latitude) in ±90 — the [lng, lat] order written
 * everywhere in this codebase. The two-sided range test also rejects NaN,
 * non-numeric entries and an out-of-range latitude (the common swapped pair).
 * A swap where both values fit both ranges is indistinguishable from a genuine
 * pair and is left to the radius test, which places it thousands of kilometres
 * away rather than near the shopper.
 *
 * `$cond` guards `$size`/`$arrayElemAt`, so a missing, null or non-array value
 * can never make the query throw: a listing without coordinates is *reported*
 * as unmeasurable, never allowed to turn the whole catalogue into a 500.
 */
const VALID_POSITION_EXPR = {
  $and: [
    { $eq: ['$location.type', 'Point'] },
    {
      $cond: [
        { $isArray: '$location.coordinates' },
        {
          $and: [
            { $eq: [{ $size: '$location.coordinates' }, 2] },
            { $gte: [{ $arrayElemAt: ['$location.coordinates', 0] }, -180] },
            { $lte: [{ $arrayElemAt: ['$location.coordinates', 0] }, 180] },
            { $gte: [{ $arrayElemAt: ['$location.coordinates', 1] }, -90] },
            { $lte: [{ $arrayElemAt: ['$location.coordinates', 1] }, 90] },
          ],
        },
        false,
      ],
    },
  ],
};

// Sorts MongoDB can order straight from the stored document. Every one ends in
// `_id`, so a page boundary is deterministic and never repeats or drops a
// listing between two pages.
const DB_SORTS = {
  relevance: { createdAt: -1, _id: -1 },
  newest: { createdAt: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: -1 },
};

// `nearest` and `rating_desc` order by a value the product row does not carry
// (the caller's centre, and the seller document), so those two order the
// matching ids first and then load only the requested page in full. Sorting
// page-by-page would otherwise invent an arbitrary order and hide nearby
// matches behind a wrong page number.
const COMPUTED_SORTS = ['nearest', 'rating_desc'];

// The listing UI keeps the names it already used, so an older client sending
// `sort=priceLowHigh` still works alongside the canonical values.
const SORT_ALIASES = {
  relevance: 'relevance',
  nearest: 'nearest',
  distance_asc: 'nearest',
  distance: 'nearest',
  newest: 'newest',
  price_asc: 'price_asc',
  price_desc: 'price_desc',
  priceLowHigh: 'price_asc',
  priceHighLow: 'price_desc',
  rating: 'rating_desc',
  rating_desc: 'rating_desc',
};

const normaliseSort = (value) => {
  if (!isProvided(value)) return 'relevance';
  const raw = String(value).trim();
  return SORT_ALIASES[raw] || SORT_ALIASES[raw.toLowerCase()] || null;
};

/** The stored [lng, lat] pair when it is actually usable, otherwise null. */
const positionOf = (doc) => {
  const coordinates = doc && doc.location && doc.location.coordinates;
  return Array.isArray(coordinates) && coordinates.length === 2 && coordinates.every(Number.isFinite)
    ? coordinates
    : null;
};

const loadSellerRatings = async (rows) => {
  const sellerIds = [...new Set(rows.map((row) => String(row.seller)).filter(Boolean))];
  if (!sellerIds.length) return new Map();
  const sellers = await User.find({ _id: { $in: sellerIds } }).select('rating');
  return new Map(sellers.map((seller) => [String(seller._id), Number(seller.rating) || 0]));
};

/** Ordering for the two sorts MongoDB cannot answer on its own. */
const orderComputedRows = (rows, sortKey, centre, ratings) => {
  rows.sort((a, b) => {
    let primary = 0;
    if (sortKey === 'nearest') {
      const aPos = centre ? positionOf(a) : null;
      const bPos = centre ? positionOf(b) : null;
      const aDistance = aPos ? distanceKmBetween(centre, aPos) : Number.POSITIVE_INFINITY;
      const bDistance = bPos ? distanceKmBetween(centre, bPos) : Number.POSITIVE_INFINITY;
      primary = aDistance - bDistance;
    } else {
      const aRating = ratings ? ratings.get(String(a.seller)) || 0 : 0;
      const bRating = ratings ? ratings.get(String(b.seller)) || 0 : 0;
      primary = bRating - aRating;
    }
    // Deterministic tie-break (newest document first — the ObjectId carries
    // its creation time), so equal distances or equal ratings still paginate
    // without repeating or skipping a listing.
    return primary !== 0 ? primary : String(b._id).localeCompare(String(a._id));
  });
};

const getProducts = async (req, res, next) => {
  try {
    const {
      lat, lng, radius, category, minPrice, maxPrice, negotiable,
      search, minRating, sort, page, limit,
    } = req.query;

    const hasLat = lat !== undefined && lat !== '';
    const hasLng = lng !== undefined && lng !== '';

    // Parsed once, outside the conditional below: the same centre is also used
    // to serialise each product's distance.
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    // Geo filtering is optional: the app always sends a centre point, but a
    // plain `GET /api/products` is a legitimate listing request and must not
    // be rejected. One coordinate without the other is still malformed.
    if (hasLat !== hasLng) {
      return res.status(400).json({
        status: 'error',
        message: 'Latitude and longitude must be supplied together',
      });
    }

    const query = {
      status: 'ACTIVE',
      stock: { $gt: 0 },
    };

    let radiusKm = null;
    let centre = null;
    if (hasLat && hasLng) {
      if (isNaN(parsedLat) || isNaN(parsedLng)) {
        return res.status(400).json({ status: 'error', message: 'Valid latitude and longitude are required' });
      }
      if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
        return res.status(400).json({ status: 'error', message: 'Latitude must be within ±90 and longitude within ±180' });
      }
      const parsedRadius = parseFloat(radius);
      if (!isNaN(parsedRadius) && parsedRadius <= 0) {
        return res.status(400).json({ status: 'error', message: 'Radius must be a positive number of kilometres' });
      }
      radiusKm = !isNaN(parsedRadius) ? Math.min(parsedRadius, MAX_RADIUS_KM) : DEFAULT_RADIUS_KM;
      centre = [parsedLng, parsedLat];
      // Server-side sphere filter: MongoDB keeps only listings whose stored
      // GeoJSON position falls inside the circle. A listing without usable
      // coordinates cannot match, so it is never presented as "nearby" and no
      // distance is invented for it anywhere.
      query.location = {
        $geoWithin: { $centerSphere: [centre, radiusKm / EARTH_RADIUS_KM] },
      };
    }

    // Legacy callers may still filter with a short alias ("?category=Office")
    // — normalise it so the filter finds the canonical records.
    if (category) query.category = normalizeCategory(category) || category;

    // Inclusive price window. A supplied bound must be a non-negative number;
    // anything else is a malformed request, not a filter to silently drop.
    const priceClause = {};
    if (isProvided(minPrice)) {
      const parsed = Number(minPrice);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).json({ status: 'error', message: 'minPrice must be a non-negative number' });
      }
      priceClause.$gte = parsed;
    }
    if (isProvided(maxPrice)) {
      const parsed = Number(maxPrice);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).json({ status: 'error', message: 'maxPrice must be a non-negative number' });
      }
      priceClause.$lte = parsed;
    }
    if (priceClause.$gte !== undefined && priceClause.$lte !== undefined && priceClause.$gte > priceClause.$lte) {
      return res.status(400).json({ status: 'error', message: 'minPrice cannot be greater than maxPrice' });
    }
    if (priceClause.$gte !== undefined || priceClause.$lte !== undefined) query.price = priceClause;

    if (negotiable === 'true') query.isNegotiable = true;
    else if (negotiable === 'false') query.isNegotiable = false;

    // Seller-rating filter. Ratings live on the seller document, so the ids
    // that qualify are resolved first; an empty `$in` matches nothing, which
    // is the truthful answer while no store has reached that rating yet.
    let minRatingValue = null;
    if (isProvided(minRating)) {
      const parsed = Number(minRating);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) {
        return res.status(400).json({ status: 'error', message: 'minRating must be a number between 0 and 5' });
      }
      if (parsed > 0) {
        const ratedSellers = await User.find({ rating: { $gte: parsed } }).select('_id');
        query.seller = { $in: ratedSellers.map((seller) => seller._id) };
        minRatingValue = parsed;
      }
    }

    // Free text: the product's own text OR the store's name. Both sides of the
    // OR live in one clause, so the rating filter above still applies on top.
    const searchTerm = typeof search === 'string' ? search.trim().slice(0, 100) : '';
    if (searchTerm) {
      const pattern = new RegExp(escapeRegex(searchTerm), 'i');
      const storeMatches = await User.find({
        role: { $in: ['SELLER', 'ADMIN'] },
        $or: [{ name: pattern }, { businessName: pattern }],
      })
        .select('_id')
        .limit(5000);
      const clauses = [{ name: pattern }, { description: pattern }, { category: pattern }];
      if (storeMatches.length) clauses.push({ seller: { $in: storeMatches.map((seller) => seller._id) } });
      query.$or = clauses;
    }

    const sortKey = normaliseSort(sort);
    if (!sortKey) {
      return res.status(400).json({
        status: 'error',
        message: `Unknown sort option. Use one of: ${Object.keys(DB_SORTS).concat(COMPUTED_SORTS).join(', ')}`,
      });
    }
    if (sortKey === 'nearest' && !centre) {
      return res.status(400).json({ status: 'error', message: 'Sorting by distance requires lat and lng' });
    }

    // Pagination. No `limit` means "every match" — the original behaviour of
    // this endpoint, and what every unpaginated caller still expects.
    let pageSize = null;
    if (isProvided(limit)) {
      const parsedLimit = Number(limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_PAGE_SIZE) {
        return res.status(400).json({
          status: 'error',
          message: `limit must be an integer between 1 and ${MAX_PAGE_SIZE}`,
        });
      }
      pageSize = parsedLimit;
    }
    let requestedPage = 1;
    if (isProvided(page)) {
      const parsedPage = Number(page);
      if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        return res.status(400).json({ status: 'error', message: 'page must be a positive integer' });
      }
      requestedPage = parsedPage;
      if (pageSize === null) pageSize = DEFAULT_PAGE_SIZE;
    }

    // Category counts for the sidebar: every active filter except the category
    // itself, so each pill shows how many listings selecting it would reveal.
    const categoryQuery = { ...query };
    delete categoryQuery.category;
    const categoryCounts = {};
    const countRows = await Product.aggregate([
      { $match: categoryQuery },
      { $group: { _id: '$category', listings: { $sum: 1 } } },
    ]);
    for (const row of countRows) {
      if (row._id) categoryCounts[row._id] = row.listings;
    }

    // Listings every *other* filter accepts but that cannot be measured:
    // reported rather than silently vanishing from a radius search.
    let excludedNoLocation = 0;
    if (centre) {
      const measurableQuery = { ...query };
      delete measurableQuery.location;
      excludedNoLocation = await Product.countDocuments({
        $and: [measurableQuery, { $nor: [{ $expr: VALID_POSITION_EXPR }] }],
      });
    }

    const total = await Product.countDocuments(query);
    const pages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    // A page number left behind by a filter that shrank the result set must
    // not render as a phantom empty page: fall back to the last real page and
    // report that number, so the client can correct itself.
    const effectivePage = pageSize ? Math.min(requestedPage, pages) : 1;
    const effectiveSkip = pageSize ? (effectivePage - 1) * pageSize : 0;

    let products;
    if (COMPUTED_SORTS.includes(sortKey)) {
      const rows = await Product.find(query).select('_id seller location createdAt').lean();
      const ratings = sortKey === 'rating_desc' ? await loadSellerRatings(rows) : null;
      orderComputedRows(rows, sortKey, centre, ratings);
      const pageRows = pageSize ? rows.slice(effectiveSkip, effectiveSkip + pageSize) : rows;
      const pageIds = pageRows.map((row) => row._id);
      const loaded = await Product.find({ _id: { $in: pageIds } }).populate('seller', SELLER_FIELDS);
      const byId = new Map(loaded.map((doc) => [String(doc._id), doc]));
      products = pageIds.map((id) => byId.get(String(id))).filter(Boolean);
    } else {
      let cursor = Product.find(query)
        .populate('seller', SELLER_FIELDS)
        .sort(DB_SORTS[sortKey]);
      if (pageSize) cursor = cursor.skip(effectiveSkip).limit(pageSize);
      products = await cursor;
    }

    res.status(200).json({
      status: 'success',
      count: products.length,
      data: products.map((product) => serializeProduct(product, centre)),
      meta: {
        page: effectivePage,
        limit: pageSize,
        total,
        pages,
        radiusKm,
        centre: centre ? { lat: parsedLat, lng: parsedLng } : null,
        sort: sortKey,
        // The figure on the card is a great-circle (as-the-crow-flies)
        // measurement, never a driving or walking distance.
        distance: centre
          ? {
              type: 'straight-line',
              formula: 'Haversine great-circle',
              unit: 'km',
              label: 'Straight-line distance',
            }
          : null,
        excludedNoLocation,
        categoryCounts,
        filters: {
          search: searchTerm || null,
          category: category ? (normalizeCategory(category) || category) : null,
          minPrice: priceClause.$gte ?? null,
          maxPrice: priceClause.$lte ?? null,
          minRating: minRatingValue,
          negotiable: negotiable === 'true' || negotiable === 'false' ? negotiable : null,
        },
      },
    });
  } catch (error) { next(error); }
};

// GET /api/products/:id — the exact record behind /products/<mongoObjectId>.
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid product id' });
    }
    const product = await Product.findById(id).populate('seller', SELLER_FIELDS);
    if (!product) return notFound(res);

    // A delisted listing (seller "deleted" it, or the admin removed it) must
    // read as gone to the public — otherwise a stale link renders a detail
    // page whose offer and buy buttons all fail later. Its own merchant and
    // the admin keep access so inventory management and moderation still work.
    if (product.status !== 'ACTIVE') {
      const owner = product.seller
        ? String(product.seller._id || product.seller)
        : null;
      const requester = req.user ? String(req.user.id) : null;
      const allowed = !!req.user && (req.user.role === 'ADMIN' || (owner && requester === owner));
      if (!allowed) return notFound(res);
    }

    // Optional centre point so the detail page can show the same real distance
    // as the card; a request without coordinates is still a valid read.
    let centre = null;
    if (req.query.lat !== undefined && req.query.lng !== undefined) {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      if (!isNaN(lat) && !isNaN(lng)) centre = [lng, lat];
    }

    res.status(200).json({ status: 'success', data: serializeProduct(product, centre) });
  } catch (error) { next(error); }
};

// GET /api/products/mine — this merchant's own listings.
const getMyProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ seller: req.user.id })
      .populate('seller', SELLER_FIELDS)
      .sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', count: products.length, data: products });
  } catch (error) { next(error); }
};

// Fields a merchant may change. `seller` is deliberately absent: ownership is
// assigned at creation and can never be rewritten from a request body.
const UPDATABLE_FIELDS = [
  'name', 'category', 'description', 'price', 'stock',
  'isNegotiable', 'hiddenMinimumPrice', 'images', 'status',
];

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid product id' });
    }
    const product = await Product.findById(id);
    if (!product) return notFound(res);

    if (!canManage(product, req.user)) {
      return res.status(403).json({ status: 'error', message: 'You can only manage your own products' });
    }

    const updates = {};
    for (const field of UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const invalid = validateProductFields(updates, product.price);
    if (invalid) return res.status(400).json({ status: 'error', message: invalid });

    if (updates.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(updates.status)) {
      return res.status(400).json({ status: 'error', message: 'Status must be ACTIVE or INACTIVE' });
    }

    Object.assign(product, updates);
    await product.save();
    res.status(200).json({ status: 'success', data: product });
  } catch (error) { next(error); }
};

// DELETE /api/products/:id — takes the listing off the marketplace.
//
// Deliberately a deactivation rather than `deleteOne()`: negotiations and
// orders reference this `_id`, and dropping the document would leave them
// pointing at nothing (a populated `product` that resolves to null). The
// record disappears from every catalog query the same way a deletion would,
// and the history stays intact.
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid product id' });
    }
    const product = await Product.findById(id);
    if (!product) return notFound(res);

    if (!canManage(product, req.user)) {
      return res.status(403).json({ status: 'error', message: 'You can only manage your own products' });
    }

    product.status = 'INACTIVE';
    await product.save();
    res.status(200).json({
      status: 'success',
      data: { _id: product._id, name: product.name, status: product.status },
      message: 'Product removed from the marketplace catalog',
    });
  } catch (error) { next(error); }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  getMyProducts,
  updateProduct,
  deleteProduct,
};
