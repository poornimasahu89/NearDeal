export const MOCK_SELLERS = [
  {
    id: 'seller_1',
    name: 'Green Valley Fresh Mart',
    owner: 'Pooja Sharma',
    rating: 4.8,
    reviewsCount: 142,
    distanceKm: 1.2,
    location: '12, Scheme No. 54, Vijay Nagar, Indore, Madhya Pradesh - 452010',
    shortLocation: 'Vijay Nagar, Indore',
    phone: '+91 98260 12345',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80',
    verified: true,
    bargainTolerance: 'High (up to 15% discount)'
  },
  {
    id: 'seller_2',
    name: 'Sharma Electronics & Gadgets',
    owner: 'Rajesh Sharma',
    rating: 4.9,
    reviewsCount: 188,
    distanceKm: 2.8,
    location: 'Plot 45, Palasia Main Road, Old Palasia, Indore, Madhya Pradesh - 452001',
    shortLocation: 'Palasia, Indore',
    phone: '+91 98930 56789',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&auto=format&fit=crop&q=80',
    verified: true,
    bargainTolerance: 'Moderate (up to 8% discount)'
  },
  {
    id: 'seller_3',
    name: 'Urban Craft Studio & Home Decor',
    owner: 'Ananya Patel',
    rating: 4.7,
    reviewsCount: 94,
    distanceKm: 4.1,
    location: '88, Sapna Sangeeta Road, Snehnagar, Indore, Madhya Pradesh - 452009',
    shortLocation: 'Sapna Sangeeta, Indore',
    phone: '+91 94250 98765',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80',
    verified: true,
    bargainTolerance: 'Flexible'
  }
];

export const MOCK_PRODUCTS = [
  {
    id: 'prod_1',
    title: 'Pure Sundarban Forest Raw Organic Honey (500g)',
    category: 'Groceries',
    price: 480,
    minAcceptablePrice: 420, // Floor price for seller smart bargaining
    originalPrice: 550,
    stock: 24,
    rating: 4.9,
    sellerId: 'seller_1',
    sellerName: 'Green Valley Fresh Mart',
    distanceKm: 1.2,
    images: [
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=600&auto=format&fit=crop&q=80'
    ],
    description: '100% natural, unprocessed raw wild honey sustainably harvested. Preserves natural pollen, antioxidants, and enzymes without added sugar syrups.',
    pickupAvailable: true,
    deliveryAvailable: true,
    bargainable: true
  },
  {
    id: 'prod_2',
    title: 'Wireless Active Noise-Cancelling Bluetooth Headphones',
    category: 'Electronics',
    price: 3499,
    minAcceptablePrice: 3000,
    originalPrice: 4299,
    stock: 8,
    rating: 4.8,
    sellerId: 'seller_2',
    sellerName: 'Sharma Electronics & Gadgets',
    distanceKm: 2.8,
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'
    ],
    description: 'High-definition wireless headphones with dual-mic active noise cancellation. 35 hours battery life with Type-C fast charging. 1-year local warranty.',
    pickupAvailable: true,
    deliveryAvailable: false,
    bargainable: true
  },
  {
    id: 'prod_3',
    title: 'Handcrafted Blue Pottery Ceramic Dinner Set (12 pcs)',
    category: 'Home & Kitchen',
    price: 2250,
    minAcceptablePrice: 1950,
    originalPrice: 2700,
    stock: 6,
    rating: 4.7,
    sellerId: 'seller_3',
    sellerName: 'Urban Craft Studio & Home Decor',
    distanceKm: 4.1,
    images: [
      'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=600&auto=format&fit=crop&q=80'
    ],
    description: 'Artisanal lead-free glazed earthenware dinner set handcrafted by local artisans. Microwave safe, durable and dishwasher friendly.',
    pickupAvailable: true,
    deliveryAvailable: true,
    bargainable: true
  },
  {
    id: 'prod_4',
    title: 'Chikmagalur Medium Roast Filter Coffee Powder (250g)',
    category: 'Groceries',
    price: 340,
    minAcceptablePrice: 290,
    originalPrice: 390,
    stock: 35,
    rating: 4.9,
    sellerId: 'seller_1',
    sellerName: 'Green Valley Fresh Mart',
    distanceKm: 1.2,
    images: [
      'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop&q=80'
    ],
    description: '80:20 plantation Arabica and premium chicory blend, freshly roasted and ground locally for authentic South Indian filter kaapi.',
    pickupAvailable: true,
    deliveryAvailable: true,
    bargainable: true
  },
  {
    id: 'prod_5',
    title: 'Mechanical Gaming Keyboard (Hot-swappable RGB)',
    category: 'Electronics',
    price: 2899,
    minAcceptablePrice: 2500,
    originalPrice: 3499,
    stock: 12,
    rating: 4.6,
    sellerId: 'seller_2',
    sellerName: 'Sharma Electronics & Gadgets',
    distanceKm: 2.8,
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80'
    ],
    description: 'Tenkeyless layout with tactile red mechanical switches, per-key RGB backlighting, braided cord, and Windows/Mac dual layout support.',
    pickupAvailable: true,
    deliveryAvailable: true,
    bargainable: true
  },
  {
    id: 'prod_6',
    title: 'Hand-Poured Soy Wax Aromatherapy Diya & Candle Set',
    category: 'Home & Kitchen',
    price: 650,
    minAcceptablePrice: 550,
    originalPrice: 799,
    stock: 20,
    rating: 4.8,
    sellerId: 'seller_3',
    sellerName: 'Urban Craft Studio & Home Decor',
    distanceKm: 4.1,
    images: [
      'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&auto=format&fit=crop&q=80'
    ],
    description: 'Set of 4 brass-finish earthen containers with pure soy wax infused with Mogra (Jasmine), Sandalwood, and Lemongrass natural extracts.',
    pickupAvailable: true,
    deliveryAvailable: true,
    bargainable: true
  }
];

export const MOCK_USERS = [
  {
    id: 'user_1',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@example.com',
    role: 'customer', // 'customer' | 'seller'
    status: 'active' // 'active' | 'suspended' | 'pending'
  },
  {
    id: 'user_2',
    name: 'Vikram Singh',
    email: 'vikram.singh@example.com',
    role: 'customer',
    status: 'suspended'
  },
  {
    id: 'user_3',
    name: 'Neha Patel',
    email: 'neha.patel@example.com',
    role: 'seller',
    status: 'pending'
  },
  {
    id: 'user_4',
    name: 'Rohit Sharma',
    email: 'rohit.sharma@example.com',
    role: 'seller',
    status: 'active'
  },
  {
    id: 'user_5',
    name: 'Priya Desai',
    email: 'priya.desai@example.com',
    role: 'customer',
    status: 'active'
  }
];

export const MOCK_REVIEWS = [
  {
    id: 'rev_1',
    rating: 4.5,
    sellerId: 'seller_1',
    productId: 'prod_1',
    comment: 'Great honey, authentic flavor!',
    status: 'approved'
  },
  {
    id: 'rev_2',
    rating: 4.0,
    sellerId: 'seller_2',
    productId: 'prod_2',
    comment: 'Sound quality is decent, but battery could be better.',
    status: 'pending'
  },
  {
    id: 'rev_3',
    rating: 5.0,
    sellerId: 'seller_3',
    productId: 'prod_3',
    comment: 'Beautiful pottery, arrived safely.',
    status: 'approved'
  },
  {
    id: 'rev_4',
    rating: 3.5,
    sellerId: 'seller_1',
    productId: 'prod_4',
    comment: 'Good coffee but a bit pricey.',
    status: 'rejected'
  },
  {
    id: 'rev_5',
    rating: 4.8,
    sellerId: 'seller_2',
    productId: 'prod_5',
    comment: 'Keyboard feels great, RGB lighting is nice.',
    status: 'approved'
  }
];


export const MOCK_NEGOTIATIONS = [
  { id: 'neg_101',
    productId: 'prod_2',
    productTitle: 'Wireless Active Noise-Cancelling Bluetooth Headphones',
    productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&auto=format&fit=crop&q=80',
    originalPrice: 3499,
    offeredPrice: 3100,
    sellerId: 'seller_2',
    sellerName: 'Sharma Electronics & Gadgets',
    buyerName: 'Aarav Mehta (Customer)',
    status: 'pending_seller', // 'pending_seller' | 'accepted' | 'countered' | 'rejected'
    expiresInHours: 12,
    sellerCommissionAmount: 62, // 2% of ₹3,100 platform fee from seller
    history: [
      { sender: 'customer', amount: 3100, note: 'Can pick up from Palasia store today evening!', time: '10 mins ago' }
    ]
  },
  {
    id: 'neg_102',
    productId: 'prod_3',
    productTitle: 'Handcrafted Blue Pottery Ceramic Dinner Set (12 pcs)',
    productImage: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=300&auto=format&fit=crop&q=80',
    originalPrice: 2250,
    offeredPrice: 2050,
    sellerId: 'seller_3',
    sellerName: 'Urban Craft Studio & Home Decor',
    buyerName: 'Aarav Mehta (Customer)',
    status: 'accepted',
    expiresInHours: 24,
    sellerCommissionAmount: 41, // 2% of ₹2,050
    history: [
      { sender: 'customer', amount: 1950, note: 'Would you consider ₹1,950 for self-pickup?', time: '2 hours ago' },
      { sender: 'seller', amount: 2050, note: 'Best discount we can offer is ₹2,050 for this set.', time: '1 hour ago' },
      { sender: 'customer', amount: 2050, note: 'Deal accepted! Will pick up tomorrow.', time: '45 mins ago' }
    ]
  },
  {
    id: 'neg_103',
    productId: 'prod_1',
    productTitle: 'Pure Sundarban Forest Raw Organic Honey (500g)',
    productImage: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300&auto=format&fit=crop&q=80',
    originalPrice: 480,
    offeredPrice: 400,
    sellerId: 'seller_1',
    sellerName: 'Green Valley Fresh Mart',
    buyerName: 'Vikram Singh',
    status: 'countered',
    expiresInHours: 6,
    sellerCommissionAmount: 8.8, // 2% of ₹440 (countered)
    history: [
      { sender: 'customer', amount: 400, note: 'Buying 3 jars if discount works', time: 'Yesterday' },
      { sender: 'seller', amount: 440, note: 'Special batch from Sundarban, lowest rate is ₹440/jar', time: 'Yesterday' }
    ]
  }
];

export const MOCK_ORDERS = [
  {
    id: 'ord_901',
    date: '2026-09-17',
    sellerName: 'Green Valley Fresh Mart',
    items: [
      { title: 'Pure Sundarban Forest Raw Organic Honey (500g)', quantity: 2, unitPrice: 440, negotiated: true },
      { title: 'Chikmagalur Medium Roast Filter Coffee Powder (250g)', quantity: 1, unitPrice: 340, negotiated: false }
    ],
    totalAmount: 1220,
    platformCommission: 24.4, // 2% of ₹1,220 borne by seller
    fulfillmentType: 'Store Pickup (1.2 km - Vijay Nagar)',
    status: 'Ready for Pickup',
    paymentStatus: 'Pay on Pickup (Cash / UPI)'
  },
  {
    id: 'ord_902',
    date: '2026-09-15',
    sellerName: 'Urban Craft Studio & Home Decor',
    items: [
      { title: 'Hand-Poured Soy Wax Aromatherapy Diya & Candle Set', quantity: 1, unitPrice: 650, negotiated: false }
    ],
    totalAmount: 650,
    platformCommission: 13, // 2% of ₹650 borne by seller
    fulfillmentType: 'Hyperlocal Delivery (Sapna Sangeeta)',
    status: 'Delivered',
    paymentStatus: 'Completed via UPI'
  }
];

export const MOCK_ADMIN_METRICS = {
  totalGrossVolume: 845000,
  totalPlatformCommission: 16900, // 2% revenue from sellers
  activeLocalSellers: 48,
  activeCustomers: 1280,
  totalCompletedNegotiations: 412,
  averageDiscountRate: '11.8%'
};
