import React, { useState } from 'react';
import Header from './components/Header';
import AIChat from './components/AIChat';
import ImageSearch from './components/ImageSearch';
import Catalog from './components/Catalog';
import CartOrdersDrawer from './components/CartOrdersDrawer';
import { CheckCircle2, ShoppingCart, ShieldCheck, Database, Sparkles, Heart, Leaf } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('catalog'); // Start on 'catalog' for rich editorial experience
  const [cartItems, setCartItems] = useState([]);
  const [currency, setCurrency] = useState('INR'); // Default to Indian Rupees 'INR'
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState('cart');
  const [toastMessage, setToastMessage] = useState(null);

  // Currency Formatter
  const formatPrice = (usdAmount, inrAmount) => {
    if (inrAmount) {
      return `₹${inrAmount.toLocaleString('en-IN')}`;
    }
    const val = typeof usdAmount === 'number' ? usdAmount : parseFloat(usdAmount) || 0;
    if (currency === 'INR') {
      const inr = Math.round(val * 85);
      return `₹${inr.toLocaleString('en-IN')}`;
    }
    return `$${val.toFixed(2)}`;
  };

  // Cart operations
  const handleAddToCart = (product, quantity = 1) => {
    const qty = Math.max(1, quantity || 1);
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + qty } : item
        );
      }
      return [...prev, { ...product, quantity: qty }];
    });

    showToast(`🛒 Added ${qty}x "${product.name}" to your bag!`);
  };

  const handleUpdateQty = (productId, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) => (item.id === productId ? { ...item, quantity: newQty } : item))
    );
  };

  const handleRemoveItem = (productId) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
    showToast(`Item removed from shopping bag.`);
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Switch to chat and ask question about a product
  const handleAskInChat = (prompt) => {
    setActiveTab('chat');
    setTimeout(() => {
      const inputEl = document.querySelector('textarea');
      if (inputEl) {
        inputEl.value = prompt;
        inputEl.focus();
      }
    }, 150);
  };

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          background: 'var(--moss-deep)',
          color: '#ffffff',
          padding: '12px 22px',
          borderRadius: 'var(--radius-full)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 600,
          fontSize: '0.88rem',
          animation: 'slideUp 0.3s ease',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        }}>
          <CheckCircle2 size={18} color="var(--moss-sage-light)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MOSS Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'orders') {
            setDrawerInitialTab('orders');
            setIsDrawerOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        cartCount={totalCartCount}
        openCart={() => {
          setDrawerInitialTab('cart');
          setIsDrawerOpen(true);
        }}
        currency={currency}
        setCurrency={setCurrency}
      />

      {/* Main App Content */}
      <main style={{ flex: 1, padding: '32px 20px', maxWidth: 1360, margin: '0 auto', width: '100%' }}>
        {activeTab === 'chat' && (
          <AIChat
            onAddToCart={handleAddToCart}
            onRemoveFromCart={handleRemoveItem}
            onBuyNowDirect={(p) => {
              handleAddToCart(p, 1);
              setDrawerInitialTab('cart');
              setIsDrawerOpen(true);
            }}
            onOpenOrders={() => {
              setDrawerInitialTab('orders');
              setIsDrawerOpen(true);
            }}
            formatPrice={formatPrice}
            currency={currency}
          />
        )}

        {activeTab === 'vision' && (
          <ImageSearch
            onAddToCart={handleAddToCart}
            onAskInChat={handleAskInChat}
            formatPrice={formatPrice}
            currency={currency}
          />
        )}

        {activeTab === 'catalog' && (
          <Catalog
            onAddToCart={handleAddToCart}
            onAskInChat={handleAskInChat}
            formatPrice={formatPrice}
            currency={currency}
          />
        )}
      </main>

      {/* MOSS Editorial Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--moss-border)',
          background: 'var(--bg-card)',
          padding: '48px 24px 32px 24px',
          marginTop: 'auto',
        }}
      >
        <div
          style={{
            maxWidth: 1360,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 32,
            }}
          >
            <div style={{ maxWidth: 460 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '10px',
                  background: 'var(--moss-deep)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#ffffff',
                    transform: 'translate(3px, -3px)',
                  }} />
                </div>
                <span style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  color: 'var(--moss-deep)',
                  textTransform: 'uppercase',
                }}>
                  MOSS
                </span>
                <span className="badge-moss">
                  Mindful Living
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                An elevated e-commerce experience curated for mindful rituals and sustainable living. Powered by autonomous AI multi-turn conversational agents with zero hallucination guarantee.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
              <div>
                <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--moss-deep)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Collections
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span style={{ cursor: 'pointer' }} onClick={() => setActiveTab('catalog')}>All Essentials</span>
                  <span style={{ cursor: 'pointer' }} onClick={() => setActiveTab('catalog')}>Organic Produce</span>
                  <span style={{ cursor: 'pointer' }} onClick={() => setActiveTab('catalog')}>Luxury Collection</span>
                  <span style={{ cursor: 'pointer' }} onClick={() => setActiveTab('vision')}>Visual Lens</span>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--moss-deep)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Intelligence
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span style={{ cursor: 'pointer' }} onClick={() => setActiveTab('chat')}>Autonomous Concierge</span>
                  <span>1-Command Atomic Order</span>
                  <span>77 Verified Artifacts</span>
                  <span>Grounded SQLite Engine</span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--moss-border)',
              paddingTop: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>© 2026 MOSS Living & ShopAI • Inspired by Minimalist Organic Living</span>
            <span>Verified 77 Pure Items • Autonomous Order Dispatch</span>
          </div>
        </div>
      </footer>

      {/* Cart & Orders Drawer Modal */}
      <CartOrdersDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        cartItems={cartItems}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        initialTab={drawerInitialTab}
        formatPrice={formatPrice}
        currency={currency}
      />
    </div>
  );
}
