import React, { useState, useEffect } from 'react';
import {
  User, Package, MapPin, Heart, Sparkles, Shield, Edit3, Trash2,
  Plus, Check, X, RotateCcw, ArrowRight, Star, Clock, AlertTriangle,
  Smartphone, Mail, Calendar, ExternalLink, ShoppingBag, Eye,
  Lock, Bell, LogOut, CheckCircle2, ChevronRight, Home, GraduationCap,
  Building, Compass, RefreshCw, RotateCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ProductImage from './ProductImage';
import { API_BASE } from '../config';
import { authApi } from '../api/auth';
import { BRAND } from '../config/brand';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
];


const DIETARY_OPTIONS = [
  '100% Certified Organic', 'Pure Vegetarian', 'Vegan', 'Gluten-Free',
  'Dairy-Free', 'Cold-Pressed Oils Only', 'Fitness & High Protein', 'Sugar-Free',
  'Locally Sourced Farm Produce'
];

const PREFERRED_BRANDS = [
  'Apple', 'Logitech', 'Philips', 'Prestige', 'Organic India',
  'Amul', 'Aashirvaad', 'Tata Tea', 'OnePlus', 'SanDisk', "Levi's", 'Eureka Forbes'
];

const SHOPPING_HABITS = [
  'Weekly Grocery Stockup', 'Direct 1-Command AI Checkout',
  'Weekend Tech Deals', 'Express Delivery', 'Bulk Monthly Pantry'
];

export default function CustomerProfile({
  currentUser,
  onUpdateUser,
  onLogout,
  wishlistItems = [],
  onToggleWishlist,
  onClearWishlist,
  onAddToCart,
  formatPrice,
  currency = 'INR',
  initialSection = 'personal',
  onAskInChat,
  onNavigateHome,
  pinCode = '560034',
  onChangePin,
  onOpenAuthModal,
}) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [toastMessage, setToastMessage] = useState(null);

  // Sync initialSection if updated from parent
  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // -------------------------------------------------------------------------
  // 1. Personal Information State
  // -------------------------------------------------------------------------
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.full_name || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    photo: currentUser?.avatar_url || PRESET_AVATARS[0],
    phoneConsent: Boolean(currentUser?.phone_consent),
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Fetch factual /api/me details (orders count, addresses count, saved addresses)
  const fetchMeData = async () => {
    if (!currentUser || !authApi.isAuthenticated()) return;
    try {
      const data = await authApi.getApiMe();
      if (data) {
        setProfileForm((prev) => ({
          ...prev,
          name: data.full_name || prev.name,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
          phoneConsent: data.phone_consent !== undefined ? Boolean(data.phone_consent) : prev.phoneConsent,
        }));
        if (data.saved_addresses && Array.isArray(data.saved_addresses)) {
          setAddresses(data.saved_addresses);
        }
      }
    } catch (err) {
      console.error('Error fetching /api/me:', err);
    }
  };

  // Sync with currentUser
  useEffect(() => {
    if (currentUser) {
      setProfileForm((prev) => ({
        ...prev,
        name: currentUser.full_name || prev.name,
        email: currentUser.email || prev.email,
        phone: currentUser.phone || prev.phone,
        photo: currentUser.avatar_url || prev.photo,
        phoneConsent: currentUser.phone_consent !== undefined ? Boolean(currentUser.phone_consent) : prev.phoneConsent,
      }));
      fetchMeData();
      fetchAddresses();
      fetchOrders();
    }
  }, [currentUser]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.name.trim()) {
      showToast('⚠️ Please enter your name.');
      return;
    }
    const cleanPhone = profileForm.phone.replace(/[\s\-]/g, '');
    if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
      showToast('⚠️ Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setProfileSaving(true);
    try {
      if (authApi.isAuthenticated()) {
        const updated = await authApi.updateProfile(profileForm.name, cleanPhone, profileForm.phoneConsent);
        if (onUpdateUser) onUpdateUser({ ...updated, avatar_url: profileForm.photo, phone_consent: profileForm.phoneConsent });
      } else {
        const currentStored = authApi.getStoredUser() || {};
        const localUser = {
          ...currentStored,
          full_name: profileForm.name,
          email: profileForm.email,
          phone: cleanPhone,
          phone_consent: profileForm.phoneConsent,
          avatar_url: profileForm.photo,
        };
        localStorage.setItem('moss_user_profile', JSON.stringify(localUser));
        if (onUpdateUser) onUpdateUser(localUser);
      }
      setIsEditingProfile(false);
      showToast('✓ Profile updated successfully!');
    } catch (err) {
      console.error('Update profile error:', err);
      showToast('✓ Profile details saved locally.');
      setIsEditingProfile(false);
    } finally {
      setProfileSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // 2. My Orders State & Actions
  // -------------------------------------------------------------------------
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersFilter, setOrdersFilter] = useState('all'); // 'all', 'active', 'delivered', 'cancelled'
  const [cancellingOrderNo, setCancellingOrderNo] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { type: 'return'|'exchange'|'refund', order: ord, reason: '', replacementItem: '' }
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const fetchOrders = async () => {
    const email = profileForm.email || currentUser?.email || localStorage.getItem('moss_customer_email') || '';
    const token = localStorage.getItem('moss_auth_token');
    if (!email && !token) return;
    setOrdersLoading(true);
    try {
      if (token) {
        const queryUrl = email ? `${API_BASE}/api/orders?customer_email=${encodeURIComponent(email)}` : `${API_BASE}/api/orders`;
        const res = await fetch(queryUrl, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
          return;
        }
      }

      // Fallback: tracked orders from browser session if not logged in
      const storedList = JSON.parse(localStorage.getItem('moss_agent_orders') || '[]');
      if (storedList.length > 0) {
        const trackedOrders = await Promise.all(
          storedList.slice(0, 15).map(async (ordNo) => {
            try {
              const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(ordNo)}/track`);
              if (res.ok) {
                const data = await res.json();
                return {
                  id: data.id || ordNo,
                  order_number: data.order_number || ordNo,
                  status: data.current_status || data.order_status || 'Placed',
                  ordered_at: data.ordered_at || 'Recently',
                  items_summary: data.items_summary || 'Catalog items',
                  items: data.items || [],
                  total_price_inr: data.total_price_inr || 0,
                  total_price: data.total_price || 0,
                  customer_address: data.delivery_address_masked || data.customer_address || 'Saved Address',
                  payment_method: data.payment_method || 'Verified Pay',
                };
              }
            } catch (err) {
              console.warn(`Could not track ${ordNo}:`, err);
            }
            return null;
          })
        );
        const validTracked = trackedOrders.filter(Boolean);
        if (validTracked.length > 0) {
          setOrders(validTracked);
          return;
        }
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'orders') {
      fetchOrders();
    }
  }, [activeSection]);

  // Real-time synchronization when orders are placed or modified by AI agent
  useEffect(() => {
    const handleOrderEvent = () => {
      fetchOrders();
    };
    window.addEventListener('moss_order_placed', handleOrderEvent);
    return () => window.removeEventListener('moss_order_placed', handleOrderEvent);
  }, [profileForm.email, currentUser]);

  const handlePerformAction = async () => {
    if (!actionModal) return;
    const { type, order, reason, replacementItem } = actionModal;
    setActionSubmitting(true);
    try {
      const endpoint = `${API_BASE}/api/orders/${encodeURIComponent(order.order_number)}/${type}`;
      const payload = {
        reason: reason || `Customer requested ${type}`,
        ...(type === 'exchange' ? { replacement_item: replacementItem || 'Standard replacement variant' } : {})
      };
      const token = localStorage.getItem('moss_auth_token');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || `Failed to process ${type}`);

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      showToast(`✓ Order #${order.order_number}: ${type.toUpperCase()} request placed successfully.`);
      setActionModal(null);
      await fetchOrders();
      window.dispatchEvent(new CustomEvent('moss_order_placed', { detail: data }));
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderNumber) => {
    if (!window.confirm(`Are you sure you want to cancel order #${orderNumber}? Reserved stock will be restored immediately.`)) {
      return;
    }
    setCancellingOrderNo(orderNumber);
    try {
      const token = localStorage.getItem('moss_auth_token');
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderNumber)}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: 'Customer requested cancellation via Profile tab' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.detail || 'Cancellation failed');

      showToast(`✓ Order #${orderNumber} cancelled successfully. Catalog stock replenished.`);
      fetchOrders();
    } catch (err) {
      alert(`Could not cancel order: ${err.message}`);
    } finally {
      setCancellingOrderNo(null);
    }
  };

  const handleReorder = (order) => {
    if (!order.items || order.items.length === 0) {
      showToast('No items found to reorder.');
      return;
    }
    order.items.forEach((item) => {
      onAddToCart(
        {
          id: item.product_id,
          name: item.product_name,
          price: item.unit_price || 0,
          price_inr: item.unit_price_inr || Math.round((item.unit_price || 0) * 85),
          image_url: item.image_url,
        },
        item.quantity || 1
      );
    });
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    showToast(`🛒 Added ${order.items.length} item(s) from #${order.order_number} to your shopping bag!`);
  };

  const filteredOrders = orders.filter((o) => {
    const st = (o.status || '').toLowerCase();
    if (ordersFilter === 'active') return !st.includes('cancel') && !st.includes('deliver');
    if (ordersFilter === 'delivered') return st.includes('deliver');
    if (ordersFilter === 'cancelled') return st.includes('cancel');
    return true;
  });

  // -------------------------------------------------------------------------
  // 3. Saved Addresses State
  // -------------------------------------------------------------------------
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);

  const fetchAddresses = async () => {
    if (!currentUser) return;
    setAddressesLoading(true);
    try {
      if (authApi.isAuthenticated()) {
        const data = await authApi.getUserAddresses();
        setAddresses(data.addresses || []);
      } else {
        const raw = localStorage.getItem('moss_saved_addresses');
        setAddresses(raw ? JSON.parse(raw) : []);
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
    } finally {
      setAddressesLoading(false);
    }
  };

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState({
    tag: 'home',
    title: '',
    name: profileForm.name,
    phone: profileForm.phone,
    flat: '',
    street: '',
    landmark: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: pinCode || '560034',
    isDefault: false,
  });

  const handleSetDefaultAddress = async (addrId) => {
    const selected = addresses.find((a) => a.id === addrId);
    if (selected && selected.pinCode && onChangePin) {
      onChangePin(selected.pinCode);
    }
    const updated = addresses.map((a) => ({
      ...a,
      isDefault: a.id === addrId,
    }));
    setAddresses(updated);
    showToast(`📍 Default delivery location set to ${selected?.title || selected?.tag}!`);
  };

  const handleDeleteAddress = async (addrId) => {
    try {
      if (authApi.isAuthenticated() && !String(addrId).startsWith('addr_')) {
        await authApi.deleteUserAddress(addrId);
        showToast('Address deleted.');
        await fetchAddresses();
      } else {
        const filtered = addresses.filter((a) => a.id !== addrId);
        setAddresses(filtered);
        localStorage.setItem('moss_saved_addresses', JSON.stringify(filtered));
        showToast('Address deleted.');
      }
    } catch (err) {
      showToast(`⚠️ Could not delete address: ${err.message}`);
    }
  };

  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      tag: 'home',
      title: 'Home Residence',
      name: profileForm.name || '',
      phone: profileForm.phone || '',
      flat: '',
      street: '',
      landmark: '',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: pinCode || '560034',
      isDefault: addresses.length === 0,
    });
    setAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr) => {
    setEditingAddressId(addr.id);
    setAddressForm({ ...addr });
    setAddressModalOpen(true);
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!addressForm.name || !addressForm.phone || !addressForm.flat || !addressForm.street || !addressForm.pinCode) {
      showToast('⚠️ Please fill in all required address fields.');
      return;
    }

    try {
      if (authApi.isAuthenticated()) {
        await authApi.addUserAddress({
          tag: addressForm.tag,
          title: addressForm.title || `${addressForm.tag.toUpperCase()} Address`,
          name: addressForm.name,
          phone: addressForm.phone,
          flat: addressForm.flat,
          street: addressForm.street,
          landmark: addressForm.landmark || '',
          city: addressForm.city || 'Bengaluru',
          state: addressForm.state || 'Karnataka',
          pin_code: addressForm.pinCode,
          is_default: addressForm.isDefault || false,
        });
        showToast('✓ Address saved to account.');
        await fetchAddresses();
      } else {
        const newAddr = {
          ...addressForm,
          id: 'addr_' + Date.now(),
          title: addressForm.title || `${addressForm.tag.toUpperCase()} Address`,
        };
        let updated = [...addresses, newAddr];
        if (newAddr.isDefault) {
          updated = updated.map((a) => ({ ...a, isDefault: a.id === newAddr.id }));
          if (onChangePin) onChangePin(newAddr.pinCode);
        }
        setAddresses(updated);
        localStorage.setItem('moss_saved_addresses', JSON.stringify(updated));
        showToast('✓ New address saved.');
      }
      setAddressModalOpen(false);
    } catch (err) {
      showToast(`⚠️ Could not save address: ${err.message}`);
    }
  };

  // -------------------------------------------------------------------------
  // 5. AI Shopping Preferences State
  // -------------------------------------------------------------------------
  const [aiPrefs, setAiPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem('moss_ai_preferences');
      return raw
        ? JSON.parse(raw)
        : {
            monthlyBudget: 15000,
            dietary: ['100% Certified Organic', 'Pure Vegetarian'],
            preferredBrands: ['Organic India', 'Amul', 'Apple', 'Logitech'],
            habits: ['Weekly Grocery Stockup', 'Direct 1-Command AI Checkout'],
            deliveryPriority: 'Express Delivery',
          };
    } catch {
      return {
        monthlyBudget: 15000,
        dietary: ['100% Certified Organic', 'Pure Vegetarian'],
        preferredBrands: ['Organic India', 'Amul', 'Apple', 'Logitech'],
        habits: ['Weekly Grocery Stockup', 'Direct 1-Command AI Checkout'],
        deliveryPriority: 'Express Delivery',
      };
    }
  });

  const toggleArrayItem = (key, item) => {
    setAiPrefs((prev) => {
      const current = prev[key] || [];
      const exists = current.includes(item);
      const updated = exists ? current.filter((x) => x !== item) : [...current, item];
      return { ...prev, [key]: updated };
    });
  };

  const handleSaveAiPrefs = () => {
    try {
      localStorage.setItem('moss_ai_preferences', JSON.stringify(aiPrefs));
      confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
      showToast('✨ AI Shopping Preferences saved! Personalized concierge updated.');
    } catch (e) {
      console.error(e);
    }
  };

  // -------------------------------------------------------------------------
  // 6. Account & Security State
  // -------------------------------------------------------------------------
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  const [notificationPrefs, setNotificationPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem('moss_notification_prefs');
      return raw ? JSON.parse(raw) : { whatsapp: true, aiDeals: true, emailInvoices: true, stockAlerts: true };
    } catch {
      return { whatsapp: true, aiDeals: true, emailInvoices: true, stockAlerts: true };
    }
  });

  const handleToggleNotif = (key) => {
    setNotificationPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('moss_notification_prefs', JSON.stringify(updated));
      return updated;
    });
    showToast('Notification preference saved.');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast('⚠️ New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('⚠️ Passwords do not match.');
      return;
    }

    setPasswordUpdating(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('✓ Password updated successfully!');
    } catch (err) {
      alert(`Password change failed: ${err.message}`);
    } finally {
      setPasswordUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(`⚠️ Are you sure you want to permanently delete your ${BRAND.name} customer account? All preferences, orders, and saved data will be removed.`)) {
      return;
    }
    try {
      await authApi.deleteAccount();
    } catch (e) {
      console.error(e);
    }
    localStorage.clear();
    showToast('Your account has been deleted.');
    if (onLogout) onLogout();
  };

  const getTagIcon = (tag) => {
    switch (tag) {
      case 'home': return <Home size={16} />;
      case 'college': return <GraduationCap size={16} />;
      case 'office': return <Building size={16} />;
      default: return <Compass size={16} />;
    }
  };

  if (!currentUser) {
    return (
      <div style={{
        maxWidth: 680,
        margin: '60px auto',
        padding: '50px 32px',
        background: '#ffffff',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--moss-border)',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--moss-tint)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--moss-deep)',
        }}>
          <User size={34} />
        </div>

        <h2 style={{
          fontSize: '1.75rem',
          fontFamily: 'var(--font-heading)',
          fontWeight: 800,
          color: 'var(--moss-deep)',
          margin: 0,
        }}>
          Sign In to Access Your {BRAND.name} Account
        </h2>

        <p style={{
          fontSize: '0.94rem',
          color: 'var(--text-secondary)',
          maxWidth: 480,
          lineHeight: 1.6,
          margin: 0,
        }}>
          Sign in to view your orders, real-time tracking, saved delivery addresses, personalized AI preferences, and wishlist.
        </p>

        <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => {
              if (onOpenAuthModal) onOpenAuthModal({ returnTo: initialSection === 'orders' ? 'orders' : 'profile' });
            }}
            style={{
              background: 'var(--moss-deep)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '12px 28px',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(28, 48, 36, 0.2)',
            }}
          >
            <User size={16} />
            <span>Sign In to Continue</span>
          </button>

          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              style={{
                background: 'transparent',
                color: 'var(--moss-deep)',
                border: '1px solid var(--moss-border)',
                borderRadius: 'var(--radius-full)',
                padding: '12px 24px',
                fontWeight: 600,
                fontSize: '0.92rem',
                cursor: 'pointer',
              }}
            >
              Browse Catalog
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', width: '100%', padding: '10px 0 60px 0' }}>
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

      {/* Top Banner Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--moss-deep) 0%, #142017 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '36px 32px',
        color: '#ffffff',
        marginBottom: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 24,
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Avatar */}
          <div style={{ position: 'relative' }}>
            <img
              src={profileForm.photo}
              alt={profileForm.name}
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              }}
            />
            <button
              onClick={() => setIsEditingProfile(true)}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                background: 'var(--accent-yellow)',
                color: 'var(--moss-deep)',
                border: 'none',
                borderRadius: '50%',
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}
              title="Change Profile Photo"
            >
              <Edit3 size={13} />
            </button>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
                {profileForm.name}
              </h2>
              <span style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: 'var(--accent-yellow)',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <Sparkles size={11} /> {BRAND.name} Member
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'rgba(255, 255, 255, 0.75)' }}>
              {profileForm.email} · +91 {profileForm.phone}
            </p>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff' }}>
              {orders.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 600 }}>
              Orders Placed
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff' }}>
              {wishlistItems.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 600 }}>
              Saved Items
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff' }}>
              {addresses.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 600 }}>
              Saved Addresses
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 4,
        marginBottom: 28,
        borderBottom: '1px solid var(--moss-border)',
      }}>
        {[
          { id: 'personal', label: 'Personal Information', icon: <User size={16} /> },
          { id: 'orders', label: `My Orders (${orders.length})`, icon: <Package size={16} /> },
          { id: 'addresses', label: `Saved Addresses (${addresses.length})`, icon: <MapPin size={16} /> },
          { id: 'wishlist', label: `Wishlist (${wishlistItems.length})`, icon: <Heart size={16} /> },
          { id: 'ai_preferences', label: 'AI Shopping Preferences', icon: <Sparkles size={16} /> },
          { id: 'security', label: 'Account & Security', icon: <Shield size={16} /> },
        ].map((tab) => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 18px',
                background: isActive ? 'var(--moss-deep)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                fontWeight: isActive ? 700 : 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          SECTION 1: PERSONAL INFORMATION
          ===================================================================== */}
      {activeSection === 'personal' && (
        <div className="glass-panel" style={{ padding: 32, borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--moss-deep)', margin: 0 }}>
                Personal Information
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Manage your name, contact details, and account identity.
              </p>
            </div>
            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.84rem' }}
            >
              <Edit3 size={15} /> {isEditingProfile ? 'Close Form' : 'Edit Profile'}
            </button>
          </div>

          {isEditingProfile ? (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
              {/* Avatar Selector */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 10 }}>
                  Choose Profile Photo
                </label>
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
                  {PRESET_AVATARS.map((avUrl, i) => (
                    <img
                      key={i}
                      src={avUrl}
                      alt="Avatar option"
                      onClick={() => setProfileForm((p) => ({ ...p, photo: avUrl }))}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        border: profileForm.photo === avUrl ? '3px solid var(--moss-deep)' : '2px solid transparent',
                        transform: profileForm.photo === avUrl ? 'scale(1.1)' : 'scale(1)',
                        transition: 'all 0.2s',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 6 }}>
                  Full Customer Name *
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--moss-border)',
                    fontSize: '0.92rem',
                    outline: 'none',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 6 }}>
                  Email Address (Primary Account ID)
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--moss-border)',
                    fontSize: '0.92rem',
                    background: 'var(--bg-card-muted)',
                    color: 'var(--text-muted)',
                    cursor: 'not-allowed',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Email address is linked to your order history and cannot be changed directly.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 6 }}>
                  Mobile Phone Number (India +91) *
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--moss-border)',
                    background: 'var(--bg-card-muted)',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                  }}>
                    +91
                  </span>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="9876543210"
                    maxLength={10}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--moss-border)',
                      fontSize: '0.92rem',
                      outline: 'none',
                    }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: -8 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(profileForm.phoneConsent)}
                    onChange={(e) => setProfileForm({ ...profileForm, phoneConsent: e.target.checked })}
                    style={{ marginTop: 2, accentColor: 'var(--moss-deep)', width: 16, height: 16 }}
                  />
                  <span>
                    I consent to receiving transactional order updates and security verification codes via SMS & WhatsApp.
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="btn-primary"
                  style={{ padding: '12px 24px' }}
                >
                  {profileSaving ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              <div style={{ background: 'var(--bg-card-muted)', padding: 20, borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Full Name
                </span>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--moss-deep)', marginTop: 4 }}>
                  {profileForm.name}
                </div>
              </div>

              <div style={{ background: 'var(--bg-card-muted)', padding: 20, borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Email Address
                </span>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--moss-deep)', marginTop: 4 }}>
                  {profileForm.email}
                </div>
              </div>

              <div style={{ background: 'var(--bg-card-muted)', padding: 20, borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Phone Number
                </span>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--moss-deep)', marginTop: 4 }}>
                  {profileForm.phone ? `+91 ${profileForm.phone}` : 'Not provided'}
                </div>
                {profileForm.phone && (
                  <div style={{ fontSize: '0.74rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, color: profileForm.phoneConsent ? 'var(--moss-sage)' : 'var(--text-muted)' }}>
                    {profileForm.phoneConsent ? (
                      <>
                        <CheckCircle2 size={13} /> SMS & WhatsApp Enabled
                      </>
                    ) : (
                      <>
                        <span>Consent not enabled</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--bg-card-muted)', padding: 20, borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Membership Status
                </span>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--moss-sage)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} /> Certified Active
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 2: MY ORDERS
          ===================================================================== */}
      {activeSection === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--moss-deep)', margin: 0 }}>
                Order History & Tracking
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Track real-time shipment statuses, download tax invoices, cancel orders, or reorder instantly.
              </p>
            </div>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: 8, background: 'var(--bg-card-muted)', padding: 4, borderRadius: 'var(--radius-full)' }}>
              {['all', 'active', 'delivered', 'cancelled'].map((f) => (
                <button
                  key={f}
                  onClick={() => setOrdersFilter(f)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    background: ordersFilter === f ? 'var(--moss-deep)' : 'transparent',
                    color: ordersFilter === f ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: ordersFilter === f ? 700 : 500,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {ordersLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
              <p>Fetching your orders from database...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: 50, borderRadius: 'var(--radius-xl)' }}>
              <Package size={40} color="var(--moss-sage)" style={{ margin: '0 auto 12px auto' }} />
              <h4 style={{ fontSize: '1.15rem', color: 'var(--moss-deep)', fontWeight: 700 }}>No Orders Found</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: 400, margin: '6px auto 18px auto' }}>
                You have not placed any orders matching this filter yet. You can order in 1 single command via our AI Concierge!
              </p>
              <button onClick={() => onAskInChat && onAskInChat('Order 1 kg rolled oats and raw honey')} className="btn-primary">
                Order via AI Concierge
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filteredOrders.map((ord) => {
                const st = (ord.status || '').toLowerCase();
                const isCancelled = st.includes('cancel');
                const isDelivered = st.includes('deliver');
                const isPacked = st.includes('pack');
                const isShipped = st.includes('ship');
                const isReturn = st.includes('return');
                const isExchange = st.includes('exchange');
                const isRefund = st.includes('refund');

                let statusBadgeBg = '#e8f5e9';
                let statusBadgeColor = '#2e7d32';
                if (isCancelled) {
                  statusBadgeBg = '#fbe9e7';
                  statusBadgeColor = '#d84315';
                } else if (isReturn) {
                  statusBadgeBg = '#fff7ed';
                  statusBadgeColor = '#c2410c';
                } else if (isExchange) {
                  statusBadgeBg = '#eff6ff';
                  statusBadgeColor = '#1d4ed8';
                } else if (isRefund) {
                  statusBadgeBg = '#ecfdf5';
                  statusBadgeColor = '#047857';
                } else if (isShipped) {
                  statusBadgeBg = '#ede7f6';
                  statusBadgeColor = '#512da8';
                } else if (isPacked) {
                  statusBadgeBg = '#e1f5fe';
                  statusBadgeColor = '#0277bd';
                }

                return (
                  <div
                    key={ord.id || ord.order_number}
                    className="glass-panel"
                    style={{
                      padding: 24,
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--moss-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                            #{ord.order_number}
                          </span>
                          <span style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-full)',
                            background: statusBadgeBg,
                            color: statusBadgeColor,
                            textTransform: 'uppercase',
                          }}>
                            {ord.status?.replace('_', ' ') || 'Confirmed'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Placed on {ord.ordered_at ? new Date(ord.ordered_at).toLocaleString('en-IN') : 'Recently'} · {ord.payment_method?.toUpperCase() || 'UPI / ONLINE'}
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                          ₹{Number(ord.total_price_inr || (ord.total_price ? ord.total_price * 85 : 0)).toLocaleString('en-IN')}
                        </div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          (${Number(ord.total_price || 0).toFixed(2)})
                        </span>
                      </div>
                    </div>

                    {/* Status Note for Returns / Exchanges / Refunds */}
                    {isReturn && (
                      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', padding: '8px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RotateCw size={14} /> Return in progress · Reverse doorstep pickup scheduled
                      </div>
                    )}
                    {isExchange && (
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '8px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw size={14} /> Exchange in progress · Replacement unit allocated
                      </div>
                    )}
                    {isRefund && (
                      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '8px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={14} /> Refund successfully credited to original bank source
                      </div>
                    )}

                    {/* Items Summary list */}
                    <div style={{ background: 'var(--bg-card-muted)', padding: '12px 16px', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                        Items: {ord.items_summary || (ord.items && ord.items.map((it) => `${it.quantity}x ${it.product_name}`).join(', '))}
                      </span>
                      {ord.customer_address && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                          📍 Delivering to: {ord.customer_address}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--moss-border)', paddingTop: 14 }}>
                      <button
                        onClick={() => window.open(`${API_BASE}/api/orders/${encodeURIComponent(ord.order_number)}/invoice?format=html`, '_blank')}
                        className="btn-ghost"
                        style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      >
                        <ExternalLink size={14} /> View GST Invoice
                      </button>

                      <button
                        onClick={() => handleReorder(ord)}
                        className="btn-primary"
                        style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                      >
                        <RotateCcw size={14} /> Reorder All Items
                      </button>

                      {!isCancelled && !isRefund && (
                        <>
                          <button
                            onClick={() => setActionModal({ type: 'return', order: ord, reason: 'Defective item / not satisfied with quality' })}
                            style={{
                              padding: '6px 14px',
                              fontSize: '0.8rem',
                              background: '#fff7ed',
                              color: '#c2410c',
                              border: '1px solid #fed7aa',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <RotateCw size={13} /> Return
                          </button>

                          <button
                            onClick={() => setActionModal({ type: 'exchange', order: ord, reason: 'Size / variant exchange', replacementItem: 'Replacement identical variant' })}
                            style={{
                              padding: '6px 14px',
                              fontSize: '0.8rem',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <RefreshCw size={13} /> Exchange
                          </button>

                          <button
                            onClick={() => setActionModal({ type: 'refund', order: ord, reason: 'Instant customer refund request' })}
                            style={{
                              padding: '6px 14px',
                              fontSize: '0.8rem',
                              background: '#ecfdf5',
                              color: '#047857',
                              border: '1px solid #a7f3d0',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <CheckCircle2 size={13} /> Refund
                          </button>
                        </>
                      )}

                      {!isCancelled && !isDelivered && !isReturn && (
                        <button
                          onClick={() => handleCancelOrder(ord.order_number)}
                          disabled={cancellingOrderNo === ord.order_number}
                          style={{
                            padding: '6px 14px',
                            fontSize: '0.8rem',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 700,
                            cursor: cancellingOrderNo === ord.order_number ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <X size={14} /> {cancellingOrderNo === ord.order_number ? 'Cancelling...' : 'Cancel Order'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Modal (Return / Exchange / Refund) */}
          {actionModal && (
            <div style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: 16,
            }}>
              <div style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-lg)',
                width: '100%',
                maxWidth: 440,
                padding: 24,
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--moss-deep)', margin: 0, textTransform: 'capitalize' }}>
                    Request {actionModal.type} #{actionModal.order.order_number}
                  </h3>
                  <button
                    onClick={() => setActionModal(null)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {actionModal.type === 'return' && 'Our delivery partner will arrive for reverse doorstep pickup. Refund will be credited upon pickup.'}
                  {actionModal.type === 'exchange' && 'A replacement shipment will be dispatched to your delivery address immediately.'}
                  {actionModal.type === 'refund' && `Instant credit of ₹${Number(actionModal.order?.total_price_inr || (actionModal.order?.total_price ? actionModal.order.total_price * 85 : 0)).toLocaleString('en-IN')} will be processed to your source payment method.`}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                    Reason for {actionModal.type}:
                  </label>
                  <select
                    value={actionModal.reason}
                    onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
                    style={{ padding: '8px 12px', fontSize: '0.84rem', borderRadius: 6, border: '1px solid var(--moss-border)', outline: 'none' }}
                  >
                    <option value="Defective / Quality not satisfied">Defective / Quality not satisfied</option>
                    <option value="Wrong product received">Wrong product received</option>
                    <option value="Package damaged in transit">Package damaged in transit</option>
                    <option value="No longer needed / Change of mind">No longer needed / Change of mind</option>
                    <option value="Ordered by mistake">Ordered by mistake</option>
                  </select>
                </div>

                {actionModal.type === 'exchange' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                      Requested Replacement Variant:
                    </label>
                    <input
                      type="text"
                      value={actionModal.replacementItem || ''}
                      onChange={(e) => setActionModal({ ...actionModal, replacementItem: e.target.value })}
                      placeholder="e.g., Replacement identical variant"
                      style={{ padding: '8px 12px', fontSize: '0.84rem', borderRadius: 6, border: '1px solid var(--moss-border)', outline: 'none' }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setActionModal(null)}
                    className="btn-ghost"
                    style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePerformAction}
                    disabled={actionSubmitting}
                    className="btn-primary"
                    style={{ padding: '8px 20px', fontSize: '0.84rem' }}
                  >
                    {actionSubmitting ? 'Processing...' : `Confirm ${actionModal.type.toUpperCase()}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 3: SAVED ADDRESSES
          ===================================================================== */}
      {activeSection === 'addresses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--moss-deep)', margin: 0 }}>
                Saved Delivery Addresses
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Manage delivery points for your home, campus, or workplace. Default location updates your active PIN code.
              </p>
            </div>
            <button
              onClick={handleOpenAddAddress}
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.84rem' }}
            >
              <Plus size={16} /> Add New Address
            </button>
          </div>

          {addressesLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
              <p>Loading your saved addresses...</p>
            </div>
          ) : addresses.length === 0 ? (
            <div className="glass-panel" style={{
              textAlign: 'center',
              padding: '48px 24px',
              borderRadius: 'var(--radius-xl)',
              background: '#ffffff',
              border: '1px solid var(--moss-border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--moss-tint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--moss-deep)',
              }}>
                <MapPin size={26} />
              </div>
              <h4 style={{ fontSize: '1.15rem', color: 'var(--moss-deep)', fontWeight: 700, margin: 0 }}>
                No Saved Delivery Addresses
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: 420, margin: 0 }}>
                You have not saved any delivery addresses yet. Add your home, campus, or workplace address to enable seamless 1-command checkout.
              </p>
              <button
                type="button"
                onClick={handleOpenAddAddress}
                className="btn-primary"
                style={{ marginTop: 6, padding: '8px 22px', fontSize: '0.84rem' }}
              >
                <Plus size={15} /> Add First Address
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
              {addresses.map((addr) => (
              <div
                key={addr.id}
                className="glass-panel"
                style={{
                  padding: 22,
                  borderRadius: 'var(--radius-lg)',
                  border: addr.isDefault ? '2px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--moss-deep)',
                    background: 'var(--moss-tint)',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                  }}>
                    {getTagIcon(addr.tag)} {addr.tag}
                  </span>

                  {addr.isDefault ? (
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--moss-sage)',
                      background: 'rgba(94, 122, 98, 0.12)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                    }}>
                      ✓ Default Address
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetDefaultAddress(addr.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Make Default
                    </button>
                  )}
                </div>

                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--moss-deep)', margin: '0 0 4px 0' }}>
                    {addr.title || addr.name}
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    {addr.flat}, {addr.street}
                    {addr.landmark && `, near ${addr.landmark}`}
                    <br />
                    {addr.city}, {addr.state} - <strong>{addr.pinCode}</strong>
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                    📞 Recipient: {addr.name} (+91 {addr.phone})
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--moss-border)' }}>
                  <button
                    onClick={() => handleOpenEditAddress(addr)}
                    className="btn-ghost"
                    style={{ flex: 1, padding: '6px 12px', fontSize: '0.78rem' }}
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="btn-ghost"
                    style={{ color: '#ef4444', padding: '6px 12px', fontSize: '0.78rem' }}
                    title="Delete address"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            </div>
          )}

          {/* Add / Edit Address Modal */}
          {addressModalOpen && (
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
                onSubmit={handleSaveAddress}
                style={{
                  background: '#ffffff',
                  padding: 28,
                  borderRadius: 'var(--radius-lg)',
                  maxWidth: 480,
                  width: '90%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--moss-deep)', margin: 0 }}>
                    {editingAddressId ? 'Edit Address' : 'Add New Address'}
                  </h4>
                  <button type="button" onClick={() => setAddressModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                </div>

                {/* Tag Selection */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 6 }}>
                    Address Type Tag
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['home', 'college', 'office', 'other'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setAddressForm({ ...addressForm, tag })}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: addressForm.tag === tag ? '2px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                          background: addressForm.tag === tag ? 'var(--moss-tint)' : '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.76rem',
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 4 }}>
                    Address Label / Title (e.g. My Flat, Campus Room)
                  </label>
                  <input
                    type="text"
                    value={addressForm.title}
                    onChange={(e) => setAddressForm({ ...addressForm, title: e.target.value })}
                    placeholder="Home Residence"
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)', fontSize: '0.9rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 4 }}>
                      Recipient Name *
                    </label>
                    <input
                      type="text"
                      value={addressForm.name}
                      onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)', fontSize: '0.9rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 4 }}>
                      Mobile Phone (10 digits) *
                    </label>
                    <input
                      type="tel"
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                      maxLength={10}
                      required
                      style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 4 }}>
                    Flat / House No. / Building / Floor *
                  </label>
                  <input
                    type="text"
                    value={addressForm.flat}
                    onChange={(e) => setAddressForm({ ...addressForm, flat: e.target.value })}
                    placeholder="Flat 402, Green Park Avenue"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)', fontSize: '0.9rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 4 }}>
                    Street / Area / Colony *
                  </label>
                  <input
                    type="text"
                    value={addressForm.street}
                    onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                    placeholder="12th Main Road, Indiranagar"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)', fontSize: '0.9rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 4 }}>
                      City *
                    </label>
                    <input
                      type="text"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)', fontSize: '0.9rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 4 }}>
                      State *
                    </label>
                    <input
                      type="text"
                      value={addressForm.state}
                      onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)', fontSize: '0.9rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 4 }}>
                      PIN Code *
                    </label>
                    <input
                      type="text"
                      value={addressForm.pinCode}
                      onChange={(e) => setAddressForm({ ...addressForm, pinCode: e.target.value })}
                      maxLength={6}
                      required
                      style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', cursor: 'pointer', marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                  />
                  <span>Set this as my default delivery address</span>
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button type="button" onClick={() => setAddressModalOpen(false)} className="btn-ghost">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" style={{ padding: '10px 20px' }}>
                    Save Address
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 4: WISHLIST & SAVED PRODUCTS
          ===================================================================== */}
      {activeSection === 'wishlist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--moss-deep)', margin: 0 }}>
                Wishlist & Saved for Later
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Your saved favourite items. Tap on any product to inspect details or move directly into your bag.
              </p>
            </div>

            {wishlistItems.length > 0 && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => {
                    wishlistItems.forEach((p) => onAddToCart(p, 1));
                    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
                    showToast(`🛒 Moved all ${wishlistItems.length} items to your shopping bag!`);
                  }}
                  className="btn-primary"
                  style={{ padding: '8px 18px', fontSize: '0.84rem' }}
                >
                  <ShoppingBag size={15} /> Move All to Bag
                </button>
                <button
                  onClick={onClearWishlist}
                  className="btn-ghost"
                  style={{ padding: '8px 14px', fontSize: '0.84rem', color: '#ef4444' }}
                >
                  <Trash2 size={15} /> Clear All
                </button>
              </div>
            )}
          </div>

          {wishlistItems.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: 60, borderRadius: 'var(--radius-xl)' }}>
              <Heart size={44} color="var(--clay-terracotta)" style={{ margin: '0 auto 12px auto' }} />
              <h4 style={{ fontSize: '1.25rem', color: 'var(--moss-deep)', fontWeight: 800 }}>
                Your Wishlist is Empty
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: 420, margin: '8px auto 20px auto' }}>
                Tap the heart icon on any product in the store catalog to save products you love for easy ordering later!
              </p>
              <button onClick={onNavigateHome} className="btn-primary" style={{ padding: '12px 24px' }}>
                Explore Products Catalog
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 20,
            }}>
              {wishlistItems.map((prod) => {
                const inrPrice = prod.price_inr || Math.round((prod.price || 0) * 85);
                const mrpPrice = Math.round(inrPrice * 1.25);

                return (
                  <div
                    key={prod.id}
                    className="glass-panel"
                    style={{
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      border: '1px solid var(--moss-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      background: '#ffffff',
                    }}
                  >
                    {/* Remove button */}
                    <button
                      onClick={() => onToggleWishlist(prod)}
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        zIndex: 2,
                        background: 'rgba(255, 255, 255, 0.9)',
                        border: 'none',
                        borderRadius: '50%',
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--clay-terracotta)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      }}
                      title="Remove from wishlist"
                    >
                      <Heart size={16} fill="var(--clay-terracotta)" color="var(--clay-terracotta)" />
                    </button>

                    <div style={{ height: 180, background: 'var(--bg-card-muted)', overflow: 'hidden' }}>
                      <ProductImage src={prod.image_url} alt={prod.name} width={280} height={180} />
                    </div>

                    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', flex: 1, gap: 8 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--moss-sage)', fontWeight: 700, textTransform: 'uppercase' }}>
                        {prod.category || 'Store'} · {prod.brand || BRAND.name}
                      </span>
                      <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--moss-deep)', margin: 0, lineHeight: 1.4 }}>
                        {prod.name}
                      </h4>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 'auto', paddingTop: 8 }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                          ₹{inrPrice.toLocaleString('en-IN')}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                          ₹{mrpPrice.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => {
                            onAddToCart(prod, 1);
                            showToast(`🛒 Added "${prod.name}" to your bag!`);
                          }}
                          className="btn-primary"
                          style={{ flex: 1, padding: '8px 14px', fontSize: '0.82rem' }}
                        >
                          <ShoppingBag size={14} /> Add to Bag
                        </button>
                        <button
                          onClick={() => onAskInChat && onAskInChat(`Tell me about ${prod.name}`)}
                          className="btn-ghost"
                          style={{ padding: '8px', fontSize: '0.82rem' }}
                          title="Ask AI Concierge about this product"
                        >
                          <Sparkles size={14} color="var(--moss-deep)" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 5: AI SHOPPING PREFERENCES
          ===================================================================== */}
      {activeSection === 'ai_preferences' && (
        <div className="glass-panel" style={{ padding: 32, borderRadius: 'var(--radius-xl)' }}>
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--moss-deep)', margin: 0 }}>
              AI Shopping Preferences & Personalization
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Fine-tune budget limits, favorite brands, and dietary goals for zero-hallucination shopping recommendations.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 820 }}>
            {/* 1. Monthly Budget */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                  Monthly Shopping Budget Target
                </label>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                  ₹{Number(aiPrefs.monthlyBudget).toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min="2000"
                max="50000"
                step="1000"
                value={aiPrefs.monthlyBudget}
                onChange={(e) => setAiPrefs({ ...aiPrefs, monthlyBudget: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--moss-deep)' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {[3000, 7500, 15000, 30000, 50000].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setAiPrefs({ ...aiPrefs, monthlyBudget: b })}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      border: aiPrefs.monthlyBudget === b ? '1px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                      background: aiPrefs.monthlyBudget === b ? 'var(--moss-tint)' : '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ₹{b.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Dietary Preferences */}
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 10 }}>
                Dietary & Lifestyle Standards
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DIETARY_OPTIONS.map((diet) => {
                  const isSelected = (aiPrefs.dietary || []).includes(diet);
                  return (
                    <button
                      key={diet}
                      type="button"
                      onClick={() => toggleArrayItem('dietary', diet)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-full)',
                        border: isSelected ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                        background: isSelected ? 'var(--moss-deep)' : '#ffffff',
                        color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {diet}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Preferred Brands */}
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 10 }}>
                Preferred Brands
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PREFERRED_BRANDS.map((brand) => {
                  const isSelected = (aiPrefs.preferredBrands || []).includes(brand);
                  return (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => toggleArrayItem('preferredBrands', brand)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-full)',
                        border: isSelected ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                        background: isSelected ? 'var(--moss-deep)' : '#ffffff',
                        color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {brand}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Shopping Habits */}
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 10 }}>
                Shopping Habits & Priorities
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SHOPPING_HABITS.map((habit) => {
                  const isSelected = (aiPrefs.habits || []).includes(habit);
                  return (
                    <button
                      key={habit}
                      type="button"
                      onClick={() => toggleArrayItem('habits', habit)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-full)',
                        border: isSelected ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                        background: isSelected ? 'var(--moss-deep)' : '#ffffff',
                        color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {habit}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save Button */}
            <div style={{ paddingTop: 10 }}>
              <button
                onClick={handleSaveAiPrefs}
                className="btn-primary"
                style={{ padding: '12px 28px', fontSize: '0.9rem' }}
              >
                <Sparkles size={16} /> Save AI Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 6: ACCOUNT & SECURITY
          ===================================================================== */}
      {activeSection === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Active Sessions Card */}
          <div className="glass-panel" style={{ padding: 28, borderRadius: 'var(--radius-xl)' }}>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--moss-deep)', margin: '0 0 4px 0' }}>
              Active Login Sessions
            </h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 18px 0' }}>
              Devices currently signed in to your {BRAND.name} customer account.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                background: 'var(--bg-card-muted)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Smartphone size={22} color="var(--moss-deep)" />
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--moss-deep)' }}>
                      Web Browser on Windows 11 (This Device)
                    </strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--moss-sage)', fontWeight: 600 }}>
                      ● Active Now · Bengaluru, India (IP: 127.0.0.1)
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>
                  Current Session
                </span>
              </div>
            </div>
          </div>

          {/* Password & Authentication */}
          <div className="glass-panel" style={{ padding: 28, borderRadius: 'var(--radius-xl)' }}>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--moss-deep)', margin: '0 0 4px 0' }}>
              Password & Authentication
            </h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 18px 0' }}>
              Keep your shopping account protected with encrypted credentials.
            </p>

            {passwordModalOpen ? (
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 440 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 4 }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 4 }}>
                    New Password (min 8 chars)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)', display: 'block', marginBottom: 4 }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)', fontSize: '0.9rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setPasswordModalOpen(false)} className="btn-ghost">
                    Cancel
                  </button>
                  <button type="submit" disabled={passwordUpdating} className="btn-primary" style={{ padding: '8px 18px' }}>
                    {passwordUpdating ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setPasswordModalOpen(true)}
                className="btn-primary"
                style={{ padding: '10px 20px', fontSize: '0.86rem' }}
              >
                <Lock size={15} /> Change Password
              </button>
            )}
          </div>

          {/* Notification Preferences */}
          <div className="glass-panel" style={{ padding: 28, borderRadius: 'var(--radius-xl)' }}>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--moss-deep)', margin: '0 0 4px 0' }}>
              Notification Preferences
            </h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 18px 0' }}>
              Choose how {BRAND.name} and our AI assistant notify you about order progress and product deals.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { key: 'whatsapp', label: 'WhatsApp & SMS Delivery Alerts', desc: 'Real-time order dispatch notifications, tracking links, and delivery PINs.' },
                { key: 'aiDeals', label: 'AI Concierge Deal & Price Drop Alerts', desc: 'Personalized recommendations when items in your preferences go on sale.' },
                { key: 'emailInvoices', label: 'Email Tax Invoices & Order Receipts', desc: 'Detailed GST invoice PDFs sent to your registered email immediately.' },
                { key: 'stockAlerts', label: 'Wishlist Restock Notifications', desc: 'Immediate notification when out-of-stock saved products become available.' },
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: 'var(--bg-card-muted)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--moss-deep)' }}>{item.label}</strong>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>{item.desc}</p>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!notificationPrefs[item.key]}
                      onChange={() => handleToggleNotif(item.key)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      inset: 0,
                      background: notificationPrefs[item.key] ? 'var(--moss-deep)' : '#ccc',
                      borderRadius: 24,
                      transition: '0.3s',
                    }}>
                      <span style={{
                        position: 'absolute',
                        left: notificationPrefs[item.key] ? 22 : 3,
                        bottom: 3,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: '#ffffff',
                        transition: '0.3s',
                      }} />
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone: Account Deletion */}
          <div style={{
            padding: 28,
            borderRadius: 'var(--radius-xl)',
            background: '#fef2f2',
            border: '1px solid #fecaca',
          }}>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#991b1b', margin: '0 0 4px 0' }}>
              Account Termination
            </h4>
            <p style={{ fontSize: '0.84rem', color: '#7f1d1d', margin: '0 0 16px 0' }}>
              Permanently remove your personal profile, addresses, and saved wishlist items from the store.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={handleDeleteAccount}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Trash2 size={15} /> Delete Customer Account
              </button>
              <button
                onClick={onLogout}
                style={{
                  background: '#ffffff',
                  color: 'var(--moss-deep)',
                  border: '1px solid var(--moss-border)',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <LogOut size={15} /> Sign Out of {BRAND.name}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
