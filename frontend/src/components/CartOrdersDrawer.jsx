import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  ShoppingBag,
  Package,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Truck,
  Clock,
  MapPin,
  AlertCircle,
  ShieldCheck,
  Building,
  Receipt,
  CreditCard,
  QrCode,
  Tag,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Percent,
  Sparkles,
  RotateCw,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { API_BASE } from '../config';
import { BRAND } from '../config/brand';
import { authApi } from '../api/auth';
import { lookupPincode, getSelectableDeliveryOptions } from '../utils/deliveryEngine';

export default function CartOrdersDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  initialTab = 'cart',
  initialStep = 'bag',
  formatPrice = (p, inr) => {
    if (inr !== undefined && inr !== null && !isNaN(Number(inr))) return `₹${Math.round(Number(inr)).toLocaleString('en-IN')}`;
    const n = Number(p);
    return !isNaN(n) && p !== undefined && p !== null ? `₹${Math.round(n * 85).toLocaleString('en-IN')}` : '₹0';
  },
  currency = 'INR',
  currentUser = null,
  onOpenAuthModal = null,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [checkoutStep, setCheckoutStep] = useState(initialStep || 'bag');
  const [orders, setOrders] = useState([]);
  const [customerEmail, setCustomerEmail] = useState(
    () => currentUser?.email || localStorage.getItem('moss_customer_email') || ''
  );

  // Address Book state (loaded strictly from authenticated user API data)
  const [addressBook, setAddressBook] = useState([]);

  // Selected Shipping Address
  const [shippingAddress, setShippingAddress] = useState({
    label: 'Delivery Address',
    recipient_name: currentUser?.full_name || '',
    phone: currentUser?.phone || '',
    postal_code: '',
    street_address: '',
    city: 'Bengaluru',
    state: 'Karnataka',
  });
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: 'Custom',
    recipient_name: currentUser?.full_name || '',
    phone: currentUser?.phone || '',
    postal_code: '',
    street_address: '',
    city: 'Bengaluru',
    state: 'Karnataka',
  });

  // Billing Address & Business Tax Invoicing state
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingAddress, setBillingAddress] = useState({
    recipient_name: '',
    phone: '',
    postal_code: '',
    street_address: '',
    city: '',
    state: '',
  });
  const [isBusinessInvoice, setIsBusinessInvoice] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessGstin, setBusinessGstin] = useState('');

  // Delivery slot, tier & Payment methods
  const [selectedSlot, setSelectedSlot] = useState('morning'); // 'morning', 'afternoon', 'evening'
  const [selectedDeliveryTier, setSelectedDeliveryTier] = useState('eco_standard');
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi', 'card', 'netbanking', 'cod'
  const [upiVpa, setUpiVpa] = useState('');
  const [showQrCode, setShowQrCode] = useState(false);
  const [cardDetails, setCardDetails] = useState({
    number: '',
    name: currentUser?.full_name || '',
    expiry: '',
    cvv: '',
  });
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);

  // Status, Lifecycle Actions & Validation
  const [cancellingOrderNo, setCancellingOrderNo] = useState(null);
  const [cancelMessage, setCancelMessage] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { type: 'return'|'exchange'|'refund', order: ord, reason: '', replacementItem: '' }
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);
  const [addressErrors, setAddressErrors] = useState({});
  const [billingErrors, setBillingErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [lastPlacedOrder, setLastPlacedOrder] = useState(null);

  useEffect(() => {
    setActiveTab(initialTab);
    if (initialStep) {
      setCheckoutStep(initialStep);
    } else if (initialTab === 'cart') {
      setCheckoutStep('bag');
    }
  }, [initialTab, initialStep, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen]);

  // Fetch saved addresses strictly from authenticated API data
  useEffect(() => {
    let isMounted = true;
    const fetchUserAddresses = async () => {
      if (!currentUser && !authApi.getToken()) {
        if (isMounted) setAddressBook([]);
        return;
      }
      try {
        const res = await authApi.getUserAddresses();
        const rawList = res?.addresses || [];
        const normalized = rawList.map((a) => {
          const streetStr = (a.street_address || `${a.flat ? a.flat + ', ' : ''}${a.street || ''}${a.landmark ? ', ' + a.landmark : ''}`).trim();
          return {
            id: String(a.id),
            label: a.title || a.tag || 'Saved',
            recipient_name: a.name || currentUser?.full_name || '',
            phone: a.phone || currentUser?.phone || '',
            postal_code: a.pinCode || a.pin_code || '',
            street_address: streetStr,
            city: a.city || 'Bengaluru',
            state: a.state || 'Karnataka',
            is_default: Boolean(a.isDefault || a.is_default),
          };
        });
        if (isMounted) {
          setAddressBook(normalized);
          const defaultAddr = normalized.find((addr) => addr.is_default) || normalized[0];
          if (defaultAddr) {
            setShippingAddress(defaultAddr);
          }
        }
      } catch (err) {
        console.warn('Could not fetch saved addresses in drawer:', err);
        if (isMounted) setAddressBook([]);
      }
    };
    if (isOpen) {
      fetchUserAddresses();
    }
    return () => { isMounted = false; };
  }, [isOpen, currentUser]);

  // Persist updated address book to localStorage
  useEffect(() => {
    try {
      if (addressBook.length > 0) {
        localStorage.setItem('moss_saved_address_book', JSON.stringify(addressBook));
      }
    } catch (e) {
      console.warn('Could not save address book:', e);
    }
  }, [addressBook]);

  const fetchOrders = async () => {
    try {
      const email = currentUser?.email || customerEmail || localStorage.getItem('moss_customer_email') || '';
      const token = localStorage.getItem('moss_auth_token');

      let orderParam = '';
      let storedList = [];
      try {
        storedList = JSON.parse(localStorage.getItem('moss_agent_orders') || '[]');
        if (storedList.length > 0) {
          orderParam = `order_numbers=${encodeURIComponent(storedList.join(','))}`;
        }
      } catch (e) {}

      // 1. If user is authenticated, query /api/orders with Bearer JWT
      if (token) {
        const queryParts = [];
        if (email) queryParts.push(`customer_email=${encodeURIComponent(email)}`);
        if (orderParam) queryParts.push(orderParam);
        const url = `${API_BASE}/api/orders${queryParts.length > 0 ? `?${queryParts.join('&')}` : ''}`;

        const res = await fetch(url, {
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

      // 2. If not authenticated or /api/orders returned error, fall back to tracking stored orders
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

      setOrders([]);
    } catch (err) {
      console.warn('Could not load orders:', err);
    }
  };

  // Listen for agent order placements or lifecycle updates to refresh orders live
  useEffect(() => {
    const handleOrderEvent = () => {
      fetchOrders();
    };
    window.addEventListener('moss_order_placed', handleOrderEvent);
    return () => window.removeEventListener('moss_order_placed', handleOrderEvent);
  }, [customerEmail, currentUser]);

  const handlePerformAction = async () => {
    if (!actionModal) return;
    const { type, order, reason, replacementItem } = actionModal;
    setActionSubmitting(true);
    try {
      const endpoint = `${API_BASE}/api/orders/${encodeURIComponent(order.order_number)}/${type}`;
      const payload = {
        reason: reason || `Customer requested ${type}`,
        ...(type === 'exchange' ? { replacement_item: replacementItem || 'Identical variant / replacement unit' } : {})
      };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || `Failed to process ${type}`);

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      setActionSuccessMsg(`✓ Order #${order.order_number}: ${type.toUpperCase()} request recorded successfully.`);
      setActionModal(null);
      await fetchOrders();
      window.dispatchEvent(new CustomEvent('moss_order_placed', { detail: data }));
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Calculations
  const cartTotalUsd = cartItems.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
  const cartTotalInr = cartItems.reduce((acc, it) => {
    const itemInr = (it.price_inr !== undefined && it.price_inr !== null && !isNaN(Number(it.price_inr)))
      ? Number(it.price_inr)
      : Math.round((Number(it.price) || 0) * 85);
    return acc + itemInr * (Number(it.quantity) || 1);
  }, 0);

  // Genuine Delivery Tiers & Serviceability
  const selectableDeliveryTiers = getSelectableDeliveryOptions(shippingAddress.postal_code || '560034', cartTotalInr);
  const activeDeliveryTier = selectableDeliveryTiers.find((t) => t.id === selectedDeliveryTier) || selectableDeliveryTiers[0];

  let standardDeliveryFeeInr = activeDeliveryTier ? activeDeliveryTier.fee : (cartTotalInr >= 500 || cartTotalInr === 0 ? 0 : 50);

  // Coupon Discount
  let discountInr = 0;
  if (appliedCoupon === 'TROVI10' || appliedCoupon === 'MOSS10') {
    discountInr = Math.round(cartTotalInr * 0.1);
  } else if (appliedCoupon === 'SAVE100') {
    discountInr = Math.min(100, cartTotalInr);
  } else if (appliedCoupon === 'FREESHIP') {
    standardDeliveryFeeInr = 0;
  }

  const deliveryFeeInr = standardDeliveryFeeInr;
  const grandTotalInr = Math.max(0, cartTotalInr - discountInr) + deliveryFeeInr;
  const estimatedGstInr = Math.round(cartTotalInr * 0.05);

  const handleApplyCoupon = () => {
    setCouponError(null);
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    if (code === 'TROVI10' || code === 'MOSS10') {
      setAppliedCoupon(code);
      setCouponCode('');
    } else if (code === 'SAVE100') {
      if (cartTotalInr < 500) {
        setCouponError('SAVE100 requires a minimum order of ₹500.');
        return;
      }
      setAppliedCoupon('SAVE100');
      setCouponCode('');
    } else if (code === 'FREESHIP') {
      setAppliedCoupon('FREESHIP');
      setCouponCode('');
    } else {
      setCouponError('Invalid promo code. Try TROVI10, SAVE100, or FREESHIP.');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  const validateShippingAddress = () => {
    const errs = {};
    if (!shippingAddress.recipient_name?.trim() || shippingAddress.recipient_name.trim().length < 2) {
      errs.recipient_name = 'Enter recipient full name (min 2 characters).';
    }
    if (!/^[6-9]\d{9}$/.test(shippingAddress.phone?.trim() || '')) {
      errs.phone = '10-digit mobile number starting with 6, 7, 8, or 9.';
    }
    if (!/^\d{6}$/.test(shippingAddress.postal_code?.trim() || '')) {
      errs.postal_code = 'Enter a valid 6-digit PIN code.';
    }
    if (!shippingAddress.street_address?.trim() || shippingAddress.street_address.trim().length < 5) {
      errs.street_address = 'Enter detailed street address (min 5 characters).';
    }
    if (!shippingAddress.city?.trim()) {
      errs.city = 'Enter city.';
    }
    if (!shippingAddress.state?.trim()) {
      errs.state = 'Enter state.';
    }
    setAddressErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateBillingAddress = () => {
    if (billingSameAsShipping) return true;
    const errs = {};
    if (!billingAddress.recipient_name?.trim() || billingAddress.recipient_name.trim().length < 2) {
      errs.recipient_name = 'Enter billing name or entity name.';
    }
    if (!/^[6-9]\d{9}$/.test(billingAddress.phone?.trim() || '')) {
      errs.phone = 'Enter valid 10-digit mobile number.';
    }
    if (!/^\d{6}$/.test(billingAddress.postal_code?.trim() || '')) {
      errs.postal_code = 'Enter valid 6-digit PIN code.';
    }
    if (!billingAddress.street_address?.trim() || billingAddress.street_address.trim().length < 5) {
      errs.street_address = 'Enter detailed billing street address.';
    }
    if (!billingAddress.city?.trim()) {
      errs.city = 'Enter billing city.';
    }
    if (!billingAddress.state?.trim()) {
      errs.state = 'Enter billing state.';
    }
    if (isBusinessInvoice) {
      if (!businessName?.trim()) {
        errs.businessName = 'Enter registered company name.';
      }
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(businessGstin?.trim().toUpperCase() || '')) {
        errs.businessGstin = 'Enter valid 15-digit GSTIN (e.g., 29ABCDE1234F1Z5).';
      }
    }
    setBillingErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveNewAddress = (e) => {
    e.preventDefault();
    if (!newAddress.recipient_name || !newAddress.phone || !newAddress.street_address || !newAddress.postal_code) {
      alert('Please fill in all address fields.');
      return;
    }
    const created = {
      ...newAddress,
      id: `addr_${Date.now()}`,
    };
    const updated = [...addressBook, created];
    setAddressBook(updated);
    setShippingAddress(created);
    setShowNewAddressForm(false);
    setNewAddress({
      label: 'Custom',
      recipient_name: '',
      phone: '',
      postal_code: '',
      street_address: '',
      city: 'Bengaluru',
      state: 'Karnataka',
    });
  };

  const handleCancelOrder = async (orderNumber) => {
    if (!window.confirm(`Are you sure you want to cancel order ${orderNumber}? Reserved stock will be replenished immediately.`)) {
      return;
    }
    setCancellingOrderNo(orderNumber);
    setCancelMessage(null);
    try {
      const token = localStorage.getItem('moss_auth_token');
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderNumber)}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || 'Could not cancel order.');
      }
      setCancelMessage(`✓ Order ${orderNumber} cancelled successfully. Reserved inventory has been restored.`);
      await fetchOrders();
      window.dispatchEvent(new CustomEvent('moss_order_placed', { detail: data }));
    } catch (err) {
      alert(`Cancellation failed: ${err.message}`);
    } finally {
      setCancellingOrderNo(null);
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    if (!currentUser) {
      if (onOpenAuthModal) {
        onOpenAuthModal({ message: 'Sign in to place your order', returnTo: 'checkout' });
      }
      return;
    }

    const isShippingValid = validateShippingAddress();
    const isBillingValid = validateBillingAddress();

    if (!isShippingValid || !isBillingValid) {
      setCheckoutError('Please resolve address and billing validation errors above.');
      return;
    }

    if (paymentMethod === 'cod' && grandTotalInr > 10000) {
      setCheckoutError('Cash on Delivery (COD) is capped at ₹10,000. Please choose UPI or Card.');
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);

    const idempotencyKey = `idemp_cart_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Build billing payload
    const billingPayload = {
      same_as_shipping: billingSameAsShipping,
      recipient_name: billingSameAsShipping ? shippingAddress.recipient_name.trim() : billingAddress.recipient_name.trim(),
      phone: billingSameAsShipping ? shippingAddress.phone.trim() : billingAddress.phone.trim(),
      postal_code: billingSameAsShipping ? shippingAddress.postal_code.trim() : billingAddress.postal_code.trim(),
      street_address: billingSameAsShipping ? shippingAddress.street_address.trim() : billingAddress.street_address.trim(),
      city: billingSameAsShipping ? shippingAddress.city.trim() : billingAddress.city.trim(),
      state: billingSameAsShipping ? shippingAddress.state.trim() : billingAddress.state.trim(),
      is_business: isBusinessInvoice,
      company_name: isBusinessInvoice ? businessName.trim() : undefined,
      gstin: isBusinessInvoice ? businessGstin.trim().toUpperCase() : undefined,
    };

    let paymentMethodDisplay = 'Demo Pay / COD';
    if (paymentMethod === 'upi') {
      paymentMethodDisplay = `UPI (${upiVpa || 'Instant QR'})`;
    } else if (paymentMethod === 'card') {
      paymentMethodDisplay = `Card (${cardDetails.number.slice(-4)}) 3DS`;
    } else if (paymentMethod === 'netbanking') {
      paymentMethodDisplay = `Net Banking (${selectedBank})`;
    } else if (paymentMethod === 'cod') {
      paymentMethodDisplay = 'Cash on Delivery';
    }

    try {
      const payload = {
        items: cartItems.map((it) => ({
          product_id: it.id,
          quantity: it.quantity,
        })),
        customer_name: shippingAddress.recipient_name.trim(),
        customer_email: customerEmail || currentUser?.email || 'customer@moss.store',
        payment_method: paymentMethodDisplay,
        delivery_slot: selectedSlot,
        shipping_address: {
          recipient_name: shippingAddress.recipient_name.trim(),
          phone: shippingAddress.phone.trim(),
          postal_code: shippingAddress.postal_code.trim(),
          street_address: shippingAddress.street_address.trim(),
          city: shippingAddress.city.trim(),
          state: shippingAddress.state.trim(),
        },
        billing_address: billingPayload,
        coupon_code: appliedCoupon,
        discount_inr: discountInr,
        idempotency_key: idempotencyKey,
      };

      const token = localStorage.getItem('moss_auth_token');
      const res = await fetch(`${API_BASE}/api/order/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        if (onOpenAuthModal) {
          onOpenAuthModal({ message: 'Sign in to place your order', returnTo: 'checkout' });
        }
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Checkout failed (${res.status})`);
      }

      const orderData = await res.json();

      confetti({
        particleCount: 90,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#1c3024', '#8fa892', '#c86d51', '#f7f6f2'],
      });

      // Save order number to localStorage for persistent tracking across tabs & sessions
      if (orderData.order_number) {
        try {
          const existing = JSON.parse(localStorage.getItem('moss_agent_orders') || '[]');
          if (!existing.includes(orderData.order_number)) {
            existing.unshift(orderData.order_number);
            localStorage.setItem('moss_agent_orders', JSON.stringify(existing.slice(0, 50)));
          }
        } catch (e) {
          console.warn(e);
        }
      }

      setLastPlacedOrder(orderData);
      onClearCart();
      await fetchOrders();
      window.dispatchEvent(new CustomEvent('moss_order_placed', { detail: orderData }));
      setActiveTab('orders');
      setCheckoutStep('bag');
    } catch (err) {
      console.error('Checkout error:', err);
      setCheckoutError(err.message || 'Checkout failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(27, 42, 32, 0.65)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#ffffff',
          borderLeft: '1px solid var(--moss-border)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--moss-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-primary)',
          }}
        >
          <div style={{ display: 'flex', gap: 6, background: 'var(--moss-tint)', padding: 4, borderRadius: 'var(--radius-full)' }}>
            <button
              onClick={() => {
                setActiveTab('cart');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 18px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: activeTab === 'cart' ? 'var(--moss-deep)' : 'transparent',
                color: activeTab === 'cart' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <ShoppingBag size={14} /> Bag ({cartItems.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 18px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: activeTab === 'orders' ? 'var(--moss-deep)' : 'transparent',
                color: activeTab === 'orders' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Package size={14} /> Orders ({orders.length})
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--moss-tint)',
              border: 'none',
              color: 'var(--moss-deep)',
              cursor: 'pointer',
              borderRadius: '50%',
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: activeTab === 'cart' && checkoutStep === 'checkout' ? 0 : 20 }}>
          {activeTab === 'cart' ? (
            cartItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <ShoppingBag size={48} style={{ opacity: 0.25, margin: '0 auto 12px', color: 'var(--moss-deep)' }} />
                <h4 style={{ color: 'var(--moss-deep)', fontSize: '1.15rem', fontWeight: 700 }}>Your shopping bag is empty</h4>
                <p style={{ fontSize: '0.85rem', marginTop: 6, color: 'var(--text-secondary)' }}>
                  Explore our mindful collection or ask the AI Concierge to curate essentials for you.
                </p>
              </div>
            ) : checkoutStep === 'bag' ? (
              /* ================= STEP 1: REVIEW BAG ITEMS ================= */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Cart Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 12,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--moss-border)',
                      }}
                    >
                      <img
                        src={item.image_url || '/placeholder.png'}
                        alt={item.name}
                        style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8 }}
                        onError={(e) => {
                          e.target.src = '/placeholder.png';
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h5
                          style={{
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            color: 'var(--moss-deep)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.name}
                        </h5>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{item.brand || `${BRAND.name} Curated`}</span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--moss-deep)', marginTop: 2 }}>
                          {formatPrice(item.price, item.price_inr)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            border: '1px solid var(--moss-border)',
                            background: '#ffffff',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                          }}
                        >
                          -
                        </button>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: 18, textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            border: '1px solid var(--moss-border)',
                            background: '#ffffff',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                          }}
                        >
                          +
                        </button>
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--clay-terracotta)',
                            cursor: 'pointer',
                            marginLeft: 4,
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Promo Code Box */}
                <div
                  style={{
                    background: 'var(--bg-card-muted)',
                    padding: 12,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--moss-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Tag size={14} color="var(--moss-deep)" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                      Have a Coupon or Promo Code?
                    </span>
                  </div>

                  {appliedCoupon ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: 'var(--moss-tint)',
                        borderRadius: 6,
                        border: '1px solid var(--moss-sage)',
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                        ✓ {appliedCoupon} applied ({discountInr > 0 ? `Saved ₹${discountInr}` : 'Free Delivery'})
                      </span>
                      <button
                        onClick={handleRemoveCoupon}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--clay-terracotta)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="Try TROVI10, SAVE100, FREESHIP"
                          style={{
                            flex: 1,
                            padding: '7px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--moss-border)',
                            fontSize: '0.8rem',
                            outline: 'none',
                            textTransform: 'uppercase',
                          }}
                        />
                        <button
                          onClick={handleApplyCoupon}
                          style={{
                            padding: '7px 14px',
                            borderRadius: 6,
                            background: 'var(--moss-deep)',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Apply
                        </button>
                      </div>
                      {couponError && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--clay-terracotta)', marginTop: 4 }}>
                          {couponError}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Free Delivery Bar */}
                {cartTotalInr < 500 && (
                  <div
                    style={{
                      background: '#fdfbf7',
                      border: '1px solid #fae29c',
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: '0.78rem',
                      color: '#744210',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Truck size={15} />
                    <span>
                      Add <strong>₹{500 - cartTotalInr}</strong> more to unlock <strong>FREE Delivery</strong>!
                    </span>
                  </div>
                )}

                {/* Delivery Destination Preview */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--moss-border)',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={16} color="var(--moss-deep)" />
                    <div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Delivery to ({shippingAddress.label})</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                        {shippingAddress.recipient_name} · {shippingAddress.city} - {shippingAddress.postal_code}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setCheckoutStep('checkout')}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--moss-sage)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Change
                  </button>
                </div>

                {/* Genuine Selectable Delivery Speeds */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--moss-border)',
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--moss-deep)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Truck size={14} color="var(--moss-deep)" /> Select Delivery Speed
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--moss-sage)', fontWeight: 700 }}>
                      PIN: {shippingAddress.postal_code || '560034'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectableDeliveryTiers.map((tier) => {
                      const isSelected = selectedDeliveryTier === tier.id;
                      return (
                        <div
                          key={tier.id}
                          onClick={() => setSelectedDeliveryTier(tier.id)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: isSelected ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                            background: isSelected ? 'var(--moss-tint)' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              border: isSelected ? '5px solid var(--moss-deep)' : '1.5px solid var(--moss-border)',
                              background: '#ffffff',
                            }} />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong style={{ fontSize: '0.82rem', color: 'var(--moss-deep)' }}>{tier.name}</strong>
                                <span style={{ fontSize: '0.66rem', color: 'var(--moss-deep)', background: '#ffffff', padding: '1px 6px', borderRadius: 9999, border: '1px solid var(--moss-border)', fontWeight: 700 }}>
                                  {tier.badge}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {tier.eta} · {tier.timeSlot}
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: tier.fee === 0 ? 'var(--moss-forest)' : 'var(--moss-deep)' }}>
                            {tier.fee === 0 ? 'FREE' : `₹${tier.fee}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Price Breakdown Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    <span>Items Subtotal</span>
                    <span>₹{(cartTotalInr || 0).toLocaleString('en-IN')} (${(Number(cartTotalUsd) || 0).toFixed(2)})</span>
                  </div>
                  {discountInr > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--moss-forest)', fontWeight: 600 }}>
                      <span>Promo Discount ({appliedCoupon})</span>
                      <span>-₹{discountInr.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    <span>Delivery ({activeDeliveryTier?.name || 'Standard Delivery'})</span>
                    <span style={{ color: deliveryFeeInr === 0 ? 'var(--moss-forest)' : 'var(--text-primary)', fontWeight: 600 }}>
                      {deliveryFeeInr === 0 ? 'FREE' : `₹${deliveryFeeInr}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Estimated GST (Inclusive in MRP)</span>
                    <span>₹{estimatedGstInr.toLocaleString('en-IN')}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: 'var(--moss-deep)',
                      borderTop: '1px solid var(--moss-border)',
                      paddingTop: 10,
                      marginTop: 4,
                    }}
                  >
                    <span>Total Payable</span>
                    <span>₹{grandTotalInr.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Proceed Button */}
                <button
                  id="cart-proceed-checkout-btn"
                  onClick={() => {
                    if (!currentUser) {
                      if (onOpenAuthModal) {
                        onOpenAuthModal({ message: 'Sign in to place your order', returnTo: 'checkout' });
                      }
                      return;
                    }
                    setCheckoutStep('checkout');
                  }}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '0.94rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <span>Proceed to Delivery & Billing</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              /* ================= STEP 2: ADDRESS & BILLING CHECKOUT ================= */
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Stepper Header */}
                <div
                  style={{
                    padding: '14px 20px',
                    background: 'var(--bg-card-muted)',
                    borderBottom: '1px solid var(--moss-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <button
                    onClick={() => setCheckoutStep('bag')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'none',
                      border: 'none',
                      color: 'var(--moss-deep)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    <ArrowLeft size={16} /> Back to Bag
                  </button>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--moss-deep)', background: '#ffffff', padding: '3px 10px', borderRadius: 9999, border: '1px solid var(--moss-border)' }}>
                    Step 2 of 2 · Address & Payment
                  </div>
                </div>

                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* --- 1. SHIPPING ADDRESS SECTION --- */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--moss-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--moss-deep)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={15} color="var(--moss-deep)" /> 1. Shipping Address (Delivery Destination)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNewAddressForm(!showNewAddressForm)}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: 'var(--moss-sage)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Plus size={13} /> {showNewAddressForm ? 'Cancel New' : '+ Add Address'}
                      </button>
                    </div>

                    {/* Saved Address Book Selector or Clean Empty State */}
                    {addressBook && addressBook.length > 0 ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {addressBook.map((book) => (
                          <button
                            key={book.id || book.label}
                            type="button"
                            onClick={() => setShippingAddress(book)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-full)',
                              border: shippingAddress.street_address === book.street_address ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                              background: shippingAddress.street_address === book.street_address ? 'var(--moss-tint)' : '#ffffff',
                              color: 'var(--moss-deep)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {shippingAddress.street_address === book.street_address && <Check size={11} />}
                            <span>{book.label}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'var(--bg-card-muted)',
                        border: '1px dashed var(--moss-border)',
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}>
                        {currentUser ? (
                          <span>No saved delivery addresses found. Enter your address in the form below.</span>
                        ) : (
                          <>
                            <span>Sign in to access your saved delivery addresses.</span>
                            {onOpenAuthModal && (
                              <button
                                type="button"
                                onClick={() => onOpenAuthModal({ message: 'Sign in to access your saved addresses', returnTo: 'cart' })}
                                style={{
                                  background: 'var(--moss-deep)',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '4px 10px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Sign In
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Inline Form for Adding New Address */}
                    {showNewAddressForm && (
                      <form
                        onSubmit={handleSaveNewAddress}
                        style={{
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--moss-border)',
                          borderRadius: 8,
                          padding: 12,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                          Add New Delivery Address
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <input
                            type="text"
                            placeholder="Tag (e.g. Studio, Parents)"
                            value={newAddress.label}
                            onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                            style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                          <input
                            type="text"
                            placeholder="Recipient Full Name"
                            value={newAddress.recipient_name}
                            onChange={(e) => setNewAddress({ ...newAddress, recipient_name: e.target.value })}
                            style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <input
                            type="tel"
                            maxLength={10}
                            placeholder="10-digit Phone"
                            value={newAddress.phone}
                            onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value.replace(/\D/g, '') })}
                            style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="6-digit PIN Code"
                            value={newAddress.postal_code}
                            onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value.replace(/\D/g, '') })}
                            style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Flat, Building, Street Address"
                          value={newAddress.street_address}
                          onChange={(e) => setNewAddress({ ...newAddress, street_address: e.target.value })}
                          style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <input
                            type="text"
                            placeholder="City"
                            value={newAddress.city}
                            onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                            style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                          <input
                            type="text"
                            placeholder="State"
                            value={newAddress.state}
                            onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                            style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                        </div>
                        <button
                          type="submit"
                          style={{
                            padding: '7px',
                            background: 'var(--moss-deep)',
                            color: '#ffffff',
                            borderRadius: 6,
                            border: 'none',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Save & Select Address
                        </button>
                      </form>
                    )}

                    {/* Active Shipping Address Fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <input
                          type="text"
                          value={shippingAddress.recipient_name || ''}
                          onChange={(e) => {
                            setShippingAddress({ ...shippingAddress, recipient_name: e.target.value });
                            if (addressErrors.recipient_name) setAddressErrors({ ...addressErrors, recipient_name: null });
                          }}
                          placeholder="Recipient Name"
                          style={{
                            width: '100%',
                            background: '#ffffff',
                            border: addressErrors.recipient_name ? '1px solid var(--clay-terracotta)' : '1px solid var(--moss-border)',
                            borderRadius: 4,
                            padding: '7px 9px',
                            fontSize: '0.8rem',
                            outline: 'none',
                          }}
                        />
                        {addressErrors.recipient_name && (
                          <span style={{ fontSize: '0.66rem', color: 'var(--clay-terracotta)', marginTop: 2, display: 'block' }}>
                            {addressErrors.recipient_name}
                          </span>
                        )}
                      </div>

                      <div>
                        <input
                          type="tel"
                          maxLength={10}
                          value={shippingAddress.phone || ''}
                          onChange={(e) => {
                            setShippingAddress({ ...shippingAddress, phone: e.target.value.replace(/\D/g, '') });
                            if (addressErrors.phone) setAddressErrors({ ...addressErrors, phone: null });
                          }}
                          placeholder="10-digit Mobile"
                          style={{
                            width: '100%',
                            background: '#ffffff',
                            border: addressErrors.phone ? '1px solid var(--clay-terracotta)' : '1px solid var(--moss-border)',
                            borderRadius: 4,
                            padding: '7px 9px',
                            fontSize: '0.8rem',
                            outline: 'none',
                          }}
                        />
                        {addressErrors.phone && (
                          <span style={{ fontSize: '0.66rem', color: 'var(--clay-terracotta)', marginTop: 2, display: 'block' }}>
                            {addressErrors.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={shippingAddress.street_address || ''}
                        onChange={(e) => {
                          setShippingAddress({ ...shippingAddress, street_address: e.target.value });
                          if (addressErrors.street_address) setAddressErrors({ ...addressErrors, street_address: null });
                        }}
                        placeholder="Flat, House No., Building, Street"
                        style={{
                          width: '100%',
                          background: '#ffffff',
                          border: addressErrors.street_address ? '1px solid var(--clay-terracotta)' : '1px solid var(--moss-border)',
                          borderRadius: 4,
                          padding: '7px 9px',
                          fontSize: '0.8rem',
                          outline: 'none',
                        }}
                      />
                      {addressErrors.street_address && (
                        <span style={{ fontSize: '0.66rem', color: 'var(--clay-terracotta)', marginTop: 2, display: 'block' }}>
                          {addressErrors.street_address}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      <div>
                        <input
                          type="text"
                          value={shippingAddress.city || ''}
                          onChange={(e) => {
                            setShippingAddress({ ...shippingAddress, city: e.target.value });
                            if (addressErrors.city) setAddressErrors({ ...addressErrors, city: null });
                          }}
                          placeholder="City"
                          style={{
                            width: '100%',
                            background: '#ffffff',
                            border: addressErrors.city ? '1px solid var(--clay-terracotta)' : '1px solid var(--moss-border)',
                            borderRadius: 4,
                            padding: '7px 8px',
                            fontSize: '0.8rem',
                            outline: 'none',
                          }}
                        />
                        {addressErrors.city && (
                          <span style={{ fontSize: '0.66rem', color: 'var(--clay-terracotta)', marginTop: 2, display: 'block' }}>
                            {addressErrors.city}
                          </span>
                        )}
                      </div>

                      <div>
                        <input
                          type="text"
                          value={shippingAddress.state || ''}
                          onChange={(e) => {
                            setShippingAddress({ ...shippingAddress, state: e.target.value });
                            if (addressErrors.state) setAddressErrors({ ...addressErrors, state: null });
                          }}
                          placeholder="State"
                          style={{
                            width: '100%',
                            background: '#ffffff',
                            border: addressErrors.state ? '1px solid var(--clay-terracotta)' : '1px solid var(--moss-border)',
                            borderRadius: 4,
                            padding: '7px 8px',
                            fontSize: '0.8rem',
                            outline: 'none',
                          }}
                        />
                        {addressErrors.state && (
                          <span style={{ fontSize: '0.66rem', color: 'var(--clay-terracotta)', marginTop: 2, display: 'block' }}>
                            {addressErrors.state}
                          </span>
                        )}
                      </div>

                      <div>
                        <input
                          type="text"
                          maxLength={6}
                          value={shippingAddress.postal_code || ''}
                          onChange={(e) => {
                            setShippingAddress({ ...shippingAddress, postal_code: e.target.value.replace(/\D/g, '') });
                            if (addressErrors.postal_code) setAddressErrors({ ...addressErrors, postal_code: null });
                          }}
                          placeholder="PIN Code"
                          style={{
                            width: '100%',
                            background: '#ffffff',
                            border: addressErrors.postal_code ? '1px solid var(--clay-terracotta)' : '1px solid var(--moss-border)',
                            borderRadius: 4,
                            padding: '7px 8px',
                            fontSize: '0.8rem',
                            outline: 'none',
                          }}
                        />
                        {addressErrors.postal_code && (
                          <span style={{ fontSize: '0.66rem', color: 'var(--clay-terracotta)', marginTop: 2, display: 'block' }}>
                            {addressErrors.postal_code}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Genuine Delivery Speed & Preferred Slot Selector */}
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-primary)', padding: 12, borderRadius: 8, border: '1px solid var(--moss-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--moss-deep)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Truck size={14} color="var(--moss-deep)" /> Delivery Speed & Schedule
                        </span>
                        {lookupPincode(shippingAddress.postal_code).valid && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--moss-forest)', fontWeight: 700, background: '#ffffff', padding: '2px 8px', borderRadius: 9999, border: '1px solid var(--moss-border)' }}>
                            ✓ {lookupPincode(shippingAddress.postal_code).city} Serviceable
                          </span>
                        )}
                      </div>

                      {/* Tier Pills */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
                        {selectableDeliveryTiers.map((tier) => {
                          const isSelected = selectedDeliveryTier === tier.id;
                          return (
                            <button
                              key={tier.id}
                              type="button"
                              onClick={() => setSelectedDeliveryTier(tier.id)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: 6,
                                border: isSelected ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                                background: isSelected ? 'var(--moss-tint)' : '#ffffff',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--moss-deep)' }}>{tier.name}</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: tier.fee === 0 ? 'var(--moss-forest)' : 'var(--moss-deep)' }}>
                                  {tier.fee === 0 ? 'FREE' : `₹${tier.fee}`}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{tier.eta}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Time Slot Selector */}
                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <Clock size={11} /> Handover Time Window
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                          {[
                            { id: 'morning', label: 'Morning Slot', time: '7 - 10 AM' },
                            { id: 'afternoon', label: 'Afternoon Slot', time: '1 - 4 PM' },
                            { id: 'evening', label: 'Evening Slot', time: '6 - 9 PM' },
                          ].map((slot) => (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSelectedSlot(slot.id)}
                              style={{
                                padding: '6px 4px',
                                borderRadius: 6,
                                border: selectedSlot === slot.id ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                                background: selectedSlot === slot.id ? '#ffffff' : 'transparent',
                                color: 'var(--moss-deep)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{slot.label}</span>
                              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{slot.time}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* --- 2. BILLING ADDRESS & TAX INVOICING SECTION --- */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--moss-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--moss-deep)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Receipt size={15} color="var(--moss-deep)" /> 2. Billing Address & GST Tax Invoice
                      </span>
                    </div>

                    {/* Toggle: Same as shipping */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'var(--moss-deep)',
                        cursor: 'pointer',
                        background: 'var(--bg-primary)',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--moss-border)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={billingSameAsShipping}
                        onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                        style={{ accentColor: 'var(--moss-deep)', cursor: 'pointer' }}
                      />
                      <span>Billing address is the same as shipping address</span>
                    </label>

                    {/* Dedicated Billing Address Form if different */}
                    {!billingSameAsShipping && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          padding: 10,
                          background: 'var(--bg-card-muted)',
                          borderRadius: 8,
                          border: '1px solid var(--moss-border)',
                        }}
                      >
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                          Specify Billing Address
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <div>
                            <input
                              type="text"
                              value={billingAddress.recipient_name}
                              onChange={(e) => setBillingAddress({ ...billingAddress, recipient_name: e.target.value })}
                              placeholder="Billing Recipient Name"
                              style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                            />
                            {billingErrors.recipient_name && (
                              <span style={{ fontSize: '0.64rem', color: 'var(--clay-terracotta)' }}>{billingErrors.recipient_name}</span>
                            )}
                          </div>
                          <div>
                            <input
                              type="tel"
                              maxLength={10}
                              value={billingAddress.phone}
                              onChange={(e) => setBillingAddress({ ...billingAddress, phone: e.target.value.replace(/\D/g, '') })}
                              placeholder="Billing Phone (10-digit)"
                              style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                            />
                            {billingErrors.phone && (
                              <span style={{ fontSize: '0.64rem', color: 'var(--clay-terracotta)' }}>{billingErrors.phone}</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={billingAddress.street_address}
                            onChange={(e) => setBillingAddress({ ...billingAddress, street_address: e.target.value })}
                            placeholder="Billing Street, Flat or Office"
                            style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                          {billingErrors.street_address && (
                            <span style={{ fontSize: '0.64rem', color: 'var(--clay-terracotta)' }}>{billingErrors.street_address}</span>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                          <input
                            type="text"
                            value={billingAddress.city}
                            onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })}
                            placeholder="City"
                            style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                          <input
                            type="text"
                            value={billingAddress.state}
                            onChange={(e) => setBillingAddress({ ...billingAddress, state: e.target.value })}
                            placeholder="State"
                            style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                          <input
                            type="text"
                            maxLength={6}
                            value={billingAddress.postal_code}
                            onChange={(e) => setBillingAddress({ ...billingAddress, postal_code: e.target.value.replace(/\D/g, '') })}
                            placeholder="PIN Code"
                            style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Business GSTIN Tax Invoice Option */}
                    <div style={{ borderTop: '1px dashed var(--moss-border)', paddingTop: 8 }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: 'var(--moss-deep)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isBusinessInvoice}
                          onChange={(e) => setIsBusinessInvoice(e.target.checked)}
                          style={{ accentColor: 'var(--moss-deep)', cursor: 'pointer' }}
                        />
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Building size={13} color="var(--moss-deep)" /> Add Business GSTIN for Input Tax Credit (ITC)
                        </span>
                      </label>

                      {isBusinessInvoice && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: 10,
                            background: 'var(--moss-tint)',
                            borderRadius: 6,
                            border: '1px solid var(--moss-sage)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            <div>
                              <input
                                type="text"
                                placeholder="Registered Company Name"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                              />
                              {billingErrors.businessName && (
                                <span style={{ fontSize: '0.64rem', color: 'var(--clay-terracotta)' }}>{billingErrors.businessName}</span>
                              )}
                            </div>
                            <div>
                              <input
                                type="text"
                                maxLength={15}
                                placeholder="15-digit GSTIN (e.g. 29ABCDE1234F1Z5)"
                                value={businessGstin}
                                onChange={(e) => setBusinessGstin(e.target.value.toUpperCase())}
                                style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)', textTransform: 'uppercase' }}
                              />
                              {billingErrors.businessGstin && (
                                <span style={{ fontSize: '0.64rem', color: 'var(--clay-terracotta)' }}>{billingErrors.businessGstin}</span>
                              )}
                            </div>
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--moss-forest)' }}>
                            ✓ B2B Tax Invoice with Input Tax Credit (ITC) breakdown will be issued automatically.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* --- 3. PAYMENT METHOD GATEWAY --- */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--moss-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--moss-deep)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ShieldCheck size={15} color="var(--moss-deep)" /> 3. Select Payment Method
                    </span>

                    {/* Method Selector Tabs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
                      {[
                        { id: 'upi', label: 'UPI / QR', icon: '⚡' },
                        { id: 'card', label: 'Card (3DS)', icon: '💳' },
                        { id: 'netbanking', label: 'NetBank', icon: '🏛️' },
                        { id: 'cod', label: 'COD', icon: '📦' },
                      ].map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id)}
                          style={{
                            padding: '8px 4px',
                            borderRadius: 6,
                            border: paymentMethod === pm.id ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                            background: paymentMethod === pm.id ? 'var(--moss-tint)' : '#ffffff',
                            color: 'var(--moss-deep)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          <span style={{ fontSize: '0.9rem' }}>{pm.icon}</span>
                          <span>{pm.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Interactive Method Details */}
                    {paymentMethod === 'upi' && (
                      <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                          Instant UPI ID / VPA
                        </span>
                        <input
                          type="text"
                          value={upiVpa}
                          onChange={(e) => setUpiVpa(e.target.value)}
                          placeholder="yourname@okhdfcbank"
                          style={{ padding: '6px 8px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                          {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map((app) => (
                            <button
                              key={app}
                              type="button"
                              onClick={() => setUpiVpa(`user@${app.toLowerCase()}`)}
                              style={{
                                padding: '3px 8px',
                                borderRadius: 4,
                                border: '1px solid var(--moss-border)',
                                background: '#ffffff',
                                fontSize: '0.68rem',
                                color: 'var(--moss-deep)',
                                cursor: 'pointer',
                              }}
                            >
                              {app}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setShowQrCode(!showQrCode)}
                            style={{
                              marginLeft: 'auto',
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: '1px solid var(--moss-sage)',
                              background: showQrCode ? 'var(--moss-deep)' : 'transparent',
                              color: showQrCode ? '#ffffff' : 'var(--moss-deep)',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <QrCode size={11} /> {showQrCode ? 'Hide QR' : 'Show QR'}
                          </button>
                        </div>
                        {showQrCode && (
                          <div style={{ textAlign: 'center', padding: '10px 0', borderTop: '1px dashed var(--moss-border)', marginTop: 4 }}>
                            <div style={{ display: 'inline-block', padding: 8, background: '#ffffff', border: '1px solid var(--moss-border)', borderRadius: 8 }}>
                              <QrCode size={70} color="var(--moss-deep)" />
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Scan with any UPI App to authorize ₹{grandTotalInr.toLocaleString('en-IN')}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {paymentMethod === 'card' && (
                      <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                            Credit or Debit Card
                          </span>
                          <span style={{ fontSize: '0.66rem', color: 'var(--moss-forest)', fontWeight: 700 }}>
                            🔒 3D Secure 2.0 Encrypted
                          </span>
                        </div>
                        <input
                          type="text"
                          value={cardDetails.number}
                          onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
                          placeholder="Card Number (XXXX XXXX XXXX XXXX)"
                          style={{ padding: '6px 8px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 6 }}>
                          <input
                            type="text"
                            value={cardDetails.name}
                            onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                            placeholder="Cardholder Name"
                            style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                          <input
                            type="text"
                            maxLength={5}
                            value={cardDetails.expiry}
                            onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                            placeholder="MM/YY"
                            style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                          <input
                            type="password"
                            maxLength={3}
                            value={cardDetails.cvv}
                            onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
                            placeholder="CVV"
                            style={{ padding: '6px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--moss-border)' }}
                          />
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'netbanking' && (
                      <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                          Select Your Bank
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                          {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra'].map((b) => (
                            <button
                              key={b}
                              type="button"
                              onClick={() => setSelectedBank(b)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: 4,
                                border: selectedBank === b ? '1.5px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                                background: selectedBank === b ? 'var(--moss-tint)' : '#ffffff',
                                color: 'var(--moss-deep)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              {selectedBank === b ? '✓ ' : ''}{b}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'cod' && (
                      <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 6 }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                          📦 Cash or UPI on Delivery
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          Pay with cash or dynamic QR code when our eco-courier arrives at your doorstep.
                        </div>
                        {grandTotalInr > 10000 && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--clay-terracotta)', fontWeight: 700, marginTop: 4 }}>
                            ⚠️ COD limit is ₹10,000. Please select UPI or Card for this order.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* --- 4. BILLING & PRICE BREAKDOWN --- */}
                  <div
                    style={{
                      background: 'var(--bg-card-muted)',
                      border: '1px solid var(--moss-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                      Order Total & Tax Bill
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <span>Items Subtotal ({cartItems.length} items)</span>
                      <span>₹{cartTotalInr.toLocaleString('en-IN')}</span>
                    </div>
                    {discountInr > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--moss-forest)', fontWeight: 700 }}>
                        <span>Promo Discount ({appliedCoupon})</span>
                        <span>-₹{discountInr.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <span>Standard Delivery</span>
                      <span style={{ color: deliveryFeeInr === 0 ? 'var(--moss-forest)' : 'var(--text-primary)', fontWeight: 600 }}>
                        {deliveryFeeInr === 0 ? 'FREE' : '₹50'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Estimated GST (Inclusive in MRP)</span>
                      <span>₹{estimatedGstInr.toLocaleString('en-IN')}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: 'var(--moss-deep)',
                        borderTop: '1px solid var(--moss-border)',
                        paddingTop: 8,
                        marginTop: 2,
                      }}
                    >
                      <span>Grand Total</span>
                      <span>₹{grandTotalInr.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {checkoutError && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--clay-terracotta)', display: 'flex', alignItems: 'center', gap: 6, background: '#fff5f5', padding: '8px 10px', borderRadius: 6, border: '1px solid #fed7d7' }}>
                      <AlertCircle size={15} /> {checkoutError}
                    </div>
                  )}

                  {/* Primary Order Submission Button */}
                  <button
                    id="confirm-and-pay-btn"
                    onClick={handleCheckout}
                    disabled={isSubmitting}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontSize: '0.94rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="typing-dot" style={{ background: '#fff' }} />
                        <span style={{ marginLeft: 8 }}>Validating & Placing Order...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>Place Order · ₹{grandTotalInr.toLocaleString('en-IN')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          ) : (
            /* ================= MY ORDERS TAB ================= */
            orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <Package size={48} style={{ opacity: 0.25, margin: '0 auto 12px', color: 'var(--moss-deep)' }} />
                <h4 style={{ color: 'var(--moss-deep)', fontSize: '1.15rem', fontWeight: 700 }}>No orders placed yet</h4>
                <p style={{ fontSize: '0.85rem', marginTop: 6, color: 'var(--text-secondary)' }}>
                  Your placed orders with live tracking and GST tax invoices will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {cancelMessage && (
                  <div style={{ background: '#e6fffa', border: '1px solid #b2f5ea', color: '#234e52', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600 }}>
                    {cancelMessage}
                  </div>
                )}

                {actionSuccessMsg && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700 }}>
                    {actionSuccessMsg}
                  </div>
                )}

                {orders.map((ord) => {
                  const st = (ord.status || 'placed').toLowerCase();
                  const isCancel = st.includes('cancel');
                  const isReturn = st.includes('return');
                  const isExchange = st.includes('exchange');
                  const isRefund = st.includes('refund');
                  const isDelivered = st.includes('deliver');

                  let badgeBg = 'var(--moss-tint)';
                  let badgeColor = 'var(--moss-forest)';
                  let badgeBorder = 'var(--moss-border)';

                  if (isCancel) {
                    badgeBg = '#fdf2f2';
                    badgeColor = 'var(--clay-terracotta)';
                    badgeBorder = '#fecaca';
                  } else if (isReturn) {
                    badgeBg = '#fff7ed';
                    badgeColor = '#ea580c';
                    badgeBorder = '#fed7aa';
                  } else if (isExchange) {
                    badgeBg = '#eff6ff';
                    badgeColor = '#2563eb';
                    badgeBorder = '#bfdbfe';
                  } else if (isRefund) {
                    badgeBg = '#ecfdf5';
                    badgeColor = '#059669';
                    badgeBorder = '#a7f3d0';
                  }

                  return (
                    <div
                      key={ord.order_number || ord.id}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--moss-border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {/* Order Number & Status Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--moss-deep)' }}>
                          {ord.order_number || `Order #${ord.id}`}
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 'var(--radius-full)',
                            background: badgeBg,
                            color: badgeColor,
                            border: `1px solid ${badgeBorder}`,
                            textTransform: 'capitalize',
                          }}
                        >
                          {ord.status?.replace('_', ' ') || 'Confirmed'}
                        </span>
                      </div>

                      {/* Order Status Stepper */}
                      {(() => {
                        if (isCancel) {
                          return (
                            <div style={{ background: '#fef3f2', color: '#c86d51', padding: '6px 10px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 700 }}>
                              ✕ Order Cancelled · Inventory Restored
                            </div>
                          );
                        }
                        if (isReturn) {
                          return (
                            <div style={{ background: '#fff7ed', color: '#ea580c', padding: '6px 10px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <RotateCw size={14} /> Reverse Pickup & Return Scheduled · Delivery partner assigned
                            </div>
                          );
                        }
                        if (isExchange) {
                          return (
                            <div style={{ background: '#eff6ff', color: '#2563eb', padding: '6px 10px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <RefreshCw size={14} /> Exchange Replacement Dispatched · Same-day swap at doorstep
                            </div>
                          );
                        }
                        if (isRefund) {
                          return (
                            <div style={{ background: '#ecfdf5', color: '#059669', padding: '6px 10px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <ShieldCheck size={14} /> Refund Credited to Original Bank Account · Reference ARN issued
                            </div>
                          );
                        }

                        const steps = ['Placed', 'Packed', 'Shipped', 'Delivered'];
                        let curIdx = 0;
                        if (st.includes('pack')) curIdx = 1;
                        if (st.includes('ship')) curIdx = 2;
                        if (isDelivered) curIdx = 3;

                        return (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 2px', background: '#ffffff', borderRadius: 8, border: '1px solid var(--moss-border)' }}>
                            {steps.map((step, idx) => (
                              <React.Fragment key={step}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
                                  <div
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: '50%',
                                      background: idx <= curIdx ? 'var(--moss-deep)' : '#e6e5df',
                                      color: '#ffffff',
                                      fontSize: '0.62rem',
                                      fontWeight: 800,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {idx <= curIdx ? '✓' : idx + 1}
                                  </div>
                                  <span style={{ fontSize: '0.66rem', color: idx <= curIdx ? 'var(--moss-deep)' : 'var(--text-muted)', fontWeight: idx === curIdx ? 700 : 500 }}>
                                    {step}
                                  </span>
                                </div>
                                {idx < steps.length - 1 && (
                                  <div style={{ height: 2, flex: 1, background: idx < curIdx ? 'var(--moss-deep)' : '#e6e5df', marginBottom: 12 }} />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        );
                      })()}

                      <div>
                        <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--moss-deep)', marginBottom: 4 }}>
                          {ord.items_summary}
                        </h5>

                        {/* Delivery Address */}
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                          <MapPin size={13} color="var(--moss-sage)" style={{ marginTop: 2, flexShrink: 0 }} />
                          <span style={{ lineBreak: 'anywhere' }}>
                            <strong>Deliver to:</strong> {ord.customer_address || 'Address on file'}
                          </span>
                        </div>

                        {/* Billing Address / GSTIN info */}
                        {ord.billing_address && ord.billing_address !== ord.customer_address && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                            <Receipt size={13} color="var(--moss-sage)" style={{ marginTop: 2, flexShrink: 0 }} />
                            <span style={{ lineBreak: 'anywhere' }}>
                              <strong>Billed to:</strong> {ord.billing_address}
                            </span>
                          </div>
                        )}

                        {ord.buyer_gstin && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--moss-deep)', fontWeight: 700, marginLeft: 19, marginTop: 2 }}>
                            GSTIN: {ord.buyer_gstin} {ord.buyer_company ? `(${ord.buyer_company})` : ''}
                          </div>
                        )}

                        {/* Payment Method */}
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <CreditCard size={13} color="var(--moss-sage)" />
                          <span>Paid via: {ord.payment_method || 'Instant Pay / COD'}</span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: 8,
                          borderTop: '1px solid var(--moss-border)',
                          fontSize: '0.8rem',
                        }}
                      >
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                          <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                          {ord.ordered_at}
                        </span>
                        <strong style={{ color: 'var(--moss-deep)', fontSize: '1.05rem', fontWeight: 800 }}>
                          ₹{(ord.total_price_inr || Math.round(ord.total_price * 85)).toLocaleString('en-IN')}
                        </strong>
                      </div>

                      {/* Action Buttons: Invoice, Return, Exchange, Refund, Cancel */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => window.open(`${API_BASE}/api/orders/${encodeURIComponent(ord.order_number)}/invoice?format=html`, '_blank')}
                          className="touch-target"
                          style={{
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--moss-border)',
                            background: '#ffffff',
                            color: 'var(--moss-deep)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          📄 GST Invoice
                        </button>

                        {!isCancel && !isRefund && (
                          <>
                            <button
                              onClick={() => setActionModal({ type: 'return', order: ord, reason: 'Defective item / not satisfied with quality' })}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 'var(--radius-full)',
                                border: '1px solid #fed7aa',
                                background: '#fff7ed',
                                color: '#c2410c',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <RotateCw size={12} /> Return
                            </button>

                            <button
                              onClick={() => setActionModal({ type: 'exchange', order: ord, reason: 'Size / variant exchange', replacementItem: 'Replacement identical variant' })}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 'var(--radius-full)',
                                border: '1px solid #bfdbfe',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <RefreshCw size={12} /> Exchange
                            </button>

                            <button
                              onClick={() => setActionModal({ type: 'refund', order: ord, reason: 'Instant customer refund request' })}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 'var(--radius-full)',
                                border: '1px solid #a7f3d0',
                                background: '#ecfdf5',
                                color: '#047857',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <ShieldCheck size={12} /> Refund
                            </button>
                          </>
                        )}

                        {!isCancel && !isDelivered && !isReturn && (
                          <button
                            onClick={() => handleCancelOrder(ord.order_number)}
                            disabled={cancellingOrderNo === ord.order_number}
                            className="touch-target"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-full)',
                              border: '1px solid #fed7d7',
                              background: '#fff5f5',
                              color: 'var(--clay-terracotta)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {cancellingOrderNo === ord.order_number ? 'Cancelling...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

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
              {actionModal.type === 'refund' && 'Instant credit of ₹' + (actionModal.order.total_price_inr || actionModal.order.total_price)?.toLocaleString('en-IN') + ' will be processed to your source payment method.'}
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
  );
}
