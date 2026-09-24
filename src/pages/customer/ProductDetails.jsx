import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MOCK_PRODUCTS, MOCK_SELLERS } from '../../data/mockData';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { BargainingModal } from '../../components/bargaining/BargainingModal';
import { formatINR, formatDistance } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import {
  MapPin,
  Star,
  Tag,
  Store,
  ShieldCheck,
  ShoppingBag,
  ArrowLeft,
  Truck,
  Check,
  Phone
} from 'lucide-react';
import './ProductDetails.css';

export const ProductDetails = () => {
  const { id } = useParams();
  const product = MOCK_PRODUCTS.find((p) => p.id === id) || MOCK_PRODUCTS[0];
  const seller = MOCK_SELLERS.find((s) => s.id === product.sellerId) || MOCK_SELLERS[0];

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isBargainOpen, setIsBargainOpen] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const { addToCart, negotiations } = useAuth();

  // Applicable negotiated price for THIS product, taken from AuthContext negotiations:
  // - 'accepted' / 'countered' → a price agreed with the seller
  // - customer's own session offer that has not been rejected
  // Falls back to null → the normal listed price is used.
  const applicableNegotiation = negotiations.find(
    (n) =>
      n.productId === product.id &&
      (n.status === 'accepted' ||
        n.status === 'countered' ||
        (n.sessionOffer && n.status !== 'rejected'))
  );
  // The standing price is the latest entry of the negotiation history
  // (e.g. the seller's counter), falling back to the record's offeredPrice.
  const standingPrice = applicableNegotiation
    ? Number(
        applicableNegotiation.history?.length
          ? applicableNegotiation.history[applicableNegotiation.history.length - 1].amount
          : applicableNegotiation.offeredPrice
      )
    : NaN;
  const negotiatedPrice =
    applicableNegotiation && Number.isFinite(standingPrice) && standingPrice < product.price
      ? standingPrice
      : null;
  const effectiveUnitPrice = negotiatedPrice !== null ? negotiatedPrice : product.price;

  const handleAddToCart = () => {
    // Passes the negotiated price when applicable, otherwise null (normal price)
    addToCart(product, quantity, negotiatedPrice);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <div className="product-details-page container mt-6">
      <Link to="/products" className="back-link flex items-center gap-1 text-sm text-muted mb-4">
        <ArrowLeft size={16} /> Back to Catalog
      </Link>

      <div className="product-details-grid">
        {/* Images Gallery */}
        <div className="product-gallery">
          <div className="main-image-wrap">
            <img
              src={product.images[activeImageIndex] || product.images[0]}
              alt={product.title}
              className="gallery-main-img"
            />
            {product.bargainable && (
              <Badge variant="bargain" size="md" className="gallery-float-badge">
                <Tag size={12} /> Open to Smart Bargaining
              </Badge>
            )}
          </div>

          {product.images.length > 1 && (
            <div className="thumb-row">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`thumb-btn ${activeImageIndex === idx ? 'active' : ''}`}
                  aria-label={`View image thumbnail ${idx + 1}`}
                >
                  <img src={img} alt="Thumbnail" className="thumb-img" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details & Purchase Controls */}
        <div className="product-info-panel">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="default" size="sm">{product.category}</Badge>
            <span className="text-xs text-muted">Stock: {product.stock} units available</span>
          </div>

          <h1 className="product-main-title">{product.title}</h1>

          <div className="flex items-center gap-3 mt-2 text-sm text-muted">
            <span className="flex items-center gap-1">
              <Star size={14} fill="#f59e0b" color="#f59e0b" />
              <strong className="text-main">{product.rating}</strong> ({seller.reviewsCount} verified reviews)
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MapPin size={14} className="text-accent" />
              <strong>{formatDistance(product.distanceKm)}</strong> from your location
            </span>
          </div>

          {/* Pricing Box */}
          <div className="pricing-box surface-card mt-4 p-4">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-main">{formatINR(product.price)}</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-lg text-muted line-through">
                  {formatINR(product.originalPrice)}
                </span>
              )}
            </div>

            <div className="bargaining-callout-box mt-3 p-3 bg-bargain-light rounded">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-bargain">Smart Bargaining Available</h5>
                  <p className="text-xs text-muted">
                    Seller welcomes fair price counter-offers for local pickup or bulk orders.
                  </p>
                </div>
                <Button
                  variant="bargain"
                  size="sm"
                  icon={Tag}
                  onClick={() => setIsBargainOpen(true)}
                >
                  Make an Offer
                </Button>
              </div>
            </div>

            <div className="action-buttons-stack">
              <div className="quantity-selector flex items-center">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="qty-btn"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="qty-val">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => q + 1)}
                  className="qty-btn"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <Button
                variant={addedToCart ? 'secondary' : 'primary'}
                size="lg"
                className="w-full add-cart-btn"
                icon={addedToCart ? Check : ShoppingBag}
                onClick={handleAddToCart}
              >
                {addedToCart ? 'Added to Cart!' : `Add to Cart (${formatINR(effectiveUnitPrice * quantity)})`}
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="product-desc-section">
            <h4 className="font-bold text-base mb-2">Product Description</h4>
            <p className="text-sm text-muted leading-relaxed">{product.description}</p>
          </div>

          {/* Fulfillment options */}
          <div className="fulfillment-grid">
            <div className="fulfillment-item">
              <Store size={18} className="text-accent" />
              <div>
                <span className="font-semibold text-xs block">Local Store Pickup</span>
                <span className="text-xs text-muted">Ready within 1-2 hours</span>
              </div>
            </div>
            <div className="fulfillment-item">
              <Truck size={18} className="text-accent" />
              <div>
                <span className="font-semibold text-xs block">Hyperlocal Delivery</span>
                <span className="text-xs text-muted">Same-day delivery in city limits</span>
              </div>
            </div>
          </div>

          {/* Seller Profile Summary Card */}
          <Card padding="md" className="seller-summary-card mt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={seller.avatar} alt={seller.name} className="seller-avatar-sm" />
                <div>
                  <h4 className="font-bold text-sm">{seller.name}</h4>
                  <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                    <MapPin size={12} className="flex-shrink-0" /> {seller.location} ({formatDistance(seller.distanceKm)})
                  </p>
                  <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                    <Phone size={11} className="flex-shrink-0" /> {seller.phone}
                  </p>
                </div>
              </div>
              <Badge variant="success" size="sm">Verified Merchant</Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted mt-3 pt-3 border-t border-border">
              <span>Bargaining Flex: <strong className="text-main">{seller.bargainTolerance}</strong></span>
              <span className="text-accent font-semibold flex items-center gap-1">
                <ShieldCheck size={13} /> Local Neighborhood Guarantee
              </span>
            </div>
          </Card>
        </div>
      </div>

      <BargainingModal
        isOpen={isBargainOpen}
        onClose={() => setIsBargainOpen(false)}
        product={product}
      />
    </div>
  );
};

