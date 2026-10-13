import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Star, ShoppingBag, MessageSquare, Check, Sparkles,
  ShieldCheck, Eye, ArrowRight, Heart, Clock, ChevronRight,
  Leaf, Package, Zap, Gift, Coffee, Sun, Apple, Droplet,
  SlidersHorizontal, ChevronLeft, RefreshCw, Camera, X, AlertCircle
} from 'lucide-react';
import ProductDetailModal from './ProductDetailModal';
import ProductImage from './ProductImage';
import { API_BASE } from '../config';
import { BRAND } from '../config/brand';

// Isolated memoized countdown component to prevent re-rendering the entire 77-product catalog every second
const DealCountdown = React.memo(function DealCountdown() {
  const [countdown, setCountdown] = useState({ hours: 8, minutes: 42, seconds: 19 });

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

  const formatTimer = (n) => String(n).padStart(2, '0');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
      <Clock size={15} color="var(--clay-terracotta)" />
      <span>Ends in <strong>[{formatTimer(countdown.hours)}:{formatTimer(countdown.minutes)}:{formatTimer(countdown.seconds)}]</strong></span>
    </div>
  );
});

export default function Catalog({
  onAddToCart,
  onAskInChat,
  formatPrice = (p, inr) => {
    if (inr !== undefined && inr !== null && !isNaN(Number(inr))) return `₹${Math.round(Number(inr)).toLocaleString('en-IN')}`;
    const n = Number(p);
    return !isNaN(n) && p !== undefined && p !== null ? `₹${Math.round(n * 85).toLocaleString('en-IN')}` : '₹0';
  },
  currency = 'INR',
  searchQuery = '',
  selectedCategory = 'all',
  onSelectCategory,
  wishlistItems = [],
  onToggleWishlist,
  onClearSearch,
  onOpenVision,
  currentUser = null,
  onOpenAuthModal = null,
  onBuyNow = null,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [bestsellerFilter, setBestsellerFilter] = useState('all'); // 'all', 'grocery', 'laptops', 'electronics', 'fashion', 'under500', 'toprated'
  const [dealsCategory, setDealsCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [wishlist, setWishlist] = useState({});
  const [subscribed, setSubscribed] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  // Enhanced Multi-Category Catalog Filtering & Attribute State
  const [catalogSort, setCatalogSort] = useState('featured'); // 'featured', 'price_asc', 'price_desc', 'rating', 'name_asc'
  const [catalogSearch, setCatalogSearch] = useState('');
  const [organicOnly, setOrganicOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [under500Only, setUnder500Only] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [minRating, setMinRating] = useState(0);
  const [priceRange, setPriceRange] = useState('all');
  
  // Category-specific attribute filters
  const [selectedRam, setSelectedRam] = useState('');
  const [selectedStorage, setSelectedStorage] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [selectedPackSize, setSelectedPackSize] = useState('');
  const [selectedWarranty, setSelectedWarranty] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Department hierarchy mapping for multi-category storefront
  const DEPARTMENT_CATEGORY_MAP = useMemo(() => ({
    grocery: ['grocery', 'honey', 'oats', 'oil', 'nuts', 'seeds', 'grains', 'tea', 'coffee', 'snacks', 'dairy-alt', 'daily-essentials', 'fruits-vegetables', 'produce', 'groceries'],
    fashion: ['fashion', 'clothing', 'apparel', 'innerwear'],
    electronics: ['electronics', 'audio', 'gadgets', 'headphones'],
    laptops: ['laptops', 'ultrabooks', 'workstations', 'student-laptops'],
    'home-kitchen': ['home-kitchen', 'kitchen-appliances', 'cookware', 'household'],
    'personal-care': ['personal-care', 'haircare', 'skincare', 'grooming'],
    luxury: ['luxury', 'luxury-smartphones', 'luxury-computing', 'haute-horlogerie', 'niche-fragrance'],
  }), []);

  // Determine if application is in Results Mode (active query or category/filter) vs Home Mode
  const isResultsMode = Boolean(
    (searchQuery && searchQuery.trim().length > 0) ||
    (selectedCategory && selectedCategory !== 'all')
  );

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    // Reset to page 1 whenever filters change
    setCurrentPage(1);
  }, [selectedCategory, catalogSearch, searchQuery, organicOnly, inStockOnly, under500Only, catalogSort, selectedBrand, minRating, priceRange, selectedRam, selectedStorage, selectedSize, selectedMaterial, selectedPackSize, selectedWarranty]);

  const fetchProducts = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      const q = (searchQuery || '').trim();
      if (q) {
        params.append('q', q);
      }
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      params.append('limit', '100');
      const res = await fetch(`${API_BASE}/api/products?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Error fetching catalog:', err);
      setFetchError(err.message || 'Unable to connect to product catalog server');
    } finally {
      setLoading(false);
    }
  };

  const isWishlisted = (id) => {
    if (wishlistItems && wishlistItems.length > 0) {
      return wishlistItems.some((it) => it.id === id);
    }
    return !!wishlist[id];
  };

  const handleToggleWishlist = (product) => {
    if (onToggleWishlist) {
      onToggleWishlist(product);
    } else {
      setWishlist((prev) => ({ ...prev, [product.id]: !prev[product.id] }));
    }
  };

  // Derive unique brands from catalog
  const availableBrands = useMemo(() => {
    const brands = new Set();
    products.forEach((p) => {
      if (p.brand && p.brand.trim()) brands.add(p.brand.trim());
    });
    return Array.from(brands).sort();
  }, [products]);

  // Complete Multi-Category Filtering & Sorting
  const effectiveQuery = (catalogSearch || searchQuery || '').toLowerCase().trim();
  const allCatalogFiltered = useMemo(() => {
    return products.filter((p) => {
      const pCat = (p.category || '').toLowerCase();

      // Category / Department hierarchy check
      if (selectedCategory && selectedCategory !== 'all') {
        const selCat = selectedCategory.toLowerCase();
        if (DEPARTMENT_CATEGORY_MAP[selCat]) {
          if (!DEPARTMENT_CATEGORY_MAP[selCat].includes(pCat)) return false;
        } else if (pCat !== selCat) {
          return false;
        }
      }

      if (organicOnly && !p.is_organic) return false;
      if (inStockOnly && p.stock <= 0) return false;

      const inr = p.price_inr || Math.round((Number(p.price) || 0) * 85);
      if (under500Only && inr > 500) return false;

      // Price range filter
      if (priceRange === 'under500' && inr > 500) return false;
      if (priceRange === '500-2000' && (inr < 500 || inr > 2000)) return false;
      if (priceRange === '2000-10000' && (inr < 2000 || inr > 10000)) return false;
      if (priceRange === 'above10000' && inr < 10000) return false;

      // Brand filter
      if (selectedBrand !== 'all' && p.brand !== selectedBrand) return false;

      // Rating filter
      if (minRating > 0 && (p.rating || 4.5) < minRating) return false;

      // Category-specific attribute filtering (matches either attributes JSON or specifications string)
      const attrString = (
        (p.attributes && typeof p.attributes === 'object' ? JSON.stringify(p.attributes) : (p.attributes || '')) +
        ' ' +
        (p.specifications || '')
      ).toLowerCase();

      if (selectedRam && !attrString.includes(selectedRam.toLowerCase())) return false;
      if (selectedStorage && !attrString.includes(selectedStorage.toLowerCase())) return false;
      if (selectedSize && !attrString.includes(selectedSize.toLowerCase())) return false;
      if (selectedMaterial && !attrString.includes(selectedMaterial.toLowerCase())) return false;
      if (selectedPackSize && !attrString.includes(selectedPackSize.toLowerCase())) return false;
      if (selectedWarranty && !attrString.includes(selectedWarranty.toLowerCase())) return false;

      // Search query filtering
      if (catalogSearch && catalogSearch.trim()) {
        const localQ = catalogSearch.toLowerCase().trim();
        const pName = (p.name || '').toLowerCase();
        const pDesc = (p.description || '').toLowerCase();
        const pBrand = (p.brand || '').toLowerCase();
        const pSpecs = (p.specifications || '').toLowerCase();
        const match = (
          pName.includes(localQ) ||
          pDesc.includes(localQ) ||
          pBrand.includes(localQ) ||
          pCat.includes(localQ) ||
          pSpecs.includes(localQ)
        );
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => {
      const aInr = a.price_inr || Math.round((Number(a.price) || 0) * 85);
      const bInr = b.price_inr || Math.round((Number(b.price) || 0) * 85);
      if (catalogSort === 'price_asc') return aInr - bInr;
      if (catalogSort === 'price_desc') return bInr - aInr;
      if (catalogSort === 'rating') return (b.rating || 4.5) - (a.rating || 4.5);
      if (catalogSort === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      return (a.id || 0) - (b.id || 0); // 'featured'
    });
  }, [
    products, selectedCategory, organicOnly, inStockOnly, under500Only,
    selectedBrand, minRating, priceRange, selectedRam, selectedStorage,
    selectedSize, selectedMaterial, selectedPackSize, selectedWarranty,
    effectiveQuery, catalogSort, searchQuery, DEPARTMENT_CATEGORY_MAP
  ]);

  const totalPages = Math.ceil(allCatalogFiltered.length / itemsPerPage) || 1;
  const paginatedCatalog = allCatalogFiltered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Deals of the day: category-aware deals
  const dealsProducts = useMemo(() => {
    let pool = products;
    if (dealsCategory !== 'all') {
      const allowed = DEPARTMENT_CATEGORY_MAP[dealsCategory] || [dealsCategory];
      pool = products.filter((p) => allowed.includes((p.category || '').toLowerCase()));
    }
    return pool.slice(0, 4);
  }, [products, dealsCategory, DEPARTMENT_CATEGORY_MAP]);

  // Best sellers: category-aware best sellers
  const bestSellers = useMemo(() => {
    return products.filter((p) => {
      const pCat = (p.category || '').toLowerCase();
      if (bestsellerFilter === 'grocery') {
        const gAllowed = DEPARTMENT_CATEGORY_MAP['grocery'] || [];
        return gAllowed.includes(pCat);
      }
      if (bestsellerFilter === 'laptops') {
        const lAllowed = DEPARTMENT_CATEGORY_MAP['laptops'] || [];
        return lAllowed.includes(pCat);
      }
      if (bestsellerFilter === 'electronics') {
        const eAllowed = DEPARTMENT_CATEGORY_MAP['electronics'] || [];
        return eAllowed.includes(pCat);
      }
      if (bestsellerFilter === 'fashion') {
        const fAllowed = DEPARTMENT_CATEGORY_MAP['fashion'] || [];
        return fAllowed.includes(pCat);
      }
      if (bestsellerFilter === 'organic') return p.is_organic;
      if (bestsellerFilter === 'under500') return (p.price_inr || p.price * 85) <= 500;
      if (bestsellerFilter === 'toprated') return (p.rating || 4.5) >= 4.7;
      return true;
    }).slice(0, 8);
  }, [products, bestsellerFilter, DEPARTMENT_CATEGORY_MAP]);

  // Single Source of Truth for Search / Category Results Mode:
  // Banner count and grid cards derive from the EXACT same searchResults array.
  const searchResults = useMemo(() => {
    let list = [...products];

    // If a category is selected (and not 'all'), apply category hierarchy match
    if (selectedCategory && selectedCategory !== 'all') {
      const selCat = selectedCategory.toLowerCase();
      const allowed = DEPARTMENT_CATEGORY_MAP[selCat] || [selCat];
      list = list.filter((p) => {
        const pCat = (p.category || '').toLowerCase();
        return allowed.includes(pCat) || pCat === selCat;
      });
    }

    // Sort according to catalogSort
    list.sort((a, b) => {
      const aInr = a.price_inr || Math.round(a.price * 85);
      const bInr = b.price_inr || Math.round(b.price * 85);
      if (catalogSort === 'price_asc') return aInr - bInr;
      if (catalogSort === 'price_desc') return bInr - aInr;
      if (catalogSort === 'rating') return (b.rating || 4.5) - (a.rating || 4.5);
      if (catalogSort === 'name_asc') return a.name.localeCompare(b.name);
      return a.id - b.id; // 'featured'
    });

    return list;
  }, [products, selectedCategory, catalogSort, DEPARTMENT_CATEGORY_MAP]);

  // Product Card Renderer (shared single source of truth, visible immediately with opacity: 1)
  const renderProductCard = (p) => {
    const inrPrice = p.price_inr || Math.round(p.price * 85);
    const mrpPrice = Math.round(inrPrice * 1.25);
    const discountPct = Math.round(((mrpPrice - inrPrice) / mrpPrice) * 100);

    return (
      <div
        key={p.id}
        className="product-card"
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
          opacity: 1,
          minHeight: 380,
          transition: 'all 0.25s',
        }}
      >
        {/* Badge Tag */}
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
          <span style={{
            background: p.is_organic ? 'var(--moss-deep)' : 'var(--accent-yellow)',
            color: p.is_organic ? '#ffffff' : 'var(--moss-deep)',
            fontSize: '0.72rem',
            fontWeight: 800,
            padding: '3px 9px',
            borderRadius: 'var(--radius-sm)',
          }}>
            {p.is_organic ? 'ORGANIC' : `${discountPct}% OFF`}
          </span>
        </div>

        {/* Accessible Wishlist Heart */}
        <button
          onClick={() => handleToggleWishlist(p)}
          className="touch-target"
          aria-label={`Save ${p.name} to wishlist`}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 2,
            background: 'rgba(255, 255, 255, 0.88)',
            border: 'none',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title={isWishlisted(p.id) ? "Remove from Wishlist" : "Add to Wishlist"}
        >
          <Heart size={17} fill={isWishlisted(p.id) ? '#c86d51' : 'none'} color={isWishlisted(p.id) ? '#c86d51' : 'var(--text-muted)'} />
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
          <ProductImage
            src={p.image_url}
            alt={p.name}
            width={280}
            height={190}
          />
        </div>

        {/* Product Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {p.specifications ? p.specifications.split(',')[0] : p.category}
            </span>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: p.stock > 5 ? 'var(--moss-sage)' : 'var(--clay-terracotta)',
            }}>
              {p.stock > 5 ? 'In stock' : p.stock > 0 ? `Only ${p.stock} left` : 'Out of stock'}
            </span>
          </div>

          <h4
            onClick={() => setSelectedProduct(p)}
            style={{
              fontSize: '0.98rem',
              fontWeight: 700,
              color: 'var(--moss-deep)',
              cursor: 'pointer',
              lineHeight: 1.35,
            }}
          >
            {p.name}
          </h4>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            ★ {p.rating ? p.rating.toFixed(1) : '4.8'} · {p.review_count || 42} reviews
          </div>
        </div>

        {/* Pricing and Action Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'auto',
          paddingTop: 8,
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
              ₹{inrPrice.toLocaleString('en-IN')}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
              ₹{mrpPrice.toLocaleString('en-IN')}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onAskInChat && onAskInChat(`Tell me about ${p.name} and reviews`)}
              className="touch-target"
              aria-label={`Ask AI concierge about ${p.name}`}
              title="Ask AI concierge"
              style={{
                background: 'var(--bg-card-muted)',
                border: '1px solid var(--moss-border)',
                borderRadius: 'var(--radius-full)',
                color: 'var(--moss-deep)',
                padding: '8px 12px',
                cursor: 'pointer',
              }}
            >
              <MessageSquare size={15} />
            </button>

            <button
              onClick={() => onAddToCart(p)}
              className="touch-target add-to-cart-btn"
              aria-label={`Add ${p.name} to cart`}
              disabled={p.stock <= 0}
              style={{
                background: p.stock > 0 ? 'var(--moss-deep)' : 'var(--text-muted)',
                color: '#ffffff',
                border: 'none',
                padding: '8px 20px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: p.stock > 0 ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
              }}
            >
              {p.stock > 0 ? 'Add' : 'Sold out'}
            </button>
          </div>
        </div>
      </div>
    );
  };

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
          currentUser={currentUser}
          onOpenAuthModal={onOpenAuthModal}
          onBuyNow={onBuyNow}
        />
      )}

      {/* Page Modes: Results Mode (Dedicated Results Page) vs Home Mode */}
      {isResultsMode ? (
        <div id="results-page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24, minHeight: '60vh' }}>
          {/* Results Toolbar */}
          <div
            id="results-toolbar"
            style={{
              background: '#ffffff',
              border: '1.5px solid var(--moss-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Left: Query / Category Info & Match Count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'var(--moss-deep)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
              </div>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                  {loading
                    ? (searchQuery ? `Searching for "${searchQuery}"...` : 'Filtering catalog...')
                    : (searchQuery ? `Showing results for "${searchQuery}"` : `Department: ${(selectedCategory || '').toUpperCase()}`)}
                </div>
                <div id="results-count-banner" style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  {loading ? 'Querying database...' : `Found ${searchResults.length} matching products`}
                </div>
              </div>
            </div>

            {/* Right: Category Select, Sort Select, Clear Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Category Select */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label htmlFor="results-category-select" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Department:
                </label>
                <select
                  id="results-category-select"
                  value={selectedCategory || 'all'}
                  onChange={(e) => onSelectCategory && onSelectCategory(e.target.value)}
                  aria-label="Filter results by category"
                  style={{
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--moss-border)',
                    background: 'var(--bg-card-muted)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--moss-deep)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="all">All Departments</option>
                  <option value="grocery">Grocery & Pantry</option>
                  <option value="honey">Pure Honey</option>
                  <option value="grains">Grains & Oats</option>
                  <option value="oil">Cold-Pressed Oils</option>
                  <option value="nuts">Raw Nuts</option>
                  <option value="fashion">Fashion & Clothing</option>
                  <option value="electronics">Electronics</option>
                  <option value="laptops">Laptops</option>
                  <option value="home-kitchen">Home & Kitchen</option>
                  <option value="personal-care">Personal Care</option>
                  <option value="luxury">Luxury</option>
                </select>
              </div>

              {/* Sort Select */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label htmlFor="results-sort-select" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Sort:
                </label>
                <select
                  id="results-sort-select"
                  value={catalogSort}
                  onChange={(e) => setCatalogSort(e.target.value)}
                  aria-label="Sort search results"
                  style={{
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--moss-border)',
                    background: 'var(--bg-card-muted)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--moss-deep)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="featured">Featured</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                  <option value="name_asc">Name: A to Z</option>
                </select>
              </div>

              {/* Clear Search */}
              <button
                id="clear-search-btn"
                type="button"
                onClick={() => {
                  setCatalogSearch('');
                  if (onClearSearch) onClearSearch();
                }}
                style={{
                  background: 'var(--moss-deep)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
              >
                <X size={15} /> Clear Search
              </button>
            </div>
          </div>

          {/* Result States */}
          {/* State 1: Loading Skeleton */}
          {loading && (
            <div
              id="results-loading-skeleton"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 20,
                minHeight: 450,
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--moss-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    minHeight: 380,
                  }}
                >
                  <div style={{ height: 190, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <div className="skeleton-shimmer" style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div style={{ height: 16, width: '60%', borderRadius: 4 }} className="skeleton-shimmer" />
                  <div style={{ height: 20, width: '85%', borderRadius: 4 }} className="skeleton-shimmer" />
                  <div style={{ height: 14, width: '40%', borderRadius: 4 }} className="skeleton-shimmer" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
                    <div style={{ height: 24, width: '30%', borderRadius: 4 }} className="skeleton-shimmer" />
                    <div style={{ height: 36, width: '35%', borderRadius: 'var(--radius-full)' }} className="skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* State 2: Error State */}
          {!loading && fetchError && (
            <div
              id="results-error-state"
              style={{
                background: '#ffffff',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-xl)',
                padding: '48px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                minHeight: 320,
                justifyContent: 'center',
              }}
            >
              <div style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <AlertCircle size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: '#991b1b', margin: 0, fontWeight: 700 }}>
                Unable to load search results
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: 460, margin: 0 }}>
                {fetchError}. Please verify your connection or try again.
              </p>
              <button
                type="button"
                onClick={fetchProducts}
                className="btn-primary"
                style={{ padding: '10px 24px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={15} /> Retry
              </button>
            </div>
          )}

          {/* State 3: Empty State */}
          {!loading && !fetchError && searchResults.length === 0 && (
            <div
              id="results-empty-state"
              style={{
                background: '#ffffff',
                border: '1px solid var(--moss-border)',
                borderRadius: 'var(--radius-xl)',
                padding: '56px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 18,
                minHeight: 400,
                justifyContent: 'center',
              }}
            >
              <div style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: 'var(--moss-tint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--moss-deep)',
              }}>
                <Search size={32} />
              </div>
              <h3 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-serif)', color: 'var(--moss-deep)', margin: 0, fontWeight: 700 }}>
                No results for "{searchQuery || selectedCategory}"
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: 480, margin: 0, lineHeight: 1.5 }}>
                We could not find any products matching your search criteria. Try checking your spelling, exploring categories, or clear the search.
              </p>

              {/* Category Suggestions */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Suggested categories:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600 }}>
                  {[
                    { id: 'grocery', label: '🛒 Grocery & Pantry' },
                    { id: 'honey', label: '🌿 Pure Honey' },
                    { id: 'fashion', label: '👕 Fashion' },
                    { id: 'electronics', label: '🎧 Electronics' },
                    { id: 'laptops', label: '💻 Laptops' },
                    { id: 'home-kitchen', label: '🍳 Home & Kitchen' },
                    { id: 'luxury', label: '👑 Luxury' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        if (onSelectCategory) onSelectCategory(cat.id);
                        if (onClearSearch) onClearSearch();
                      }}
                      style={{
                        background: 'var(--bg-card-muted)',
                        border: '1px solid var(--moss-border)',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--moss-deep)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogSearch('');
                    if (onClearSearch) onClearSearch();
                  }}
                  className="btn-primary"
                  style={{ padding: '10px 24px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <X size={15} /> Clear Search
                </button>
              </div>
            </div>
          )}

          {/* State 4: Products Grid (Single source of truth with toolbar count) */}
          {!loading && !fetchError && searchResults.length > 0 && (
            <div
              className="results-grid"
              id="results-product-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 20,
                minHeight: 450,
                overflow: 'visible',
              }}
            >
              {searchResults.map(renderProductCard)}
            </div>
          )}
        </div>
      ) : (
        <>

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
              {BRAND.tagline}<br />
              <span style={{ fontSize: '0.65em', opacity: 0.9 }}>{BRAND.taglineEn}</span>
            </h1>

            <p style={{
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.82)',
              maxWidth: 480,
              lineHeight: 1.5,
              marginBottom: 32,
            }}>
              Curated multi-category catalog across groceries, laptops, fashion, tech & luxury. Order bundles with a single command.
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
              onClick={() => onAskInChat('Show top laptops for coding, organic pantry bundles, and wireless headphones')}
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
                Try: <em>"Laptops for programming under ₹60k"</em> or <em>"Organic honey under ₹500"</em>
              </p>
            </div>

            <button
              onClick={() => onAskInChat('Find laptops for programming under ₹60,000 and pure honey under ₹500')}
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
              Use code <strong style={{ color: 'var(--moss-deep)', letterSpacing: '0.08em' }}>TROVI15</strong>
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: MULTI-CATEGORY GRID (All 7 Top-Level Departments)
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
          { id: 'all', label: 'All Catalog', bg: '#f4f6f4', icon: '🏪' },
          { id: 'grocery', label: 'Grocery', bg: '#eef2ec', icon: '🛒' },
          { id: 'fashion', label: 'Fashion', bg: '#f3eef8', icon: '👕' },
          { id: 'electronics', label: 'Electronics', bg: '#edf2f7', icon: '🎧' },
          { id: 'laptops', label: 'Laptops', bg: '#eaf1f8', icon: '💻' },
          { id: 'home-kitchen', label: 'Home & Kitchen', bg: '#fdf5ea', icon: '🍳' },
          { id: 'personal-care', label: 'Personal Care', bg: '#f8eff5', icon: '✨' },
          { id: 'luxury', label: 'Luxury', bg: '#fbf3e6', icon: '👑' },
          { id: 'honey', label: 'MOSS Organics', bg: '#eaf4eb', icon: '🌿' },
          { id: 'clothing', label: 'Apparel', bg: '#f3eef8', icon: '👔' },
          { id: 'fruits-vegetables', label: 'Produce', bg: '#eaf4eb', icon: '🥦' },
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
          SECTION 3: GUARANTEES STRIP (General, True Claims Only)
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
          <ShieldCheck size={18} color="var(--moss-sage)" /> 100% Genuine & Brand Assured
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Package size={18} color="var(--moss-sage)" /> Easy 7-Day Returns & Exchanges
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Zap size={18} color="var(--moss-sage)" /> Secure UPI, Card & NetBanking
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <MessageSquare size={18} color="var(--moss-sage)" /> 24/7 Dedicated Concierge Support
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: DEALS OF THE DAY (With Category Tabs)
          ========================================================================= */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <h2 style={{ fontSize: '1.65rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)', margin: 0 }}>
              Deals of the day
            </h2>
            <DealCountdown />
          </div>
          {/* Category Filter Pills for Deals */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Deals' },
              { id: 'laptops', label: 'Laptops' },
              { id: 'grocery', label: 'Grocery' },
              { id: 'electronics', label: 'Electronics' },
              { id: 'fashion', label: 'Fashion' },
              { id: 'home-kitchen', label: 'Home' },
              { id: 'luxury', label: 'Luxury' },
            ].map((dTab) => (
              <button
                key={dTab.id}
                type="button"
                onClick={() => setDealsCategory(dTab.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  border: dealsCategory === dTab.id ? '1px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                  background: dealsCategory === dTab.id ? 'var(--moss-deep)' : '#ffffff',
                  color: dealsCategory === dTab.id ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: dealsCategory === dTab.id ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {dTab.label}
              </button>
            ))}
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
                  onClick={() => handleToggleWishlist(p)}
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
                  title={isWishlisted(p.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                >
                  <Heart size={16} fill={isWishlisted(p.id) ? '#c86d51' : 'none'} color={isWishlisted(p.id) ? '#c86d51' : 'var(--text-muted)'} />
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
                  <ProductImage
                    src={p.image_url}
                    alt={p.name}
                    width={280}
                    height={190}
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
              { id: 'laptops', label: 'Laptops' },
              { id: 'grocery', label: 'Grocery' },
              { id: 'electronics', label: 'Tech' },
              { id: 'fashion', label: 'Fashion' },
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
            const fallbackBadges = ['BEST SELLER', 'TOP RATED', 'POPULAR', 'VERIFIED'];
            const cardBadge = p.is_organic ? 'ORGANIC' : (p.badge || fallbackBadges[i % fallbackBadges.length]);

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
                {/* Badge Tag: ORGANIC only if product data supports it */}
                <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
                  <span style={{
                    background: p.is_organic ? 'var(--moss-deep)' : '#ffffff',
                    color: p.is_organic ? '#ffffff' : 'var(--moss-deep)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--moss-border)',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                  }}>
                    {cardBadge}
                  </span>
                </div>

                {/* Wishlist Heart */}
                <button
                  onClick={() => handleToggleWishlist(p)}
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
                  title={isWishlisted(p.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                >
                  <Heart size={16} fill={isWishlisted(p.id) ? '#c86d51' : 'none'} color={isWishlisted(p.id) ? '#c86d51' : 'var(--text-muted)'} />
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
                  <ProductImage
                    src={p.image_url}
                    alt={p.name}
                    width={280}
                    height={190}
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
          SECTION 6B: CURATED PANTRY COLLECTION (Complete 77-Item Grid)
          ========================================================================= */}
      <section id="curated-pantry-catalog" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--moss-sage)',
                display: 'block',
                marginBottom: 4,
              }}>
                {selectedCategory && selectedCategory !== 'all' ? `${selectedCategory.toUpperCase()} COLLECTION` : 'MULTI-CATEGORY STORE'}
              </span>
              <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--moss-deep)' }}>
                {selectedCategory && selectedCategory !== 'all' ? `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Essentials & Gear` : 'Curated Multi-Category Catalog'}
              </h2>
            </div>
            
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Showing <strong>{paginatedCatalog.length}</strong> of <strong>{allCatalogFiltered.length}</strong> curated items
            </div>
          </div>
          
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: 640 }}>
            Browse verified groceries, fashion & apparel, laptops & computing, electronics, home essentials, and luxury craftsmanship.
          </p>
        </div>

        {/* Live Filter, Search, and Sort Controls Bar */}
        <div style={{
          background: '#ffffff',
          border: '1px solid var(--moss-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: 'var(--shadow-sm)',
        }}>
          {/* Row 1: Search + Quick Pills + Sort */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
          }}>
            {/* Search Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--bg-card-muted)',
              border: '1px solid var(--moss-border)',
              borderRadius: 'var(--radius-full)',
              padding: '6px 16px',
              flex: '1 1 260px',
              maxWidth: 420,
            }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search by name, spec, brand..."
                aria-label="Filter catalog items"
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '0.86rem',
                  color: 'var(--text-primary)',
                  width: '100%',
                }}
              />
              {catalogSearch && (
                <button
                  onClick={() => setCatalogSearch('')}
                  aria-label="Clear catalog search"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    padding: 4,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Filter Toggles */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => setOrganicOnly((prev) => !prev)}
                className="touch-target"
                aria-pressed={organicOnly}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: organicOnly ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                  background: organicOnly ? 'var(--moss-deep)' : '#ffffff',
                  color: organicOnly ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                }}
              >
                <Leaf size={14} /> Certified Organic
              </button>

              <button
                onClick={() => setInStockOnly((prev) => !prev)}
                className="touch-target"
                aria-pressed={inStockOnly}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: inStockOnly ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                  background: inStockOnly ? 'var(--moss-deep)' : '#ffffff',
                  color: inStockOnly ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                }}
              >
                <Check size={14} /> In Stock
              </button>

              {/* Reset All Filters button if any active */}
              {(organicOnly || inStockOnly || under500Only || selectedBrand !== 'all' || minRating > 0 || priceRange !== 'all' || selectedRam || selectedStorage || selectedSize || selectedMaterial || selectedPackSize || selectedWarranty || catalogSearch || (selectedCategory && selectedCategory !== 'all')) && (
                <button
                  onClick={() => {
                    setOrganicOnly(false);
                    setInStockOnly(false);
                    setUnder500Only(false);
                    setSelectedBrand('all');
                    setMinRating(0);
                    setPriceRange('all');
                    setSelectedRam('');
                    setSelectedStorage('');
                    setSelectedSize('');
                    setSelectedMaterial('');
                    setSelectedPackSize('');
                    setSelectedWarranty('');
                    setCatalogSearch('');
                    if (onSelectCategory) onSelectCategory('all');
                  }}
                  className="touch-target"
                  aria-label="Reset all filters"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RefreshCw size={12} /> Reset
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label htmlFor="catalog-sort-select" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Sort:
              </label>
              <select
                id="catalog-sort-select"
                value={catalogSort}
                onChange={(e) => setCatalogSort(e.target.value)}
                aria-label="Sort product catalog"
                style={{
                  background: 'var(--bg-card-muted)',
                  border: '1px solid var(--moss-border)',
                  borderRadius: 'var(--radius-full)',
                  padding: '7px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--moss-deep)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="featured">Featured / Curated</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Top Customer Rated</option>
                <option value="name_asc">Name: A to Z</option>
              </select>
            </div>
          </div>

          {/* Row 2: Dynamic Category-Specific Attributes, Brand & Price Filters */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            paddingTop: 12,
            borderTop: '1px solid var(--moss-border)',
          }}>
            {/* Brand Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>Brand:</span>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--moss-border)',
                  background: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--moss-deep)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Brands</option>
                {availableBrands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Price Range Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>Budget:</span>
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--moss-border)',
                  background: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--moss-deep)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Budgets</option>
                <option value="under500">Under ₹500</option>
                <option value="500-2000">₹500 - ₹2,000</option>
                <option value="2000-10000">₹2,000 - ₹10,000</option>
                <option value="above10000">Above ₹10,000</option>
              </select>
            </div>

            {/* Rating Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>Rating:</span>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--moss-border)',
                  background: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--moss-deep)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value={0}>All Ratings</option>
                <option value={4.5}>★ 4.5 & above</option>
                <option value={4.0}>★ 4.0 & above</option>
              </select>
            </div>

            {/* Category-Specific: Laptop Specs (RAM & Storage) */}
            {(selectedCategory === 'laptops' || selectedCategory === 'ultrabooks' || selectedCategory === 'workstations' || selectedCategory === 'student-laptops' || selectedCategory === 'all') && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>RAM:</span>
                  <select
                    value={selectedRam}
                    onChange={(e) => setSelectedRam(e.target.value)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--moss-border)',
                      background: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--moss-deep)',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">All RAM</option>
                    <option value="16GB">16GB RAM</option>
                    <option value="32GB">32GB RAM</option>
                    <option value="64GB">64GB RAM</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>Storage:</span>
                  <select
                    value={selectedStorage}
                    onChange={(e) => setSelectedStorage(e.target.value)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--moss-border)',
                      background: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--moss-deep)',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">All Storage</option>
                    <option value="512GB">512GB SSD</option>
                    <option value="1TB">1TB SSD</option>
                    <option value="2TB">2TB SSD</option>
                  </select>
                </div>
              </>
            )}

            {/* Category-Specific: Clothing Specs (Size & Material) */}
            {(selectedCategory === 'fashion' || selectedCategory === 'clothing' || selectedCategory === 'apparel' || selectedCategory === 'innerwear') && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>Size:</span>
                  <select
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--moss-border)',
                      background: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--moss-deep)',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">All Sizes</option>
                    <option value="S">Small (S)</option>
                    <option value="M">Medium (M)</option>
                    <option value="L">Large (L)</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>Fabric:</span>
                  <select
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--moss-border)',
                      background: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--moss-deep)',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">All Fabrics</option>
                    <option value="Linen">Pure Linen</option>
                    <option value="Cotton">Organic Cotton</option>
                    <option value="Wool">Merino Wool</option>
                  </select>
                </div>
              </>
            )}

            {/* Category-Specific: Grocery Specs (Pack Size) */}
            {(selectedCategory === 'grocery' || selectedCategory === 'honey' || selectedCategory === 'oats' || selectedCategory === 'grains' || selectedCategory === 'oil' || selectedCategory === 'nuts') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>Pack:</span>
                <select
                  value={selectedPackSize}
                  onChange={(e) => setSelectedPackSize(e.target.value)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--moss-border)',
                    background: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--moss-deep)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">All Packs</option>
                  <option value="250g">250 g</option>
                  <option value="500g">500 g</option>
                  <option value="1kg">1 kg</option>
                </select>
              </div>
            )}

            {/* Category-Specific: Electronics (Warranty) */}
            {(selectedCategory === 'electronics' || selectedCategory === 'audio' || selectedCategory === 'headphones' || selectedCategory === 'gadgets') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>Warranty:</span>
                <select
                  value={selectedWarranty}
                  onChange={(e) => setSelectedWarranty(e.target.value)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--moss-border)',
                    background: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--moss-deep)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">All Warranties</option>
                  <option value="1 Year">1 Year Warranty</option>
                  <option value="2 Year">2 Year Warranty</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Loading Skeleton State */}
        {loading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div
                key={n}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--moss-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  minHeight: 340,
                }}
              >
                <div style={{ height: 190, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div className="skeleton-shimmer" style={{ width: '100%', height: '100%' }} />
                </div>
                <div style={{ height: 16, width: '60%', borderRadius: 4 }} className="skeleton-shimmer" />
                <div style={{ height: 20, width: '85%', borderRadius: 4 }} className="skeleton-shimmer" />
                <div style={{ height: 14, width: '40%', borderRadius: 4 }} className="skeleton-shimmer" />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
                  <div style={{ height: 24, width: '30%', borderRadius: 4 }} className="skeleton-shimmer" />
                  <div style={{ height: 36, width: '35%', borderRadius: 'var(--radius-full)' }} className="skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && paginatedCatalog.length === 0 && (
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--moss-border)',
            borderRadius: 'var(--radius-xl)',
            padding: '50px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--moss-tint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--moss-deep)',
            }}>
              <Search size={28} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-serif)', color: 'var(--moss-deep)', margin: 0 }}>
              No results for "{effectiveQuery || searchQuery || 'your criteria'}"
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: 460, margin: 0 }}>
              We could not find any products matching your search query. Try exploring popular categories or clear your search to see the full pantry.
            </p>

            {/* Quick Suggestions - Popular Categories */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 560, marginTop: 4 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Suggested categories:</span>
              {[
                { id: 'fruits-vegetables', label: 'Fresh Produce' },
                { id: 'honey', label: 'Pure Honey' },
                { id: 'grains', label: 'Grains & Oats' },
                { id: 'oil', label: 'Cold-Pressed Oils' },
                { id: 'nuts', label: 'Raw Nuts' },
                { id: 'electronics', label: 'Tech & Gadgets' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    if (onSelectCategory) onSelectCategory(cat.id);
                    if (onClearSearch) onClearSearch();
                    setCatalogSearch('');
                  }}
                  style={{
                    background: 'var(--bg-card-muted)',
                    border: '1px solid var(--moss-border)',
                    padding: '5px 14px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--moss-deep)',
                    cursor: 'pointer',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  if (onClearSearch) onClearSearch();
                  setCatalogSearch('');
                  if (onSelectCategory) onSelectCategory('all');
                }}
                className="btn-primary"
                style={{ padding: '8px 22px', fontSize: '0.86rem' }}
              >
                <X size={15} /> Clear Search & View All
              </button>
              {onOpenVision && (
                <button
                  type="button"
                  onClick={onOpenVision}
                  style={{
                    background: '#ffffff',
                    color: 'var(--moss-deep)',
                    border: '1.5px solid var(--moss-deep)',
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Camera size={16} color="var(--clay-terracotta)" />
                  Search with Photo / Visual Lens
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setCatalogSearch('');
                  if (onClearSearch) onClearSearch();
                  setOrganicOnly(false);
                  setInStockOnly(false);
                  setUnder500Only(false);
                  if (onSelectCategory) onSelectCategory('all');
                }}
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
                Reset Filters & Show All Products
              </button>
            </div>
          </div>
        )}

        {/* Product Cards Grid */}
        {!loading && paginatedCatalog.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {paginatedCatalog.map((p) => {
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
                  {/* Badge Tag */}
                  <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
                    <span style={{
                      background: p.is_organic ? 'var(--moss-deep)' : 'var(--accent-yellow)',
                      color: p.is_organic ? '#ffffff' : 'var(--moss-deep)',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      {p.is_organic ? 'ORGANIC' : `${discountPct}% OFF`}
                    </span>
                  </div>

                  {/* Accessible Wishlist Heart */}
                  <button
                    onClick={() => handleToggleWishlist(p)}
                    className="touch-target"
                    aria-label={`Save ${p.name} to wishlist`}
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      zIndex: 2,
                      background: 'rgba(255, 255, 255, 0.88)',
                      border: 'none',
                      borderRadius: '50%',
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title={isWishlisted(p.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                  >
                    <Heart size={17} fill={isWishlisted(p.id) ? '#c86d51' : 'none'} color={isWishlisted(p.id) ? '#c86d51' : 'var(--text-muted)'} />
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
                    <ProductImage
                      src={p.image_url}
                      alt={p.name}
                      width={280}
                      height={190}
                    />
                  </div>

                  {/* Product Metadata */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {p.specifications ? p.specifications.split(',')[0] : p.category}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: p.stock > 5 ? 'var(--moss-sage)' : 'var(--clay-terracotta)',
                      }}>
                        {p.stock > 5 ? 'In stock' : p.stock > 0 ? `Only ${p.stock} left` : 'Out of stock'}
                      </span>
                    </div>

                    <h4
                      onClick={() => setSelectedProduct(p)}
                      style={{
                        fontSize: '0.98rem',
                        fontWeight: 700,
                        color: 'var(--moss-deep)',
                        cursor: 'pointer',
                        lineHeight: 1.35,
                      }}
                    >
                      {p.name}
                    </h4>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      ★ {p.rating ? p.rating.toFixed(1) : '4.8'} · {p.review_count || 42} reviews
                    </div>
                  </div>

                  {/* Pricing and Action Buttons */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 'auto',
                    paddingTop: 8,
                    gap: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                        ₹{inrPrice.toLocaleString('en-IN')}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        ₹{mrpPrice.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => onAskInChat && onAskInChat(`Tell me about ${p.name} and reviews`)}
                        className="touch-target"
                        aria-label={`Ask AI concierge about ${p.name}`}
                        title="Ask AI concierge"
                        style={{
                          background: 'var(--bg-card-muted)',
                          border: '1px solid var(--moss-border)',
                          borderRadius: 'var(--radius-full)',
                          color: 'var(--moss-deep)',
                          padding: '8px 12px',
                          cursor: 'pointer',
                        }}
                      >
                        <MessageSquare size={15} />
                      </button>

                      <button
                        onClick={() => onAddToCart(p)}
                        className="touch-target"
                        aria-label={`Add ${p.name} to cart`}
                        disabled={p.stock <= 0}
                        style={{
                          background: p.stock > 0 ? 'var(--moss-deep)' : 'var(--text-muted)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '8px 20px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          cursor: p.stock > 0 ? 'pointer' : 'not-allowed',
                          transition: 'background 0.2s',
                        }}
                      >
                        {p.stock > 0 ? 'Add' : 'Sold out'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Accessible Pagination Bar */}
        {!loading && totalPages > 1 && (
          <nav
            aria-label="Pantry catalog pages"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 16,
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="touch-target"
              aria-label="Go to previous page"
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--moss-border)',
                background: '#ffffff',
                color: currentPage === 1 ? 'var(--text-muted)' : 'var(--moss-deep)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ChevronLeft size={16} /> Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className="touch-target"
                aria-current={currentPage === page ? 'page' : undefined}
                aria-label={`Page ${page}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-full)',
                  border: currentPage === page ? '1px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                  background: currentPage === page ? 'var(--moss-deep)' : '#ffffff',
                  color: currentPage === page ? '#ffffff' : 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="touch-target"
              aria-label="Go to next page"
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--moss-border)',
                background: '#ffffff',
                color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--moss-deep)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Next <ChevronRight size={16} />
            </button>
          </nav>
        )}
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
              quote: "The cold-pressed mustard and sesame oils taste exactly like traditional stone mills. Zero pesticides, clean glass packaging. Trovi has become our daily pantry default.",
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
          SECTION 9: JOIN THE TROVI CIRCLE (Exact Page 2 of PDF Wireframe)
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
          Join the {BRAND.name} circle
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
            ✓ Welcome to the {BRAND.name} circle! 15% discount code applied.
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
        </>
      )}
    </div>
  );
}
