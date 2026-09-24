import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { ProductCard } from '../../components/common/ProductCard';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { MOCK_PRODUCTS, MOCK_SELLERS } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { formatDistance } from '../../utils/formatters';
import {
  MapPin,
  Tag,
  Store,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Phone
} from 'lucide-react';
import './Home.css';

export const Home = () => {
  const { maxRadiusKm, userLocation } = useAuth();

  // Filter products based on active radius setting
  const nearbyProducts = MOCK_PRODUCTS.filter((p) => p.distanceKm <= maxRadiusKm);

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-banner">
        <div className="container">
          <div className="hero-content mx-auto text-center flex flex-col items-center">
            <div className="hero-badge flex items-center gap-2">
              <Sparkles size={14} className="text-bargain" />
              <span>Hyperlocal Commerce & Smart Bargaining</span>
            </div>
            <h1 className="hero-heading">
              Support neighborhood shops. <br />
              <span className="text-gradient">Negotiate fair prices in real-time.</span>
            </h1>
            <p className="hero-subtext">
              Discover authentic spices, electronics, and handcrafted decor within{' '}
              <strong>{formatDistance(maxRadiusKm)}</strong> of {userLocation}. Make real-time counter offers and pick up locally or order delivery.
            </p>

            <div className="hero-cta-group flex items-center justify-center gap-3">
              <Link to="/products">
                <Button variant="primary" size="lg" icon={ArrowRight}>
                  Explore Local Deals
                </Button>
              </Link>
              <Link to="/seller">
                <Button variant="outline" size="lg" icon={Store}>
                  Are you a Merchant?
                </Button>
              </Link>
            </div>

            {/* Platform Highlights */}
            <div className="hero-features-strip grid grid-cols-3 gap-4 mt-8 w-full">
              <div className="feature-item flex items-center gap-3">
                <div className="feature-icon-box bg-accent-light">
                  <MapPin size={20} className="text-accent" />
                </div>
                <div>
                  <h5 className="font-semibold text-sm">Hyperlocal Radius</h5>
                  <p className="text-xs text-muted">Shop within 1 to 20 km</p>
                </div>
              </div>

              <div className="feature-item flex items-center gap-3">
                <div className="feature-icon-box bg-bargain-light">
                  <Tag size={20} className="text-bargain" />
                </div>
                <div>
                  <h5 className="font-semibold text-sm">Smart Bargaining</h5>
                  <p className="text-xs text-muted">Counter-offer in INR directly</p>
                </div>
              </div>

              <div className="feature-item flex items-center gap-3">
                <div className="feature-icon-box bg-secondary-light">
                  <ShieldCheck size={20} style={{ color: 'var(--secondary)' }} />
                </div>
                <div>
                  <h5 className="font-semibold text-sm">2% Seller Commission</h5>
                  <p className="text-xs text-muted">Paid by seller upon sale</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nearby Products Section */}
      <section className="section-featured container mt-8">
        <div className="section-header flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="section-title">Products Near You</h2>
              <Badge variant="success" size="sm">
                Within {formatDistance(maxRadiusKm)}
              </Badge>
            </div>
            <p className="text-sm text-muted">Direct from verified neighborhood merchants in your area</p>
          </div>
          <Link to="/products" className="text-sm font-semibold text-accent flex items-center gap-1">
            View all ({MOCK_PRODUCTS.length}) <ArrowRight size={14} />
          </Link>
        </div>

        <div className="product-grid grid grid-cols-3 gap-6">
          {nearbyProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Featured Verified Local Sellers */}
      <section className="section-sellers container mt-12">
        <div className="section-header flex items-center justify-between mb-4">
          <div>
            <h2 className="section-title">Featured Neighborhood Sellers</h2>
            <p className="text-sm text-muted">Verified local shops with flexible bargaining and prompt store pickup</p>
          </div>
        </div>

        <div className="sellers-grid grid grid-cols-3 gap-6">
          {MOCK_SELLERS.map((seller) => (
            <Card key={seller.id} hoverEffect className="seller-card">
              <div className="seller-banner" style={{ backgroundImage: `url(${seller.banner})` }}>
                <img src={seller.avatar} alt={seller.name} className="seller-avatar" />
              </div>
              <div className="seller-body">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-base">{seller.name}</h4>
                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                      <MapPin size={12} className="flex-shrink-0" /> {seller.shortLocation || seller.location} ({formatDistance(seller.distanceKm)})
                    </p>
                  </div>
                  <Badge variant="success" size="sm">Verified</Badge>
                </div>

                <div className="seller-meta-row flex items-center justify-between mt-3 text-xs text-muted">
                  <span>Rating: <strong>{seller.rating} ★</strong> ({seller.reviewsCount})</span>
                  <span>Bargain: <strong>{seller.bargainTolerance}</strong></span>
                </div>

                <div className="text-xs text-muted flex items-center gap-1 mt-2">
                  <Phone size={11} /> <span>{seller.phone}</span>
                </div>

                <Link to={`/products?seller=${seller.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-4">
                    Browse Store Catalog
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};
