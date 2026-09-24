import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../../components/common/ProductCard';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/Loader';
import { MOCK_PRODUCTS } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { formatDistance } from '../../utils/formatters';
import { Search, SlidersHorizontal, Tag } from 'lucide-react';
import './ProductListing.css';
const priceValues = MOCK_PRODUCTS.map(p => p.price);
const priceMin = Math.min(...priceValues);
const priceMax = Math.max(...priceValues);
export const ProductListing = () => {
  const [searchParams] = useSearchParams();
  // Existing auth context values
  const { maxRadiusKm, setMaxRadiusKm } = useAuth();
  // New state for price range filter (min and max price in INR)
  const [minPrice, setMinPrice] = useState(priceMin);
  const [maxPrice, setMaxPrice] = useState(priceMax);
  // New state for seller rating filter (minimum rating)
  const [minRating, setMinRating] = useState(0);
  // New state for sorting option
  const [sortOption, setSortOption] = useState('relevance');


  const [selectedCategory, setSelectedCategory] = useState('All');
  const searchParam = searchParams.get('search') || '';
  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [onlyBargainable, setOnlyBargainable] = useState(false);

  // Re-sync when a new ?search= arrives from the top navigation bar while
  // this page is already mounted (React's render-phase state adjustment).
  const [lastSearchParam, setLastSearchParam] = useState(searchParam);
  if (searchParam !== lastSearchParam) {
    setLastSearchParam(searchParam);
    setSearchQuery(searchParam);
  }



  const categories = ['All', 'Groceries', 'Electronics', 'Home & Kitchen'];
  // Determine price bounds from mock data for slider defaults



  const filteredProducts = MOCK_PRODUCTS.filter((product) => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.sellerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDistance = product.distanceKm <= maxRadiusKm;
    const matchesBargain = !onlyBargainable || product.bargainable;
    const matchesPrice = product.price >= minPrice && product.price <= maxPrice;
    const matchesRating = product.rating >= minRating;
    return matchesCategory && matchesSearch && matchesDistance && matchesBargain && matchesPrice && matchesRating;
  });

  // Apply sorting based on selected option
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortOption) {
      case 'priceLowHigh':
        return a.price - b.price;
      case 'priceHighLow':
        return b.price - a.price;
      case 'rating':
        return b.rating - a.rating;
      default:
        return 0;
    }
  });
  

  

  return (
    <div className="product-listing-page container mt-6">
      <div className="listing-header mb-6">
        <h1 className="text-2xl font-bold">Local Marketplace Catalog</h1>
        <p className="text-muted text-sm">
          Browse products from neighborhood vendors within {formatDistance(maxRadiusKm)} radius
        </p>
      </div>

      <div className="listing-layout">
        {/* Sidebar Filters */}
        <aside className="listing-sidebar">
          <Card padding="md" className="filter-card">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-sm flex items-center gap-1">
                <SlidersHorizontal size={14} /> Filter Products
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                  setOnlyBargainable(false);
                  setMinPrice(priceMin);
                  setMaxPrice(priceMax);
                  setMinRating(0);
                  setSortOption('relevance');
                }}
                className="text-xs text-accent font-medium hover:underline"
              >
                Reset
              </button>
            </div>

            {/* Distance Slider Filter */}
            <div className="filter-group mb-5">
              <div className="flex justify-between items-center mb-1 text-xs font-semibold">
                <span>Discovery Radius</span>
                <span className="text-accent">{formatDistance(maxRadiusKm)} max</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={maxRadiusKm}
                onChange={(e) => setMaxRadiusKm(Number(e.target.value))}
                className="radius-slider"
                aria-label="Filter radius in kilometers"
              />
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>1 km (walking)</span>
                <span>20 km</span>
              </div>
            </div>

            {/* Price Range Filter */}
            <div className="filter-group mb-5">
              <div className="flex justify-between items-center mb-1 text-xs font-semibold">
                <span>Price Range (₹)</span>
                <span className="text-accent">{minPrice} – {maxPrice}</span>
              </div>
              <div className="price-inputs-row">
                <input
                  type="number"
                  min={priceMin}
                  max={priceMax}
                  value={minPrice}
                  onChange={(e) => setMinPrice(Number(e.target.value))}
                  aria-label="Minimum price"
                />
                <input
                  type="number"
                  min={priceMin}
                  max={priceMax}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  aria-label="Maximum price"
                />
              </div>
            </div>

            {/* Seller Rating Filter */}
            <div className="filter-group mb-5">
              <span className="text-xs font-semibold uppercase text-muted block mb-2">Seller Rating</span>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="filter-select"
                aria-label="Minimum seller rating"
              >
                <option value={0}>All Ratings</option>
                <option value={4}>4★ & up</option>
                <option value={4.5}>4.5★ & up</option>
                <option value={5}>5★</option>
              </select>
            </div>

            {/* Categories */}
            <div className="filter-group mb-5">
              <span className="text-xs font-semibold uppercase text-muted block mb-2">Category</span>
              <div className="category-pill-list flex flex-col gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`category-filter-btn ${selectedCategory === cat ? 'active' : ''}`}
                  >
                    <span>{cat}</span>
                    <span className="count-badge">
                      {cat === 'All' ? MOCK_PRODUCTS.length : MOCK_PRODUCTS.filter(p => p.category === cat).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Bargaining Toggle */}
            <div className="filter-group">
              <label className="bargain-toggle-label flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyBargainable}
                  onChange={(e) => setOnlyBargainable(e.target.checked)}
                />
                <span className="font-medium flex items-center gap-1 text-xs">
                  <Tag size={12} className="text-bargain" /> Open to Smart Bargaining
                </span>
              </label>
            </div>
          </Card>
        </aside>

        {/* Main Products Grid Area */}
        <div className="listing-main">
          <div className="search-and-sort-bar">
            <div className="search-input-wrap">
              <Input
                icon={Search}
                placeholder="Filter by product name, seller, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Filter products"
              />
            </div>
            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Sort:</span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="sort-select"
                aria-label="Sort products"
              >
                <option value="relevance">Relevance</option>
                <option value="priceLowHigh">Price: Low → High</option>
                <option value="priceHighLow">Price: High → Low</option>
                <option value="rating">Rating</option>
              </select>
            </div>
            <span className="text-xs text-muted whitespace-nowrap">
              Showing <strong>{sortedProducts.length}</strong> items
            </span>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="product-grid">
              {sortedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No products found in this range"
              message={`Try expanding your discovery radius beyond ${formatDistance(maxRadiusKm)} or clearing category filters.`}
              action={
                <Button variant="outline" size="sm" onClick={() => setMaxRadiusKm(20)}>
                  Expand radius to 20 km
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};
