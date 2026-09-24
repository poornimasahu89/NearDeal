import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { BargainingModal } from '../bargaining/BargainingModal';
import { MapPin, Star, Tag, Store } from 'lucide-react';
import { formatINR, formatDistance } from '../../utils/formatters';
import './ProductCard.css';

export const ProductCard = ({ product }) => {
  const [isBargainModalOpen, setIsBargainModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const fallbackImage = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';

  return (
    <>
      <Card hoverEffect padding="none" className="product-card">
        <div className="product-image-wrap">
          <Link to={`/products/${product.id}`} aria-label={`View details for ${product.title}`}>
            <img
              src={imageError ? fallbackImage : (product.images?.[0] || fallbackImage)}
              alt={product.title}
              className="product-img"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          </Link>
          <div className="product-badges-float flex items-center gap-1">
            <Badge variant="default" size="sm" className="distance-badge">
              <MapPin size={10} className="text-accent" /> {formatDistance(product.distanceKm)}
            </Badge>
            {product.bargainable && (
              <Badge variant="bargain" size="sm">
                <Tag size={10} /> Smart Offer
              </Badge>
            )}
          </div>
        </div>

        <div className="product-info-body">
          <div className="product-seller-row flex items-center justify-between text-xs text-muted mb-1">
            <span className="flex items-center gap-1 truncate" title={product.sellerName}>
              <Store size={12} className="flex-shrink-0" /> {product.sellerName}
            </span>
            <span className="flex items-center gap-1 font-semibold text-main flex-shrink-0">
              <Star size={12} fill="#f59e0b" color="#f59e0b" /> {product.rating}
            </span>
          </div>

          <Link to={`/products/${product.id}`}>
            <h4 className="product-title" title={product.title}>{product.title}</h4>
          </Link>

          <div className="product-pricing-row flex items-baseline justify-between mt-2">
            <div className="price-group">
              <span className="product-price">{formatINR(product.price)}</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="product-orig-price">{formatINR(product.originalPrice)}</span>
              )}
            </div>
            <span className="text-xs text-muted">
              {product.pickupAvailable ? 'Store Pickup' : 'Delivery only'}
            </span>
          </div>

          <div className="product-actions-grid mt-3 flex gap-2">
            <Link to={`/products/${product.id}`} className="w-full">
              <Button variant="outline" size="sm" className="w-full">
                View Details
              </Button>
            </Link>
            {product.bargainable && (
              <Button
                variant="bargain"
                size="sm"
                icon={Tag}
                onClick={() => setIsBargainModalOpen(true)}
                title="Propose a custom price to the seller"
              >
                Bargain
              </Button>
            )}
          </div>
        </div>
      </Card>

      <BargainingModal
        isOpen={isBargainModalOpen}
        onClose={() => setIsBargainModalOpen(false)}
        product={product}
      />
    </>
  );
};
