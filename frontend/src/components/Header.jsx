import React, { useState } from 'react';
import { Search, MapPin, Heart, ShoppingBag, Package, User, ChevronDown, Sparkles } from 'lucide-react';

const CATEGORIES_NAV = [
  { id: 'all', label: 'All Collection' },
  { id: 'daily-essentials', label: 'Daily Essentials' },
  { id: 'luxury', label: 'Luxury Collection' },
  { id: 'fruits-vegetables', label: 'Fresh Produce' },
  { id: 'honey', label: 'Pure Honey' },
  { id: 'grains', label: 'Grains & Oats' },
  { id: 'oil', label: 'Cold-Pressed Oils' },
  { id: 'nuts', label: 'Raw Nuts' },
  { id: 'offers', label: 'Offers' },
  { id: 'concierge', label: 'AI Concierge' },
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
  pinCode = '560034',
  onChangePin,
  wishlistCount = 0,
}) {
  const [showPinModal, setShowPinModal] = useState(false);
  const [tempPin, setTempPin] = useState(pinCode);
  const [selectedSearchCat, setSelectedSearchCat] = useState('All');

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (tempPin.trim()) {
      if (onChangePin) onChangePin(tempPin.trim());
      setShowPinModal(false);
    }
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
      {/* 1. Top Announcement Strip (Exact PDF Wireframe) */}
      <div style={{
        background: 'var(--moss-banner)',
        color: '#f8f7f4',
        fontSize: '0.78rem',
        fontWeight: 500,
        padding: '7px 20px',
        textAlign: 'center',
        letterSpacing: '0.02em',
      }}>
        Spring Collection 2026 · Free delivery above ₹499 · UPI, cards & COD
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
        {/* Left: Brand Logo & Delivery PIN */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Logo: ● MOSS */}
          <div
            onClick={() => setActiveTab('catalog')}
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
              letterSpacing: '0.12em',
              color: 'var(--moss-deep)',
            }}>
              MOSS
            </span>
          </div>

          {/* Deliver to PIN */}
          <button
            onClick={() => setShowPinModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              transition: 'background 0.2s',
            }}
            title="Click to change delivery PIN code"
          >
            <MapPin size={15} color="var(--moss-sage)" />
            <span>Deliver to <strong style={{ color: 'var(--text-primary)' }}>[{pinCode}]</strong></span>
          </button>
        </div>

        {/* Center: Search Bar with Category Dropdown */}
        <div style={{
          flex: '1 1 420px',
          maxWidth: 620,
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--moss-border)',
          padding: '3px 4px 3px 14px',
          transition: 'all 0.2s',
        }}>
          {/* Category Dropdown */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            paddingRight: 12,
            borderRight: '1px solid var(--moss-border)',
            cursor: 'pointer',
          }}>
            <span>{selectedSearchCat}</span>
            <ChevronDown size={13} />
          </div>

          {/* Search Input */}
          <input
            type="text"
            placeholder="Search organic honey, oats, milk, cold-pressed oil, matcha"
            value={searchQuery || ''}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
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

          {/* Dark Search Button */}
          <button
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
            onClick={() => setActiveTab('catalog')}
          >
            <Search size={16} />
          </button>
        </div>

        {/* Right: Orders, Account, Wishlist & Bag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Package size={15} />
            <span>Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <User size={15} />
            <span>Account</span>
          </button>

          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
            }}
            title="Wishlist"
          >
            <Heart size={19} />
            {wishlistCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -2,
                right: -2,
                background: 'var(--clay-terracotta)',
                color: '#fff',
                fontSize: '0.65rem',
                width: 15,
                height: 15,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
              }}>
                {wishlistCount}
              </span>
            )}
          </button>

          {/* Bag · 0 Button (Exact Wireframe) */}
          <button
            onClick={openCart}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 20px',
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

      {/* 3. Category Navigation Sub-Bar (Exact PDF Wireframe) */}
      <nav style={{
        borderTop: '1px solid var(--moss-border)',
        padding: '8px 24px',
        maxWidth: 1380,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {CATEGORIES_NAV.map((cat) => {
          const isActive = (selectedCategory === cat.id) || (cat.id === 'all' && (!selectedCategory || selectedCategory === 'all'));
          return (
            <button
              key={cat.id}
              onClick={() => {
                if (cat.id === 'concierge') {
                  setActiveTab('chat');
                } else {
                  setActiveTab('catalog');
                  if (onSelectCategory) onSelectCategory(cat.id);
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--moss-deep)' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--moss-deep)' : '2px solid transparent',
                paddingBottom: 4,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </nav>

      {/* PIN Code Modal */}
      {showPinModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <form
            onSubmit={handlePinSubmit}
            style={{
              background: '#ffffff',
              padding: 24,
              borderRadius: 'var(--radius-lg)',
              maxWidth: 360,
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h4 style={{ color: 'var(--moss-deep)', fontSize: '1.1rem' }}>Enter Delivery PIN Code</h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Check delivery speed and eco-fleet availability for your location.
            </p>
            <input
              type="text"
              value={tempPin}
              onChange={(e) => setTempPin(e.target.value)}
              placeholder="e.g. 560034"
              maxLength={6}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--moss-border)',
                fontSize: '1rem',
                fontWeight: 700,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
              >
                Save Location
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
