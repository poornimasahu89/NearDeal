import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { MOCK_PRODUCTS } from '../../data/mockData';
import { useAuth, filterNegotiationsForSeller } from '../../context/AuthContext';
import { formatINR } from '../../utils/formatters';
import {
  Package,
  Clock,
  TrendingUp,
  Tag,
  ArrowRight,
  Percent
} from 'lucide-react';
import './SellerDashboard.css';

export const SellerDashboard = () => {
  const [sellerProducts, setSellerProducts] = useState(MOCK_PRODUCTS.filter((p) => p.sellerId === 'seller_2'));

  // Shared negotiation state lives in AuthContext (no duplicate store here).
  // Incoming queue = offers addressed to THIS logged-in seller (identity match),
  // still awaiting a response.
  const { negotiations, currentUser, acceptNegotiation, declineNegotiation, counterNegotiation } = useAuth();
  const pendingNegotiations = filterNegotiationsForSeller(negotiations, currentUser).filter(
    (n) => n.status === 'pending' || n.status === 'pending_seller'
  );

  // Active negotiation being countered
  const [activeCounterNeg, setActiveCounterNeg] = useState(null);
  const [counterInputVal, setCounterInputVal] = useState('');
  const [counterError, setCounterError] = useState('');

  const handleAddProduct = () => {
    const newProd = {
      id: `new_${Date.now()}`,
      title: 'New Product',
      price: 1000,
      originalPrice: 1200,
      stock: 10,
      minAcceptablePrice: 900,
      bargainable: true,
      sellerId: 'seller_2',
      images: ['https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80'],
      category: 'Misc',
    };
    setSellerProducts([...sellerProducts, newProd]);
  };

  const handleDeleteProduct = (id) => {
    setSellerProducts(sellerProducts.filter((p) => p.id !== id));
  };

  // Handlers for Accept, Decline, Counter actions on negotiations.
  // Both update the shared negotiation record so the outcomes differ
  // (status 'accepted' vs 'rejected') instead of just dropping the row.
  const handleAcceptNegotiation = (id) => {
    acceptNegotiation(id);
  };

  const handleRejectNegotiation = (id) => {
    declineNegotiation(id);
  };

  const handleOpenCounter = (neg) => {
    setActiveCounterNeg(neg);
    setCounterInputVal(String(Math.round(neg.offeredPrice * 1.05) || neg.offeredPrice));
    setCounterError('');
  };

  const handleCounterSubmit = (e) => {
    e.preventDefault();
    const amount = Number(counterInputVal);
    if (!amount || amount <= 0) {
      setCounterError('Please enter a valid amount.');
      return;
    }
    if (activeCounterNeg && amount > activeCounterNeg.originalPrice) {
      setCounterError(`Counter offer cannot exceed listed price (₹${activeCounterNeg.originalPrice}).`);
      return;
    }
    // Store the counter amount in the shared negotiation (status + price + history)
    counterNegotiation(activeCounterNeg.id, amount);
    setActiveCounterNeg(null);
    setCounterInputVal('');
    setCounterError('');
  };

  const totalGrossSales = 68400; // In INR
  const platformCommissionPaid = totalGrossSales * 0.02; // 2% commission = ₹1,368
  const netEarnings = totalGrossSales - platformCommissionPaid; // ₹67,032

  return (
    <div className="seller-dashboard-page container mt-6">
      <div className="dashboard-header flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Sharma Electronics & Gadgets</h1>
            <Badge variant="success" size="sm">Verified Merchant</Badge>
          </div>
          <p className="text-sm text-muted">
            Palasia Main Road, Indore • Manage inventory, customer counter-offers, and 2% platform deductions
          </p>
        </div>

        <Link to="/seller/negotiations">
          <Button variant="bargain" icon={Tag}>
            Review Active Offers ({pendingNegotiations.length})
          </Button>
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-metrics-grid grid grid-cols-4 gap-4 mb-6">
        <Card padding="md" className="kpi-card">
          <div className="flex items-center justify-between text-muted text-xs font-semibold mb-1">
            <span>Gross Marketplace Sales</span>
            <TrendingUp size={16} className="text-accent" />
          </div>
          <span className="text-2xl font-bold text-main">{formatINR(totalGrossSales)}</span>
          <span className="text-xs text-accent mt-1 block flex items-center gap-1">
            <TrendingUp size={12} /> +14% this month
          </span>
        </Card>

        <Card padding="md" className="kpi-card">
          <div className="flex items-center justify-between text-muted text-xs font-semibold mb-1">
            <span>Net Seller Earnings</span>
            <TrendingUp size={16} className="text-accent" />
          </div>
          <span className="text-2xl font-bold text-accent">{formatINR(netEarnings)}</span>
          <span className="text-xs text-muted mt-1 block">After 2% platform take-rate</span>
        </Card>

        <Card padding="md" className="kpi-card">
          <div className="flex items-center justify-between text-muted text-xs font-semibold mb-1">
            <span>Platform Commission (2%)</span>
            <Percent size={16} style={{ color: 'var(--secondary)' }} />
          </div>
          <span className="text-2xl font-bold" style={{ color: 'var(--secondary)' }}>
            {formatINR(platformCommissionPaid)}
          </span>
          <span className="text-xs text-muted mt-1 block">Paid to NearDeal upon sales</span>
        </Card>

        <Card padding="md" className="kpi-card">
          <div className="flex items-center justify-between text-muted text-xs font-semibold mb-1">
            <span>Customer Offers Pending</span>
            <Clock size={16} className="text-bargain" />
          </div>
          <span className="text-2xl font-bold text-bargain">{pendingNegotiations.length}</span>
          <span className="text-xs text-muted mt-1 block">Requires response</span>
        </Card>
      </div>

      <div className="seller-dashboard-sections grid grid-cols-2 gap-6">
        {/* Pending Negotiations Column */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Tag size={16} className="text-bargain" /> Pending Customer Bargains
            </h3>
            <Link to="/seller/negotiations" className="text-xs text-accent font-semibold flex items-center gap-1">
              View Queue <ArrowRight size={12} />
            </Link>
          </div>

          <div className="offers-list flex flex-col gap-3">
            {pendingNegotiations.map((neg) => (
              <div key={neg.id} className="offer-summary-row flex items-center justify-between p-3 surface-card">
                <div className="flex items-center gap-3">
                  <img src={neg.productImage} alt={neg.productTitle} className="offer-thumb" />
                  <div>
                    <h5 className="font-semibold text-xs">{neg.productTitle}</h5>
                    <p className="text-xs text-muted">Buyer: {neg.buyerName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted line-through">{formatINR(neg.originalPrice)}</span>
                      <span className="text-xs font-bold text-bargain">{formatINR(neg.offeredPrice)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => handleAcceptNegotiation(neg.id)}>
                    Accept
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleRejectNegotiation(neg.id)}>
                    Decline
                  </Button>
                  <Button variant="bargain" size="sm" onClick={() => handleOpenCounter(neg)}>
                    Counter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Store Active Listings */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Package size={16} className="text-accent" /> Store Catalog ({sellerProducts.length} Items)
            </h3>
            <Button variant="primary" size="sm" onClick={handleAddProduct}>
              + Add Product
            </Button>
          </div>

          <div className="seller-products-list flex flex-col gap-3">
            {sellerProducts.map((prod) => (
              <div key={prod.id} className="seller-product-row flex items-center justify-between p-3 surface-card">
                <div className="flex items-center gap-3">
                  <img src={prod.images[0]} alt={prod.title} className="offer-thumb" />
                  <div>
                    <h5 className="font-semibold text-xs">{prod.title}</h5>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold">{formatINR(prod.price)}</span>
                      <span className="text-xs text-muted">Stock: {prod.stock}</span>
                      <span className="text-xs text-muted">Floor: {formatINR(prod.minAcceptablePrice)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={prod.bargainable ? 'bargain' : 'default'} size="sm">
                    {prod.bargainable ? 'Bargaining ON' : 'Fixed Price'}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteProduct(prod.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <CounterModal
        isOpen={Boolean(activeCounterNeg)}
        onClose={() => setActiveCounterNeg(null)}
        negotiation={activeCounterNeg}
        onSubmit={handleCounterSubmit}
        counterValue={counterInputVal}
        setCounterValue={(val) => {
          setCounterInputVal(val);
          setCounterError('');
        }}
        error={counterError}
      />
    </div>
  );
};

// Counter Offer Modal
const CounterModal = ({ isOpen, onClose, negotiation, onSubmit, counterValue, setCounterValue, error }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Counter Offer" maxWidth="400px">
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p>Countering <strong>{negotiation?.productTitle}</strong> (listed ₹{negotiation?.originalPrice})</p>
      <Input
        label="Counter Amount (₹)"
        type="number"
        min={1}
        max={negotiation?.originalPrice}
        value={counterValue}
        onChange={(e) => setCounterValue(e.target.value)}
        error={error}
        required
      />
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit">Send Counter</Button>
      </div>
    </form>
  </Modal>
);

export default SellerDashboard;

