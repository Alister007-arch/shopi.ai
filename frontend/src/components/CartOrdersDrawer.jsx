import React, { useState, useEffect } from 'react';
import { X, Trash2, ShoppingBag, Package, CheckCircle2, ArrowRight, Truck, Clock, MapPin, AlertCircle, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { API_BASE } from '../config';

export default function CartOrdersDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  initialTab = 'cart',
  formatPrice = (p, inr) => inr ? `₹${inr.toLocaleString('en-IN')}` : `$${p.toFixed(2)}`,
  currency = 'INR',
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [orders, setOrders] = useState([]);
  const [customerName, setCustomerName] = useState('Rahul Sharma');
  const [customerAddress, setCustomerAddress] = useState('Flat 402, Green Park Avenue, Bengaluru 560034');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen]);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orders`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  const cartTotalInr = cartItems.reduce((acc, item) => {
    const unitInr = item.price_inr || Math.round(item.price * 85);
    return acc + unitInr * item.quantity;
  }, 0);

  const cartTotalUsd = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const deliveryFeeInr = cartTotalInr >= 500 || cartTotalInr === 0 ? 0 : 50;
  const grandTotalInr = cartTotalInr + deliveryFeeInr;

  const handleCheckout = async () => {
    if (cartItems.length === 0 || isSubmitting) return;

    if (!customerAddress.trim()) {
      setCheckoutError('Please enter a delivery address.');
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      const itemsPayload = cartItems.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      }));

      const res = await fetch(`${API_BASE}/api/order/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsPayload,
          customer_name: customerName.trim() || 'Online Shopper',
          customer_address: customerAddress.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `HTTP ${res.status}`);
      }

      const orderData = await res.json();
      if (orderData.status === 'error') {
        throw new Error(orderData.message);
      }

      // Celebrate with confetti
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#00f2fe', '#38ef7d', '#22d3ee', '#fbbf24'],
      });

      setLastPlacedOrder(orderData);
      onClearCart();
      await fetchOrders();
      setActiveTab('orders');
    } catch (err) {
      console.error('Checkout error:', err);
      setCheckoutError(err.message || 'Checkout failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(10px)',
      zIndex: 100,
      display: 'flex',
      justifyContent: 'flex-end',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 480,
        background: '#070b14',
        borderLeft: '1px solid var(--border-mint)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(10, 16, 29, 0.95)',
        }}>
          <div style={{ display: 'flex', gap: 6, background: 'rgba(0, 0, 0, 0.4)', padding: 4, borderRadius: 'var(--radius-full)' }}>
            <button
              onClick={() => setActiveTab('cart')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 16px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: activeTab === 'cart' ? 'var(--mint-gradient)' : 'transparent',
                color: activeTab === 'cart' ? '#04070d' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              <ShoppingBag size={14} /> Cart ({cartItems.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 16px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: activeTab === 'orders' ? 'var(--mint-gradient)' : 'transparent',
                color: activeTab === 'orders' ? '#04070d' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              <Package size={14} /> My Orders ({orders.length})
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {activeTab === 'cart' ? (
            cartItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <ShoppingBag size={48} style={{ opacity: 0.25, margin: '0 auto 12px' }} />
                <h4 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>Your cart is empty</h4>
                <p style={{ fontSize: '0.85rem', marginTop: 4 }}>
                  Browse our multi-category catalog or ask the AI assistant to add items!
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="glass-panel"
                    style={{
                      padding: 14,
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      border: '1px solid var(--border-mint)',
                    }}
                  >
                    <img
                      src={item.image_url}
                      alt={item.name}
                      style={{ width: 54, height: 54, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h5 style={{
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: '#fff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {item.name}
                      </h5>
                      <span style={{ fontSize: '0.72rem', color: 'var(--mint-cyan)' }}>
                        {item.brand || 'Store'} • {item.category}
                      </span>
                      <div style={{
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        color: 'var(--mint-primary)',
                        marginTop: 2,
                      }}>
                        {formatPrice(item.price, item.price_inr)}
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: 18, textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: 'rgba(0, 242, 254, 0.2)',
                          border: 'none',
                          color: 'var(--mint-primary)',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveItem(item.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fda4af',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Orders Tab */
            orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <Package size={48} style={{ opacity: 0.25, margin: '0 auto 12px' }} />
                <h4 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>No orders placed yet</h4>
                <p style={{ fontSize: '0.85rem', marginTop: 4 }}>
                  Completed orders will appear here with live tracking numbers.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="glass-panel"
                    style={{
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      border: '1px solid var(--border-mint)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="badge-mint">
                        {ord.order_number || `Order #${ord.id}`}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: 'rgba(34, 211, 238, 0.15)',
                        color: 'var(--mint-light)',
                      }}>
                        {ord.status || 'Confirmed'}
                      </span>
                    </div>

                    <div>
                      <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                        {ord.items_summary}
                      </h5>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={13} color="var(--mint-cyan)" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ord.customer_address || 'Delivery Address on file'}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 8,
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      fontSize: '0.8rem',
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                        {ord.ordered_at}
                      </span>
                      <strong style={{ color: 'var(--mint-primary)', fontSize: '1rem' }}>
                        ₹{(ord.total_price_inr || Math.round(ord.total_price * 85)).toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Drawer Footer Checkout (Only in Cart Tab) */}
        {activeTab === 'cart' && cartItems.length > 0 && (
          <div style={{
            padding: 22,
            borderTop: '1px solid var(--border-mint)',
            background: 'rgba(4, 7, 13, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            {/* Customer Details Input */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Delivery Address:
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Enter complete delivery address..."
                style={{
                  width: '100%',
                  background: 'rgba(10, 16, 29, 0.8)',
                  border: '1px solid var(--border-mint)',
                  color: '#fff',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  fontSize: '0.84rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Calculations Breakdown */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>Items Subtotal</span>
              <span>₹{cartTotalInr.toLocaleString('en-IN')} (${cartTotalUsd.toFixed(2)})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>Express Delivery</span>
              <span style={{ color: deliveryFeeInr === 0 ? 'var(--mint-cyan)' : '#fff' }}>
                {deliveryFeeInr === 0 ? 'FREE (Orders over ₹500)' : '₹50'}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '1.2rem',
              fontWeight: 800,
              color: '#fff',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: 8,
            }}>
              <span>Total Payable</span>
              <span style={{ color: 'var(--mint-primary)' }}>₹{grandTotalInr.toLocaleString('en-IN')}</span>
            </div>

            {checkoutError && (
              <div style={{ fontSize: '0.78rem', color: '#fda4af', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} /> {checkoutError}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
            >
              {isSubmitting ? (
                <>
                  <span className="typing-dot" />
                  <span style={{ marginLeft: 8 }}>Validating & Placing Order...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Confirm Order (Demo Pay / COD)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
