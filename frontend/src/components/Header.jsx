import React from 'react';
import { Sparkles, MessageSquare, Camera, ShoppingBag, Package, ShoppingCart } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, cartCount, openCart, currency, setCurrency }) {
  return (
    <header style={{
      borderBottom: '1px solid var(--border-mint)',
      background: 'rgba(4, 7, 13, 0.88)',
      backdropFilter: 'blur(22px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '14px 28px',
    }}>
      <div style={{
        maxWidth: 1300,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: 'var(--mint-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px var(--mint-glow)',
          }}>
            <Sparkles size={24} color="#04070d" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.5rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                background: 'linear-gradient(135deg, #ffffff 40%, var(--mint-primary) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                ShopAI
              </span>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(0, 242, 254, 0.15)',
                color: 'var(--mint-cyan)',
                border: '1px solid var(--border-mint)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                V3 Agentic
              </span>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Autonomous Multi-Category Shopping Agent
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(10, 16, 29, 0.7)',
          padding: 5,
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border-mint)',
        }}>
          <button
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={16} />
            <span>AI Chat Agent</span>
          </button>
          
          <button
            className={`tab-btn ${activeTab === 'vision' ? 'active' : ''}`}
            onClick={() => setActiveTab('vision')}
          >
            <Camera size={16} />
            <span>Visual Search</span>
          </button>
          
          <button
            className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <ShoppingBag size={16} />
            <span>Multi-Category Store</span>
          </button>
          
          <button
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <Package size={16} />
            <span>My Orders</span>
          </button>
        </nav>

        {/* Right actions: Online status & Cart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.75rem',
            color: 'var(--mint-light)',
            background: 'rgba(0, 242, 254, 0.08)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-mint)',
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--mint-primary)',
              boxShadow: '0 0 10px var(--mint-primary)',
            }} />
            <span style={{ fontWeight: 600 }}>Active Agent Core</span>
          </div>

          {/* Currency Toggle */}
          <button
            onClick={() => setCurrency(currency === 'USD' ? 'INR' : 'USD')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 13px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Switch Currency between USD and INR"
          >
            <span style={{ color: 'var(--mint-cyan)' }}>{currency === 'USD' ? '$' : '₹'}</span>
            <span>{currency}</span>
          </button>

          {/* Cart Icon */}
          <button
            onClick={openCart}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 242, 254, 0.08)',
              border: '1px solid var(--border-mint)',
              color: 'var(--mint-light)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="View Shopping Cart"
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: 'var(--mint-primary)',
                color: '#04070d',
                fontSize: '0.72rem',
                fontWeight: 800,
                width: 19,
                height: 19,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px var(--mint-glow)',
              }}>
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
