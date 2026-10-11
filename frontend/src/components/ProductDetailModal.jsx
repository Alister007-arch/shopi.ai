import React, { useState, useEffect } from 'react';
import { X, Star, ShoppingCart, MessageSquare, Check, AlertCircle, ShieldCheck, Tag, Info, Layers, Cpu } from 'lucide-react';
import { API_BASE } from '../config';

export default function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  onAskInChat,
  formatPrice = (p, inr) => inr ? `₹${inr.toLocaleString('en-IN')}` : `$${p.toFixed(2)}`,
  currency = 'INR',
}) {
  const [quantity, setQuantity] = useState(1);
  const [reviewIntel, setReviewIntel] = useState(null);
  const [loadingIntel, setLoadingIntel] = useState(true);

  useEffect(() => {
    if (!product) return;
    setQuantity(1);
    fetchReviewIntelligence(product.id);
  }, [product]);

  const fetchReviewIntelligence = async (productId) => {
    setLoadingIntel(true);
    try {
      const res = await fetch(`${API_BASE}/api/products/${productId}/reviews-analysis`);
      if (res.ok) {
        const data = await res.json();
        setReviewIntel(data);
      }
    } catch (err) {
      console.error('Failed to load review intelligence:', err);
    } finally {
      setLoadingIntel(false);
    }
  };

  if (!product) return null;

  const inrPrice = product.price_inr || Math.round(product.price * 85);
  const inStock = (product.stock || 0) > 0;
  const attrs = product.attributes || {};

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 860,
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#070b14',
          border: '1px solid var(--border-mint)',
          borderRadius: 20,
          padding: 28,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 242, 254, 0.15)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: '#94a3b8',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        {/* Top Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {/* Image */}
          <div style={{
            height: 280,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            position: 'relative',
            background: '#000',
            border: '1px solid var(--border-mint)',
          }}>
            <img
              src={product.image_url}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {product.is_organic && (
              <div style={{ position: 'absolute', top: 12, left: 12 }}>
                <span className="badge-organic">
                  <ShieldCheck size={12} /> Certified Organic
                </span>
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
              <span className="badge-demo">Demo Catalog Record</span>
            </div>
          </div>

          {/* Core Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge-mint">
                {product.brand || 'ShopAI'} • {product.category}
              </span>
              <span style={{ fontSize: '0.75rem', color: inStock ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                {product.stock_status || (inStock ? 'In Stock' : 'Out of Stock')}
              </span>
            </div>

            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
              {product.name}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="badge-rating">
                <Star size={13} fill="#f59e0b" color="#f59e0b" />
                {product.rating ? product.rating.toFixed(1) : '4.5'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ({product.review_count} verified reviews)
              </span>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {product.description}
            </p>

            {/* Price block */}
            <div style={{
              background: 'rgba(0, 242, 254, 0.06)',
              border: '1px solid var(--border-mint)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 16px',
              marginTop: 'auto',
            }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Store Verified Price
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--mint-primary)' }}>
                ₹{inrPrice.toLocaleString('en-IN')}
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                  (${product.price.toFixed(2)})
                </span>
              </div>
            </div>

            {/* Quantity & Cart Action */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{
                    width: 32,
                    height: 32,
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
                <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 800 }}>{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  style={{
                    width: 32,
                    height: 32,
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
                onClick={() => {
                  onAddToCart(product, quantity);
                  onClose();
                }}
                className="btn-primary"
                style={{ flex: 1 }}
              >
                <ShoppingCart size={16} /> Add to Cart (₹{(inrPrice * quantity).toLocaleString('en-IN')})
              </button>
            </div>
          </div>
        </div>

        {/* Specifications & Attributes Section */}
        {Object.keys(attrs).length > 0 && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid var(--border-mint)',
            borderRadius: 'var(--radius-md)',
            padding: 18,
          }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--mint-light)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={16} color="var(--mint-primary)" /> Hardware & Product Specifications
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 10,
            }}>
              {Object.entries(attrs).map(([k, v]) => (
                <div key={k} style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {k.replace('_', ' ')}
                  </span>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff', marginTop: 2 }}>
                    {String(v)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review Intelligence Section */}
        {reviewIntel && (
          <div style={{
            background: 'rgba(0, 242, 254, 0.04)',
            border: '1px solid var(--border-mint)',
            borderRadius: 'var(--radius-md)',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--mint-light)' }}>
                ⭐ Review Intelligence Summary
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Based on {reviewIntel.analyzed_reviews_count || 0} customer reviews
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {reviewIntel.verified_advantages && reviewIntel.verified_advantages.length > 0 && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: 12,
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399' }}>✓ Verified Advantages</span>
                  <ul style={{ paddingLeft: 18, marginTop: 6, fontSize: '0.8rem', color: '#e2e8f0' }}>
                    {reviewIntel.verified_advantages.map((adv, i) => (
                      <li key={i}>{adv}</li>
                    ))}
                  </ul>
                </div>
              )}

              {reviewIntel.verified_limitations && reviewIntel.verified_limitations.length > 0 && (
                <div style={{
                  background: 'rgba(244, 63, 94, 0.08)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  padding: 12,
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fda4af' }}>⚠️ Reported Limitations</span>
                  <ul style={{ paddingLeft: 18, marginTop: 6, fontSize: '0.8rem', color: '#e2e8f0' }}>
                    {reviewIntel.verified_limitations.map((lim, i) => (
                      <li key={i}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
