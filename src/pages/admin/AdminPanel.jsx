import React from 'react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { MOCK_ADMIN_METRICS, MOCK_SELLERS, MOCK_ORDERS, MOCK_USERS, MOCK_REVIEWS, MOCK_PRODUCTS } from '../../data/mockData';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import {
  DollarSign,
  TrendingUp,
  Store,
  Users,
  ShieldCheck,
  Percent,
  CheckCircle
} from 'lucide-react';
import './AdminPanel.css';

export const AdminPanel = () => {
  // State for users, products, and reviews
  const [users, setUsers] = React.useState(MOCK_USERS);
  const [reviews, setReviews] = React.useState(MOCK_REVIEWS);
  const [products, setProducts] = React.useState(
    MOCK_PRODUCTS.map(p => ({ ...p, status: 'pending' }))
  );
  const [userSearch, setUserSearch] = React.useState('');
  const [productSearch, setProductSearch] = React.useState('');
  const [reviewSearch, setReviewSearch] = React.useState('');

  // User status handlers
  const toggleUserStatus = (id) => {
    setUsers(prev =>
      prev.map(u => {
        if (u.id !== id) return u;
        if (u.status === 'pending') return { ...u, status: 'active' };
        if (u.status === 'active') return { ...u, status: 'suspended' };
        if (u.status === 'suspended') return { ...u, status: 'active' };
        return u;
      })
    );
  };

  // Product handlers
  const approveProduct = (id) => {
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, status: 'approved' } : p))
    );
  };
  const removeProduct = (id) => {
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, status: 'removed' } : p))
    );
  };

  // Review handlers
  const approveReview = (id) => {
    setReviews(prev =>
      prev.map(r => (r.id === id ? { ...r, status: 'approved' } : r))
    );
  };
  const rejectReview = (id) => {
    setReviews(prev =>
      prev.map(r => (r.id === id ? { ...r, status: 'rejected' } : r))
    );
  };
  return (
    <div className="admin-panel-page container mt-6">
      <div className="admin-header flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Platform Governance & Revenue</h1>
            <Badge variant="info" size="sm">Admin Oversight</Badge>
          </div>
          <p className="text-sm text-muted">
            Monitors hyperlocal volume, seller health, and the 2% platform fee take-rate
          </p>
        </div>
      </div>

      {/* Admin KPI Summary */}
      <div className="admin-kpi-grid grid grid-cols-4 gap-4 mb-6">
        <Card padding="md" className="admin-kpi-card">
          <div className="flex justify-between items-center text-xs text-muted font-semibold mb-1">
            <span>Gross Marketplace Volume</span>
            <DollarSign size={16} className="text-accent" />
          </div>
          <span className="text-2xl font-bold text-main">
            ${MOCK_ADMIN_METRICS.totalGrossVolume.toLocaleString()}
          </span>
          <span className="text-xs text-muted mt-1 block">Completed transactions</span>
        </Card>

        <Card padding="md" className="admin-kpi-card">
          <div className="flex justify-between items-center text-xs text-muted font-semibold mb-1">
            <span>Platform Commission (2%)</span>
            <Percent size={16} style={{ color: 'var(--secondary)' }} />
          </div>
          <span className="text-2xl font-bold" style={{ color: 'var(--secondary)' }}>
            ${MOCK_ADMIN_METRICS.totalPlatformCommission.toLocaleString()}
          </span>
          <span className="text-xs text-accent mt-1 block flex items-center gap-1">
            <ShieldCheck size={12} /> Revenue from sellers
          </span>
        </Card>

        <Card padding="md" className="admin-kpi-card">
          <div className="flex justify-between items-center text-xs text-muted font-semibold mb-1">
            <span>Verified Local Sellers</span>
            <Store size={16} className="text-accent" />
          </div>
          <span className="text-2xl font-bold text-main">
            {MOCK_ADMIN_METRICS.activeLocalSellers}
          </span>
          <span className="text-xs text-muted mt-1 block">In 5 km downtown zone</span>
        </Card>

        <Card padding="md" className="admin-kpi-card">
          <div className="flex justify-between items-center text-xs text-muted font-semibold mb-1">
            <span>Bargain Settlements</span>
            <TrendingUp size={16} className="text-bargain" />
          </div>
          <span className="text-2xl font-bold text-bargain">
            {MOCK_ADMIN_METRICS.totalCompletedNegotiations}
          </span>
          <span className="text-xs text-muted mt-1 block">Avg discount: {MOCK_ADMIN_METRICS.averageDiscountRate}</span>
        </Card>
      </div>

      <div className="admin-sections-grid grid grid-cols-2 gap-6">
        {/* Active Local Sellers Directory */}
        <Card padding="md">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2">
            <Store size={16} className="text-accent" /> Neighborhood Merchant Roster
          </h3>

          <div className="seller-roster-list flex flex-col gap-3">
            {MOCK_SELLERS.map((seller) => (
              <div key={seller.id} className="seller-roster-item flex items-center justify-between p-3 surface-card">
                <div className="flex items-center gap-3">
                  <img src={seller.avatar} alt={seller.name} className="roster-avatar" />
                  <div>
                    <h5 className="font-semibold text-sm">{seller.name}</h5>
                    <p className="text-xs text-muted">Owner: {seller.owner} • {seller.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="success" size="sm">2% Tier Active</Badge>
                  <span className="text-xs text-muted block mt-1">Rating: {seller.rating} ★</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

{/* User Management */}
<Card padding="md">
  <h3 className="font-bold text-base mb-4 flex items-center gap-2">
    <Users size={16} className="text-accent" /> User Management
  </h3>
  <Input
    placeholder="Search users..."
    value={userSearch}
    onChange={(e) => setUserSearch(e.target.value)}
  />
  <div className="admin-users-list flex flex-col gap-3 mt-3">
    {users
      .filter((u) =>
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase())
      )
      .map((u) => (
        <div key={u.id} className="user-item flex items-center justify-between p-3 surface-card">
          <div>
            <h5 className="font-semibold text-sm">{u.name}</h5>
            <p className="text-xs text-muted">{u.email}</p>
          </div>
          <div className="text-right flex items-center gap-2">
            <Badge variant={u.status === 'active' ? 'success' : u.status === 'suspended' ? 'danger' : 'warning'} size="sm">
              {u.status}
            </Badge>
            <Button
              variant={u.status === 'active' ? 'danger' : 'primary'}
              size="sm"
              onClick={() => toggleUserStatus(u.id)}
            >
              {u.status === 'active' ? 'Suspend' : 'Activate'}
            </Button>
          </div>
        </div>
      ))}
  </div>
</Card>

{/* Product Management */}
<Card padding="md" className="mt-6">
  <h3 className="font-bold text-base mb-4 flex items-center gap-2">
    <Store size={16} className="text-accent" /> Product Management
  </h3>
  <Input
    placeholder="Search products..."
    value={productSearch}
    onChange={(e) => setProductSearch(e.target.value)}
  />
  <div className="admin-products-list flex flex-col gap-3 mt-3">
    {products
      .filter((p) => (p.title || p.name || '').toLowerCase().includes(productSearch.toLowerCase()))
      .map((p) => (
        <div key={p.id} className="product-item flex items-center justify-between p-3 surface-card">
          <div>
            <h5 className="font-semibold text-sm">{p.title || p.name}</h5>
            <p className="text-xs text-muted">Status: {p.status}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => approveProduct(p.id)}
              disabled={p.status !== 'pending'}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => removeProduct(p.id)}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
  </div>
</Card>

{/* Reviews Section */}
<Card padding="md" className="mt-6">
  <h3 className="font-bold text-base mb-4 flex items-center gap-2">
    <CheckCircle size={16} className="text-accent" /> Reviews
  </h3>
  <Input
    placeholder="Search reviews..."
    value={reviewSearch}
    onChange={(e) => setReviewSearch(e.target.value)}
  />
  <div className="admin-reviews-list flex flex-col gap-3 mt-3">
    {reviews
      .filter((r) => r.comment.toLowerCase().includes(reviewSearch.toLowerCase()))
      .map((r) => (
        <div key={r.id} className="review-item flex items-center justify-between p-3 surface-card">
          <div>
            <p className="text-sm">{r.comment}</p>
            <p className="text-xs text-muted">Rating: {r.rating}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'} size="sm">
              {r.status}
            </Badge>
            <Button
              variant="primary"
              size="sm"
              onClick={() => approveReview(r.id)}
              disabled={r.status !== 'pending'}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => rejectReview(r.id)}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}
  </div>
</Card>

        {/* Recent Platform Orders & Fees */}
        <Card padding="md">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2">
            <DollarSign size={16} className="text-secondary" /> Recent Settlements & 2% Fee Cut
          </h3>

          <div className="admin-orders-list flex flex-col gap-3">
            {MOCK_ORDERS.map((ord) => (
              <div key={ord.id} className="order-fee-row flex items-center justify-between p-3 surface-card">
                <div>
                  <h5 className="font-semibold text-sm">Order #{ord.id}</h5>
                  <p className="text-xs text-muted">Store: {ord.sellerName}</p>
                  <span className="text-xs text-accent">{ord.fulfillmentType}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold block">${ord.totalAmount.toFixed(2)} GMV</span>
                  <span className="text-xs font-semibold text-secondary">
                    +${ord.platformCommission.toFixed(2)} (2% platform)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
