import React from 'react';
import { Sparkles, MessageSquare, Camera, ShoppingBag, Package, ShoppingCart, Leaf } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, cartCount, openCart, currency, setCurrency }) {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(247, 246, 242, 0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--moss-border)',
      transition: 'all 0.25s ease',
    }}>
      {/* Top Editorial Announcement Bar */}
      <div style={{
        background: 'var(--moss-deep)',
        color: '#f7f6f2',
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        padding: '7px 20px',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}>
        <span>🌿 Spring Collection 2026</span>
        <span>•</span>
        <span>77 Certified Pure Essentials</span>
        <span>•</span>
        <span>Instant 1-Command Autonomous AI Checkout</span>
      </div>

      <div style={{
        maxWidth: 1360,
        margin: '0 auto',
        padding: '16px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        {/* MOSS Signature Brand Logo (Orix Creative Dribbble Aesthetic) */}
        <div
          onClick={() => setActiveTab('catalog')}
          style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
        >
          {/* Rounded Square Emblem with Offset Dot */}
          <div style={{
            width: 42,
            height: 42,
            borderRadius: '12px',
            background: 'var(--moss-deep)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: '0 4px 14px rgba(27, 42, 32, 0.16)',
          }}>
            {/* Minimalist offset dot symbol matching Orix Creative's brandmark */}
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#ffffff',
              transform: 'translate(4px, -4px)',
            }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.45rem',
                fontWeight: 800,
                letterSpacing: '0.2em',
                color: 'var(--moss-deep)',
                textTransform: 'uppercase',
              }}>
                MOSS
              </span>
              <span style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                color: 'var(--moss-sage)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'var(--moss-tint)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--moss-border)',
              }}>
                AI Living
              </span>
            </div>
            <p style={{
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.02em',
              fontWeight: 500,
            }}>
              Mindful Essentials & Autonomous Concierge
            </p>
          </div>
        </div>

        {/* Minimalist Navigation Pills */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.85)',
          padding: 5,
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--moss-border)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <button
            className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <ShoppingBag size={15} />
            <span>Collection</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={15} />
            <span>AI Concierge</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'vision' ? 'active' : ''}`}
            onClick={() => setActiveTab('vision')}
          >
            <Camera size={15} />
            <span>Visual Lens</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <Package size={15} />
            <span>Orders</span>
          </button>
        </nav>

        {/* Right Actions: Currency & Shopping Bag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Active Status Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontSize: '0.74rem',
            color: 'var(--moss-deep)',
            background: 'var(--moss-tint)',
            padding: '7px 14px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--moss-border)',
            fontWeight: 600,
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--moss-sage)',
              boxShadow: '0 0 8px var(--moss-sage)',
            }} />
            <span>Ready to Order</span>
          </div>

          {/* Currency Switcher */}
          <button
            onClick={() => setCurrency(currency === 'USD' ? 'INR' : 'USD')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '8px 14px',
              borderRadius: 'var(--radius-full)',
              background: '#ffffff',
              border: '1px solid var(--moss-border)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--shadow-sm)',
            }}
            title="Switch Currency between USD and INR"
          >
            <span style={{ color: 'var(--moss-sage)' }}>{currency === 'USD' ? '$' : '₹'}</span>
            <span>{currency}</span>
          </button>

          {/* Luxury Bag Button */}
          <button
            onClick={openCart}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--moss-deep)',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              boxShadow: 'var(--shadow-moss)',
              fontWeight: 600,
              fontSize: '0.86rem',
            }}
            title="Open Shopping Bag"
          >
            <ShoppingCart size={17} />
            <span>Bag</span>
            <span style={{
              background: '#ffffff',
              color: 'var(--moss-deep)',
              fontSize: '0.72rem',
              fontWeight: 800,
              minWidth: 20,
              height: 20,
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 6px',
            }}>
              {cartCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
