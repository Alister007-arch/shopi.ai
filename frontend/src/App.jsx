import React, { useState } from 'react';
import Header from './components/Header';
import AIChat from './components/AIChat';
import ImageSearch from './components/ImageSearch';
import Catalog from './components/Catalog';
import CartOrdersDrawer from './components/CartOrdersDrawer';
import { CheckCircle2, ShoppingBag, ShieldCheck, Database, Sparkles, Heart, Leaf } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [cartItems, setCartItems] = useState([]);
  const [currency, setCurrency] = useState('INR');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState('cart');
  const [toastMessage, setToastMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [pinCode, setPinCode] = useState('560034');

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

      {/* Header (Exact PDF Wireframe Page 1) */}
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
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        pinCode={pinCode}
        onChangePin={setPinCode}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '28px 24px', maxWidth: 1380, margin: '0 auto', width: '100%' }}>
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
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        )}
      </main>

      {/* Footer (Exact PDF Wireframe Page 3 & Page 5) */}
      <footer style={{
        background: '#142017',
        color: '#ffffff',
        padding: '56px 24px 36px 24px',
        marginTop: 'auto',
      }}>
        <div style={{
          maxWidth: 1380,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 40,
        }}>
          {/* Col 1: MOSS Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
              <div style={{ width: 13, height: 13, borderRadius: '50%', background: '#ffffff' }} />
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.45rem',
                fontWeight: 800,
                letterSpacing: '0.14em',
                color: '#ffffff',
              }}>
                MOSS
              </span>
            </div>
            <p style={{
              fontSize: '0.88rem',
              color: 'rgba(255, 255, 255, 0.72)',
              lineHeight: 1.6,
              maxWidth: 320,
            }}>
              Mindful essentials & autonomous concierge. Certified pure pantry and lifestyle goods with single-command checkout.
            </p>
          </div>

          {/* Col 2: Shop Links */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginBottom: 16 }}>
              Shop
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.75)' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => { setSelectedCategory('honey'); setActiveTab('catalog'); }}>Pure Honey</span>
              <span style={{ cursor: 'pointer' }} onClick={() => { setSelectedCategory('grains'); setActiveTab('catalog'); }}>Grains & Oats</span>
              <span style={{ cursor: 'pointer' }} onClick={() => { setSelectedCategory('oil'); setActiveTab('catalog'); }}>Cold-Pressed Oils</span>
              <span style={{ cursor: 'pointer' }} onClick={() => { setSelectedCategory('all'); setActiveTab('catalog'); }}>Offers</span>
            </div>
          </div>

          {/* Col 3: Help Links */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginBottom: 16 }}>
              Help
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.75)' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => { setDrawerInitialTab('orders'); setIsDrawerOpen(true); }}>Track order</span>
              <span>Returns & refunds</span>
              <span style={{ cursor: 'pointer' }} onClick={() => setActiveTab('chat')}>Contact us</span>
              <span>FAQs</span>
            </div>
          </div>

          {/* Col 4: Pay Securely */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginBottom: 16 }}>
              Pay securely
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.5, marginBottom: 14 }}>
              UPI · Cards · Net banking · COD
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.74rem',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                color: 'rgba(255, 255, 255, 0.85)',
              }}>
                100% Encrypted UPI
              </span>
              <span style={{
                fontSize: '0.74rem',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                color: 'rgba(255, 255, 255, 0.85)',
              }}>
                Eco-Fleet Dispatch
              </span>
            </div>
          </div>
        </div>

        <div style={{
          maxWidth: 1380,
          margin: '36px auto 0 auto',
          paddingTop: 20,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          fontSize: '0.78rem',
          color: 'rgba(255, 255, 255, 0.5)',
        }}>
          <span>© 2026 MOSS Living & ShopAI. All rights reserved.</span>
          <span>Designed with Mindful Living & Autonomous AI</span>
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
