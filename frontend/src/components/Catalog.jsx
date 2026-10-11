import React, { useState, useEffect } from 'react';
import { Search, Filter, Star, Leaf, ShoppingCart, MessageSquare, Tag, Check, Sparkles, ArrowUpDown, ShieldCheck, Eye, Cpu, Headphones, Apple, Shirt, Utensils, Info, ArrowRight } from 'lucide-react';
import ProductDetailModal from './ProductDetailModal';
import { API_BASE } from '../config';

const CATEGORIES = [
  { id: 'all', name: '✨ All Collection' },
  { id: 'daily-essentials', name: '🥛 Daily Essentials' },
  { id: 'luxury', name: '👑 Luxury Collection' },
  { id: 'fruits-vegetables', name: '🍎 Fresh Produce' },
  { id: 'honey', name: '🍯 Pure Honey' },
  { id: 'grains', name: '🌾 Grains & Oats' },
  { id: 'oil', name: '🫒 Cold-Pressed Oils' },
  { id: 'nuts', name: '🥜 Raw Nuts & Seeds' },
  { id: 'tea', name: '🍵 Botanical Tea' },
  { id: 'coffee', name: '☕ Artisan Coffee' },
  { id: 'snacks', name: '🥨 Wholesome Snacks' },
  { id: 'dairy-alt', name: '🥛 Dairy & Plant Milk' },
  { id: 'laptops', name: '💻 Laptops & Tech' },
  { id: 'electronics', name: '🎧 Audio & Gadgets' },
  { id: 'clothing', name: '👕 Organic Apparel' },
  { id: 'home-kitchen', name: '🍳 Mindful Living' },
  { id: 'personal-care', name: '🌿 Care & Wellness' },
  { id: 'household', name: '🧼 Eco Essentials' },
];

export default function Catalog({
  onAddToCart,
  onAskInChat,
  formatPrice = (p, inr) => inr ? `₹${inr.toLocaleString('en-IN')}` : `$${p.toFixed(2)}`,
  currency = 'INR',
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [organicOnly, setOrganicOnly] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, organicOnly, sortBy]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (organicOnly) params.append('is_organic', 'true');
      if (sortBy) params.append('sort_by', sortBy);

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

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q) ||
      (p.specifications && p.specifications.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 60, paddingInline: 24 }}>
      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={onAddToCart}
          onAskInChat={onAskInChat}
          formatPrice={formatPrice}
          currency={currency}
        />
      )}

      {/* Editorial MOSS Hero Section (Orix Creative Dribbble Aesthetic) */}
      <section
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--moss-border)',
          padding: '48px 44px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        {/* Subtle decorative background gradient accent */}
        <div style={{
          position: 'absolute',
          top: -80,
          right: -80,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(143, 168, 146, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24, position: 'relative' }}>
          <div style={{ maxWidth: 780 }}>
            {/* Pill Tag */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="badge-moss">
                🌿 Mindful Living & Sustainable Sourcing
              </span>
              <span className="badge-demo">
                77 Verified Artifacts
              </span>
            </div>

            {/* Editorial Heading */}
            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2.2rem, 3.8vw, 3.5rem)',
              fontWeight: 600,
              lineHeight: 1.15,
              color: 'var(--moss-deep)',
              letterSpacing: '-0.02em',
              marginBottom: 16,
            }}>
              Mindful Living, Curated for Everyday Rituals.
            </h1>

            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '1.02rem',
              lineHeight: 1.6,
              maxWidth: 680,
            }}>
              Experience tranquil, organic living with hand-curated essentials. Powered by our autonomous AI Shopping Concierge — order bundles and discover verified artisan goods with a single command.
            </p>

            {/* Quality Commitment Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--moss-tint)',
                color: 'var(--moss-deep)',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}>
                <Check size={14} color="var(--moss-sage)" /> 100% Certified Farm Purity
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--moss-tint)',
                color: 'var(--moss-deep)',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}>
                <Sparkles size={14} color="var(--moss-sage)" /> Instant 1-Command AI Checkout
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--moss-tint)',
                color: 'var(--moss-deep)',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}>
                <ShieldCheck size={14} color="var(--moss-sage)" /> Zero Artificial Additives
              </div>
            </div>
          </div>

          {/* Quick AI Action Card */}
          <div style={{
            background: 'var(--moss-tint)',
            border: '1px solid var(--moss-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            maxWidth: 320,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--moss-deep)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}>
                <Sparkles size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                  Moss AI Concierge
                </h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Autonomous 1-Command Ordering
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              Try: <em>"Order 1 kg oats and pure honey under ₹500"</em>
            </p>

            <button
              onClick={() => onAskInChat('Show me organic morning breakfast essentials with ratings and prices')}
              className="btn-primary"
              style={{ width: '100%', fontSize: '0.84rem', padding: '10px 16px' }}
            >
              <MessageSquare size={15} /> Talk with Concierge
            </button>
          </div>
        </div>

        {/* Minimalist Search & Filter Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          paddingTop: 20,
          borderTop: '1px solid var(--moss-border)',
        }}>
          {/* Search Box */}
          <div style={{
            flex: '1 1 320px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}>
            <Search size={18} color="var(--moss-sage)" style={{ position: 'absolute', left: 16 }} />
            <input
              type="text"
              placeholder="Search organic honey, oats, milk, cold-pressed oil, matcha..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '13px 18px 13px 46px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--moss-border)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
                fontFamily: 'var(--font-body)',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--moss-sage)';
                e.target.style.background = '#ffffff';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--moss-border)';
                e.target.style.background = 'var(--bg-secondary)';
              }}
            />
          </div>

          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowUpDown size={15} color="var(--text-muted)" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '12px 18px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--moss-border)',
                color: 'var(--text-primary)',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="rating">Top Rated (4.5★+)</option>
              <option value="price_asc">Price: Lowest to Highest</option>
              <option value="price_desc">Price: Highest to Lowest</option>
              <option value="reviews">Most Verified Reviews</option>
            </select>
          </div>

          {/* Organic Filter Pill */}
          <button
            onClick={() => setOrganicOnly(!organicOnly)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '12px 20px',
              borderRadius: 'var(--radius-full)',
              background: organicOnly ? 'var(--moss-deep)' : 'var(--bg-secondary)',
              border: '1px solid',
              borderColor: organicOnly ? 'var(--moss-deep)' : 'var(--moss-border)',
              color: organicOnly ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
          >
            <Leaf size={15} color={organicOnly ? '#fff' : 'var(--moss-sage)'} />
            <span>Organic Certified Only</span>
          </button>
        </div>
      </section>

      {/* Dribbble Signature Category Pills Bar */}
      <div style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 4,
        scrollbarWidth: 'none',
      }}>
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              className={`category-pill ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Catalog Metrics Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 8 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
          Displaying <strong style={{ color: 'var(--moss-deep)' }}>{filteredProducts.length} curated products</strong>
          {selectedCategory !== 'all' && ` • Collection: ${selectedCategory}`}
        </p>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          Authoritative Real-Time Inventory
        </span>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <div className="typing-dot" style={{ margin: '0 4px' }} />
          <div className="typing-dot" style={{ margin: '0 4px', animationDelay: '0.2s' }} />
          <div className="typing-dot" style={{ margin: '0 4px', animationDelay: '0.4s' }} />
          <p style={{ marginTop: 14, fontSize: '0.92rem', color: 'var(--moss-deep)' }}>Gathering pure catalog artifacts...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div
          style={{
            padding: '60px 30px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--moss-border)',
          }}
        >
          <div style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: 'var(--moss-tint)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--moss-deep)',
          }}>
            <Info size={28} />
          </div>
          <h3 style={{ fontSize: '1.3rem', color: 'var(--moss-deep)' }}>
            No Items Found in this Collection
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 500, fontSize: '0.9rem' }}>
            We only display authentic products with verified stock and real photographs.
          </p>
          <button
            onClick={() => setSelectedCategory('all')}
            className="btn-primary"
            style={{ marginTop: 6 }}
          >
            Explore Complete Collection
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(295px, 1fr))',
          gap: 26,
        }}>
          {filteredProducts.map((p) => {
            const hasSpecs = p.attributes && Object.keys(p.attributes).length > 0;
            const topSpec = hasSpecs ? Object.entries(p.attributes)[0] : null;

            return (
              <div
                key={p.id}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--moss-border)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  e.currentTarget.style.borderColor = 'var(--moss-border-strong)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  e.currentTarget.style.borderColor = 'var(--moss-border)';
                }}
              >
                {/* Product Image Frame */}
                <div style={{
                  height: 220,
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'var(--bg-card-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <img
                    src={p.image_url}
                    alt={p.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.4s ease',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
                    onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  />

                  {/* Badges on Image */}
                  <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {p.is_organic && (
                      <span className="badge-organic" style={{ background: '#ffffff', boxShadow: 'var(--shadow-sm)' }}>
                        <Leaf size={11} color="var(--moss-sage)" /> Organic
                      </span>
                    )}
                    {p.badge && (
                      <span className="badge-clay" style={{ background: '#ffffff', boxShadow: 'var(--shadow-sm)' }}>
                        {p.badge}
                      </span>
                    )}
                  </div>

                  {/* Rating Badge */}
                  <div style={{ position: 'absolute', bottom: 12, right: 12 }}>
                    <span className="badge-rating">
                      <Star size={12} fill="#d4a359" color="#d4a359" />
                      {p.rating ? p.rating.toFixed(1) : '4.8'}
                    </span>
                  </div>

                  {/* Stock Indicator */}
                  <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: p.stock > 10 ? 'var(--moss-forest)' : 'var(--clay-terracotta)',
                      background: 'rgba(255, 255, 255, 0.92)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                      backdropFilter: 'blur(6px)',
                      border: '1px solid var(--moss-border)',
                    }}>
                      {p.stock_status || 'In Stock'}
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      color: 'var(--moss-sage)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      {p.brand || 'MOSS Essentials'} • {p.category}
                    </span>
                  </div>

                  {/* Product Title */}
                  <h3
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: 'var(--moss-deep)',
                      lineHeight: 1.35,
                      cursor: 'pointer',
                      transition: 'color 0.2s',
                    }}
                    onClick={() => setSelectedProduct(p)}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--moss-sage)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--moss-deep)')}
                  >
                    {p.name}
                  </h3>

                  {/* Description */}
                  <p style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {p.description}
                  </p>

                  {/* Key Attribute Highlight */}
                  {topSpec && (
                    <div style={{
                      background: 'var(--moss-tint)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.72rem',
                      color: 'var(--moss-deep)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontWeight: 600,
                    }}>
                      <Cpu size={12} color="var(--moss-sage)" />
                      <span>{topSpec[0].replace('_', ' ').toUpperCase()}: {topSpec[1]}</span>
                    </div>
                  )}

                  {/* Pricing Bar */}
                  <div style={{
                    marginTop: 'auto',
                    paddingTop: 14,
                    borderTop: '1px solid var(--moss-border)',
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <span style={{
                        fontSize: '1.35rem',
                        fontWeight: 800,
                        color: 'var(--moss-deep)',
                        fontFamily: 'var(--font-heading)',
                      }}>
                        {formatPrice(p.price, p.price_inr)}
                      </span>
                      {currency === 'INR' && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                          (${p.price.toFixed(2)})
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedProduct(p)}
                      className="btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                      title="Inspect Specifications & Reviews"
                    >
                      <Eye size={13} /> Specs
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button
                      onClick={() => onAddToCart(p)}
                      className="btn-primary"
                      style={{ flex: 1.2, padding: '10px 14px', fontSize: '0.84rem' }}
                    >
                      <ShoppingCart size={15} /> Add to Bag
                    </button>

                    <button
                      onClick={() => onAskInChat(`Tell me about ${p.name} (ID: #${p.id}) and customer reviews`)}
                      className="btn-secondary"
                      style={{ flex: 1, padding: '10px 12px', fontSize: '0.82rem' }}
                    >
                      <MessageSquare size={14} /> Inquire
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
