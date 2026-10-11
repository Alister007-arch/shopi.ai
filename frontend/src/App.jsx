import React, { useState } from 'react';
import Header from './components/Header';
import AIChat from './components/AIChat';
import ImageSearch from './components/ImageSearch';
import Catalog from './components/Catalog';
import CartOrdersDrawer from './components/CartOrdersDrawer';
import { CheckCircle2, ShoppingCart, ShieldCheck, Database, Sparkles, Heart } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('catalog'); // Start on 'catalog' for rich dashboard experience, switchable to 'chat' | 'vision' | 'orders'
  const [cartItems, setCartItems] = useState([]);
  const [currency, setCurrency] = useState('INR'); // Default to Indian Rupees 'INR'
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState('cart');
  const [toastMessage, setToastMessage] = useState(null);

  // Currency Formatter
  const formatPrice = (usdAmount) => {
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

    showToast(`🛒 Added ${qty}x "${product.name}" to your cart!`);
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
    showToast(`Item removed from cart.`);
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#090d16' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          background: 'rgba(16, 185, 129, 0.95)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 600,
          fontSize: '0.9rem',
          animation: 'slideUp 0.3s ease',
        }}>
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Header */}
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
      <main style={{ flex: 1, padding: '24px 20px', maxWidth: 1350, margin: '0 auto', width: '100%' }}>
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

      {/* Professional Footer with Catalog & Integrity Disclosure */}
      <footer
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(10, 14, 23, 0.95)',
          padding: '32px 24px 24px 24px',
          marginTop: 'auto',
        }}
      >
        <div
          style={{
            maxWidth: 1350,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 24,
            }}
          >
            <div style={{ maxWidth: 480 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                  Shop<span style={{ color: '#10b981' }}>AI</span>
                </span>
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                  }}
                >
                  Verified Catalog Agent
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
                An evidence-based shopping agent and visual search engine. Every recommendation,
                budget filter, and comparison is directly computed from local SQLite records
                without fabricated claims or hallucinated review sentiment.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>Navigation</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem', color: '#94a3b8' }}>
                  <span style={{ cursor: 'pointer' }} onClick={() => setActiveTab('catalog')}>Product Catalog</span>
                  <span style={{ cursor: 'pointer' }} onClick={() => setActiveTab('chat')}>AI Assistant</span>
                  <span style={{ cursor: 'pointer' }} onClick={() => setActiveTab('vision')}>Visual Search</span>
                  <span style={{ cursor: 'pointer' }} onClick={() => { setDrawerInitialTab('orders'); setIsDrawerOpen(true); }}>Past Orders</span>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>Data & Architecture</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem', color: '#94a3b8' }}>
                  <span>SQLite <code style={{ color: '#10b981' }}>shopai.db</code> (32 Items)</span>
                  <span>FastAPI + LangGraph Reasoning</span>
                  <span>Deterministic Offline Fallback</span>
                  <span>Currency: USD / INR (1 USD ≈ ₹85)</span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              paddingTop: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              fontSize: '0.75rem',
              color: '#64748b',
            }}
          >
            <span>© 2026 ShopAI Prototype • Grounded in Real Data • No Hallucinations</span>
            <span>Running on Windows 11</span>
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
