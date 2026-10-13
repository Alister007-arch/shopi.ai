import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, AlertCircle, ShieldCheck, RotateCcw, RefreshCw,
  CreditCard, PackageCheck, Upload, X, Clock, ArrowRight, Lock, UserCheck
} from 'lucide-react';
import { API_BASE } from '../config';

const ACTION_CONFIG = {
  cancel: {
    title: 'Cancel Order',
    badge: 'Cancellation Flow',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.1)',
    border: 'rgba(239, 68, 68, 0.3)',
    reasons: [
      { id: 'changed_mind', label: 'Changed my mind' },
      { id: 'found_better_price', label: 'Found a better price elsewhere' },
      { id: 'delay_expected', label: 'Delivery takes too long' },
      { id: 'mistake_in_order', label: 'Ordered by mistake' },
      { id: 'other', label: 'Other reason' },
    ],
    confirmText: 'Confirm Cancellation',
  },
  return: {
    title: 'Request Return',
    badge: '7-Day Return Window',
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.1)',
    border: 'rgba(249, 115, 22, 0.3)',
    reasons: [
      { id: 'damaged', label: 'Damaged in transit (Photo required)' },
      { id: 'wrong_item', label: 'Received wrong item (Photo required)' },
      { id: 'quality_issue', label: 'Quality / freshness issue' },
      { id: 'changed_mind', label: 'Changed mind (Eligible items only)' },
      { id: 'late_delivery', label: 'Delivered too late' },
    ],
    confirmText: 'Confirm Return Request',
  },
  exchange: {
    title: 'Request Exchange',
    badge: 'Variant Replacement',
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.1)',
    border: 'rgba(59, 130, 246, 0.3)',
    reasons: [
      { id: 'size_fit_issue', label: 'Size or fit issue' },
      { id: 'damaged', label: 'Received damaged item' },
      { id: 'wrong_item', label: 'Wrong variant delivered' },
      { id: 'color_variant_preference', label: 'Color or variant preference' },
    ],
    confirmText: 'Confirm Exchange Request',
  },
  refund: {
    title: 'Instant Refund',
    badge: 'Refund Service',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.3)',
    reasons: [
      { id: 'damaged', label: 'Damaged product' },
      { id: 'wrong_item', label: 'Wrong product delivered' },
      { id: 'quality_issue', label: 'Disputed quality issue' },
      { id: 'changed_mind', label: 'Customer return refund' },
    ],
    confirmText: 'Confirm & Initiate Refund',
  },
  place_order: {
    title: 'Order Checkout',
    badge: 'Deterministic Action Flow',
    color: '#00f2fe',
    bg: 'rgba(0, 242, 254, 0.1)',
    border: 'rgba(0, 242, 254, 0.3)',
    reasons: [
      { id: 'standard', label: 'Standard customer purchase' }
    ],
    confirmText: 'Confirm & Place Order',
  },
};

export default function OrderActionCard({
  actionCard,
  currentUser,
  onOpenAuthModal,
  onActionCompleted,
  onDismiss,
  formatPrice = (p, inr) => {
    if (inr !== undefined && inr !== null && !isNaN(Number(inr))) return `₹${Math.round(Number(inr)).toLocaleString('en-IN')}`;
    const n = Number(p);
    return !isNaN(n) && p !== undefined && p !== null ? `₹${Math.round(n * 85).toLocaleString('en-IN')}` : '₹0';
  },
}) {
  const actionType = actionCard?.action || 'cancel';
  const cfg = ACTION_CONFIG[actionType] || ACTION_CONFIG.cancel;

  // Selected Order and User Orders
  const [userOrders, setUserOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(actionCard?.order_id || '');
  const [selectedReason, setSelectedReason] = useState(actionCard?.reason || cfg.reasons[0]?.id || '');
  const [photoUrl, setPhotoUrl] = useState('');
  const [replacementVariantId, setReplacementVariantId] = useState('');

  // Eligibility and Preparation State
  const [eligibility, setEligibility] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [preparedSummary, setPreparedSummary] = useState(null);
  const [confirmationToken, setConfirmationToken] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionResult, setActionResult] = useState(null);

  const token = localStorage.getItem('moss_auth_token');
  const isAuthenticated = Boolean(currentUser && token);

  // 1. Fetch User's Orders if order_id is not already pinned
  useEffect(() => {
    if (!isAuthenticated) return;
    if (actionType === 'place_order') return;

    let isMounted = true;
    async function loadOrders() {
      try {
        const res = await fetch(`${API_BASE}/api/orders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const ords = data.orders || [];
          if (isMounted) {
            setUserOrders(ords);
            if (!selectedOrderId && ords.length > 0) {
              setSelectedOrderId(ords[0].order_number);
            }
          }
        }
      } catch (err) {
        console.warn('Could not load user orders for picker:', err);
      }
    }
    loadOrders();
    return () => { isMounted = false; };
  }, [isAuthenticated, actionType, token]);

  // 2. Query Eligibility from Order Action Service
  useEffect(() => {
    if (!isAuthenticated) return;
    if (actionType !== 'place_order' && !selectedOrderId) return;

    let isMounted = true;
    async function checkEligibility() {
      setEligibilityLoading(true);
      setActionError(null);
      try {
        const params = new URLSearchParams({
          action: actionType,
          reason: selectedReason,
        });
        if (selectedOrderId) {
          params.append('order_id', selectedOrderId);
        }
        if (actionType === 'place_order' && actionCard?.items) {
          params.append('items', JSON.stringify(actionCard.items));
        }

        const res = await fetch(`${API_BASE}/api/actions/eligibility?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (isMounted) {
          if (res.ok) {
            setEligibility(data);
          } else {
            setEligibility({ eligible: false, message: data.detail || 'Not eligible under store policy.' });
          }
        }
      } catch (err) {
        if (isMounted) {
          setEligibility({ eligible: false, message: 'Could not connect to Order Action Service.' });
        }
      } finally {
        if (isMounted) setEligibilityLoading(false);
      }
    }

    checkEligibility();
    return () => { isMounted = false; };
  }, [isAuthenticated, actionType, selectedOrderId, selectedReason, token]);

  // 3. Prepare Action (Fetch itemized quote & 10-minute confirmation token)
  const handlePrepareAction = async () => {
    if (!isAuthenticated) return;
    setIsPreparing(true);
    setActionError(null);

    try {
      const idempotencyKey = `prep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const payload = {
        order_id: selectedOrderId || null,
        action: actionType,
        reason: selectedReason,
        photo_url: photoUrl || null,
        replacement_item_id: replacementVariantId ? parseInt(replacementVariantId) : null,
      };

      if (actionType === 'place_order' && actionCard?.items) {
        payload.items = actionCard.items;
      }

      const res = await fetch(`${API_BASE}/api/actions/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Preparation failed.');
      }

      setPreparedSummary(data.summary);
      setConfirmationToken(data.confirmation_token);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsPreparing(false);
    }
  };

  // 4. Confirm Action via Direct State Machine Call
  const handleConfirmAction = async () => {
    let activeToken = confirmationToken;
    if (!activeToken) {
      setIsPreparing(true);
      setActionError(null);
      try {
        const prepIdemp = `prep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const payload = {
          order_id: selectedOrderId || null,
          action: actionType,
          reason: selectedReason,
          photo_url: photoUrl || null,
          replacement_item_id: replacementVariantId ? parseInt(replacementVariantId) : null,
        };
        if (actionType === 'place_order' && actionCard?.items) {
          payload.items = actionCard.items;
        }
        const prepRes = await fetch(`${API_BASE}/api/actions/prepare`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Idempotency-Key': prepIdemp,
          },
          body: JSON.stringify(payload),
        });
        const prepData = await prepRes.json();
        if (!prepRes.ok) {
          throw new Error(prepData.detail || prepData.message || 'Preparation failed.');
        }
        activeToken = prepData.confirmation_token;
        setConfirmationToken(activeToken);
        setPreparedSummary(prepData.summary);
      } catch (err) {
        setActionError(err.message);
        setIsPreparing(false);
        return;
      } finally {
        setIsPreparing(false);
      }
    }

    setIsConfirming(true);
    setActionError(null);

    try {
      const idempotencyKey = `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const res = await fetch(`${API_BASE}/api/actions/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          confirmation_token: activeToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Action execution failed.');
      }

      setActionResult(data);
      if (onActionCompleted) {
        onActionCompleted(data);
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsConfirming(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render Guest Login Required View
  // -------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div
        id="action-card-guest"
        data-testid="action-card-guest"
        style={{
          width: '100%',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: 12,
          padding: 18,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
          color: '#f8fafc',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'rgba(245, 158, 11, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b'
          }}>
            <Lock size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#fbbf24' }}>
              Sign In to Continue
            </h4>
            <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
              Order Action Service enforces strict account authentication
            </span>
          </div>
        </div>

        <p style={{ fontSize: '0.84rem', color: '#cbd5e1', margin: '0 0 14px 0', lineHeight: 1.5 }}>
          To {actionType === 'place_order' ? 'place orders' : `request a ${actionType}`} securely, please sign in to your verified customer account.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            id="action-guest-signin-btn"
            data-testid="action-guest-signin-btn"
            onClick={() => {
              if (onOpenAuthModal) {
                onOpenAuthModal({ message: 'Sign in to continue order action', returnTo: 'chat' });
              }
            }}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#000',
              fontWeight: 700,
              border: 'none',
              padding: '9px 18px',
              borderRadius: 8,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <UserCheck size={16} /> Sign In to Continue
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '9px 14px',
                borderRadius: 8,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render Result Card after Successful Confirmation
  // -------------------------------------------------------------------------
  if (actionResult) {
    return (
      <div
        id="action-result-card"
        data-testid="action-result-card"
        style={{
          width: '100%',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #10b981',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 0 25px rgba(16, 185, 129, 0.25)',
          color: '#f8fafc',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399'
            }}>
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#34d399' }}>
                {actionType === 'place_order' ? 'Order Placed Successfully' : `${cfg.title} Confirmed`}
              </h4>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Order #{actionResult.order_number}
              </span>
            </div>
          </div>
          <span style={{
            background: 'rgba(16, 185, 129, 0.2)',
            color: '#6ee7b7',
            padding: '3px 10px',
            borderRadius: 9999,
            fontSize: '0.74rem',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}>
            {actionResult.new_status}
          </span>
        </div>

        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          borderRadius: 8,
          padding: 12,
          fontSize: '0.84rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginBottom: 14,
        }}>
          <div><strong>Status:</strong> <span style={{ color: '#a7f3d0' }}>{actionResult.new_status}</span></div>
          {actionResult.refund && (
            <div>
              <strong>Refund:</strong> ₹{actionResult.refund.refund_amount_inr?.toLocaleString('en-IN')} (
              {actionResult.refund.status || 'Initiated'}) • {actionResult.refund.destination || 'Original Payment Method'}
            </div>
          )}
          {actionResult.total_price_inr && (
            <div><strong>Total Amount:</strong> ₹{actionResult.total_price_inr?.toLocaleString('en-IN')}</div>
          )}
          {actionResult.ticket && (
            <div style={{ color: '#fbbf24', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} />
              <span>
                Support Ticket ID: <strong>{actionResult.ticket.ticket_number}</strong> (Flagged for human review)
              </span>
            </div>
          )}
        </div>

        <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
          ✓ Verified by Order Action Service. State change logged with immutable audit record #{actionResult.audit_id}.
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render Interactive Action Card
  // -------------------------------------------------------------------------
  return (
    <div
      id="order-action-card"
      data-testid="order-action-card"
      style={{
        width: '100%',
        background: 'rgba(15, 23, 42, 0.92)',
        border: `1px solid ${cfg.border}`,
        borderRadius: 14,
        padding: 18,
        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.35), 0 0 15px ${cfg.bg}`,
        color: '#f8fafc',
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: cfg.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color
          }}>
            {actionType === 'cancel' && <RotateCcw size={18} />}
            {actionType === 'return' && <RotateCcw size={18} />}
            {actionType === 'exchange' && <RefreshCw size={18} />}
            {actionType === 'refund' && <CreditCard size={18} />}
            {actionType === 'place_order' && <PackageCheck size={18} />}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
              {cfg.title}
            </h4>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              Deterministic Order Action Service
            </span>
          </div>
        </div>
        <span style={{
          background: cfg.bg,
          color: cfg.color,
          border: `1px solid ${cfg.border}`,
          padding: '3px 9px',
          borderRadius: 9999,
          fontSize: '0.72rem',
          fontWeight: 700,
        }}>
          {cfg.badge}
        </span>
      </div>

      {/* Target Order Picker / Summary */}
      {actionType !== 'place_order' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '0.76rem', color: '#94a3b8', marginBottom: 5, fontWeight: 600 }}>
            Target Order:
          </label>
          {userOrders.length > 0 ? (
            <select
              id="order-picker-select"
              data-testid="order-picker-select"
              value={selectedOrderId}
              onChange={(e) => {
                setSelectedOrderId(e.target.value);
                setConfirmationToken(null);
                setPreparedSummary(null);
              }}
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.4)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: '0.84rem',
                outline: 'none',
              }}
            >
              {userOrders.map((ord) => (
                <option key={ord.order_number} value={ord.order_number}>
                  #{ord.order_number} • Status: {ord.status} • ₹{ord.total_price_inr?.toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          ) : (
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: '0.84rem',
              color: '#cbd5e1',
            }}>
              Order ID: <strong>{selectedOrderId || 'No order selected'}</strong>
            </div>
          )}
        </div>
      )}

      {/* Real-time Eligibility Status */}
      <div style={{
        marginBottom: 14,
        padding: '10px 14px',
        borderRadius: 8,
        background: eligibilityLoading
          ? 'rgba(255, 255, 255, 0.04)'
          : eligibility?.eligible
          ? 'rgba(16, 185, 129, 0.12)'
          : 'rgba(239, 68, 68, 0.12)',
        border: `1px solid ${
          eligibilityLoading
            ? 'rgba(255, 255, 255, 0.1)'
            : eligibility?.eligible
            ? 'rgba(16, 185, 129, 0.3)'
            : 'rgba(239, 68, 68, 0.3)'
        }`,
        fontSize: '0.82rem',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        {eligibilityLoading ? (
          <>
            <Clock size={16} color="#94a3b8" />
            <span style={{ color: '#94a3b8' }}>Checking policy eligibility...</span>
          </>
        ) : eligibility?.eligible ? (
          <>
            <CheckCircle2 size={16} color="#34d399" />
            <span style={{ color: '#a7f3d0' }}>{eligibility.message}</span>
          </>
        ) : (
          <>
            <AlertCircle size={16} color="#f87171" />
            <span style={{ color: '#fca5a5' }}>
              {eligibility?.message || 'Action is currently ineligible under store policies.'}
            </span>
          </>
        )}
      </div>

      {/* Reason Dropdown */}
      {cfg.reasons && cfg.reasons.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '0.76rem', color: '#94a3b8', marginBottom: 5, fontWeight: 600 }}>
            Select Reason:
          </label>
          <select
            id="action-reason-select"
            data-testid="action-reason-select"
            value={selectedReason}
            onChange={(e) => {
              setSelectedReason(e.target.value);
              setConfirmationToken(null);
              setPreparedSummary(null);
            }}
            style={{
              width: '100%',
              background: 'rgba(0, 0, 0, 0.4)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: '0.84rem',
              outline: 'none',
            }}
          >
            {cfg.reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Optional Photo Upload for Damaged/Wrong Item Claims */}
      {(selectedReason === 'damaged' || selectedReason === 'wrong_item') && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '0.76rem', color: '#94a3b8', marginBottom: 5, fontWeight: 600 }}>
            Evidence Photo URL (Required for damage claims):
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              id="action-photo-url-input"
              data-testid="action-photo-url-input"
              type="text"
              placeholder="https://example.com/item-damage-photo.jpg"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.4)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}

      {/* Prepared Summary Breakdown (if prepared) */}
      {preparedSummary && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.45)',
          borderRadius: 8,
          padding: 12,
          fontSize: '0.82rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginBottom: 14,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Action Prepared:</span>
            <strong>{preparedSummary.action?.toUpperCase()}</strong>
          </div>
          {preparedSummary.refund_amount_inr !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Computed Refund:</span>
              <strong style={{ color: '#34d399' }}>₹{preparedSummary.refund_amount_inr?.toLocaleString('en-IN')}</strong>
            </div>
          )}
          {preparedSummary.total_price_inr !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Total Payable:</span>
              <strong style={{ color: '#00f2fe' }}>₹{preparedSummary.total_price_inr?.toLocaleString('en-IN')}</strong>
            </div>
          )}
          {preparedSummary.needs_human_review && (
            <div style={{ color: '#fbbf24', fontSize: '0.78rem', marginTop: 4 }}>
              ⚠️ High value or disputed item: Will route to Customer Support team with status "needs_human_review".
            </div>
          )}
        </div>
      )}

      {/* Action Error Alert */}
      {actionError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: 8,
          padding: '8px 12px',
          color: '#fca5a5',
          fontSize: '0.8rem',
          marginBottom: 12,
        }}>
          {actionError}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        {onDismiss && (
          <button
            id="action-cancel-btn"
            data-testid="action-cancel-btn"
            onClick={onDismiss}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#94a3b8',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '9px 14px',
              borderRadius: 8,
              fontSize: '0.84rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
        )}

        {!confirmationToken && (
          <button
            id="action-prepare-btn"
            data-testid="action-prepare-btn"
            onClick={handlePrepareAction}
            disabled={isPreparing || isConfirming || (eligibility && !eligibility.eligible)}
            style={{
              background: eligibility && !eligibility.eligible ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.18)',
              color: eligibility && !eligibility.eligible ? '#64748b' : '#fff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              padding: '9px 16px',
              borderRadius: 8,
              fontSize: '0.84rem',
              cursor: eligibility && !eligibility.eligible ? 'not-allowed' : 'pointer',
              fontWeight: 700,
            }}
          >
            {isPreparing ? 'Preparing Quote...' : 'Review Quote'}
          </button>
        )}

        <button
          id="confirm-action-btn"
          data-testid="confirm-action-btn"
          onClick={handleConfirmAction}
          disabled={isConfirming || isPreparing || (eligibility && !eligibility.eligible)}
          style={{
            background: `linear-gradient(135deg, ${cfg.color} 0%, #10b981 100%)`,
            color: '#000',
            border: 'none',
            padding: '9px 18px',
            borderRadius: 8,
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: (isConfirming || isPreparing) ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: `0 0 15px ${cfg.bg}`,
          }}
        >
          <CheckCircle2 size={16} />
          {isConfirming || isPreparing ? 'Processing...' : cfg.confirmText}
        </button>
      </div>
    </div>
  );
}
