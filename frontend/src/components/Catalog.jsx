import React, { useState, useEffect } from 'react';
import { Search, Filter, Star, Leaf, ShoppingCart, MessageSquare, Tag, Check, Sparkles, ArrowUpDown, ShieldCheck, Eye, Cpu, Headphones, Apple, Shirt, Utensils, Info } from 'lucide-react';
import ProductDetailModal from './ProductDetailModal';
import { API_BASE } from '../config';

const CATEGORIES = [
  { id: 'all', name: '✨ All Departments' },
  { id: 'daily-essentials', name: '🥛 Daily Essentials' },
  { id: 'luxury', name: '👑 Luxury Collection' },
  { id: 'laptops', name: '💻 Laptops & Tech' },
  { id: 'electronics', name: '🎧 Audio & Wearables' },
  { id: 'fruits-vegetables', name: '🍎 Fresh Produce' },
  { id: 'honey', name: '🍯 Pure Honey' },
  { id: 'grains', name: '🌾 Grains & Oats' },
  { id: 'oil', name: '🫒 Healthy Oils' },
  { id: 'nuts', name: '🥜 Nuts & Seeds' },
  { id: 'tea', name: '🍵 Organic Tea' },
  { id: 'coffee', name: '☕ Artisan Coffee' },
  { id: 'snacks', name: '🥨 Snacks' },
  { id: 'dairy-alt', name: '🥛 Dairy & Plant Milk' },
  { id: 'clothing', name: '👕 Apparel & Footwear' },
  { id: 'home-kitchen', name: '🍳 Home & Kitchen' },
  { id: 'personal-care', name: '🌿 Personal Care' },
  { id: 'household', name: '🧼 Household Essentials' },
  { id: 'books-stationery', name: '📚 Books & Stationery (Empty Demo)' },
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
  const [sortBy, setSortBy] = useState('rating'); // 'rating', 'price_asc', 'price_desc', 'reviews'
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
    <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Detail Modal */}
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

      {/* Hero Assistant Banner in Black & Mint Blue */}
      <div
        className="glass-panel"
        style={{
          padding: '24px 28px',
          background: 'linear-gradient(135deg, rgba(8, 13, 24, 0.95) 0%, rgba(12, 19, 36, 0.95) 100%)',
          border: '1px solid var(--border-mint)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  background: 'rgba(0, 242, 254, 0.12)',
                  color: 'var(--mint-cyan)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  border: '1px solid var(--border-mint)',
                }}
              >
                <Sparkles size={14} /> Autonomous AI Shopping Engine
              </span>
              <span className="badge-demo">Demo Store Catalog</span>
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '8px 0 4px', color: '#fff' }}>
              Multi-Category Store & Verified Inventory
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Explore certified organic foods, fresh produce, developer laptops, and audio gear. All prices verified in <code style={{ color: 'var(--mint-primary)' }}>shopai.db</code>.
            </p>
          </div>

          <button
            onClick={() => onAskInChat('Find top-rated items under my budget and explain their pros and cons')}
            className="btn-primary"
            style={{ padding: '12px 20px', fontSize: '0.92rem' }}
          >
            <MessageSquare size={17} /> Ask AI Assistant
          </button>
        </div>

        {/* Search & Sort Controls Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          paddingTop: 12,
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          {/* Search Box */}
          <div style={{
            flex: '1 1 280px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}>
            <Search size={18} color="var(--mint-cyan)" style={{ position: 'absolute', left: 14 }} />
            <input
              type="text"
              placeholder="Search laptops, headphones, honey, oats, watermelon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px 12px 42px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(4, 7, 13, 0.8)',
                border: '1px solid var(--border-mint)',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowUpDown size={15} color="var(--text-muted)" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '11px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(4, 7, 13, 0.8)',
                border: '1px solid var(--border-mint)',
                color: '#fff',
                fontSize: '0.85rem',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="rating">Best Customer Rating</option>
              <option value="price_asc">Price: Lowest to Highest</option>
              <option value="price_desc">Price: Highest to Lowest</option>
              <option value="reviews">Most Reviewed</option>
            </select>
          </div>

          {/* Organic Only Filter */}
          <button
            onClick={() => setOrganicOnly(!organicOnly)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '11px 16px',
              borderRadius: 'var(--radius-md)',
              background: organicOnly ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: organicOnly ? '1px solid #10b981' : '1px solid var(--border-subtle)',
              color: organicOnly ? '#34d399' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <ShieldCheck size={16} />
            <span>Certified Organic</span>
          </button>
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 6,
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

      {/* Catalog Status Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Showing <strong style={{ color: 'var(--mint-cyan)' }}>{filteredProducts.length}</strong> items in catalog
          {selectedCategory !== 'all' && ` • Category: ${selectedCategory}`}
        </p>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Authoritative pricing from SQLite database
        </span>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div className="typing-dot" style={{ margin: '0 4px' }} />
          <div className="typing-dot" style={{ margin: '0 4px', animationDelay: '0.2s' }} />
          <div className="typing-dot" style={{ margin: '0 4px', animationDelay: '0.4s' }} />
          <p style={{ marginTop: 12, fontSize: '0.9rem' }}>Loading store catalog from database...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        /* Explicit Empty State for Unavailable Categories */
        <div
          className="glass-panel"
          style={{
            padding: '50px 30px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(0, 242, 254, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--mint-primary)',
          }}>
            <Info size={28} />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>
            Category Currently Unavailable in Catalog
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 520, fontSize: '0.9rem' }}>
            We currently do not stock items under <strong>"{selectedCategory}"</strong>. ShopAI strictly displays verified products and does not fabricate inventory.
          </p>
          <button
            onClick={() => setSelectedCategory('all')}
            className="btn-primary"
            style={{ marginTop: 8 }}
          >
            Browse All Active Departments
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {filteredProducts.map((p) => {
            const hasSpecs = p.attributes && Object.keys(p.attributes).length > 0;
            const topSpec = hasSpecs ? Object.entries(p.attributes)[0] : null;

            return (
              <div
                key={p.id}
                className="glass-panel"
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid var(--border-mint)',
                  position: 'relative',
                }}
              >
                {/* Product Image */}
                <div style={{ height: 180, position: 'relative', overflow: 'hidden', background: '#000' }}>
                  <img
                    src={p.image_url}
                    alt={p.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.3s ease',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  />

                  {/* Top Badges */}
                  <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {p.is_organic && (
                      <span className="badge-organic">
                        <ShieldCheck size={11} /> Organic
                      </span>
                    )}
                    {p.badge && (
                      <span style={{
                        background: 'rgba(4, 7, 13, 0.85)',
                        backdropFilter: 'blur(8px)',
                        color: 'var(--mint-cyan)',
                        border: '1px solid var(--border-mint)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}>
                        {p.badge}
                      </span>
                    )}
                  </div>

                  {/* Rating Tag */}
                  <div style={{ position: 'absolute', bottom: 10, right: 10 }}>
                    <span className="badge-rating">
                      <Star size={12} fill="#f59e0b" color="#f59e0b" />
                      {p.rating ? p.rating.toFixed(1) : '4.5'} ({p.review_count})
                    </span>
                  </div>

                  {/* Demo Label */}
                  <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
                    <span className="badge-demo">Demo</span>
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', flex: 1, gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      color: 'var(--mint-cyan)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      {p.brand || 'ShopAI'} • {p.category}
                    </span>
                    <span style={{
                      fontSize: '0.72rem',
                      color: p.stock > 10 ? '#34d399' : '#fbbf24',
                      fontWeight: 600,
                    }}>
                      {p.stock_status || 'In Stock'}
                    </span>
                  </div>

                  <h3 style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#fff',
                    lineHeight: 1.35,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedProduct(p)}
                  >
                    {p.name}
                  </h3>

                  <p style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.45,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {p.description}
                  </p>

                  {/* Spec Highlight Pill if exists */}
                  {topSpec && (
                    <div style={{
                      background: 'rgba(0, 242, 254, 0.05)',
                      border: '1px solid rgba(0, 242, 254, 0.15)',
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: '0.72rem',
                      color: 'var(--mint-light)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <Cpu size={12} color="var(--mint-cyan)" />
                      <span><strong>{topSpec[0].replace('_', ' ').toUpperCase()}:</strong> {topSpec[1]}</span>
                    </div>
                  )}

                  {/* Pricing */}
                  <div style={{
                    marginTop: 'auto',
                    paddingTop: 12,
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <span style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: 'var(--mint-primary)',
                        fontFamily: 'var(--font-heading)',
                      }}>
                        {formatPrice(p.price, p.price_inr)}
                      </span>
                      {currency === 'INR' && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                          (${p.price.toFixed(2)})
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedProduct(p)}
                      className="btn-ghost"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      title="Inspect Specifications & Reviews"
                    >
                      <Eye size={13} /> Specs
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => onAddToCart(p)}
                      className="btn-secondary"
                      style={{ flex: 1, padding: '9px 12px', fontSize: '0.82rem' }}
                    >
                      <ShoppingCart size={14} /> + Cart
                    </button>

                    <button
                      onClick={() => onAskInChat(`Tell me about ${p.name} (ID: #${p.id}) and customer reviews`)}
                      className="btn-primary"
                      style={{ flex: 1.2, padding: '9px 12px', fontSize: '0.82rem' }}
                    >
                      <MessageSquare size={14} /> Ask AI
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
