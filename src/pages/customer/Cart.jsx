import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/Loader';
import { Trash2, Store, ShieldCheck, Plus, Minus } from 'lucide-react';
import { formatINR, formatDistance } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import './Cart.css';

export const Cart = () => {
  // Real cart state lives in AuthContext (shared with Product Details / Bargaining)
  const { cartItems, updateCartQuantity, removeCartItem } = useAuth();

  // Customer purchase subtotal uses the effective unit price
  // (negotiated price when applicable, otherwise the listed price).
  // The seller-side 2% platform commission is NEVER added here.
  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Savings are counted only for items actually won through bargaining
  const totalSavings = cartItems.reduce((acc, item) =>
    item.isNegotiated && item.originalPrice && item.originalPrice > item.price
      ? acc + (item.originalPrice - item.price) * item.quantity
      : acc,
    0
  );

  // Group items by their neighborhood seller (no hard-coded merchant/product)
  const sellerGroups = cartItems.reduce((acc, item) => {
    const key = item.seller || 'Local Merchant';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  if (cartItems.length === 0) {
    return (
      <div className="cart-page container">
        <h1 className="cart-page-title text-2xl font-bold">Your Local Shopping Bag</h1>
        <p className="cart-page-subtitle text-sm text-muted">
          Items organized by neighborhood seller for pickup or delivery
        </p>
        <EmptyState
          title="Your bag is empty"
          message="Browse nearby neighborhood deals and use Smart Bargaining to lock a fair price."
          action={
            <Link to="/products">
              <Button variant="primary" size="md">
                Explore Local Deals
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="cart-page container">
      <h1 className="cart-page-title text-2xl font-bold">Your Local Shopping Bag</h1>
      <p className="cart-page-subtitle text-sm text-muted">
        Items organized by neighborhood seller for pickup or delivery
      </p>

      <div className="cart-layout">
        <div className="cart-items-column">
          {/* Merchant Grouping (one card per seller) */}
          {Object.entries(sellerGroups).map(([sellerName, items]) => (
            <Card padding="md" className="merchant-cart-group" key={sellerName}>
              <div className="cart-group-header">
                <div className="cart-group-title">
                  <Store size={18} className="text-accent" />
                  <span>{sellerName}</span>
                  <span className="cart-group-meta">
                    ({formatDistance(items[0]?.distanceKm ?? 1.0)} away)
                  </span>
                </div>
                <Badge variant="success" size="sm">Store Pickup Ready</Badge>
              </div>

              <div className="cart-items-list">
                {items.map((item) => (
                  <div key={item.id} className="cart-item-row">
                    <div className="cart-item-info">
                      <img src={item.image} alt={item.title} className="cart-item-thumb" />
                      <div className="cart-item-details">
                        <h4 className="cart-item-title text-sm">{item.title}</h4>
                        <div className="cart-item-price-row">
                          <span className="cart-item-price text-sm font-bold">{formatINR(item.price)}</span>
                          {item.originalPrice && item.originalPrice > item.price && (
                            <span className="cart-item-original-price text-xs text-muted">
                              {formatINR(item.originalPrice)}
                            </span>
                          )}
                          {item.isNegotiated && (
                            <Badge variant="bargain" size="sm">Smart Offer Won</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="cart-item-actions">
                      <span className="cart-item-qty text-xs text-muted">Qty: {item.quantity}</span>
                      <div className="qty-stepper">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, -1)}
                          className="cart-icon-btn"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, 1)}
                          className="cart-icon-btn"
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="cart-icon-btn cart-icon-btn-remove"
                        aria-label="Remove item"
                        onClick={() => removeCartItem(item.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <div className="cart-summary-column">
          <Card padding="md" className="summary-card">
            <h3 className="summary-title text-base">Order Summary</h3>

            <div className="summary-rows">
              <div className="summary-row">
                <span className="summary-label">Subtotal:</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              <div className="summary-row summary-row-savings">
                <span>Bargaining Savings:</span>
                <span>-{formatINR(totalSavings)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Store Pickup (Indore):</span>
                <span className="summary-free">FREE</span>
              </div>

              <div className="summary-divider" />

              <div className="summary-row summary-row-total">
                <span>Customer Payable:</span>
                <span>{formatINR(subtotal)}</span>
              </div>
            </div>

            {/* Local Market Assurance */}
            <div className="revenue-transparency-box">
              <ShieldCheck size={18} className="revenue-transparency-icon" />
              <div className="revenue-transparency-text">
                <strong>Neighborhood Guarantee:</strong> Zero convenience surcharges or platform
                fees for buyers. Inspect and verify items directly at the store or upon delivery.
              </div>
            </div>

            {/* Checkout Form */}
            <CheckoutForm cartItems={cartItems} subtotal={subtotal} />
            <p className="cart-summary-footnote text-xs text-muted">
              Pay via UPI, Card, or Cash directly at the store upon verification.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Checkout form component for addressing Indian delivery details
const CheckoutForm = ({ cartItems, subtotal }) => {
  const [formData, setFormData] = useState({
    name: 'Aarav Mehta',
    address: '14, Snehnagar, Sapna Sangeeta Road',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pin: '452001'
  });
  const [errors, setErrors] = useState({});
  const [orderPlaced, setOrderPlaced] = useState(false);

  // Shared order state lives in AuthContext (same store /orders reads)
  const { placeOrder } = useAuth();

  const storeName = cartItems[0]?.seller || 'your neighborhood store';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Name required';
    if (!formData.address) newErrors.address = 'Address required';
    if (!formData.city) newErrors.city = 'City required';
    if (!formData.state) newErrors.state = 'State required';
    if (!/^[0-9]{6}$/.test(formData.pin)) newErrors.pin = 'Enter a valid 6-digit PIN';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    // Store the completed checkout in shared AuthContext order state
    // (effective/negotiated prices; customer total excludes seller 2%)
    placeOrder(cartItems);
    setOrderPlaced(true);
  };

  if (orderPlaced) {
    return (
      <div className="order-confirmed-block surface-card">
        <h4 className="order-confirmed-title">Order Confirmed!</h4>
        <p className="order-confirmed-text text-xs text-muted">
          Your order of {formatINR(subtotal)} is ready for pickup/delivery from {storeName}.
        </p>
        <a href="/orders" className="btn btn-primary btn-sm order-confirmed-link">
          View in My Orders
        </a>
      </div>
    );
  }

  return (
    <form className="checkout-form surface-card" onSubmit={handleSubmit}>
      <h4 className="checkout-form-title text-sm">Delivery / Pickup Details</h4>
      <div className="checkout-grid">
        <div className="checkout-field">
          <input
            name="name"
            placeholder="Full Name"
            className="form-input checkout-input"
            value={formData.name}
            onChange={handleChange}
            aria-label="Full Name"
          />
          {errors.name && <p className="checkout-field-error">{errors.name}</p>}
        </div>
        <div className="checkout-field">
          <input
            name="pin"
            placeholder="PIN (6 digits)"
            className="form-input checkout-input"
            value={formData.pin}
            onChange={handleChange}
            aria-label="PIN Code"
          />
          {errors.pin && <p className="checkout-field-error">{errors.pin}</p>}
        </div>
        <div className="checkout-field">
          <input
            name="city"
            placeholder="City"
            className="form-input checkout-input"
            value={formData.city}
            onChange={handleChange}
            aria-label="City"
          />
          {errors.city && <p className="checkout-field-error">{errors.city}</p>}
        </div>
        <div className="checkout-field">
          <input
            name="state"
            placeholder="State"
            className="form-input checkout-input"
            value={formData.state}
            onChange={handleChange}
            aria-label="State"
          />
          {errors.state && <p className="checkout-field-error">{errors.state}</p>}
        </div>
        <div className="checkout-field checkout-field-full">
          <input
            name="address"
            placeholder="Address Line"
            className="form-input checkout-input"
            value={formData.address}
            onChange={handleChange}
            aria-label="Address Line"
          />
          {errors.address && <p className="checkout-field-error">{errors.address}</p>}
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-md checkout-submit">
        Place Order ({formatINR(subtotal)})
      </button>
    </form>
  );
};
