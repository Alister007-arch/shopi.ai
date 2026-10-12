import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import AIChat from './components/AIChat';
import ImageSearch from './components/ImageSearch';
import Catalog from './components/Catalog';
import CartOrdersDrawer from './components/CartOrdersDrawer';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';
import CustomerProfile from './components/CustomerProfile';
import HelpModal from './components/HelpModal';
import PoliciesView from './components/PoliciesView';
import { authApi } from './api/auth';
import { BRAND } from './config/brand';
import { CheckCircle2, ShoppingBag, ShieldCheck, Database, Sparkles, Heart, Leaf } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('moss_guest_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currency, setCurrency] = useState('INR');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState('cart');
  const [drawerInitialStep, setDrawerInitialStep] = useState('bag');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [helpModalInitialTab, setHelpModalInitialTab] = useState('faq');
  const [toastMessage, setToastMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('q') || '';
    } catch {
      return '';
    }
  });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentUser, setCurrentUser] = useState(() => authApi.getStoredUser());
  const [pinCode, setPinCode] = useState(() => {
    const stored = authApi.getStoredUser();
    if (stored?.id) {
      const savedPin = localStorage.getItem(`moss_pincode_${stored.id}`);
      if (savedPin) return savedPin;
    }
    return localStorage.getItem('moss_pincode_guest') || '560034';
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authReturnTo, setAuthReturnTo] = useState(null);
  const [authPromptMessage, setAuthPromptMessage] = useState(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAgentWidgetOpen, setIsAgentWidgetOpen] = useState(false);
  const [isAgentMaximized, setIsAgentMaximized] = useState(false);
  const [agentInitialPrompt, setAgentInitialPrompt] = useState(null);

  const handleOpenAuthModal = (options = null) => {
    const returnTo = typeof options === 'string' ? options : options?.returnTo || null;
    const msg = typeof options === 'object' ? options?.message : null;
    setAuthReturnTo(returnTo);
    setAuthPromptMessage(msg || (returnTo === 'checkout' ? 'Sign in to place your order' : null));
    setIsAuthModalOpen(true);
  };

  // Sync server cart whenever user is authenticated
  useEffect(() => {
    if (currentUser) {
      authApi.getCart().then((data) => {
        if (data?.items && Array.isArray(data.items)) {
          setCartItems(data.items);
        }
      }).catch((err) => {
        console.warn('Failed to fetch server cart:', err);
      });
    }
  }, [currentUser]);

  // Handle expired sessions transparently without losing cart
  useEffect(() => {
    const handleAuthExpired = (e) => {
      setCurrentUser(null);
      handleOpenAuthModal({
        message: e?.detail?.message || 'Your session has expired. Sign in to place your order.',
        returnTo: 'checkout',
      });
      showToast('Your session has expired. Sign in to place your order.');
    };
    window.addEventListener('moss_auth_expired', handleAuthExpired);
    return () => window.removeEventListener('moss_auth_expired', handleAuthExpired);
  }, []);

  // Route Guard for /checkout, /orders, /profile
  useEffect(() => {
    const checkRouteGuards = () => {
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      const isCheckout = path === '/checkout' || hash === '#/checkout' || hash === '#checkout';
      const isOrders = path === '/orders' || hash === '#/orders' || hash === '#orders';
      const isProfile = path === '/profile' || hash === '#/profile' || hash === '#profile';
      const isPolicies = path === '/policies' || hash === '#/policies' || hash === '#policies';

      if (isPolicies) {
        setActiveTab('policies');
      } else if (isCheckout) {
        if (!currentUser) {
          handleOpenAuthModal({ message: 'Sign in to place your order', returnTo: 'checkout' });
        } else {
          setDrawerInitialTab('cart');
          setDrawerInitialStep('checkout');
          setIsDrawerOpen(true);
        }
      } else if (isOrders) {
        if (!currentUser) {
          handleOpenAuthModal({ returnTo: 'orders' });
        } else {
          setProfileInitialSection('orders');
          setActiveTab('profile');
        }
      } else if (isProfile) {
        if (!currentUser) {
          handleOpenAuthModal({ returnTo: 'profile' });
        } else {
          setProfileInitialSection('personal');
          setActiveTab('profile');
        }
      }
    };

    checkRouteGuards();
    window.addEventListener('popstate', checkRouteGuards);
    window.addEventListener('hashchange', checkRouteGuards);
    return () => {
      window.removeEventListener('popstate', checkRouteGuards);
      window.removeEventListener('hashchange', checkRouteGuards);
    };
  }, [currentUser]);

  // URL synchronization for ?q=
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q');
        if (q !== null) {
          setSearchQuery(q);
          if (q.trim()) {
            setActiveTab('catalog');
          }
        }
      } catch (e) {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handlePinChange = (newPin) => {
    setPinCode(newPin);
    if (currentUser?.id) {
      localStorage.setItem(`moss_pincode_${currentUser.id}`, newPin);
    } else {
      localStorage.setItem('moss_pincode_guest', newPin);
    }
  };

  // Global Wishlist State (persisted to localStorage)
  // Signed-out guests use strictly moss_guest_wishlist (defaulting to empty array).
  // Clean up legacy demo data key moss_wishlist_items if present.
  const [wishlistItems, setWishlistItems] = useState(() => {
    try {
      const user = authApi.getStoredUser();
      const storageKey = user?.id ? `moss_wishlist_${user.id}` : 'moss_guest_wishlist';
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      localStorage.removeItem('moss_wishlist_items');
      return [];
    } catch (e) {
      return [];
    }
  });

  // Sync wishlist when auth state changes
  useEffect(() => {
    try {
      const storageKey = currentUser?.id ? `moss_wishlist_${currentUser.id}` : 'moss_guest_wishlist';
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setWishlistItems(parsed);
          return;
        }
      }
      setWishlistItems([]);
    } catch {
      setWishlistItems([]);
    }
  }, [currentUser]);

  const [profileInitialSection, setProfileInitialSection] = useState('personal');

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

  // Search Action Handlers
  const handleSearchChange = (query) => {
    setSearchQuery(query);
    if (activeTab !== 'catalog' && (query || '').trim()) {
      setActiveTab('catalog');
      setIsDrawerOpen(false);
      setIsAdminOpen(false);
      setIsHelpModalOpen(false);
    }
    const trimmed = (query || '').trim();
    if (trimmed) {
      const newUrl = `${window.location.pathname}?q=${encodeURIComponent(trimmed)}`;
      window.history.replaceState({ q: trimmed }, '', newUrl);
    } else {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleSearchSubmit = (query) => {
    const q = (query !== undefined ? query : searchQuery || '').trim();
    setSearchQuery(q);
    setActiveTab('catalog');
    setIsDrawerOpen(false);
    setIsAdminOpen(false);
    setIsHelpModalOpen(false);
    setIsAuthModalOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (q) {
      const newUrl = `${window.location.pathname}?q=${encodeURIComponent(q)}`;
      window.history.pushState({ q }, '', newUrl);
    } else {
      window.history.pushState({}, '', window.location.pathname);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setActiveTab('catalog');
    window.history.pushState({}, '', window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cart operations
  const handleAddToCart = (product, quantity = 1) => {
    const qty = Math.max(1, quantity || 1);
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      const updated = existing
        ? prev.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + qty } : item
          )
        : [...prev, { ...product, quantity: qty }];
      if (!currentUser) {
        localStorage.setItem('moss_guest_cart', JSON.stringify(updated));
      }
      return updated;
    });

    if (currentUser) {
      authApi.addToCart(product.id, qty).catch((e) => console.warn('Server cart update notice:', e));
    }

    showToast(`🛒 Added ${qty}x "${product.name}" to your bag!`);
  };

  const handleUpdateQty = (productId, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setCartItems((prev) => {
      const updated = prev.map((item) => (item.id === productId ? { ...item, quantity: newQty } : item));
      if (!currentUser) {
        localStorage.setItem('moss_guest_cart', JSON.stringify(updated));
      }
      return updated;
    });

    if (currentUser) {
      authApi.addToCart(productId, newQty).catch((e) => console.warn('Server cart update notice:', e));
    }
  };

  const handleRemoveItem = (productId) => {
    setCartItems((prev) => {
      const updated = prev.filter((item) => item.id !== productId);
      if (!currentUser) {
        localStorage.setItem('moss_guest_cart', JSON.stringify(updated));
      }
      return updated;
    });
    showToast(`Item removed from shopping bag.`);
  };

  const handleClearCart = () => {
    setCartItems([]);
    localStorage.removeItem('moss_guest_cart');
    if (currentUser) {
      authApi.clearCart().catch((e) => console.warn('Server cart clear notice:', e));
    }
  };

  // Wishlist operations
  const handleToggleWishlist = (product) => {
    if (!product) return;
    setWishlistItems((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      let updated;
      if (exists) {
        updated = prev.filter((item) => item.id !== product.id);
        showToast(`Removed "${product.name}" from wishlist.`);
      } else {
        updated = [...prev, product];
        showToast(`❤️ Added "${product.name}" to wishlist!`);
      }
      try {
        const storageKey = currentUser?.id ? `moss_wishlist_${currentUser.id}` : 'moss_guest_wishlist';
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleClearWishlist = () => {
    setWishlistItems([]);
    try {
      const storageKey = currentUser?.id ? `moss_wishlist_${currentUser.id}` : 'moss_guest_wishlist';
      localStorage.removeItem(storageKey);
      localStorage.removeItem('moss_wishlist_items');
    } catch (e) {}
    showToast('Wishlist cleared.');
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open the bottom-right agent widget with prompt pre-filled
  const handleAskInChat = (prompt) => {
    setAgentInitialPrompt(prompt);
    setIsAgentWidgetOpen(true);
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
            setProfileInitialSection('orders');
            setActiveTab('profile');
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
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        pinCode={pinCode}
        onChangePin={handlePinChange}
        wishlistCount={wishlistItems.length}
        onOpenWishlist={() => {
          setProfileInitialSection('wishlist');
          setActiveTab('profile');
        }}
        onOpenProfile={() => {
          if (!currentUser) {
            handleOpenAuthModal({ returnTo: 'profile' });
          } else {
            setProfileInitialSection('personal');
            setActiveTab('profile');
          }
        }}
        currentUser={currentUser}
        onOpenAuthModal={handleOpenAuthModal}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenOrders={() => {
          if (!currentUser) {
            handleOpenAuthModal({ returnTo: 'orders' });
          } else {
            setDrawerInitialTab('orders');
            setIsDrawerOpen(true);
          }
        }}
        onLogout={() => {
          authApi.logout();
          setCurrentUser(null);
          showToast(`Signed out from ${BRAND.name}.`);
        }}
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
              setDrawerInitialStep('checkout');
              setIsDrawerOpen(true);
            }}
            onOpenOrders={() => {
              setDrawerInitialTab('orders');
              setIsDrawerOpen(true);
            }}
            formatPrice={formatPrice}
            currency={currency}
            currentUser={currentUser}
            onOpenAuthModal={handleOpenAuthModal}
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
            wishlistItems={wishlistItems}
            onToggleWishlist={handleToggleWishlist}
            onClearSearch={handleClearSearch}
            onOpenVision={() => setActiveTab('vision')}
            currentUser={currentUser}
            onOpenAuthModal={handleOpenAuthModal}
            onBuyNow={(p) => {
              handleAddToCart(p, 1);
              setDrawerInitialTab('cart');
              setDrawerInitialStep('checkout');
              setIsDrawerOpen(true);
            }}
          />
        )}

        {activeTab === 'profile' && (
          <CustomerProfile
            currentUser={currentUser}
            onUpdateUser={(updated) => {
              setCurrentUser(updated);
              showToast('Profile updated successfully.');
            }}
            onLogout={() => {
              authApi.logout();
              setCurrentUser(null);
              showToast(`Signed out from ${BRAND.name}.`);
              setActiveTab('catalog');
            }}
            wishlistItems={wishlistItems}
            onToggleWishlist={handleToggleWishlist}
            onClearWishlist={handleClearWishlist}
            onAddToCart={handleAddToCart}
            formatPrice={formatPrice}
            currency={currency}
            initialSection={profileInitialSection}
            onAskInChat={handleAskInChat}
            onNavigateHome={() => setActiveTab('catalog')}
            pinCode={pinCode}
            onChangePin={handlePinChange}
            onOpenAuthModal={handleOpenAuthModal}
          />
        )}

        {activeTab === 'orders' && (
          <CustomerProfile
            currentUser={currentUser}
            onUpdateUser={(updated) => {
              setCurrentUser(updated);
              showToast('Profile updated successfully.');
            }}
            onLogout={() => {
              authApi.logout();
              setCurrentUser(null);
              showToast(`Signed out from ${BRAND.name}.`);
              setActiveTab('catalog');
            }}
            wishlistItems={wishlistItems}
            onToggleWishlist={handleToggleWishlist}
            onClearWishlist={handleClearWishlist}
            onAddToCart={handleAddToCart}
            formatPrice={formatPrice}
            currency={currency}
            initialSection="orders"
            onAskInChat={handleAskInChat}
            onNavigateHome={() => setActiveTab('catalog')}
            pinCode={pinCode}
            onChangePin={handlePinChange}
            onOpenAuthModal={handleOpenAuthModal}
          />
        )}

        {activeTab === 'policies' && (
          <PoliciesView
            onOpenChat={(initialPrompt) => {
              setAgentInitialPrompt(initialPrompt);
              setIsAgentWidgetOpen(true);
            }}
            onNavigateHome={() => {
              setActiveTab('catalog');
              window.history.pushState({}, '', '/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
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
          {/* Col 1: Trovi Brand */}
          <div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, cursor: 'pointer', width: 'fit-content' }}
              onClick={() => {
                setSelectedCategory('all');
                setActiveTab('catalog');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title="Return to top"
            >
              <div style={{ width: 13, height: 13, borderRadius: '50%', background: '#ffffff' }} />
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.45rem',
                fontWeight: 800,
                letterSpacing: '0.14em',
                color: '#ffffff',
              }}>
                {BRAND.name}
              </span>
            </div>
            <p style={{
              fontSize: '0.88rem',
              color: 'rgba(255, 255, 255, 0.72)',
              lineHeight: 1.6,
              maxWidth: 320,
            }}>
              {BRAND.tagline} {BRAND.taglineEn}. Curated multi-category catalog with single-command AI checkout.
            </p>
          </div>

          {/* Col 2: Shop Links */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginBottom: 16 }}>
              Shop
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.75)' }}>
              <span
                style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.target.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.target.style.color = 'rgba(255, 255, 255, 0.75)')}
                onClick={() => {
                  setSelectedCategory('honey');
                  setActiveTab('catalog');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Pure Honey
              </span>
              <span
                style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.target.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.target.style.color = 'rgba(255, 255, 255, 0.75)')}
                onClick={() => {
                  setSelectedCategory('grains');
                  setActiveTab('catalog');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Grains & Oats
              </span>
              <span
                style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.target.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.target.style.color = 'rgba(255, 255, 255, 0.75)')}
                onClick={() => {
                  setSelectedCategory('oil');
                  setActiveTab('catalog');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Cold-Pressed Oils
              </span>
              <span
                style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.target.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.target.style.color = 'rgba(255, 255, 255, 0.75)')}
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                  setActiveTab('catalog');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  showToast('Showing verified pantry offers & bestsellers.');
                }}
              >
                Offers
              </span>
            </div>
          </div>

          {/* Col 3: Help Links */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginBottom: 16 }}>
              Help
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.75)' }}>
              <span
                style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.target.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.target.style.color = 'rgba(255, 255, 255, 0.75)')}
                onClick={() => {
                  setDrawerInitialTab('orders');
                  setIsDrawerOpen(true);
                }}
              >
                Track order
              </span>
              <span
                style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.target.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.target.style.color = 'rgba(255, 255, 255, 0.75)')}
                onClick={() => {
                  setHelpModalInitialTab('returns');
                  setIsHelpModalOpen(true);
                }}
              >
                Returns & refunds
              </span>
              <span
                style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.target.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.target.style.color = 'rgba(255, 255, 255, 0.75)')}
                onClick={() => {
                  setActiveTab('policies');
                  window.history.pushState({}, '', '/policies');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                📜 Store Policy (/policies)
              </span>
              <span
                style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.target.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.target.style.color = 'rgba(255, 255, 255, 0.75)')}
                onClick={() => {
                  setHelpModalInitialTab('contact');
                  setIsHelpModalOpen(true);
                }}
              >
                Contact us
              </span>
              <span
                style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.target.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.target.style.color = 'rgba(255, 255, 255, 0.75)')}
                onClick={() => {
                  setHelpModalInitialTab('faq');
                  setIsHelpModalOpen(true);
                }}
              >
                FAQs
              </span>
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
              <span
                onClick={() => {
                  setDrawerInitialTab('cart');
                  setIsDrawerOpen(true);
                }}
                style={{
                  fontSize: '0.74rem',
                  background: 'rgba(255, 255, 255, 0.12)',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.22)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
                title="View shopping bag & secure checkout"
              >
                Secure Checkout
              </span>
              <span
                onClick={() => {
                  setDrawerInitialTab('orders');
                  setIsDrawerOpen(true);
                }}
                style={{
                  fontSize: '0.74rem',
                  background: 'rgba(255, 255, 255, 0.12)',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.22)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
                title="View real-time order tracking"
              >
                Tracked Express Delivery
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
          <span>{BRAND.copyright}</span>
          <span>{BRAND.tagline} · {BRAND.taglineEn}</span>
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
        initialStep={drawerInitialStep}
        formatPrice={formatPrice}
        currency={currency}
        currentUser={currentUser}
        onOpenAuthModal={handleOpenAuthModal}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        promptMessage={authPromptMessage}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthReturnTo(null);
          setAuthPromptMessage(null);
        }}
        onAuthSuccess={async (user) => {
          setCurrentUser(user);
          showToast(`Welcome back, ${user.full_name || 'Shopper'}!`);

          // Guest cart merge into server cart
          try {
            let guestItems = [];
            const savedGuest = localStorage.getItem('moss_guest_cart');
            if (savedGuest) {
              guestItems = JSON.parse(savedGuest);
            } else if (cartItems.length > 0) {
              guestItems = cartItems;
            }

            if (guestItems.length > 0) {
              const mergePayload = guestItems.map((item) => ({
                product_id: item.id,
                quantity: item.quantity,
              }));
              const mergedData = await authApi.mergeCart(mergePayload);
              if (mergedData?.items) {
                setCartItems(mergedData.items);
              }
              localStorage.removeItem('moss_guest_cart');
            } else {
              const serverCart = await authApi.getCart();
              if (serverCart?.items) {
                setCartItems(serverCart.items);
              }
            }
          } catch (err) {
            console.warn('Failed to merge cart after auth:', err);
          }

          if (authReturnTo === 'checkout') {
            setDrawerInitialTab('cart');
            setDrawerInitialStep('checkout');
            setIsDrawerOpen(true);
          } else if (authReturnTo === 'orders') {
            setProfileInitialSection('orders');
            setActiveTab('profile');
          } else if (authReturnTo === 'profile') {
            setProfileInitialSection('personal');
            setActiveTab('profile');
          } else if (authReturnTo) {
            setActiveTab(authReturnTo);
          }
          setAuthReturnTo(null);
          setAuthPromptMessage(null);
        }}
      />

      {/* Help, FAQs & Returns Portal Modal */}
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        initialTab={helpModalInitialTab}
        onOpenOrders={() => {
          setDrawerInitialTab('orders');
          setIsDrawerOpen(true);
        }}
        onOpenChat={() => {
          setActiveTab('chat');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Admin Enterprise Operations Dashboard Modal */}
      {isAdminOpen && (
        <AdminDashboard
          currentUser={currentUser}
          onClose={() => setIsAdminOpen(false)}
          onProductUpdated={() => {
            showToast('Catalog updated in admin console.');
          }}
          onAdminLoginSuccess={(adminUser) => {
            setCurrentUser(adminUser);
            showToast(`Administrator authenticated: ${adminUser.full_name}`);
          }}
        />
      )}

      {/* Floating Agent Launcher Tab in Bottom-Right Corner ("Down Right Corner") */}
      <button
        onClick={() => {
          setIsAgentWidgetOpen((prev) => !prev);
          setAgentInitialPrompt(null);
        }}
        aria-label="Toggle AI Shopping Agent Tab"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9990,
          background: isAgentWidgetOpen
            ? 'linear-gradient(135deg, #142017 0%, var(--moss-deep) 100%)'
            : 'linear-gradient(135deg, var(--moss-deep) 0%, #142017 100%)',
          color: '#ffffff',
          border: '1.5px solid rgba(255, 255, 255, 0.22)',
          borderRadius: 'var(--radius-full)',
          padding: '12px 20px',
          boxShadow: isAgentWidgetOpen
            ? '0 6px 20px rgba(0, 0, 0, 0.35)'
            : '0 10px 28px rgba(28, 48, 36, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          fontWeight: 700,
          fontSize: '0.88rem',
          backdropFilter: 'blur(12px)',
          letterSpacing: '0.02em',
        }}
        className="agent-floating-tab"
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Sparkles size={16} color="var(--accent-yellow, #f5e6cc)" />
          </div>
          <span style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: '#10b981',
            border: '2px solid #142017',
          }} />
        </div>
        <span>AI Agent</span>
        <span style={{
          background: isAgentWidgetOpen ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.15)',
          color: '#f8f7f4',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.7rem',
          fontWeight: 600,
        }}>
          {isAgentWidgetOpen ? 'Close' : 'Live'}
        </span>
      </button>

      {/* Docked Floating Agent Window in Bottom-Right Corner */}
      {isAgentWidgetOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: isAgentMaximized ? 20 : 84,
            right: isAgentMaximized ? 20 : 24,
            width: isAgentMaximized ? 'calc(100vw - 40px)' : '420px',
            maxWidth: 'calc(100vw - 32px)',
            height: isAgentMaximized ? 'calc(100vh - 40px)' : '620px',
            maxHeight: 'calc(100vh - 104px)',
            zIndex: 9995,
            background: 'var(--bg-primary)',
            borderRadius: '20px',
            border: '1.5px solid var(--moss-border-strong, #c8c7bf)',
            boxShadow: '0 24px 60px rgba(20, 32, 23, 0.28), 0 4px 16px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'agentPopIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <AIChat
            isWidgetMode={true}
            isMaximized={isAgentMaximized}
            onMaximizeWidget={() => setIsAgentMaximized((m) => !m)}
            onCloseWidget={() => setIsAgentWidgetOpen(false)}
            initialPrompt={agentInitialPrompt}
            onAddToCart={handleAddToCart}
            onRemoveFromCart={handleRemoveItem}
            onBuyNowDirect={(p) => {
              handleAddToCart(p, 1);
              setDrawerInitialTab('cart');
              setDrawerInitialStep('checkout');
              setIsDrawerOpen(true);
            }}
            onOpenOrders={() => {
              setDrawerInitialTab('orders');
              setIsDrawerOpen(true);
            }}
            formatPrice={formatPrice}
            currency={currency}
            currentUser={currentUser}
            onOpenAuthModal={handleOpenAuthModal}
          />
        </div>
      )}
    </div>
  );
}
