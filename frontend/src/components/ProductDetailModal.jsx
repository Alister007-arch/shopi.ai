import React, { useState, useEffect } from 'react';
import { X, Star, ShoppingCart, MessageSquare, Check, AlertCircle, ShieldCheck, Tag, Info, Layers, Cpu, Leaf } from 'lucide-react';
import { API_BASE } from '../config';

export default function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  onAskInChat,
  formatPrice = (p, inr) => inr ? `₹${inr.toLocaleString('en-IN')}` : `$${p.toFixed(2)}`,
  currency = 'INR',
}) {
  const [reviewIntel, setReviewIntel] = useState(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const inrPrice = product.price_inr || Math.round(product.price * 85);
  const inStock = product.stock > 0;
  const attrs = product.attributes || {};

  useEffect(() => {
    fetchReviewIntelligence(product.id);
  }, [product.id]);

  const fetchReviewIntelligence = async (productId) => {
    setLoadingIntel(true);
    try {
      const res = await fetch(`${API_BASE}/api/products/${productId}/reviews-analysis`);
      if (res.ok) {
        const data = await res.json();
        setReviewIntel(data);
      }
    } catch (err) {
      console.warn('Could not fetch review intelligence:', err);
    } finally {
      setLoadingIntel(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(27, 42, 32, 0.65)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: 20,
    }}>
      <div
        className="animate-slide-up"
        style={{
          width: '100%',
          maxWidth: 860,
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          border: '1px solid var(--moss-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 34,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'var(--moss-tint)',
            border: 'none',
            color: 'var(--moss-deep)',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#e1e9df')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--moss-tint)')}
        >
          <X size={18} />
        </button>

        {/* Top Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 28 }}>
          {/* Image */}
          <div style={{
            height: 300,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            position: 'relative',
            background: 'var(--bg-card-muted)',
            border: '1px solid var(--moss-border)',
          }}>
            <img
              src={product.image_url}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {product.is_organic && (
              <div style={{ position: 'absolute', top: 12, left: 12 }}>
                <span className="badge-organic" style={{ background: '#ffffff', boxShadow: 'var(--shadow-sm)' }}>
                  <Leaf size={12} color="var(--moss-sage)" /> Certified Organic
                </span>
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
              <span className="badge-demo" style={{ background: 'rgba(255, 255, 255, 0.92)' }}>Verified Inventory</span>
            </div>
          </div>

          {/* Core Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge-moss">
                {product.brand || 'MOSS Essentials'} • {product.category}
              </span>
              <span style={{ fontSize: '0.75rem', color: inStock ? 'var(--moss-forest)' : 'var(--clay-terracotta)', fontWeight: 700 }}>
                {product.stock_status || (inStock ? 'In Stock' : 'Out of Stock')}
              </span>
            </div>

            <h2 style={{ fontSize: '1.6rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)', lineHeight: 1.25 }}>
              {product.name}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="badge-rating">
                <Star size={13} fill="#d4a359" color="#d4a359" />
                {product.rating ? product.rating.toFixed(1) : '4.8'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ({product.review_count} verified reviews)
              </span>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {product.description}
            </p>

            {/* Price block */}
            <div style={{
              background: 'var(--moss-tint)',
              border: '1px solid var(--moss-border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              marginTop: 'auto',
            }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--moss-sage)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Store Verified Price
              </span>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--moss-deep)', fontFamily: 'var(--font-heading)' }}>
                ₹{inrPrice.toLocaleString('en-IN')}
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 8, fontWeight: 500 }}>
                  (${product.price.toFixed(2)})
                </span>
              </div>
            </div>

            {/* Quantity & Cart Action */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--bg-card-muted)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--moss-border)',
              }}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{
                    width: 32,
                    height: 32,
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
                <span style={{ minWidth: 26, textAlign: 'center', fontWeight: 700, color: 'var(--moss-deep)' }}>{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#ffffff',
                    border: '1px solid var(--moss-border)',
                    color: 'var(--moss-deep)',
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
                style={{ flex: 1, padding: '12px 20px' }}
              >
                <ShoppingCart size={16} /> Add to Bag (₹{(inrPrice * quantity).toLocaleString('en-IN')})
              </button>
            </div>
          </div>
        </div>

        {/* Specifications & Attributes Section */}
        {Object.keys(attrs).length > 0 && (
          <div style={{
            background: 'var(--bg-card-muted)',
            border: '1px solid var(--moss-border)',
            borderRadius: 'var(--radius-md)',
            padding: 20,
          }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--moss-deep)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={16} color="var(--moss-sage)" /> Hardware & Product Specifications
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}>
              {Object.entries(attrs).map(([k, v]) => (
                <div key={k} style={{
                  background: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--moss-border)',
                }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {k.replace('_', ' ')}
                  </span>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--moss-deep)', marginTop: 2 }}>
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
            background: 'var(--bg-card-muted)',
            border: '1px solid var(--moss-border)',
            borderRadius: 'var(--radius-md)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                ⭐ Review Intelligence Summary
              </h4>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Based on {reviewIntel.analyzed_reviews_count || 0} customer reviews
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {reviewIntel.verified_advantages && reviewIntel.verified_advantages.length > 0 && (
                <div style={{
                  background: 'var(--moss-tint)',
                  border: '1px solid var(--moss-border)',
                  padding: 14,
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--moss-forest)' }}>✓ Verified Advantages</span>
                  <ul style={{ paddingLeft: 18, marginTop: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {reviewIntel.verified_advantages.map((adv, i) => (
                      <li key={i}>{adv}</li>
                    ))}
                  </ul>
                </div>
              )}

              {reviewIntel.verified_limitations && reviewIntel.verified_limitations.length > 0 && (
                <div style={{
                  background: 'var(--clay-subtle)',
                  border: '1px solid rgba(200, 109, 81, 0.25)',
                  padding: 14,
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--clay-terracotta)' }}>⚠️ Reported Limitations</span>
                  <ul style={{ paddingLeft: 18, marginTop: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
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
