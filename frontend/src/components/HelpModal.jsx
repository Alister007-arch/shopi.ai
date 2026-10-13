import React, { useState } from 'react';
import {
  X, HelpCircle, RotateCw, RefreshCw, ShieldCheck, Mail, Phone,
  MapPin, MessageSquare, ChevronDown, ChevronUp, Search, ArrowRight,
  Package, Clock, CheckCircle2, Sparkles, CreditCard
} from 'lucide-react';
import { API_BASE } from '../config';
import { BRAND } from '../config/brand';

const FAQ_ITEMS = [
  {
    q: "How does 1-Command Auto-Ordering work?",
    category: "Ordering",
    a: "Simply speak or type your request in chat—for example: 'Auto order 500g raw wild honey to home address' or 'Buy 1 kg oats to office address'. The Trovi AI assistant parses your item and address preference, verifies real-time inventory, and confirms your order with zero tedious clicks."
  },
  {
    q: "What is the Return, Exchange & Refund policy?",
    category: "Returns",
    a: "Trovi offers category-specific return and exchange policies. You can request a return, variant exchange, or refund directly from your Orders drawer or by telling Trovi AI 'Return my last order'. Reverse pickup is free and refunds are credited back to your original payment method upon pickup."
  },
  {
    q: "How do I use the Voice Assistant?",
    category: "Voice Assistant",
    a: "Click the 🎙️ Voice microphone button inside the chat input box. Speak your shopping or return command clearly in English or Hinglish. The assistant transcribes your voice in real time and speaks responses aloud through text-to-speech synthesis (which you can mute or unmute using the audio icon in the header)."
  },
  {
    q: "How fast is delivery?",
    category: "Delivery",
    a: "We offer Same-Day Express Delivery across Bengaluru within 4 to 6 hours for orders placed before 3:00 PM. All other locations receive priority delivery within 24 to 48 hours via our verified delivery partners."
  },
  {
    q: "Are GST Tax Invoices available for business Input Tax Credit (ITC)?",
    category: "Billing",
    a: "Yes! Every order automatically generates a compliant GST Tax Invoice. You can view or download it anytime from the My Orders section or print an official PDF/HTML copy containing complete CGST, SGST, IGST, and HSN tax breakdowns."
  },
  {
    q: "Can I exchange an item for a different size or variant?",
    category: "Returns",
    a: "Yes. When viewing your order card, click '🔁 Exchange' and specify the replacement item or size. Our delivery partner will bring your replacement unit and collect the existing item at your doorstep simultaneously."
  },
  {
    q: "What payment methods are supported?",
    category: "Billing",
    a: "We support UPI (GPay, PhonePe, Paytm, BHIM), all major Credit/Debit Cards with 3D Secure verification, Net Banking across 50+ Indian banks, and Cash on Delivery (COD) for orders up to ₹10,000."
  }
];

export default function HelpModal({
  isOpen,
  onClose,
  initialTab = 'faq', // 'faq' | 'returns' | 'contact'
  onOpenOrders = null,
  onOpenChat = null,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [faqSearch, setFaqSearch] = useState('');
  
  // Instant Order lookup in Returns tab
  const [lookupOrderNumber, setLookupOrderNumber] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Sync initialTab when modal opens
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
    setLookupResult(null);
    setLookupError(null);
    setActionSuccess(null);
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  const handleLookupOrder = async (e) => {
    e.preventDefault();
    const query = lookupOrderNumber.trim();
    if (!query) return;

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    setActionSuccess(null);

    try {
      const token = localStorage.getItem('moss_auth_token');
      let orderData = null;

      // 1. Try authenticated order lookup first if user is logged in
      if (token) {
        try {
          const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(query)}`, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });
          if (res.ok) {
            orderData = await res.json();
          }
        } catch (e) {
          console.warn('Auth order lookup error:', e);
        }
      }

      // 2. Fall back to live order tracking endpoint
      if (!orderData) {
        const trackRes = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(query)}/track`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
        });
        if (trackRes.ok) {
          orderData = await trackRes.json();
        }
      }

      if (!orderData) {
        throw new Error(`Order #${query} not found. Please verify your order number.`);
      }
      setLookupResult(orderData);
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleQuickAction = async (type) => {
    if (!lookupResult) return;
    try {
      const ordNo = lookupResult.order_number || lookupResult.id;
      const token = localStorage.getItem('moss_auth_token');
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(ordNo)}/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: `Requested via Help & Returns portal (${type})` })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || `Failed to process ${type}`);
      
      setActionSuccess(`✓ ${type.toUpperCase()} request placed successfully for #${ordNo}!`);
      // Refresh lookup with tracking
      const updatedRes = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(ordNo)}/track`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      if (updatedRes.ok) {
        setLookupResult(await updatedRes.json());
      }
      window.dispatchEvent(new CustomEvent('moss_order_placed', { detail: data }));
    } catch (e) {
      alert(`Action error: ${e.message}`);
    }
  };

  const filteredFaqs = FAQ_ITEMS.filter((f) =>
    f.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
    f.a.toLowerCase().includes(faqSearch.toLowerCase()) ||
    f.category.toLowerCase().includes(faqSearch.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.72)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px 16px',
    }}>
      <div
        className="glass-panel"
        style={{
          background: '#ffffff',
          color: 'var(--text-primary)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid var(--moss-border)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          background: '#142017',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <HelpCircle size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, letterSpacing: '0.01em' }}>
                Help & Customer Support Hub
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.7)', margin: '2px 0 0 0' }}>
                {BRAND.name} Care · Returns, FAQs, and 24/7 AI Support
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              color: '#ffffff',
              padding: 8,
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--moss-border)',
          background: 'var(--bg-card-muted)',
          padding: '6px 16px 0 16px',
          gap: 8,
        }}>
          {[
            { id: 'returns', label: 'Returns & Refunds', icon: <RotateCw size={15} /> },
            { id: 'faq', label: 'FAQs & Policies', icon: <HelpCircle size={15} /> },
            { id: 'contact', label: 'Contact Us', icon: <MessageSquare size={15} /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  border: 'none',
                  borderBottom: isActive ? '3px solid var(--moss-deep)' : '3px solid transparent',
                  background: 'transparent',
                  color: isActive ? 'var(--moss-deep)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          {/* TAB 1: RETURNS & REFUNDS PORTAL */}
          {activeTab === 'returns' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Policy Highlight Banner */}
              <div style={{
                background: 'linear-gradient(135deg, var(--moss-tint) 0%, rgba(0, 242, 254, 0.08) 100%)',
                border: '1px solid var(--moss-border)',
                borderRadius: 'var(--radius-md)',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'var(--moss-deep)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--moss-deep)', margin: 0 }}>
                    7-Day Hassle-Free Returns & Instant Refunds
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                    Not completely satisfied? We offer complimentary doorstep reverse pickup. Choose between an immediate variant exchange or an instant refund to your source bank or UPI account.
                  </p>
                </div>
              </div>

              {/* Order Quick Actions Buttons */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {onOpenOrders && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenOrders();
                    }}
                    className="btn-primary"
                    style={{ flex: 1, padding: '12px 18px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Package size={16} /> Open My Orders to Return or Exchange
                  </button>
                )}
                {onOpenChat && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenChat();
                    }}
                    className="btn-ghost"
                    style={{ flex: 1, padding: '12px 18px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <MessageSquare size={16} /> Ask AI Concierge to Process Return
                  </button>
                )}
              </div>

              {/* Order ID Direct Lookup Form */}
              <div style={{
                border: '1px solid var(--moss-border)',
                borderRadius: 'var(--radius-md)',
                padding: 18,
                background: 'var(--bg-card)',
              }}>
                <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--moss-deep)', margin: '0 0 8px 0' }}>
                  Look Up Any Order by Number
                </h5>
                <form onSubmit={handleLookupOrder} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={lookupOrderNumber}
                    onChange={(e) => setLookupOrderNumber(e.target.value)}
                    placeholder="Enter Order # (e.g., ORD-2026-0001 or 1001)"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--moss-border)',
                      fontSize: '0.86rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={lookupLoading}
                    className="btn-primary"
                    style={{ padding: '10px 18px', fontSize: '0.84rem' }}
                  >
                    {lookupLoading ? 'Searching...' : 'Find Order'}
                  </button>
                </form>

                {lookupError && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                    {lookupError}
                  </div>
                )}

                {actionSuccess && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: '#dcfce7', color: '#15803d', borderRadius: 6, fontSize: '0.8rem', fontWeight: 700 }}>
                    {actionSuccess}
                  </div>
                )}

                {/* Lookup Card Result */}
                {lookupResult && (
                  <div style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 8,
                    background: 'var(--bg-card-muted)',
                    border: '1px solid var(--moss-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--moss-deep)' }}>
                        #{lookupResult.order_number}
                      </span>
                      <span className="badge-mint" style={{ textTransform: 'uppercase', fontSize: '0.72rem' }}>
                        {lookupResult.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Total: ₹{Number(lookupResult.total_price_inr || (lookupResult.total_price ? lookupResult.total_price * 85 : 0)).toLocaleString('en-IN')} • {lookupResult.customer_address || 'Registered Address'}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleQuickAction('return')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #fed7aa',
                          background: '#fff7ed',
                          color: '#c2410c',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <RotateCw size={12} /> Request Return
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAction('exchange')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <RefreshCw size={12} /> Request Exchange
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAction('refund')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #a7f3d0',
                          background: '#ecfdf5',
                          color: '#047857',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <CheckCircle2 size={12} /> Instant Refund
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FAQS ACCORDION */}
          {activeTab === 'faq' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Search Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'var(--bg-card-muted)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--moss-border)',
              }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  placeholder="Search questions on orders, returns, payments, or voice assistant..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.86rem',
                    color: 'var(--text-primary)',
                  }}
                />
                {faqSearch && (
                  <button
                    onClick={() => setFaqSearch('')}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Accordion Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredFaqs.map((faq, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div
                      key={idx}
                      style={{
                        border: isOpen ? '1px solid var(--moss-deep)' : '1px solid var(--moss-border)',
                        borderRadius: 'var(--radius-sm)',
                        background: isOpen ? 'var(--moss-tint)' : '#ffffff',
                        transition: 'all 0.2s',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        style={{
                          width: '100%',
                          padding: '14px 18px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--moss-deep)',
                            color: '#ffffff',
                          }}>
                            {faq.category}
                          </span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--moss-deep)' }}>
                            {faq.q}
                          </span>
                        </div>
                        {isOpen ? <ChevronUp size={18} color="var(--moss-deep)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                      </button>

                      {isOpen && (
                        <div style={{
                          padding: '0 18px 16px 18px',
                          fontSize: '0.84rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.6,
                        }}>
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CONTACT US */}
          {activeTab === 'contact' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Concierge Highlight Card */}
              <div style={{
                background: 'linear-gradient(135deg, #142017 0%, var(--moss-deep) 100%)',
                color: '#ffffff',
                padding: '22px 24px',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}>
                <div>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Immediate Live Assistance
                  </span>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '4px 0 6px 0' }}>
                    Speak with {BRAND.assistantName}
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.8)', margin: 0, maxWidth: 380 }}>
                    Get real-time answers, check live order delivery status, process returns, or request custom recommendations instantly.
                  </p>
                </div>
                {onOpenChat && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenChat();
                    }}
                    className="btn-primary"
                    style={{ background: '#ffffff', color: '#142017', padding: '12px 20px', fontWeight: 800 }}
                  >
                    Open {BRAND.assistantName} <ArrowRight size={15} style={{ marginLeft: 6 }} />
                  </button>
                )}
              </div>

              {/* Contact Channels Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div style={{ background: 'var(--bg-card-muted)', padding: 18, borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Mail size={18} color="var(--moss-deep)" />
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--moss-deep)' }}>Email Support</span>
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--moss-forest)', fontWeight: 700 }}>
                    {BRAND.supportEmail}
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Response within 15 minutes
                  </span>
                </div>

                <div style={{ background: 'var(--bg-card-muted)', padding: 18, borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Phone size={18} color="var(--moss-deep)" />
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--moss-deep)' }}>Toll-Free Helpline</span>
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--moss-forest)', fontWeight: 700 }}>
                    +91 80 4567 8900
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Mon - Sun: 7:00 AM - 11:00 PM IST
                  </span>
                </div>

                <div style={{ background: 'var(--bg-card-muted)', padding: 18, borderRadius: 'var(--radius-sm)', border: '1px solid var(--moss-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <MapPin size={18} color="var(--moss-deep)" />
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--moss-deep)' }}>Fulfillment Hub</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    EcoSpace Tech Park, Tower 3B, Outer Ring Road, Bellandur, Bengaluru - 560103
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
