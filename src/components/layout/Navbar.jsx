import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Search,
  ShoppingBag,
  Store,
  ArrowRight,
  ShieldCheck,
  LogOut,
  Package,
  ChevronDown
} from 'lucide-react';
import { useAuth, filterNegotiationsForSeller } from '../../context/AuthContext';
import './Navbar.css';

export const Navbar = () => {
  const { currentRole, isAuthenticated, logout, userProfile, userLocation, maxRadiusKm, setMaxRadiusKm, cartItems, negotiations, currentUser } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/login');
  };

  // Live cart count (total quantity of real cart items in AuthContext)
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Live count of THIS seller's negotiations (same identity filter as the queue)
  const sellerOfferCount = filterNegotiationsForSeller(negotiations, currentUser).length;

  // Top search bar: Enter or the search button → ProductListing with ?search= applied
  const [searchTerm, setSearchTerm] = useState('');
  const handleSearch = () => {
    const term = searchTerm.trim();
    if (!term) return;
    navigate(`/products?search=${encodeURIComponent(term)}`);
  };

  const getInitials = () => {
    if (!userProfile?.name) return 'U';
    const parts = userProfile.name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return userProfile.name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="navbar-header glass-panel">
      {/* Main Navigation Bar */}
      <div className="navbar-main">
        <div className="container flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link to="/" className="brand-logo flex items-center gap-2">
            <div className="brand-icon-box">
              <Store size={22} className="brand-icon" />
            </div>
            <div>
              <span className="brand-title">Near<span className="text-accent">Deal</span></span>
              <span className="brand-subtitle">Local & Smart Bargaining</span>
            </div>
          </Link>

          {/* Location & Radius Badge */}
          <div className="location-pill flex items-center gap-2">
            <MapPin size={16} className="text-accent flex-shrink-0" />
            <div className="location-text-group">
              <span className="location-title">Your Area</span>
              <span className="location-val truncate" title={userLocation}>{userLocation}</span>
            </div>
            <div className="radius-selector flex items-center gap-1">
              <span className="text-xs text-muted">Radius:</span>
              <select
                value={maxRadiusKm}
                onChange={(e) => setMaxRadiusKm(Number(e.target.value))}
                className="radius-dropdown"
                aria-label="Select local discovery radius"
              >
                <option value={2}>2 km</option>
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={20}>20 km</option>
              </select>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="nav-search-bar">
            <button
              type="button"
              className="search-icon search-submit-btn"
              onClick={handleSearch}
              aria-label="Search"
            >
              <Search size={16} />
            </button>
            <input
              type="text"
              placeholder="Search local spices, electronics, sweets, decor..."
              className="search-input"
              aria-label="Search local marketplace"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
          </div>

          {/* Quick Nav Links according to active perspective */}
          <div className="nav-actions flex items-center gap-3">
            <Link to="/products" className="nav-link text-sm font-medium">
              Explore
            </Link>

            {isAuthenticated && currentRole === 'customer' && (
              <>
                <Link to="/orders" className="nav-link text-sm font-medium hide-on-mobile">
                  My Orders
                </Link>
                <Link to="/cart" className="cart-btn flex items-center gap-1" aria-label="Shopping Cart">
                  <ShoppingBag size={18} />
                  <span className="cart-badge">{cartCount}</span>
                </Link>
              </>
            )}

            {isAuthenticated && currentRole === 'seller' && (
              <>
                <Link to="/seller/negotiations" className="nav-link-bargain flex items-center gap-1 text-sm font-medium">
                  Offers ({sellerOfferCount})
                </Link>
                <Link to="/seller" className="nav-btn-portal flex items-center gap-1 text-sm font-semibold">
                  Seller Portal <ArrowRight size={14} />
                </Link>
              </>
            )}

            {isAuthenticated && currentRole === 'admin' && (
              <Link to="/admin" className="nav-btn-admin flex items-center gap-1 text-sm font-semibold">
                Admin Panel <ArrowRight size={14} />
              </Link>
            )}

            {/* Account / User Menu */}
            {isAuthenticated ? (
              <div className="user-account-menu relative" ref={dropdownRef}>
                <button
                  type="button"
                  className="user-profile-trigger flex items-center gap-2"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  aria-label="User Account Menu"
                >
                  <div className="avatar-circle">
                    {getInitials()}
                  </div>
                  <div className="user-name-role flex flex-col text-left hide-on-mobile">
                    <span className="user-display-name truncate">{userProfile?.name || 'Account'}</span>
                    <span className="user-role-badge capitalize">{currentRole}</span>
                  </div>
                  <ChevronDown size={14} className="text-muted hide-on-mobile" />
                </button>

                {dropdownOpen && (
                  <div className="account-dropdown-menu">
                    <div className="dropdown-header">
                      <p className="font-semibold text-sm">{userProfile?.name}</p>
                      <p className="text-xs text-muted truncate">{userProfile?.email}</p>
                      {userProfile?.storeName && (
                        <p className="text-xs text-accent mt-0.5 font-medium">{userProfile.storeName}</p>
                      )}
                    </div>
                    <div className="dropdown-divider" />
                    
                    {currentRole === 'customer' && (
                      <>
                        <Link
                          to="/orders"
                          className="dropdown-item flex items-center gap-2"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <Package size={15} /> My Orders
                        </Link>
                        <Link
                          to="/cart"
                          className="dropdown-item flex items-center gap-2"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <ShoppingBag size={15} /> Shopping Cart
                        </Link>
                      </>
                    )}

                    {currentRole === 'seller' && (
                      <>
                        <Link
                          to="/seller"
                          className="dropdown-item flex items-center gap-2"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <Store size={15} /> Seller Dashboard
                        </Link>
                        <Link
                          to="/seller/negotiations"
                          className="dropdown-item flex items-center gap-2"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <ShieldCheck size={15} /> Price Negotiations
                        </Link>
                      </>
                    )}

                    {currentRole === 'admin' && (
                      <Link
                        to="/admin"
                        className="dropdown-item flex items-center gap-2"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <ShieldCheck size={15} /> Admin Dashboard
                      </Link>
                    )}

                    <div className="dropdown-divider" />
                    <button
                      type="button"
                      className="dropdown-item logout-btn flex items-center gap-2 w-full text-left"
                      onClick={handleLogout}
                    >
                      <LogOut size={15} /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-signin text-sm font-medium">
                  Log In
                </Link>
                <Link to="/register" className="btn-signup text-sm font-medium">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

