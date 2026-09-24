import React from 'react';
import { Link } from 'react-router-dom';
import { Store, ShieldCheck } from 'lucide-react';
import './Footer.css';

export const Footer = () => {
  return (
    <footer className="footer-container">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <div className="flex items-center gap-2 mb-2">
              <Store size={20} className="text-accent" />
              <span className="font-bold text-lg">NearDeal</span>
            </div>
            <p className="text-sm text-muted mb-4">
              Local commerce powered by smart bargaining. Direct connections between neighborhood buyers and verified local merchants.
            </p>
            <div className="commission-callout-footer flex items-center gap-2">
              <ShieldCheck size={16} color="#10b981" />
              <span className="text-xs">Transparent 2% platform fee from sellers on successful sales.</span>
            </div>
          </div>

          <div className="footer-links-col">
            <h5 className="footer-title">Customer</h5>
            <ul className="footer-list">
              <li><a href="/products">Local Discovery</a></li>
              <li><a href="/orders">My Orders</a></li>
              <li><a href="#">How Bargaining Works</a></li>
              <li><a href="#">Local Pickup Guide</a></li>
            </ul>
          </div>

          <div className="footer-links-col">
            <h5 className="footer-title">Seller Portal</h5>
            <ul className="footer-list">
              <li><a href="/seller">Dashboard</a></li>
              <li><a href="/seller/negotiations">Manage Offers</a></li>
              <li><a href="#">2% Commission Policy</a></li>
              <li><a href="#">Store Verification</a></li>
            </ul>
          </div>

          <div className="footer-links-col">
            <h5 className="footer-title">Platform &amp; Admin</h5>
            <ul className="footer-list">
              <li className="footer-admin-login-item">
                <Link to="/admin/login" className="footer-admin-login-link">
                  <ShieldCheck size={14} /> Admin Login
                </Link>
              </li>
              <li><a href="/admin">Platform Analytics</a></li>
              <li><a href="#">Community Guidelines</a></li>
              <li><a href="#">Dispute Resolution</a></li>
              <li><a href="#">Privacy &amp; Terms</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom flex items-center justify-between">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} NearDeal Inc. Supporting local commerce & neighborhood merchants.
          </p>
          <div className="text-xs text-muted flex items-center gap-1">
            Built with modern React + Vite foundation
          </div>
        </div>
      </div>
    </footer>
  );
};
