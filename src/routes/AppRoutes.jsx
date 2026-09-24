import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';

import { ProtectedRoute } from '../components/router/ProtectedRoute';

// Customer Pages
import { Home } from '../pages/customer/Home';
import { ProductListing } from '../pages/customer/ProductListing';
import { ProductDetails } from '../pages/customer/ProductDetails';
import { Cart } from '../pages/customer/Cart';
import { Orders } from '../pages/customer/Orders';

// Seller Pages
import { SellerDashboard } from '../pages/seller/SellerDashboard';
import { Negotiations } from '../pages/seller/Negotiations';

// Admin Pages
import { AdminPanel } from '../pages/admin/AdminPanel';

// Auth Pages
import { Login, Register, AdminLogin } from '../pages/auth/AuthPages';

// Empty / Not Found fallback
import { EmptyState } from '../components/common/Loader';
import { Button } from '../components/common/Button';
import { Link } from 'react-router-dom';

const ProtectedAdminRoute = ({ children }) => (
  <ProtectedRoute requiredRoles="admin">{children}</ProtectedRoute>
);

const ProtectedSellerRoute = ({ children }) => (
  <ProtectedRoute requiredRoles="seller">{children}</ProtectedRoute>
);


const NotFound = () => (
  <div className="container mt-12 text-center">
    <EmptyState
      title="Page Not Found"
      message="The requested marketplace route does not exist."
      action={
        <Link to="/">
          <Button variant="primary" size="md">
            Return to Marketplace Home
          </Button>
        </Link>
      }
    />
  </div>
);

export const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* Customer / General Marketplace Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<ProductListing />} />
        <Route path="/products/:id" element={<ProductDetails />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/orders" element={<Orders />} />

        {/* Seller Portal Routes (Protected) */}
        <Route
          path="/seller"
          element={
            <ProtectedSellerRoute>
              <SellerDashboard />
            </ProtectedSellerRoute>
          }
        />
        <Route
          path="/seller/negotiations"
          element={
            <ProtectedSellerRoute>
              <Negotiations />
            </ProtectedSellerRoute>
          }
        />

        {/* Admin Oversight Routes (Protected) */}
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminPanel />
            </ProtectedAdminRoute>
          }
        />

        {/* Authentication Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

