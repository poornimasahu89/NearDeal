import React, { useState } from 'react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Clock, Check, X } from 'lucide-react';
import { formatINR } from '../../utils/formatters';
import { useAuth, filterNegotiationsForSeller } from '../../context/AuthContext';
import './Negotiations.css';

export const Negotiations = () => {
  // Shared negotiation state from AuthContext — the same store the customer's
  // BargainModal writes into and the Seller Dashboard reads from. Demo data is
  // only the initial seed; new customer offers and seller actions land here.
  // Queue is scoped to the logged-in seller's identity: customer offers for
  // other sellers (and records without a seller identity) never render here.
  const {
    negotiations: allNegotiations,
    currentUser,
    acceptNegotiation,
    declineNegotiation,
    counterNegotiation
  } = useAuth();
  const negotiations = filterNegotiationsForSeller(allNegotiations, currentUser);
  const [counterValues, setCounterValues] = useState({});

  const handleAction = (id, newStatus) => {
    if (newStatus === 'accepted') acceptNegotiation(id);
    else declineNegotiation(id);
  };

  const handleCounter = (id) => {
    const amount = Number(counterValues[id]);
    if (!amount || amount <= 0) return; // existing validation preserved
    // Stores the counter amount in the shared negotiation (status + history)
    counterNegotiation(id, amount);
  };

  return (
    <div className="negotiations-page container mt-6">
      <div className="negotiations-header mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Smart Bargaining Queue</h1>
          <Badge variant="bargain" size="md">
            {negotiations.length} Active Offers
          </Badge>
        </div>
        <p className="text-sm text-muted">
          Review customer price proposals, send counter-offers or accept deals for local store pickup
        </p>
      </div>

      <div className="negotiations-grid flex flex-col gap-4">
        {negotiations.map((neg) => {
          const discountPercent = Math.round(
            ((neg.originalPrice - neg.offeredPrice) / neg.originalPrice) * 100
          );
          // Platform fee rule: 2% of finalized negotiated purchase price
          const sellerFee = neg.offeredPrice * 0.02;
          const netPayout = neg.offeredPrice - sellerFee;

          return (
            <Card key={neg.id} padding="md" className="negotiation-card">
              <div className="negotiation-top flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <img src={neg.productImage} alt={neg.productTitle} className="neg-product-img" />
                  <div>
                    <h4 className="font-bold text-sm">{neg.productTitle}</h4>
                    <span className="text-xs text-muted">Buyer: <strong>{neg.buyerName}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      neg.status === 'accepted'
                        ? 'success'
                        : neg.status === 'rejected'
                        ? 'danger'
                        : neg.status === 'countered'
                        ? 'info'
                        : 'bargain'
                    }
                    size="sm"
                  >
                    {neg.status === 'accepted'
                      ? 'Deal Accepted'
                      : neg.status === 'rejected'
                      ? 'Declined'
                      : neg.status === 'countered'
                      ? 'Counter Sent'
                      : 'Awaiting Seller'}
                  </Badge>
                  <span className="text-xs text-muted flex items-center gap-1">
                    <Clock size={12} /> {neg.expiresInHours}h left
                  </span>
                </div>
              </div>

              {/* Price comparison & 2% commission metrics */}
              <div className="negotiation-metrics-row grid grid-cols-4 gap-4 my-3 p-3 bg-muted rounded">
                <div>
                  <span className="text-xs text-muted block">Original Listed</span>
                  <span className="text-sm font-semibold">{formatINR(neg.originalPrice)}</span>
                </div>
                <div>
                  <span className="text-xs text-muted block">Customer Offer</span>
                  <span className="text-sm font-bold text-bargain">
                    {formatINR(neg.offeredPrice)} (-{discountPercent}%)
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted block">Platform Commission (2%)</span>
                  <span className="text-sm font-semibold text-muted">{formatINR(sellerFee, true)}</span>
                </div>
                <div>
                  <span className="text-xs text-muted block">Net Seller Proceeds</span>
                  <span className="text-sm font-bold text-accent">{formatINR(netPayout, true)}</span>
                </div>
              </div>

              {/* Negotiation Conversation Snippet */}
              <div className="negotiation-history-box mb-3">
                <span className="text-xs font-semibold text-muted block mb-1">Negotiation History:</span>
                {neg.history.map((item, idx) => (
                  <div key={idx} className={`history-bubble bubble-${item.sender} text-xs`}>
                    <strong>{item.sender === 'customer' ? 'Customer' : 'You (Seller)'}:</strong>{' '}
                    Proposed {formatINR(item.amount)} — <em>"{item.note}"</em>{' '}
                    <span className="text-muted">({item.time})</span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              {neg.status !== 'accepted' && neg.status !== 'rejected' && (
                <div className="negotiation-actions flex items-center justify-between gap-4 pt-2 border-t border-border">
                  <div className="counter-input-group flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Counter (₹)"
                      style={{ maxWidth: '150px' }}
                      value={counterValues[neg.id] || ''}
                      onChange={(e) =>
                        setCounterValues({ ...counterValues, [neg.id]: e.target.value })
                      }
                      aria-label="Enter counter price in INR"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        handleCounter(neg.id);
                        setCounterValues((prev) => ({ ...prev, [neg.id]: '' }));
                      }}
                    >
                      Send Counter
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      icon={X}
                      onClick={() => handleAction(neg.id, 'rejected')}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="bargain"
                      size="sm"
                      icon={Check}
                      onClick={() => handleAction(neg.id, 'accepted')}
                    >
                      Accept Deal ({formatINR(neg.offeredPrice)})
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
