import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Tag, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { formatINR, formatDistance } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import './BargainingModal.css';

export const BargainingModal = ({
  isOpen,
  onClose,
  product
}) => {
  // Ensure hooks are called on every render
  const hasProduct = !!product;
  const initialOffer = product ? Math.round(product.price * 0.90) : 0;
  const [offerPrice, setOfferPrice] = useState(initialOffer);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Submitted offers are stored in the shared AuthContext negotiations state
  const { submitCustomerOffer } = useAuth();

  if (!hasProduct) return null;



  // Platform rule: 2% commission from seller based on finalized negotiated price
  const numericOffer = Number(offerPrice) || 0;
  const estimatedSellerCommission = (numericOffer * 0.02).toFixed(2);
  const discountAmount = Math.max(0, product.price - numericOffer);
  const discountPercent = product.price > 0 ? Math.round((discountAmount / product.price) * 100) : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (numericOffer <= 0) {
      setValidationError('Please enter a valid offer amount.');
      return;
    }
    if (numericOffer >= product.price) {
      setValidationError('Offer price must be lower than the current listed price.');
      return;
    }
    setValidationError('');
    // Persist the offer in the shared negotiation state so the
    // negotiated price can reach Add to Cart / the seller queue.
    submitCustomerOffer(product, numericOffer, note);
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setValidationError('');
    setOfferPrice(initialOffer);
    setNote('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title="Smart Bargaining Offer"
      maxWidth="520px"
    >
      {submitted ? (
        <div className="bargain-success-view">
          <div className="bargain-success-icon">
            <CheckCircle2 size={44} color="#10b981" />
          </div>
          <h4>Offer Dispatched to Seller!</h4>
          <p className="text-muted text-sm">
            Your counter-offer of <strong>{formatINR(numericOffer)}</strong> has been sent to{' '}
            <strong>{product.sellerName}</strong>. You will receive an instant notification when the seller accepts, counters, or declines.
          </p>
          <div className="bargain-success-card">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Your Proposed Price:</span>
              <span className="font-bold">{formatINR(numericOffer)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted" style={{ marginTop: '0.35rem' }}>
              <span>Seller Platform Commission (2% - Paid by Seller):</span>
              <span>{formatINR(estimatedSellerCommission, true)}</span>
            </div>
          </div>
          <Button variant="primary" onClick={handleReset} className="w-full" style={{ marginTop: '1.25rem' }}>
            Back to Marketplace
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bargain-form">
          <div className="bargain-product-summary">
            <img src={product.images[0]} alt={product.title} className="bargain-product-img" />
            <div>
              <h4 className="font-semibold text-sm">{product.title}</h4>
              <p className="text-xs text-muted">Sold by {product.sellerName} ({formatDistance(product.distanceKm)} away)</p>
              <div className="bargain-price-row">
                <span className="text-muted text-xs">Listed Price:</span>
                <span className="font-bold text-sm line-through text-muted" style={{ marginLeft: '0.25rem' }}>
                  {formatINR(product.price)}
                </span>
              </div>
            </div>
          </div>

          <div className="bargain-callout">
            <Sparkles size={18} className="text-bargain flex-shrink-0" />
            <div>
              <span className="font-semibold text-xs text-bargain">Local Smart Bargaining</span>
              <p className="text-xs text-muted">
                Local sellers frequently accept reasonable offers for quick store pickup or upfront UPI/cash payment.
              </p>
            </div>
          </div>

          <div className="bargain-inputs-grid">
            <Input
              label="Your Proposed Offer (₹ INR)"
              type="number"
              step="1"
              min="1"
              max={product.price - 1}
              value={offerPrice}
              onChange={(e) => {
                setOfferPrice(e.target.value);
                setValidationError('');
              }}
              helperText={
                numericOffer > 0 && numericOffer < product.price
                  ? `You save ${formatINR(discountAmount)} (${discountPercent}% off listed)`
                  : 'Enter an amount lower than the listed price'
              }
              error={validationError}
              required
            />
          </div>

          <div className="bargain-note-group">
            <label className="input-label">Message / Pickup Notes (Optional)</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="e.g. Can pick up today by 6 PM from your shop, or paying in cash..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="bargain-transparency-box">
            <ShieldCheck size={16} className="text-accent flex-shrink-0" />
            <span className="text-xs text-muted">
              Direct Negotiation: The seller will review your offer in real-time. Once accepted, your price is locked for pickup or delivery.
            </span>
          </div>

          <div className="bargain-actions flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="bargain" type="submit" icon={Tag}>
              Send Smart Offer
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
