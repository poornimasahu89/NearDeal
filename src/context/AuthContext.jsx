/* eslint-disable react/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { MOCK_NEGOTIATIONS } from '../data/mockData';

export const AuthContext = createContext();

const MOCK_CREDENTIALS = {
  customer: {
    email: 'customer@neardeal.local',
    name: 'Aarav Mehta',
    phone: '+91 98765 43210',
    city: 'Indore, MP'
  },
  seller: {
    email: 'seller@neardeal.local',
    name: 'Rajesh Sharma',
    storeName: 'Sharma Electronics & Gadgets',
    sellerId: 'seller_2', // matches MOCK_SELLERS.seller_2 (Sharma Electronics & Gadgets)
    phone: '+91 98930 56789',
    city: 'Indore, MP'
  },
  admin: {
    email: 'admin@neardeal.local',
    name: 'Platform Moderator',
    storeName: 'NearDeal Operations',
    phone: '+91 98260 00001',
    city: 'Indore HQ'
  }
};

/**
 * Builds order records from cart items using the EFFECTIVE purchase price
 * (negotiated price when the item was won through bargaining, listed price
 * otherwise). The customer's totalAmount NEVER includes the seller-side 2%
 * platform commission — that is recorded separately as informational data.
 */
export const buildOrdersFromCart = (cartItems = []) => {
  const stamp = Date.now().toString(36);
  return cartItems.map((item, index) => {
    const unitPrice = Number(item.price); // effective purchase price
    const totalAmount = unitPrice * Number(item.quantity); // customer payable
    return {
      id: `ord_${stamp}_${index + 1}`,
      date: new Date().toISOString().slice(0, 10),
      status: 'Ready for Pickup',
      paymentStatus: 'Pay on Pickup (Cash / UPI)',
      fulfillmentType: `Store Pickup (${Number(item.distanceKm || 1.0).toFixed(1)} km)`,
      productName: item.title,
      productImage: item.image || '',
      quantity: Number(item.quantity),
      unitPrice,
      sellerName: item.seller || 'Local Merchant',
      totalAmount,
      // Seller-side only — displayed as info, never added to totalAmount
      platformCommission: Math.round(totalAmount * 2) / 100,
      negotiated: !!item.isNegotiated,
      originalPrice: item.originalPrice || null,
      items: [
        {
          title: item.title,
          quantity: Number(item.quantity),
          unitPrice,
          negotiated: !!item.isNegotiated,
          image: item.image || ''
        }
      ]
    };
  });
};

/**
 * Returns only the negotiations addressed to THIS seller (their incoming queue).
 * Matching is by sellerId first; when an ID is missing on either side (legacy
 * records or registered sellers without a sellerId) it falls back to comparing
 * sellerName against the seller's storeName. A negotiation with no usable
 * seller identity is never shown, and a seller with no identity sees an
 * empty queue — nothing is exposed to every seller by default.
 */
export const filterNegotiationsForSeller = (negotiations = [], seller = null) => {
  const sellerId = seller?.sellerId;
  const storeName = (seller?.storeName || '').trim().toLowerCase();
  if (!sellerId && !storeName) return []; // no usable seller identity → show nothing
  return negotiations.filter((neg) => {
    const negSellerId = neg.sellerId;
    const negStoreName = (neg.sellerName || '').trim().toLowerCase();
    // IDs on both sides are authoritative: different IDs = different sellers
    if (negSellerId && sellerId) return negSellerId === sellerId;
    // Fallback when an ID is missing on one side: compare store names
    if (negStoreName && storeName) return negStoreName === storeName;
    return false; // record has no usable seller identity → never show it
  });
};

export const AuthProvider = ({ children }) => {
  // Check if session is stored
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('neardeal_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [userLocation, setUserLocation] = useState('Vijay Nagar, Indore');
  const [maxRadiusKm, setMaxRadiusKm] = useState(5);

  // Cart state initialized empty so demo products don't appear automatically
  const [cartItems, setCartItems] = useState([]);

  // Active negotiations state initialized with existing mock negotiations
  const [negotiations, setNegotiations] = useState(MOCK_NEGOTIATIONS);

  // Shared orders state — created at checkout, seeded empty (no demo orders).
  // Persisted like the auth session so orders survive refresh/navigation.
  const [orders, setOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('neardeal_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const currentRole = currentUser?.role || null;
  const isAuthenticated = !!currentUser?.isAuthenticated;

  // Persist session
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('neardeal_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('neardeal_auth_user');
    }
  }, [currentUser]);

  // Persist created orders during the current frontend session
  useEffect(() => {
    try {
      localStorage.setItem('neardeal_orders', JSON.stringify(orders));
    } catch {
      /* storage unavailable — keep in-memory state */
    }
  }, [orders]);

  // Cart actions
  const addToCart = (product, quantity = 1, customPrice = null) => {
    const effectivePrice = customPrice !== null ? Number(customPrice) : Number(product.price);
    const isNegotiated = customPrice !== null && Number(customPrice) < Number(product.price);
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      if (existingIndex > -1) {
        return prev.map((item, idx) =>
          idx === existingIndex
            ? {
                ...item,
                quantity: item.quantity + quantity,
                price: effectivePrice,
                isNegotiated: isNegotiated || item.isNegotiated,
                // Negotiated items strike through the listed price (not the MRP)
                originalPrice: isNegotiated ? product.price : item.originalPrice
              }
            : item
        );
      }
      return [
        ...prev,
        {
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          productId: product.id,
          title: product.title,
          seller: product.sellerName || 'Local Merchant',
          distanceKm: product.distanceKm || 1.0,
          price: effectivePrice,
          // Negotiated items strike through the listed price; regular items keep the MRP
          originalPrice: isNegotiated ? product.price : (product.originalPrice || null),
          quantity: Math.max(1, quantity),
          isNegotiated: isNegotiated,
          image: product.images?.[0] || 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=200&auto=format&fit=crop&q=80'
        }
      ];
    });
  };

  const updateCartQuantity = (id, delta) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const removeCartItem = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  // Checkout action — stores completed orders in the shared order state
  const placeOrder = (items = []) => {
    if (!items.length) return [];
    const newOrders = buildOrdersFromCart(items);
    setOrders((prev) => [...newOrders, ...prev]);
    return newOrders;
  };

  // Negotiation actions for customers & sellers
  const submitCustomerOffer = (product, offeredPrice, note = '') => {
    const numericOffer = Number(offeredPrice);
    const newNeg = {
      id: `neg_${Date.now()}`,
      productId: product.id,
      productTitle: product.title,
      productImage: product.images?.[0] || '',
      originalPrice: product.price,
      offeredPrice: numericOffer,
      sellerId: product.sellerId,
      sellerName: product.sellerName,
      buyerName: currentUser?.name ? `${currentUser.name} (Customer)` : 'Customer',
      status: 'pending_seller',
      // Offer submitted by the customer in this session (used for cart price applicability)
      sessionOffer: true,
      expiresInHours: 24,
      sellerCommissionAmount: (numericOffer * 0.02).toFixed(2),
      history: [
        { sender: 'customer', amount: numericOffer, note: note || 'Proposed price offer', time: 'Just now' }
      ]
    };
    setNegotiations((prev) => [newNeg, ...prev]);
    return newNeg;
  };

  const acceptNegotiation = (id) => {
    setNegotiations((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'accepted' } : n))
    );
  };

  const declineNegotiation = (id) => {
    setNegotiations((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'rejected' } : n))
    );
  };

  const counterNegotiation = (id, counterAmount) => {
    const amount = Number(counterAmount);
    setNegotiations((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              status: 'countered',
              offeredPrice: amount,
              sellerCommissionAmount: (amount * 0.02).toFixed(2),
              history: [
                ...n.history,
                { sender: 'seller', amount, note: 'Seller counter-offer', time: 'Just now' }
              ]
            }
          : n
      )
    );
  };

  const switchRole = (role) => {
    const cred = MOCK_CREDENTIALS[role] || MOCK_CREDENTIALS.customer;
    setCurrentUser({
      role,
      isAuthenticated: true,
      ...cred
    });
  };

  const login = (role, email, extra = {}) => {
    const cred = MOCK_CREDENTIALS[role] || {
      name: email.split('@')[0],
      email: email,
      phone: '+91 98765 00000',
      city: 'Indore, MP'
    };
    const user = {
      role,
      isAuthenticated: true,
      ...cred,
      ...extra,
      email: email || cred.email
    };
    setCurrentUser(user);
    return user;
  };

  const register = (role, data = {}) => {
    const user = {
      role,
      isAuthenticated: true,
      name: data.name || (role === 'seller' ? 'New Merchant' : 'New Customer'),
      email: data.email || `${role}@neardeal.local`,
      phone: data.phone || '+91 98765 43210',
      city: 'Indore, MP',
      storeName: role === 'seller' ? (data.storeName || data.name || 'Local Store') : undefined,
      ...data
    };
    setCurrentUser(user);
    return user;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('neardeal_auth_user');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        isAuthenticated,
        switchRole,
        login,
        register,
        logout,
        userLocation,
        setUserLocation,
        maxRadiusKm,
        setMaxRadiusKm,
        userProfile: currentUser || { name: 'Guest', email: '' },
        cartItems,
        addToCart,
        updateCartQuantity,
        removeCartItem,
        clearCart,
        negotiations,
        submitCustomerOffer,
        acceptNegotiation,
        declineNegotiation,
        counterNegotiation,
        orders,
        placeOrder
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

