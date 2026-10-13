import React, { useState, useRef, useEffect } from 'react';
import {
  Search, MapPin, Heart, ShoppingBag, Package, User, ChevronDown,
  Sparkles, BarChart3, Camera, Check, Upload, ArrowRight, Zap, Leaf, Truck, Shield
} from 'lucide-react';
import { lookupPincode } from '../utils/deliveryEngine';
import { BRAND } from '../config/brand';

const MEGA_DEPARTMENTS = [
  {
    id: 'grocery',
    name: 'Grocery & Gourmet',
    icon: '🛒',
    desc: 'Artisan pantry, farm-fresh produce, and MOSS Organics',
    subcategories: [
      { id: 'honey', label: 'Honey & Spreads' },
      { id: 'oats', label: 'Oats & Cereals' },
      { id: 'oil', label: 'Cold-Pressed Oils' },
      { id: 'nuts', label: 'Nuts & Dry Fruits' },
      { id: 'grains', label: 'Grains & Rice' },
      { id: 'tea', label: 'Teas & Infusions' },
      { id: 'fruits-vegetables', label: 'Fresh Produce' },
      { id: 'daily-essentials', label: 'Daily Essentials' },
    ],
    collection: { id: 'grocery', label: 'MOSS Organics Collection 🌿' },
  },
  {
    id: 'fashion',
    name: 'Fashion & Apparel',
    icon: '👕',
    desc: 'Pure linen, organic cotton basics, comfort innerwear',
    subcategories: [
      { id: 'clothing', label: 'Clothing & Outerwear' },
      { id: 'apparel', label: 'Apparel & Basics' },
      { id: 'innerwear', label: 'Innerwear & Loungewear' },
    ],
  },
  {
    id: 'electronics',
    name: 'Electronics',
    icon: '🎧',
    desc: 'Noise-cancelling audio, wireless headphones, smart devices',
    subcategories: [
      { id: 'audio', label: 'Audio & Hi-Fi' },
      { id: 'headphones', label: 'Headphones' },
      { id: 'gadgets', label: 'Smart Wearables' },
    ],
  },
  {
    id: 'laptops',
    name: 'Laptops & Computing',
    icon: '💻',
    desc: 'High-performance ultrabooks, workstations, student notebooks',
    subcategories: [
      { id: 'ultrabooks', label: 'Developer Ultrabooks' },
      { id: 'workstations', label: 'Power Workstations' },
      { id: 'student-laptops', label: 'Student Notebooks' },
    ],
  },
  {
    id: 'home-kitchen',
    name: 'Home & Kitchen',
    icon: '🍳',
    desc: 'Cookware, appliances, eco home & cleaning',
    subcategories: [
      { id: 'kitchen-appliances', label: 'Kitchen Appliances' },
      { id: 'cookware', label: 'Cookware & Dining' },
      { id: 'household', label: 'Household & Cleaning' },
    ],
  },
  {
    id: 'personal-care',
    name: 'Personal Care',
    icon: '✨',
    desc: 'Botanical haircare, mineral skincare, multi-grooming',
    subcategories: [
      { id: 'haircare', label: 'Haircare & Scalp' },
      { id: 'skincare', label: 'Skincare & Sunscreen' },
      { id: 'grooming', label: 'Grooming & Trimmers' },
    ],
  },
  {
    id: 'luxury',
    name: 'Luxury & Premium',
    icon: '👑',
    desc: 'Haute horlogerie, titanium flagship smartphones, niche perfumes',
    subcategories: [
      { id: 'luxury-smartphones', label: 'Luxury Smartphones' },
      { id: 'luxury-computing', label: 'Luxury Computing' },
      { id: 'haute-horlogerie', label: 'Haute Horlogerie' },
      { id: 'niche-fragrance', label: 'Niche Fragrance' },
    ],
  },
];

const CATEGORIES_NAV = [
  { id: 'mega', label: '☰ All Departments', isMega: true },
  { id: 'all', label: 'All Catalog' },
  { id: 'grocery', label: '🛒 Grocery' },
  { id: 'fashion', label: '👕 Fashion' },
  { id: 'electronics', label: '🎧 Electronics' },
  { id: 'laptops', label: '💻 Laptops' },
  { id: 'home-kitchen', label: '🍳 Home & Kitchen' },
  { id: 'personal-care', label: '✨ Personal Care' },
  { id: 'luxury', label: '👑 Luxury' },
  { id: 'honey', label: '🌿 MOSS Organics' },
  { id: 'policies', label: '📜 Store Policies' },
  { id: 'concierge', label: BRAND.chatButtonLabel },
];

const SEARCH_CATEGORIES = [
  { id: 'all', label: 'All Departments' },
  { id: 'grocery', label: 'Grocery' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'laptops', label: 'Laptops' },
  { id: 'home-kitchen', label: 'Home & Kitchen' },
  { id: 'personal-care', label: 'Personal Care' },
  { id: 'luxury', label: 'Luxury' },
];

const POPULAR_METROS = [
  { city: 'Bengaluru', pin: '560034', speed: '⚡ 4-Hr Express (HQ)' },
  { city: 'New Delhi', pin: '110001', speed: '🌱 Next-Day Morning' },
  { city: 'Mumbai', pin: '400001', speed: '🌱 Next-Day Morning' },
  { city: 'Hyderabad', pin: '500034', speed: '⚡ Express Delivery' },
  { city: 'Pune', pin: '411001', speed: '🌱 Next-Day Morning' },
  { city: 'Chennai', pin: '600017', speed: '🌱 Next-Day Morning' },
];

export default function Header({
  activeTab,
  setActiveTab,
  cartCount,
  openCart,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  pinCode = '560034',
  onChangePin,
  wishlistCount = 0,
  onOpenWishlist,
  onOpenProfile,
  currentUser = null,
  onOpenAuthModal,
  onLogout,
  onOpenAdmin,
  onOpenOrders,
}) {
  const [showPinModal, setShowPinModal] = useState(false);
  const [tempPin, setTempPin] = useState(pinCode);
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [selectedSearchCat, setSelectedSearchCat] = useState('All');
  const [showVisualQuickLens, setShowVisualQuickLens] = useState(false);
  const [showMegaMenu, setShowMegaMenu] = useState(false);

  const catDropdownRef = useRef(null);
  const quickLensRef = useRef(null);
  const megaMenuRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (catDropdownRef.current && !catDropdownRef.current.contains(event.target)) {
        setIsCatDropdownOpen(false);
      }
      if (quickLensRef.current && !quickLensRef.current.contains(event.target)) {
        setShowVisualQuickLens(false);
      }
      if (megaMenuRef.current && !megaMenuRef.current.contains(event.target)) {
        setShowMegaMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentPinInfo = lookupPincode(pinCode);
  const tempPinInfo = lookupPincode(tempPin);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setActiveTab('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (onSearchSubmit) {
      onSearchSubmit(searchQuery);
    }
  };

  const handleSelectSearchCategory = (cat) => {
    setSelectedSearchCat(cat.label);
    setIsCatDropdownOpen(false);
    if (onSelectCategory) {
      onSelectCategory(cat.id);
    }
    setActiveTab('catalog');
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (tempPinInfo.valid) {
      if (onChangePin) onChangePin(tempPin.trim());
      setShowPinModal(false);
    }
  };

  const handleQuickMetroSelect = (metroPin) => {
    setTempPin(metroPin);
    if (onChangePin) onChangePin(metroPin);
    setShowPinModal(false);
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: '#ffffff',
      borderBottom: '1px solid var(--moss-border)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
    }}>
      {/* 1. Top Announcement Strip with Delivery Perks */}
      <div style={{
        background: 'var(--moss-deep)',
        color: '#f8f7f4',
        fontSize: '0.78rem',
        fontWeight: 500,
        padding: '7px 20px',
        textAlign: 'center',
        letterSpacing: '0.02em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span>🎯 {BRAND.tagline}</span>
        <span>•</span>
        <span>{BRAND.taglineEn}</span>
        <span>•</span>
        <span>Free Delivery above ₹499</span>
        <span>•</span>
        <span>📍 Delivering to <strong>{currentPinInfo.city ? `${currentPinInfo.city} ${pinCode}` : `PIN ${pinCode}`}</strong></span>
      </div>

      {/* 2. Main Navigation Bar */}
      <div style={{
        maxWidth: 1380,
        margin: '0 auto',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        flexWrap: 'wrap',
      }}>
        {/* Left: Brand Logo & Genuine Delivery PIN */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Logo: ● MOSS */}
          <div
            onClick={() => {
              setActiveTab('catalog');
              if (onSelectCategory) onSelectCategory('all');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'var(--moss-deep)',
            }} />
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.5rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: 'var(--moss-deep)',
            }}>
              {BRAND.name}
            </span>
          </div>

          {/* Genuine Deliver to PIN Button */}
          <button
            onClick={() => {
              setTempPin(pinCode);
              setShowPinModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'var(--bg-card-muted)',
              border: '1px solid var(--moss-border)',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              transition: 'all 0.2s',
            }}
            title="Click to check genuine Indian delivery speed and location"
          >
            <MapPin size={15} color="var(--moss-deep)" />
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Deliver to:</div>
              <strong style={{ color: 'var(--moss-deep)', fontSize: '0.82rem' }}>
                {currentPinInfo.city ? `${currentPinInfo.city} ${pinCode}` : `PIN ${pinCode}`}
              </strong>
            </div>
            <ChevronDown size={12} color="var(--text-muted)" style={{ marginLeft: 2 }} />
          </button>
        </div>

        {/* Center: Search Bar with Active Category & Visual Camera Lens */}
        <div style={{ flex: '1 1 420px', maxWidth: 640, position: 'relative' }}>
          <form
            onSubmit={handleSearchSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--moss-border)',
              padding: '3px 4px 3px 12px',
              transition: 'all 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            {/* Interactive Category Dropdown inside Search Bar */}
            <div ref={catDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  paddingRight: 10,
                  borderRight: '1px solid var(--moss-border)',
                  background: 'transparent',
                  borderTop: 'none',
                  borderBottom: 'none',
                  borderLeft: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{selectedSearchCat}</span>
                <ChevronDown size={13} color="var(--moss-sage)" />
              </button>

              {isCatDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  background: '#ffffff',
                  border: '1px solid var(--moss-border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  width: 170,
                  zIndex: 100,
                  overflow: 'hidden',
                  padding: 4,
                }}>
                  {SEARCH_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectSearchCategory(cat)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '7px 10px',
                        background: selectedSearchCat === cat.label ? 'var(--moss-tint)' : 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: '0.8rem',
                        fontWeight: selectedSearchCat === cat.label ? 700 : 500,
                        color: 'var(--moss-deep)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{cat.label}</span>
                      {selectedSearchCat === cat.label && <Check size={12} color="var(--moss-deep)" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search groceries, fashion, laptops, electronics, home & luxury..."
              value={searchQuery || ''}
              onChange={(e) => {
                if (onSearchChange) onSearchChange(e.target.value);
                if (activeTab !== 'catalog' && e.target.value) {
                  setActiveTab('catalog');
                }
              }}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                padding: '8px 12px',
                fontSize: '0.84rem',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'var(--font-body)',
              }}
            />

            {/* Visual Lens Camera Button in Search Bar */}
            <div ref={quickLensRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('vision');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: activeTab === 'vision' ? 'var(--moss-deep)' : 'transparent',
                  border: activeTab === 'vision' ? '1px solid var(--moss-deep)' : '1px solid transparent',
                  color: activeTab === 'vision' ? '#ffffff' : 'var(--moss-deep)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginRight: 2,
                  transition: 'all 0.2s',
                }}
                title="📸 Visual Lens: Search by uploading a product photo or screenshot"
              >
                <Camera size={17} />
              </button>
            </div>

            {/* Search Submit Button */}
            <button
              type="submit"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--moss-deep)',
                border: 'none',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              title="Search products"
            >
              <Search size={16} />
            </button>
          </form>
        </div>

        {/* Right: Visual Lens Tab, Admin, Orders, Profile, Wishlist & Bag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Visual Search Lens Button */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('vision');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{
              background: activeTab === 'vision' ? 'var(--moss-deep)' : 'rgba(28, 48, 36, 0.06)',
              border: activeTab === 'vision' ? '1px solid var(--moss-deep)' : '1px solid var(--moss-border)',
              borderRadius: 'var(--radius-full)',
              color: activeTab === 'vision' ? '#ffffff' : 'var(--moss-deep)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              transition: 'all 0.2s',
            }}
            title="Multimodal Visual Lens: Search store by photo"
          >
            <Camera size={14} color={activeTab === 'vision' ? '#ffffff' : 'var(--moss-deep)'} />
            <span>Visual Lens</span>
          </button>

          {/* Admin Dashboard - only shown if user is authenticated admin */}
          {currentUser?.role === 'admin' && (
            <button
              type="button"
              onClick={onOpenAdmin}
              style={{
                background: 'rgba(28, 48, 36, 0.06)',
                border: '1px solid var(--moss-border)',
                borderRadius: 'var(--radius-full)',
                color: 'var(--moss-deep)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                transition: 'background 0.2s',
              }}
              title="Enterprise Operations & Inventory Console"
            >
              <BarChart3 size={13} color="var(--moss-deep)" />
              <span>Admin</span>
            </button>
          )}

          {/* Placed Orders */}
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                if (onOpenAuthModal) onOpenAuthModal({ returnTo: 'orders' });
              } else {
                if (onOpenOrders) onOpenOrders();
                else setActiveTab('orders');
              }
            }}
            style={{
              background: activeTab === 'orders' ? 'rgba(28, 48, 36, 0.08)' : 'transparent',
              border: activeTab === 'orders' ? '1px solid var(--moss-border)' : 'none',
              borderRadius: 'var(--radius-full)',
              color: activeTab === 'orders' ? 'var(--moss-deep)' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: activeTab === 'orders' ? '5px 12px' : '4px 6px',
              transition: 'all 0.2s',
            }}
            title="View placed orders, track live delivery, return or refund"
          >
            <Package size={15} color={activeTab === 'orders' ? 'var(--moss-deep)' : 'currentColor'} />
            <span>Orders</span>
          </button>

          {/* Profile / Account: STRICT MUTUAL EXCLUSION (Never show both) */}
          {currentUser ? (
            <div id="header-user-menu" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                id="header-user-name"
                type="button"
                onClick={() => {
                  if (onOpenProfile) onOpenProfile();
                  else setActiveTab('profile');
                }}
                style={{
                  background: activeTab === 'profile' ? 'var(--moss-deep)' : 'var(--bg-card-muted)',
                  border: '1px solid var(--moss-border)',
                  color: activeTab === 'profile' ? '#ffffff' : 'var(--moss-deep)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  transition: 'all 0.2s',
                }}
                title={`Signed in as ${currentUser?.email || 'Customer'}`}
              >
                <User size={13} color={activeTab === 'profile' ? '#ffffff' : 'var(--moss-deep)'} />
                <span>{currentUser?.full_name || (currentUser?.email ? currentUser.email.split('@')[0] : 'Shopper')}</span>
              </button>
              {currentUser?.role === 'admin' && (
                <button
                  id="header-admin-portal-btn"
                  type="button"
                  onClick={onOpenAdmin}
                  style={{
                    background: 'linear-gradient(135deg, #1b2a20 0%, #2e4a36 100%)',
                    border: '1px solid #10b981',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-full)',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                  }}
                  title="Open Enterprise Operations & Admin Dashboard"
                >
                  <Shield size={12} color="#10b981" />
                  <span>Admin Console</span>
                </button>
              )}
              <button
                id="header-orders-menu-btn"
                type="button"
                onClick={() => {
                  if (onOpenOrders) onOpenOrders();
                  else setActiveTab('orders');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 6px',
                }}
                title="My Orders"
              >
                Orders
              </button>
              <button
                id="header-sign-out-btn"
                type="button"
                onClick={onLogout}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--clay-terracotta)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 6px',
                }}
                title="Sign Out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                id="header-sign-in-btn"
                type="button"
                onClick={() => {
                  if (onOpenAuthModal) onOpenAuthModal({ message: "Sign in to place your order", returnTo: 'profile' });
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--moss-border)',
                  color: 'var(--moss-deep)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  transition: 'all 0.2s',
                }}
                title={`Sign In to your ${BRAND.name} account`}
              >
                <User size={14} color="var(--moss-deep)" />
                <span>Sign In</span>
              </button>
              <button
                id="header-admin-login-btn"
                type="button"
                onClick={onOpenAdmin}
                style={{
                  background: 'var(--bg-card-muted)',
                  border: '1px solid var(--moss-border)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-full)',
                }}
                title="Administrator Login Portal"
              >
                <Shield size={12} color="var(--moss-deep)" />
                <span>Admin</span>
              </button>
            </div>
          )}

          {/* Wishlist Icon */}
          <button
            type="button"
            onClick={() => {
              if (onOpenWishlist) onOpenWishlist();
              else setActiveTab('profile');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              borderRadius: 'var(--radius-sm)',
            }}
            title="Wishlist & Saved Products"
          >
            <Heart
              size={20}
              color={wishlistCount > 0 ? 'var(--clay-terracotta)' : 'var(--text-secondary)'}
              fill={wishlistCount > 0 ? 'var(--clay-terracotta)' : 'none'}
            />
            {wishlistCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -1,
                right: -2,
                background: 'var(--clay-terracotta)',
                color: '#fff',
                fontSize: '0.65rem',
                width: 16,
                height: 16,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
              }}>
                {wishlistCount}
              </span>
            )}
          </button>

          {/* Bag Button */}
          <button
            type="button"
            onClick={openCart}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--moss-deep)',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.88rem',
              boxShadow: '0 4px 12px rgba(28, 48, 36, 0.2)',
              transition: 'transform 0.2s',
            }}
          >
            <ShoppingBag size={15} />
            <span>Bag · {cartCount || 0}</span>
          </button>
        </div>
      </div>

      {/* 3. Category Navigation Sub-Bar & Mega Menu Trigger */}
      <div style={{ position: 'relative' }} ref={megaMenuRef}>
        <nav style={{
          borderTop: '1px solid var(--moss-border)',
          padding: '8px 24px',
          maxWidth: 1380,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {CATEGORIES_NAV.map((cat) => {
            const isMega = cat.isMega;
            const isActive = isMega ? showMegaMenu : (
              (activeTab === 'policies' && cat.id === 'policies') ||
              (activeTab === 'vision' && cat.id === 'vision') ||
              (activeTab === 'catalog' && ((selectedCategory === cat.id) || (cat.id === 'all' && (!selectedCategory || selectedCategory === 'all'))))
            );
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  if (isMega) {
                    setShowMegaMenu(!showMegaMenu);
                    return;
                  }
                  setShowMegaMenu(false);
                  if (cat.id === 'policies') {
                    setActiveTab('policies');
                    window.history.pushState({}, '', '/policies');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else if (cat.id === 'concierge') {
                    setActiveTab('chat');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else if (cat.id === 'vision') {
                    setActiveTab('vision');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    setActiveTab('catalog');
                    if (onSelectCategory) onSelectCategory(cat.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                style={{
                  background: isMega ? (showMegaMenu ? 'var(--moss-deep)' : 'var(--moss-tint)') : 'transparent',
                  border: isMega ? '1px solid var(--moss-border)' : 'none',
                  borderRadius: isMega ? 'var(--radius-full)' : 0,
                  padding: isMega ? '4px 12px' : '4px 2px',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: isActive || isMega ? 700 : 500,
                  color: isMega ? (showMegaMenu ? '#ffffff' : 'var(--moss-deep)') : (isActive ? 'var(--moss-deep)' : 'var(--text-secondary)'),
                  borderBottom: !isMega && isActive ? '2px solid var(--moss-deep)' : (!isMega ? '2px solid transparent' : '1px solid var(--moss-border)'),
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{cat.label}</span>
                {isMega && <ChevronDown size={13} style={{ transform: showMegaMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
              </button>
            );
          })}
        </nav>

        {/* Mega Menu Dropdown Panel */}
        {showMegaMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#ffffff',
            borderBottom: '2px solid var(--moss-border)',
            boxShadow: '0 16px 40px rgba(20, 32, 23, 0.12)',
            zIndex: 1000,
            padding: '24px 32px 32px',
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <div style={{ maxWidth: 1380, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--moss-border)' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--moss-deep)', margin: 0 }}>
                    {BRAND.name} Departments & Collections
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                    Browse all verified departments, electronics, fashion, laptops, pantry essentials, and luxury craftsmanship
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMegaMenu(false)}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                  }}
                  title="Close Mega Menu"
                >
                  <X size={15} />
                </button>
              </div>

              {/* 7 Department Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 20,
              }}>
                {MEGA_DEPARTMENTS.map((dept) => (
                  <div
                    key={dept.id}
                    style={{
                      background: 'var(--bg-card-muted)',
                      border: '1px solid var(--moss-border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <div
                      onClick={() => {
                        setShowMegaMenu(false);
                        setActiveTab('catalog');
                        if (onSelectCategory) onSelectCategory(dept.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        paddingBottom: 6,
                        borderBottom: '1px solid rgba(0,0,0,0.06)',
                      }}
                    >
                      <span style={{ fontSize: '1.4rem' }}>{dept.icon}</span>
                      <div>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--moss-deep)', display: 'block' }}>
                          {dept.name}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {dept.desc}
                        </span>
                      </div>
                    </div>

                    {/* Subcategories list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {dept.subcategories.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setShowMegaMenu(false);
                            setActiveTab('catalog');
                            if (onSelectCategory) onSelectCategory(sub.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            textAlign: 'left',
                            padding: '3px 0',
                            fontSize: '0.8rem',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--moss-forest)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                        >
                          <span style={{ color: 'var(--moss-sage)', fontSize: '0.7rem' }}>•</span>
                          <span>{sub.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Sub-brand highlight if applicable */}
                    {dept.collection && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMegaMenu(false);
                          setActiveTab('catalog');
                          if (onSelectCategory) onSelectCategory(dept.collection.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{
                          marginTop: 'auto',
                          background: 'var(--moss-tint)',
                          border: '1px solid var(--moss-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '6px 10px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: 'var(--moss-deep)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {dept.collection.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Genuine Indian Postal Delivery PIN Modal */}
      {showPinModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(20, 32, 23, 0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
        }}>
          <form
            onSubmit={handlePinSubmit}
            style={{
              background: '#ffffff',
              padding: 26,
              borderRadius: 'var(--radius-lg)',
              maxWidth: 440,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--moss-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={20} color="var(--moss-deep)" />
                <h4 style={{ color: 'var(--moss-deep)', fontSize: '1.15rem', fontWeight: 800 }}>
                  Enter Delivery PIN Code
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Check live serviceability, 4-hour express availability, and temperature-controlled cold fleet dispatch for your location.
            </p>

            <div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={tempPin}
                  onChange={(e) => setTempPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="e.g. 560034"
                  maxLength={6}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '11px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--moss-border)',
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    outline: 'none',
                    letterSpacing: '0.1em',
                    color: 'var(--moss-deep)',
                  }}
                />
                <button
                  type="submit"
                  disabled={!tempPinInfo.valid}
                  className="btn-primary"
                  style={{
                    padding: '11px 20px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    opacity: tempPinInfo.valid ? 1 : 0.5,
                  }}
                >
                  Save PIN
                </button>
              </div>

              {/* Live Serviceability Feedback */}
              {tempPin.length === 6 && (
                <div style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  background: tempPinInfo.valid ? 'var(--moss-tint)' : '#fef2f2',
                  border: tempPinInfo.valid ? '1px solid var(--moss-border)' : '1px solid #fecaca',
                  borderRadius: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  {tempPinInfo.valid ? (
                    <>
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--moss-deep)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Check size={14} color="var(--moss-forest)" />
                        <span>Serviceable in {tempPinInfo.city}, {tempPinInfo.state}</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {tempPinInfo.area} · {tempPinInfo.estimatedDeliveryText}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: '#b91c1c' }}>
                      {tempPinInfo.message}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Metro Selector */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                Popular Express Fulfillment Hubs:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {POPULAR_METROS.map((metro) => (
                  <button
                    key={metro.pin}
                    type="button"
                    onClick={() => handleQuickMetroSelect(metro.pin)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: pinCode === metro.pin ? 'var(--moss-tint)' : 'var(--bg-card-muted)',
                      border: pinCode === metro.pin ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                      {metro.city} [{metro.pin}]
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--moss-sage)' }}>
                      {metro.speed}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 8,
              borderTop: '1px solid var(--moss-border)',
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
            }}>
              <span>🌱 Verified Partner Delivery</span>
              <span>⚡ Fast & Reliable Service</span>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
