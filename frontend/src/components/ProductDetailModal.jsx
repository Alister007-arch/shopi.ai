import React, { useState, useEffect } from 'react';
import {
  X, Star, ShoppingBag, MessageSquare, Check, ShieldCheck,
  ChevronDown, ChevronRight, Leaf, Zap, Package, ArrowRight, Heart
} from 'lucide-react';
import { API_BASE } from '../config';

export default function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  onAskInChat,
  formatPrice = (p, inr) => inr ? `₹${inr.toLocaleString('en-IN')}` : `$${p.toFixed(2)}`,
  currency = 'INR',
  allProducts = [],
}) {
  const [selectedSize, setSelectedSize] = useState('500 g');
  const [pinCodeInput, setPinCodeInput] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState(null);
  const [activeAccordion, setActiveAccordion] = useState('description'); // 'description', 'nutrition', 'returns'
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);

  if (!product) return null;

  const inrPrice = product.price_inr || Math.round(product.price * 85);
  const mrpPrice = Math.round(inrPrice * 1.25);
  const discountPct = Math.round(((mrpPrice - inrPrice) / mrpPrice) * 100);

  // Bundle suggestions (Frequently bought together)
  const bundleItems = allProducts.filter((p) => p.id !== product.id).slice(0, 2);
  const bundleTotalInr = inrPrice + bundleItems.reduce((acc, p) => acc + (p.price_inr || Math.round(p.price * 85)), 0);

  // You may also like items
  const relatedProducts = allProducts.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 4);

  const handleCheckPin = (e) => {
    e.preventDefault();
    if (pinCodeInput.trim().length >= 5) {
      setDeliveryStatus('✓ Delivery by tomorrow, 8:00 AM via Eco Fleet (Free delivery)');
    } else {
      setDeliveryStatus('Please enter a valid 6-digit PIN code.');
    }
  };

  const handleAddBundle = () => {
    onAddToCart(product, 1);
    bundleItems.forEach((b) => onAddToCart(b, 1));
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(20, 32, 23, 0.65)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '24px 16px',
    }}>
      <div
        className="animate-slide-up"
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '94vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 40px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            background: 'var(--bg-secondary)',
            border: 'none',
            color: 'var(--text-primary)',
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

        {/* 1. Breadcrumbs */}
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <span style={{ cursor: 'pointer' }} onClick={onClose}>Home</span> / <span>{product.category}</span> / <strong style={{ color: 'var(--moss-deep)' }}>{product.name}</strong>
        </div>

        {/* 2. Main Product Grid (Left Gallery, Right Details) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.3fr)',
          gap: 36,
        }}>
          {/* Left: Product Images & Thumbnails */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              height: 380,
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: 'var(--bg-card-muted)',
              border: '1px solid var(--moss-border)',
            }}>
              <img
                src={product.image_url}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Thumbnail Row */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedImgIdx(idx)}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    background: 'var(--bg-card-muted)',
                    border: selectedImgIdx === idx ? '2px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                    cursor: 'pointer',
                    opacity: selectedImgIdx === idx ? 1 : 0.65,
                  }}
                >
                  <img
                    src={product.image_url}
                    alt="Thumbnail"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Right: Product Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Tag */}
            <div>
              <span style={{
                background: 'var(--moss-tint)',
                color: 'var(--moss-deep)',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                {product.is_organic ? 'CERTIFIED ORGANIC' : 'VERIFIED ITEM'}
              </span>
            </div>

            {/* Product Title */}
            <h2 style={{
              fontSize: '1.9rem',
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
              color: 'var(--moss-deep)',
              lineHeight: 1.25,
            }}>
              {product.name}
            </h2>

            {/* Rating */}
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              ★ {product.rating ? product.rating.toFixed(1) : '4.8'} · {product.review_count} reviews
            </div>

            {/* Pricing */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                ₹{inrPrice.toLocaleString('en-IN')}
              </span>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                ₹{mrpPrice.toLocaleString('en-IN')}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--clay-terracotta)' }}>
                {discountPct}% off
              </span>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: -8 }}>
              Inclusive of all taxes
            </span>

            {/* Pack Size Pills */}
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                Pack size
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['250 g', '500 g', '1 kg'].map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 'var(--radius-sm)',
                      border: selectedSize === size ? '2px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                      background: selectedSize === size ? 'var(--moss-tint)' : '#ffffff',
                      color: 'var(--moss-deep)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons: Add to bag & Buy now with UPI */}
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button
                onClick={() => {
                  onAddToCart(product, 1);
                  onClose();
                }}
                style={{
                  flex: 1,
                  background: 'var(--moss-deep)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '14px 22px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Add to bag
              </button>

              <button
                onClick={() => {
                  onAddToCart(product, 1);
                  onClose();
                }}
                style={{
                  flex: 1,
                  background: '#ffffff',
                  color: 'var(--moss-deep)',
                  border: '1px solid var(--moss-deep)',
                  padding: '14px 22px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Buy now with UPI
              </button>
            </div>

            {/* Delivery Check Form */}
            <form onSubmit={handleCheckPin} style={{ marginTop: 10 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Check delivery
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Enter PIN code"
                  value={pinCodeInput}
                  onChange={(e) => setPinCodeInput(e.target.value)}
                  maxLength={6}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--moss-border)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: 'var(--moss-deep)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 20px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                  }}
                >
                  Check
                </button>
              </div>
              {deliveryStatus && (
                <p style={{ fontSize: '0.78rem', color: 'var(--moss-sage)', marginTop: 6, fontWeight: 600 }}>
                  {deliveryStatus}
                </p>
              )}
            </form>

            {/* Purity Guarantee Strip */}
            <div style={{
              display: 'flex',
              gap: 16,
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              paddingTop: 8,
              borderTop: '1px solid var(--moss-border)',
            }}>
              <span>✓ Certified farm purity</span>
              <span>✓ Zero additives</span>
              <span>✓ Easy returns</span>
            </div>

            {/* Questions AI Box */}
            <div style={{
              background: 'var(--moss-deep)',
              color: '#ffffff',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 4,
            }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                Questions? Ask the Moss Concierge about this product.
              </span>
              <button
                onClick={() => {
                  onAskInChat(`Tell me about ${product.name} (ID: #${product.id}), its sourcing, and user reviews`);
                  onClose();
                }}
                style={{
                  background: '#ffffff',
                  color: 'var(--moss-deep)',
                  border: 'none',
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Ask
              </button>
            </div>
          </div>
        </div>

        {/* 3. Accordions (Description & sourcing, Nutrition, Returns) */}
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--moss-border)' }}>
          {/* Accordion 1: Description */}
          <div style={{ borderBottom: '1px solid var(--moss-border)' }}>
            <div
              onClick={() => setActiveAccordion(activeAccordion === 'description' ? '' : 'description')}
              style={{
                padding: '16px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.95rem',
                color: 'var(--moss-deep)',
              }}
            >
              <span>▶ Description & sourcing</span>
              <ChevronDown size={18} style={{ transform: activeAccordion === 'description' ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </div>
            {activeAccordion === 'description' && (
              <div style={{ paddingBottom: 16, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <p>{product.description}</p>
                <p style={{ marginTop: 8 }}>
                  <strong>Origin & Processing:</strong> Sourced directly from certified heritage bio-reserves. Processed via traditional cold extraction without pasteurization or artificial preservatives.
                </p>
              </div>
            )}
          </div>

          {/* Accordion 2: Nutrition */}
          <div style={{ borderBottom: '1px solid var(--moss-border)' }}>
            <div
              onClick={() => setActiveAccordion(activeAccordion === 'nutrition' ? '' : 'nutrition')}
              style={{
                padding: '16px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.95rem',
                color: 'var(--moss-deep)',
              }}
            >
              <span>▶ Nutrition & ingredients</span>
              <ChevronDown size={18} style={{ transform: activeAccordion === 'nutrition' ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </div>
            {activeAccordion === 'nutrition' && (
              <div style={{ paddingBottom: 16, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <p><strong>Ingredients:</strong> 100% Raw, Unfiltered Single-Origin {product.name}.</p>
                <p style={{ marginTop: 6 }}><strong>Nutritional Profile (per 100g):</strong> Energy 304 kcal, Protein 0.3g, Carbohydrates 82.4g, Zero Added Refined Sugar.</p>
              </div>
            )}
          </div>

          {/* Accordion 3: Returns */}
          <div style={{ borderBottom: '1px solid var(--moss-border)' }}>
            <div
              onClick={() => setActiveAccordion(activeAccordion === 'returns' ? '' : 'returns')}
              style={{
                padding: '16px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.95rem',
                color: 'var(--moss-deep)',
              }}
            >
              <span>▶ Returns & refunds</span>
              <ChevronDown size={18} style={{ transform: activeAccordion === 'returns' ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </div>
            {activeAccordion === 'returns' && (
              <div style={{ paddingBottom: 16, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <p>100% Satisfaction Guarantee. If you are not delighted with the purity or taste, enjoy instant refund or replacement within 7 days of delivery.</p>
              </div>
            )}
          </div>
        </div>

        {/* 4. Frequently bought together (Exact Page 4 of PDF Wireframe) */}
        {bundleItems.length >= 2 && (
          <div style={{
            background: 'var(--bg-card-muted)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <h3 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)' }}>
              Frequently bought together
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
              {/* Product thumbnails with plus signs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--moss-border)' }}>
                  <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-muted)' }}>+</span>
                <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--moss-border)' }}>
                  <img src={bundleItems[0].image_url} alt={bundleItems[0].name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-muted)' }}>+</span>
                <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--moss-border)' }}>
                  <img src={bundleItems[1].image_url} alt={bundleItems[1].name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </div>

              {/* Bundle Pricing & Add Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Bundle total</span>
                  <strong style={{ fontSize: '1.4rem', color: 'var(--moss-deep)' }}>
                    ₹{bundleTotalInr.toLocaleString('en-IN')}
                  </strong>
                </div>

                <button
                  onClick={handleAddBundle}
                  style={{
                    background: 'var(--moss-deep)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Add all 3 to bag
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Customer Reviews (Exact Page 4 of PDF Wireframe) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)' }}>
            Customer reviews
          </h3>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--moss-deep)', fontFamily: 'var(--font-heading)' }}>
                {product.rating ? product.rating.toFixed(1) : '4.8'}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                out of 5 · {product.review_count} ratings
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 260, background: 'var(--bg-card-muted)', padding: 18, borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong style={{ fontSize: '0.88rem', color: 'var(--moss-deep)' }}>Kavita Sundaram</strong>
                <span style={{ color: 'var(--clay-terracotta)', fontSize: '0.85rem' }}>★★★★★</span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                "Incredible natural fragrance and pure texture. You can genuinely taste the authenticity without any sugar syrup adulteration. Highly recommend for daily rituals."
              </p>
              <span style={{ fontSize: '0.72rem', color: 'var(--moss-sage)', fontWeight: 700, marginTop: 8, display: 'inline-block' }}>
                ✓ Verified Purchaser
              </span>
            </div>
          </div>
        </div>

        {/* 6. You may also like (Exact Page 4 & 5 of PDF Wireframe) */}
        {relatedProducts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)' }}>
              You may also like
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
            }}>
              {relatedProducts.map((rel) => {
                const relInr = rel.price_inr || Math.round(rel.price * 85);
                return (
                  <div
                    key={rel.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--moss-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ height: 130, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg-card-muted)' }}>
                      <img src={rel.image_url} alt={rel.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--moss-deep)', lineHeight: 1.3 }}>
                      {rel.name}
                    </h5>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--moss-deep)' }}>
                        ₹{relInr.toLocaleString('en-IN')}
                      </span>
                      <button
                        onClick={() => onAddToCart(rel, 1)}
                        style={{
                          background: 'var(--moss-deep)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '5px 12px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
