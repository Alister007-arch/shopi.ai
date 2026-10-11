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
  const [customerName, setCustomerName] = useState('Online Shopper');
  const [customerAddress, setCustomerAddress] = useState('Flat 402, Green Park Avenue, Bengaluru 560034');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [lastPlacedOrder, setLastPlacedOrder] = useState(null);

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
      console.warn('Could not load orders:', err);
    }
  };

  const cartTotalUsd = cartItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
  const cartTotalInr = cartItems.reduce((acc, it) => {
    const itemInr = it.price_inr || Math.round(it.price * 85);
    return acc + (itemInr * it.quantity);
  }, 0);

  const deliveryFeeInr = cartTotalInr > 500 || cartTotalInr === 0 ? 0 : 50;
  const grandTotalInr = cartTotalInr + deliveryFeeInr;

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      const payload = {
        items: cartItems.map((it) => ({
          product_id: it.id,
          quantity: it.quantity,
        })),
        customer_name: customerName,
        customer_address: customerAddress,
        customer_email: 'shopper@moss.internal',
      };

      const res = await fetch(`${API_BASE}/api/order/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Checkout failed (${res.status})`);
      }

      const orderData = await res.json();

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#1b2a20', '#8fa892', '#c86d51', '#f7f6f2'],
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
      background: 'rgba(27, 42, 32, 0.65)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      zIndex: 100,
      display: 'flex',
      justifyContent: 'flex-end',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 480,
        background: '#ffffff',
        borderLeft: '1px solid var(--moss-border)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--moss-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
        }}>
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-card-muted)', padding: 4, borderRadius: 'var(--radius-full)' }}>
            <button
              onClick={() => setActiveTab('cart')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 18px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: activeTab === 'cart' ? 'var(--moss-deep)' : 'transparent',
                color: activeTab === 'cart' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <ShoppingBag size={14} /> Bag ({cartItems.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 18px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: activeTab === 'orders' ? 'var(--moss-deep)' : 'transparent',
                color: activeTab === 'orders' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Package size={14} /> Orders ({orders.length})
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--moss-tint)',
              border: 'none',
              color: 'var(--moss-deep)',
              cursor: 'pointer',
              borderRadius: '50%',
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {activeTab === 'cart' ? (
            cartItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <ShoppingBag size={48} style={{ opacity: 0.25, margin: '0 auto 12px', color: 'var(--moss-deep)' }} />
                <h4 style={{ color: 'var(--moss-deep)', fontSize: '1.15rem', fontWeight: 700 }}>Your shopping bag is empty</h4>
                <p style={{ fontSize: '0.85rem', marginTop: 6, color: 'var(--text-secondary)' }}>
                  Explore our mindful collection or ask the AI Concierge to curate essentials for you.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: 14,
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      background: 'var(--bg-card-muted)',
                      border: '1px solid var(--moss-border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <img
                      src={item.image_url}
                      alt={item.name}
                      style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h5 style={{
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: 'var(--moss-deep)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {item.name}
                      </h5>
                      <span style={{ fontSize: '0.72rem', color: 'var(--moss-sage)', fontWeight: 600 }}>
                        {item.brand || 'MOSS'} • {item.category}
                      </span>
                      <div style={{
                        fontSize: '0.96rem',
                        fontWeight: 800,
                        color: 'var(--moss-deep)',
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
                          borderRadius: '50%',
                          background: '#ffffff',
                          border: '1px solid var(--moss-border)',
                          color: 'var(--moss-deep)',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: 18, textAlign: 'center', color: 'var(--moss-deep)' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: 'var(--moss-deep)',
                          border: 'none',
                          color: '#ffffff',
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
                        color: 'var(--clay-terracotta)',
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
                <Package size={48} style={{ opacity: 0.25, margin: '0 auto 12px', color: 'var(--moss-deep)' }} />
                <h4 style={{ color: 'var(--moss-deep)', fontSize: '1.15rem', fontWeight: 700 }}>No orders placed yet</h4>
                <p style={{ fontSize: '0.85rem', marginTop: 6, color: 'var(--text-secondary)' }}>
                  Placed orders will appear here with instant live tracking numbers.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    style={{
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      background: 'var(--bg-card-muted)',
                      border: '1px solid var(--moss-border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="badge-moss">
                        {ord.order_number || `Order #${ord.id}`}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--moss-tint)',
                        color: 'var(--moss-forest)',
                        border: '1px solid var(--moss-border)',
                      }}>
                        {ord.status || 'Confirmed'}
                      </span>
                    </div>

                    <div>
                      <h5 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--moss-deep)', marginBottom: 4 }}>
                        {ord.items_summary}
                      </h5>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={13} color="var(--moss-sage)" />
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
                      borderTop: '1px solid var(--moss-border)',
                      fontSize: '0.8rem',
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                        {ord.ordered_at}
                      </span>
                      <strong style={{ color: 'var(--moss-deep)', fontSize: '1.05rem', fontWeight: 800 }}>
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
            borderTop: '1px solid var(--moss-border)',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            {/* Customer Details Input */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                Delivery Address:
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Enter complete delivery address..."
                style={{
                  width: '100%',
                  background: 'var(--bg-card-muted)',
                  border: '1px solid var(--moss-border)',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
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
              <span>Eco-Fleet Delivery</span>
              <span style={{ color: deliveryFeeInr === 0 ? 'var(--moss-forest)' : 'var(--text-primary)', fontWeight: 600 }}>
                {deliveryFeeInr === 0 ? 'FREE (Orders over ₹500)' : '₹50'}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--moss-deep)',
              borderTop: '1px solid var(--moss-border)',
              paddingTop: 10,
            }}>
              <span>Total Payable</span>
              <span style={{ color: 'var(--moss-deep)' }}>₹{grandTotalInr.toLocaleString('en-IN')}</span>
            </div>

            {checkoutError && (
              <div style={{ fontSize: '0.78rem', color: 'var(--clay-terracotta)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} /> {checkoutError}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: '0.92rem' }}
            >
              {isSubmitting ? (
                <>
                  <span className="typing-dot" style={{ background: '#fff' }} />
                  <span style={{ marginLeft: 8 }}>Validating & Placing Order...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Confirm Order (Instant Pay / COD)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
