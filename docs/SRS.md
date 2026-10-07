# NearDeal — Software Requirements Specification (SRS)

**Project name:** Local Commerce & Smart Bargaining Platform
**Tagline:** Search Local. Bargain Better. Find Nearby. Make the Deal.
**Concept:** A location-based e-commerce web application where customers
discover nearby products and negotiate prices directly with sellers through a
built-in bargaining system.

This document consolidates the three role-based specifications that were
written for the project team:

| Original document | Section below |
| --- | --- |
| `SRS_Frontend_Developer.md` | [Part A](#part-a--frontend-requirements) |
| `SRS_Backend_Developer.md` | [Part B](#part-b--backend-requirements) |
| `SRS_Database_Developer.md` | [Part C](#part-c--database-requirements) |

The technical content of those documents is preserved. They describe
**requirements** — what the platform is meant to do. For what is *actually
built today*, read [`Project_Report.md`](Project_Report.md)
§ *Current Implementation Status*, which labels every area as **implemented**,
**partially implemented** or **planned**.

---

# Part A — Frontend Requirements

## A.1 Project overview

**Role of the frontend developer:** build a responsive, mobile-friendly and
interactive user interface covering three user roles — Customer, Seller and
Admin — consuming the REST APIs provided by the backend, without owning
database schemas or backend business logic.

## A.2 Technology stack

- **Framework:** React
- **Build tool:** Vite
- **Design:** responsive, mobile-first
- **State management:** Redux, Context API or Zustand (developer's choice)
- **Routing:** React Router

## A.3 Core role-based features

### A.3.1 Customer interface

The primary goal is to find nearby products and easily negotiate prices.

- **Authentication:** registration and login screens.
- **Home page:** search bar, location selector, dynamic sections for
  categories, nearby products, best deals and highly rated sellers.
- **Search results and filters:** results ordered by distance; filters for
  price range, distance radius (5 km, 10 km), minimum rating and a
  "negotiation available" toggle; sorting by nearest, lowest price and highest
  rated.
- **Product details page:** image gallery, specifications, seller rating,
  distance, a **Buy Now** button and a prominent **Negotiate Price** button
  (when enabled by the seller).
- **Bargaining UI:** a modal or dedicated screen to input an offer price, with
  a visual indicator comparing listed price and offer.
- **Customer dashboard:** active negotiations with Accept / Reject / Counter
  actions on seller counter-offers, order history, and profile management.
- **Checkout flow:** standard cart UI showing the *final negotiated price* and
  a payment form.

### A.3.2 Seller interface

The seller needs tools to list products quickly and respond to negotiations
quickly.

- **Authentication:** seller-specific registration requiring business details.
- **Seller dashboard:** overview of total sales, active negotiations and
  recent orders.
- **Product management:** add/edit form covering images, name, price, stock and
  category, with a crucial **Enable Negotiation** toggle and an optional
  private **Minimum Acceptable Price**.
- **Negotiation center:** list of incoming offers with Accept, Reject and
  Counter-Offer actions.
- **Order and inventory management:** view placed orders and update status to
  Processing or Completed.

### A.3.3 Admin interface

- **Admin dashboard:** data tables and lists.
- **User/seller management:** view all users and sellers, verify new sellers,
  suspend accounts.
- **Content moderation:** view products and reviews, remove inappropriate
  content.
- **Transaction logs:** a basic log of completed orders and the 2% commission
  earned by the platform.

## A.4 API integration and state expectations

- **Geospatial data:** the browser sends the user's latitude/longitude and
  receives a sorted array of products with a `distance` field.
- **Real-time updates:** the negotiation dashboard needs frequent polling or
  WebSocket integration so customers see counter-offers promptly.
- **Error handling:** clean UI feedback for rejected offers (e.g. "Offer too
  low") and out-of-stock errors.

---

# Part B — Backend Requirements

## B.1 Project overview

**Role of the backend developer:** build the core business logic, the REST API
endpoints, security and the negotiation state machine, interacting with the
database layer to query and mutate data.

## B.2 Technology stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Architecture:** RESTful APIs
- **Security:** JWT (JSON Web Tokens) for authentication
- **External integrations:** image storage (e.g. AWS S3 / Cloudinary), payment
  gateway (e.g. Stripe / Razorpay)

## B.3 Core business logic and modules

### B.3.1 Authentication and authorization

- JWT-based authentication.
- **Role-Based Access Control:** three strict roles — `CUSTOMER`, `SELLER`,
  `ADMIN`.
- Sellers may only modify their own products; customers may only view their own
  negotiations and orders.

### B.3.2 Location-based search (geospatial logic)

- Endpoints accept the user's latitude and longitude.
- Query products within a specific radius (e.g. 5 km, 10 km).
- Calculate and return a `distance` value for display.

### B.3.3 The smart bargaining engine (core feature)

A state machine for negotiations with offer states
`PENDING`, `ACCEPTED`, `REJECTED`, `COUNTERED`, `EXPIRED`.

Business rules:

1. Customer submits an offer → state `PENDING`.
2. Check against the seller's `hiddenMinimumPrice`. If the offer is lower,
   automatically update state to `REJECTED` and notify the customer.
3. If valid, notify the seller.
4. Seller can change state to `ACCEPTED` or submit a `COUNTERED` price.
5. If `ACCEPTED`, lock the price and allow the customer to proceed to
   checkout.

Validation: minimum offer limits; no negative numbers.

### B.3.4 Order and commission processing

- On checkout, fetch the *final negotiated price* (or listed price when there
  was no negotiation).
- **Commission logic:** calculate the platform fee as exactly 2% of the final
  transaction value and record it in the transaction log.
- Order states: `PENDING → PAID → PROCESSING → COMPLETED`.

### B.3.5 API endpoints required (high level)

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login` |
| Products | `GET /api/products` (lat, long, radius, filters); `POST/PUT/DELETE /api/products/:id` (seller) |
| Negotiations | `POST /api/negotiations/offer`; `POST /api/negotiations/:id/respond`; `GET /api/negotiations` |
| Orders & payments | `POST /api/orders/checkout`; `GET /api/orders` |
| Admin | `GET /api/admin/transactions`; `PUT /api/admin/users/:id/suspend` |

## B.4 Third-party integrations

- **Image uploads:** an endpoint (likely Multer) to upload product images to
  cloud storage and return the URL to the database.
- **Payments:** securely generate payment intents/sessions with the payment
  gateway and handle webhooks to confirm payment success.

---

# Part C — Database Requirements

## C.1 Project overview

**Role of the database developer:** design the schema, ensure data integrity,
optimise queries (especially geospatial search) and handle transaction safety.

## C.2 Technology recommendations

- **Database type:** relational (e.g. PostgreSQL with PostGIS) recommended for
  ACID compliance during negotiations/checkout plus built-in geospatial
  querying; alternatively MongoDB with GeoJSON indexes if a NoSQL approach is
  preferred.

## C.3 Core entities and schema design

### C.3.1 Users and sellers (authentication)

- `Users`: `UserID` (PK), `Name`, `Email` (unique), `PasswordHash`,
  `Role` (enum: Customer, Seller, Admin), `CreatedAt`.
- `Sellers`: `SellerID` (PK, FK → Users), `BusinessName`,
  `VerificationStatus` (boolean), `Rating` (decimal), `Location` (spatial point).
- `CustomerLocations`: `CustomerID` (FK), `LastKnownLocation` (spatial point).

### C.3.2 Products and inventory

- `Products`: `ProductID` (PK), `SellerID` (FK), `Category`, `Name`,
  `Description`, `Images` (array/JSON), `Stock` (integer),
  `Status` (Active, Inactive).
- `Pricing data`: `BasePrice` (decimal), `IsNegotiable` (boolean),
  `HiddenMinimumPrice` (decimal — private threshold for auto-rejections).
- *Optimisation:* a spatial index joining seller location with product to
  quickly find "products near me".

### C.3.3 Negotiations (the core transactional table)

- `NegotiationID` (PK), `ProductID` (FK), `CustomerID` (FK), `SellerID` (FK),
  `CurrentOfferPrice` (decimal),
  `LastActionBy` (enum: Customer, Seller, System),
  `Status` (enum: Pending, Countered, Accepted, Rejected, Expired),
  `UpdatedAt`.
- High read/write volume; concurrency control is required to prevent race
  conditions (e.g. a customer buying while a seller rejects).

### C.3.4 Orders and commissions

- `Orders`: `OrderID` (PK), `CustomerID` (FK), `SellerID` (FK),
  `ProductID` (FK).
- `Financials`: `FinalAgreedPrice` (decimal — from the negotiation or the base
  price); `PlatformCommission` (decimal — strictly 2% of the final agreed
  price).
- `Status`: Pending, Paid, Processing, Completed, Cancelled.
- Orders must be tied transactionally to inventory reduction.

### C.3.5 Reviews

- `Reviews`: `ReviewID` (PK), `ReviewerID` (FK), `TargetSellerID` (FK),
  `TargetProductID` (FK), `Rating` (1–5), `Comment`, `CreatedAt`.

## C.4 Key responsibilities and optimisations

- **Geospatial indexing:** robust spatial indexing (GiST in PostgreSQL, or
  `2dsphere` in MongoDB) on seller location. The most frequent query is:
  *"find all products in category X whose seller is within Y kilometres of the
  customer, sorted by distance."*
- **ACID transactions:** converting an `ACCEPTED` negotiation into a final
  `Order` plus stock reduction must be transactional to prevent overselling.
- **Data integrity:** foreign keys, check constraints (price > 0,
  stock ≥ 0, offer price > 0) and enums so invalid data cannot enter the
  system.
- **Analytics views:** basic views for the admin dashboard — total transaction
  volume and summed `PlatformCommission`, grouped by month.

---

# Requirement → Implementation Map

Where each requirement stands today. Full detail is in
[`Project_Report.md`](Project_Report.md).

| Requirement | Status | Where it lives |
| --- | --- | --- |
| React + Vite responsive UI | ✅ Implemented | `frontend/` |
| Three role interfaces | ✅ Implemented | `pages/customer`, `pages/seller`, `pages/admin` |
| JWT auth + RBAC | ✅ Implemented | `authController`, `authMiddleware` |
| Geospatial search with distance | ✅ Implemented | `productController`, `2dsphere` indexes |
| Bargaining state machine | ✅ Implemented | `negotiationController` |
| Hidden minimum auto-rejection | ✅ Implemented | `createOffer` |
| 2% seller commission | ✅ Implemented | `orderController` |
| Server-side price verification | ✅ Implemented | `createOrder` |
| Order lifecycle + stock safety | ✅ Implemented | `orderController` |
| Admin dashboard + moderation | ✅ Implemented | `adminController`, `AdminPanel` |
| Review model + moderation API | ✅ Implemented (API + admin UI) | `reviewController` |
| Customer review submit/show UI | ⚠️ Not built | API wrapped in `api.js`, no UI |
| Real-time negotiation updates | ⚠️ Partial — refresh on load | no polling/WebSocket |
| `EXPIRED` negotiation status | ⚠️ Reserved — never set | enum only |
| Seller verification approval | ⚠️ Display only | `isVerifiedSeller` never set |
| Image upload (Multer / S3) | ❌ Planned | URLs only |
| Payment gateway | ❌ Planned | `paymentMethod` enum only |
| Notifications | ❌ Planned | — |
| ACID multi-document transactions | ⚠️ Replaced by atomic ops | `findOneAndUpdate` guards |
| Relational DB (PostgreSQL) | ❌ Not used | MongoDB + Mongoose chosen instead |
