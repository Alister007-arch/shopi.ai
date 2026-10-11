import React, { useState, useEffect } from 'react';
import {
  Search, Star, ShoppingBag, MessageSquare, Check, Sparkles,
  ShieldCheck, Eye, ArrowRight, Heart, Clock, ChevronRight,
  Leaf, Package, Zap, Gift, Coffee, Sun, Apple, Droplet
} from 'lucide-react';
import ProductDetailModal from './ProductDetailModal';
import { API_BASE } from '../config';

export default function Catalog({
  onAddToCart,
  onAskInChat,
  formatPrice = (p, inr) => inr ? `₹${inr.toLocaleString('en-IN')}` : `$${p.toFixed(2)}`,
  currency = 'INR',
  searchQuery = '',
  selectedCategory = 'all',
  onSelectCategory,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bestsellerFilter, setBestsellerFilter] = useState('all'); // 'all', 'organic', 'under500', 'toprated'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [wishlist, setWishlist] = useState({});
  const [subscribed, setSubscribed] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [countdown, setCountdown] = useState({ hours: 8, minutes: 42, seconds: 19 });

  // Countdown timer for Deals of the Day
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 12, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      const res = await fetch(`${API_BASE}/api/products?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Error fetching catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleWishlist = (id) => {
    setWishlist((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q)
    );
  });

  // Deals of the day: products with badges or organic items
  const dealsProducts = products.slice(0, 4);

  // Best sellers with filter
  const bestSellers = products.filter((p) => {
    if (bestsellerFilter === 'organic') return p.is_organic;
    if (bestsellerFilter === 'under500') return (p.price_inr || p.price * 85) <= 500;
    if (bestsellerFilter === 'toprated') return (p.rating || 4.5) >= 4.7;
    return true;
  }).slice(4, 8);

  const formatTimer = (n) => String(n).padStart(2, '0');

  return (
    <div style={{ maxWidth: 1380, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48, paddingBottom: 60 }}>
      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={onAddToCart}
          onAskInChat={onAskInChat}
          formatPrice={formatPrice}
          currency={currency}
          allProducts={products}
        />
      )}

      {/* =========================================================================
          SECTION 1: HERO GRID (Exact Page 1 of PDF Wireframe)
          ========================================================================= */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)',
        gap: 20,
        alignItems: 'stretch',
      }}>
        {/* Left Large Banner: Deep Forest Moss Green */}
        <div style={{
          background: 'var(--moss-deep)',
          borderRadius: 'var(--radius-xl)',
          padding: '48px 44px',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 380,
        }}>
          {/* Subtle Organic Background Leaf / Circle Accent */}
          <div style={{
            position: 'absolute',
            right: -40,
            bottom: -40,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(143, 168, 146, 0.22) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div>
            <span style={{
              display: 'inline-block',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--moss-sage-light)',
              marginBottom: 16,
            }}>
              SPRING COLLECTION 2026
            </span>

            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2.3rem, 4vw, 3.6rem)',
              fontWeight: 600,
              lineHeight: 1.15,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              marginBottom: 16,
            }}>
              Mindful living,<br />
              curated for everyday<br />
              rituals.
            </h1>

            <p style={{
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.82)',
              maxWidth: 480,
              lineHeight: 1.5,
              marginBottom: 32,
            }}>
              Certified pure essentials. Order bundles with a single command.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => onSelectCategory && onSelectCategory('all')}
              style={{
                background: '#ffffff',
                color: 'var(--moss-deep)',
                padding: '12px 28px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
            >
              Shop collection
            </button>

            <button
              onClick={() => onAskInChat('Find certified organic essentials and explain their benefits')}
              style={{
                background: 'transparent',
                color: '#ffffff',
                padding: '12px 26px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Talk to Concierge
            </button>
          </div>
        </div>

        {/* Right Stacked Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top Card: Moss AI Concierge (White Card) */}
          <div style={{
            flex: 1,
            background: 'var(--bg-card)',
            border: '1px solid var(--moss-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 30,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--moss-deep)', marginBottom: 8 }}>
                Moss AI Concierge
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Try: <em>"Order 1 kg oats and pure honey under ₹500"</em>
              </p>
            </div>

            <button
              onClick={() => onAskInChat('Order 1 kg oats and pure honey under ₹500')}
              style={{
                background: 'var(--moss-deep)',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                marginTop: 20,
                alignSelf: 'flex-start',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Sparkles size={16} /> Talk with Concierge
            </button>
          </div>

          {/* Bottom Card: Offer Card (Warm Sand Yellow) */}
          <div style={{
            flex: 1,
            background: 'var(--accent-yellow)',
            borderRadius: 'var(--radius-lg)',
            padding: 30,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--moss-deep)', marginBottom: 6 }}>
              15% off your first order
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Use code <strong style={{ color: 'var(--moss-deep)', letterSpacing: '0.08em' }}>MOSS15</strong>
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: CIRCULAR CATEGORIES (Exact Page 1 of PDF Wireframe)
          ========================================================================= */}
      <section style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        overflowX: 'auto',
        padding: '10px 0',
        scrollbarWidth: 'none',
      }}>
        {[
          { id: 'daily-essentials', label: 'Daily Essentials', bg: '#eef2ec', icon: '🥛' },
          { id: 'luxury', label: 'Luxury', bg: '#fbf3e6', icon: '👑' },
          { id: 'fruits-vegetables', label: 'Fresh Produce', bg: '#eaf4eb', icon: '🍎' },
          { id: 'honey', label: 'Pure Honey', bg: '#fef7e6', icon: '🍯' },
          { id: 'grains', label: 'Grains & Oats', bg: '#f3efe6', icon: '🌾' },
          { id: 'oil', label: 'Cold-Pressed Oils', bg: '#e8eff1', icon: '🫒' },
          { id: 'nuts', label: 'Raw Nuts', bg: '#f6f0ea', icon: '🥜' },
        ].map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectCategory && onSelectCategory(item.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              flex: '1 0 100px',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: item.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              border: selectedCategory === item.id ? '2px solid var(--moss-deep)' : '1px solid var(--moss-border)',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {item.icon}
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
          </div>
        ))}
      </section>

      {/* =========================================================================
          SECTION 3: GUARANTEES STRIP (Exact Page 1 of PDF Wireframe)
          ========================================================================= */}
      <section style={{
        background: '#ffffff',
        border: '1px solid var(--moss-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 32px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 20,
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <ShieldCheck size={18} color="var(--moss-sage)" /> 100% certified farm purity
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Leaf size={18} color="var(--moss-sage)" /> Zero artificial additives
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Zap size={18} color="var(--moss-sage)" /> Instant 1-command checkout
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Package size={18} color="var(--moss-sage)" /> Easy returns & refunds
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: DEALS OF THE DAY (Exact Page 1 of PDF Wireframe)
          ========================================================================= */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.65rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)' }}>
            Deals of the day
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <Clock size={15} color="var(--clay-terracotta)" />
            <span>Ends in <strong>[{formatTimer(countdown.hours)}:{formatTimer(countdown.minutes)}:{formatTimer(countdown.seconds)}]</strong></span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {dealsProducts.map((p, i) => {
            const inrPrice = p.price_inr || Math.round(p.price * 85);
            const mrpPrice = Math.round(inrPrice * 1.25);
            const discountPct = Math.round(((mrpPrice - inrPrice) / mrpPrice) * 100);

            return (
              <div
                key={p.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--moss-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  transition: 'all 0.25s',
                }}
              >
                {/* Discount Badge on Top Left */}
                <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
                  <span style={{
                    background: 'var(--accent-yellow)',
                    color: 'var(--moss-deep)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    {discountPct}% OFF
                  </span>
                </div>

                {/* Wishlist Heart on Top Right */}
                <button
                  onClick={() => toggleWishlist(p.id)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    zIndex: 2,
                    background: 'rgba(255, 255, 255, 0.85)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Heart size={16} fill={wishlist[p.id] ? '#c86d51' : 'none'} color={wishlist[p.id] ? '#c86d51' : 'var(--text-muted)'} />
                </button>

                {/* Product Image Frame */}
                <div
                  onClick={() => setSelectedProduct(p)}
                  style={{
                    height: 190,
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    background: 'var(--bg-card-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={p.image_url}
                    alt={p.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                {/* Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {p.specifications ? p.specifications.split(',')[0] : 'Standard pack'}
                  </span>

                  <h4
                    onClick={() => setSelectedProduct(p)}
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--moss-deep)',
                      cursor: 'pointer',
                    }}
                  >
                    {p.name}
                  </h4>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    ★ {p.rating ? p.rating.toFixed(1) : '4.8'} · {p.review_count} reviews
                  </div>
                </div>

                {/* Price and Add button */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                  paddingTop: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                      ₹{inrPrice.toLocaleString('en-IN')}
                    </span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                      ₹{mrpPrice.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <button
                    onClick={() => onAddToCart(p)}
                    style={{
                      background: 'var(--moss-deep)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 22px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.84rem',
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
      </section>

      {/* =========================================================================
          SECTION 5: SHOP BY RITUAL (Exact Page 1 & 2 of PDF Wireframe)
          ========================================================================= */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h2 style={{ fontSize: '1.65rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)' }}>
          Shop by ritual
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
        }}>
          {/* Ritual 1: Morning breakfast (Ice Blue) */}
          <div
            onClick={() => onSelectCategory && onSelectCategory('grains')}
            style={{
              background: 'var(--accent-blue)',
              borderRadius: 'var(--radius-xl)',
              padding: '36px 30px',
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
          >
            <h3 style={{ fontSize: '1.45rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)', marginBottom: 6 }}>
              Morning breakfast
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              Oats, honey, milk · from ₹199
            </p>
          </div>

          {/* Ritual 2: Wellness (Warm Butter Sand) */}
          <div
            onClick={() => onSelectCategory && onSelectCategory('tea')}
            style={{
              background: 'var(--accent-yellow)',
              borderRadius: 'var(--radius-xl)',
              padding: '36px 30px',
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
          >
            <h3 style={{ fontSize: '1.45rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)', marginBottom: 6 }}>
              Wellness
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              Matcha, nuts, oils · from ₹299
            </p>
          </div>

          {/* Ritual 3: Gifting (Deep Green with White Text) */}
          <div
            onClick={() => onSelectCategory && onSelectCategory('luxury')}
            style={{
              background: 'var(--accent-green)',
              borderRadius: 'var(--radius-xl)',
              padding: '36px 30px',
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
          >
            <h3 style={{ fontSize: '1.45rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: '#ffffff', marginBottom: 6 }}>
              Gifting
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              Luxury hampers · from ₹999
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: BEST SELLERS (Exact Page 2 of PDF Wireframe)
          ========================================================================= */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <h2 style={{ fontSize: '1.65rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)' }}>
            Best sellers
          </h2>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'organic', label: 'Organic only' },
              { id: 'under500', label: 'Under ₹500' },
              { id: 'toprated', label: 'Top rated' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setBestsellerFilter(tab.id)}
                style={{
                  padding: '7px 18px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--moss-border)',
                  background: bestsellerFilter === tab.id ? 'var(--moss-deep)' : '#ffffff',
                  color: bestsellerFilter === tab.id ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {bestSellers.map((p, i) => {
            const inrPrice = p.price_inr || Math.round(p.price * 85);
            const mrpPrice = Math.round(inrPrice * 1.2);
            const badgeLabels = ['Organic', 'Fresh', 'New', 'Best seller'];

            return (
              <div
                key={p.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--moss-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                }}
              >
                {/* Badge Tag */}
                <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
                  <span style={{
                    background: '#ffffff',
                    color: 'var(--moss-deep)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--moss-border)',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                  }}>
                    {p.badge || badgeLabels[i % badgeLabels.length]}
                  </span>
                </div>

                {/* Wishlist Heart */}
                <button
                  onClick={() => toggleWishlist(p.id)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    zIndex: 2,
                    background: 'rgba(255, 255, 255, 0.85)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Heart size={16} fill={wishlist[p.id] ? '#c86d51' : 'none'} color={wishlist[p.id] ? '#c86d51' : 'var(--text-muted)'} />
                </button>

                {/* Image */}
                <div
                  onClick={() => setSelectedProduct(p)}
                  style={{
                    height: 190,
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    background: 'var(--bg-card-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={p.image_url}
                    alt={p.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {p.specifications ? p.specifications.split(',')[0] : 'Standard size'}
                  </span>
                  <h4
                    onClick={() => setSelectedProduct(p)}
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--moss-deep)',
                      cursor: 'pointer',
                    }}
                  >
                    {p.name}
                  </h4>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    ★ {p.rating ? p.rating.toFixed(1) : '4.8'} · {p.review_count} reviews
                  </div>
                </div>

                {/* Price and Add */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                  paddingTop: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                      ₹{inrPrice.toLocaleString('en-IN')}
                    </span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                      ₹{mrpPrice.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <button
                    onClick={() => onAddToCart(p)}
                    style={{
                      background: 'var(--moss-deep)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 22px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.84rem',
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
      </section>

      {/* =========================================================================
          SECTION 7: ONE COMMAND. YOUR CART, READY. (Exact Page 2 of PDF Wireframe)
          ========================================================================= */}
      <section style={{
        background: '#16241b',
        borderRadius: 'var(--radius-xl)',
        padding: '50px 48px',
        color: '#ffffff',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 36,
        alignItems: 'center',
      }}>
        {/* Left Copy */}
        <div>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(2rem, 3.4vw, 3rem)',
            fontWeight: 600,
            lineHeight: 1.2,
            marginBottom: 16,
          }}>
            One command. Your cart, ready.
          </h2>

          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.82)',
            lineHeight: 1.6,
            maxWidth: 460,
            marginBottom: 28,
          }}>
            Tell the Concierge what you need and your budget. It builds the bag, you confirm and pay with UPI.
          </p>

          <button
            onClick={() => onAskInChat('Order 1 kg oats and pure honey under ₹500')}
            style={{
              background: '#ffffff',
              color: 'var(--moss-deep)',
              border: 'none',
              padding: '13px 30px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Try the Concierge
          </button>
        </div>

        {/* Right Interactive Simulation Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* User speech prompt */}
          <div style={{
            background: '#ffffff',
            color: 'var(--moss-deep)',
            padding: '14px 20px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600,
            fontSize: '0.9rem',
            alignSelf: 'flex-end',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
          }}>
            Order 1 kg oats and pure honey under ₹500
          </div>

          {/* Agent Bundle Response Card */}
          <div style={{
            background: '#253d2d',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.92rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Rolled Oats 1 kg</span>
                <span style={{ fontWeight: 700 }}>₹180</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pure Forest Honey</span>
                <span style={{ fontWeight: 700 }}>₹280</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 8,
                borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                fontSize: '1.05rem',
                fontWeight: 800,
              }}>
                <span>Total</span>
                <span>₹460</span>
              </div>
            </div>

            <button
              onClick={() => {
                const oats = products.find((p) => p.name.toLowerCase().includes('oat')) || products[1];
                const honey = products.find((p) => p.name.toLowerCase().includes('honey')) || products[0];
                if (oats) onAddToCart(oats, 1);
                if (honey) onAddToCart(honey, 1);
              }}
              style={{
                background: 'var(--accent-yellow)',
                color: 'var(--moss-deep)',
                border: 'none',
                padding: '13px 20px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              }}
            >
              Confirm & pay with UPI
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 8: LOVED BY CUSTOMERS (Exact Page 2 of PDF Wireframe)
          ========================================================================= */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h2 style={{ fontSize: '1.65rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)' }}>
          Loved by customers
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {[
            {
              quote: "The forest honey and oats arrived within 2 hours. The autonomous agent is incredible — I typed one sentence and my order was confirmed without filling any forms.",
              author: "Priya Sharma",
              city: "Bengaluru",
            },
            {
              quote: "The cold-pressed mustard and sesame oils taste exactly like traditional stone mills. Zero pesticides, clean glass packaging. MOSS has become our daily pantry default.",
              author: "Ananya Iyer",
              city: "Mumbai",
            },
            {
              quote: "The review intelligence feature saved me from buying the wrong laptop. It gave me unbiased pros and cons grounded in real user feedback. Exceptional experience.",
              author: "Rohan Mehta",
              city: "Delhi",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                border: '1px solid var(--moss-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 28,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 16,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ color: 'var(--clay-terracotta)', fontSize: '1.1rem' }}>
                ★★★★★
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                "{item.quote}"
              </p>

              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                {item.author}, <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{item.city}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          SECTION 9: JOIN THE MOSS CIRCLE (Exact Page 2 of PDF Wireframe)
          ========================================================================= */}
      <section style={{
        background: '#ffffff',
        border: '1px solid var(--moss-border)',
        borderRadius: 'var(--radius-xl)',
        padding: '50px 30px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <h2 style={{ fontSize: '1.85rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)' }}>
          Join the MOSS circle
        </h2>

        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: 440 }}>
          Early access to launches and offers.
        </p>

        {subscribed ? (
          <div style={{
            background: 'var(--moss-tint)',
            color: 'var(--moss-deep)',
            padding: '12px 24px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 700,
            fontSize: '0.9rem',
          }}>
            ✓ Welcome to the MOSS circle! 15% discount code applied.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (emailInput.trim()) setSubscribed(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--moss-border)',
              padding: 4,
              maxWidth: 440,
              width: '100%',
              marginTop: 10,
            }}
          >
            <input
              type="email"
              placeholder="Email address"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                padding: '10px 18px',
                fontSize: '0.9rem',
                outline: 'none',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="submit"
              style={{
                background: 'var(--moss-deep)',
                color: '#ffffff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              Subscribe
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
