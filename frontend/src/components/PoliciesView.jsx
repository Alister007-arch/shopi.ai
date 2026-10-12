import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  Clock,
  Camera,
  AlertCircle,
  CheckCircle2,
  Package,
  Sparkles,
  Mail,
  UserCheck,
  MessageSquare,
  ArrowRight,
  HelpCircle,
  FileText,
  BadgeAlert,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { API_BASE } from '../config';
import { BRAND } from '../config/brand';

const POLICY_SECTIONS = [
  {
    id: 'cancellation',
    title: 'Cancel your order',
    badge: 'Free Until Shipped',
    badgeColor: 'emerald',
    icon: RotateCcw,
    windowSummary: 'Instant cancellation before dispatch',
    content: `You can cancel free of charge until your order is shipped. Once shipped, you can refuse delivery or return it after delivery. Prepaid orders are refunded to the original payment method.`,
    highlights: [
      '100% free cancellation prior to carrier pickup / shipped status',
      'Immediate automated refund release to original payment method',
      'Refusal at doorstep supported if already in transit',
    ],
  },
  {
    id: 'food_and_grocery',
    title: 'Food and grocery (honey, oats, oils, nuts, tea, snacks)',
    badge: '48 Hours • Photo Required',
    badgeColor: 'amber',
    icon: Package,
    windowSummary: 'Report within 48 hours of delivery',
    content: `For hygiene and safety, we do not accept returns for change of mind. Report within 48 hours of delivery with a photo if the item is damaged, leaking, expired, wrong, missing or has a quality issue. We will replace it or refund you.`,
    highlights: [
      'Strict food safety standard: No returns for change of mind',
      'Accepted claims: Damaged, leaking, expired, wrong, missing, or quality issues',
      'Photo upload required with report',
      'Resolution: Immediate replacement or full refund',
    ],
  },
  {
    id: 'fresh_produce',
    title: 'Fresh produce, milk and eggs',
    badge: '24 Hours • Photo Required',
    badgeColor: 'rose',
    icon: Clock,
    windowSummary: 'Report within 24 hours of delivery',
    content: `Report within 24 hours of delivery with a photo if the item is damaged, spoiled, wrong or missing.`,
    highlights: [
      'Fast-track perishable resolution within 24 hours',
      'Accepted claims: Damaged, spoiled, wrong item, or missing',
      'Photo proof required via Concierge or Orders page',
      'Resolution: Replacement or prompt refund',
    ],
  },
  {
    id: 'clothing',
    title: 'Clothing & Fashion',
    badge: '7 Days • Unworn with Tags',
    badgeColor: 'blue',
    icon: Sparkles,
    windowSummary: '7-day return or exchange window',
    content: `Return or exchange within 7 days if unworn with tags and original packaging. Innerwear is not returnable, except damaged or wrong items.`,
    highlights: [
      '7 days return or exchange period',
      'Items must be unworn, with all brand tags and original packaging intact',
      'Doorstep size exchange with simultaneous reverse pickup',
      'Innerwear exception: strictly non-returnable unless received damaged or incorrect',
    ],
  },
  {
    id: 'electronics',
    title: 'Electronics & Smart Tech',
    badge: '7 Days • Replace First',
    badgeColor: 'indigo',
    icon: CheckCircle2,
    windowSummary: '7 days for defects or damage',
    content: `Within 7 days for defective, dead on arrival, damaged or wrong items. We replace first; if a replacement is not available, we refund. Warranty claims go through the brand.`,
    highlights: [
      '7-day window for defective, dead on arrival, damaged, or wrong items',
      'Priority resolution: Replacement dispatched first; full refund if out of stock',
      'Long-term post-7-day warranty handled through authorized brand service centers',
    ],
  },
  {
    id: 'luxury',
    title: 'Luxury items',
    badge: '7 Days • Mandatory Inspection',
    badgeColor: 'purple',
    icon: ShieldCheck,
    windowSummary: '7 days sealed with certificate',
    content: `Within 7 days if sealed, unused and complete with tags and certificates. Each return goes through an inspection.`,
    highlights: [
      '7 days return eligibility',
      'Must remain sealed, unused, complete with authenticity cards & certificates',
      'Every return undergoes specialized physical white-glove inspection',
      'Refund processed immediately upon verification passing',
    ],
  },
  {
    id: 'refunds',
    title: 'Refunds & Payment Processing',
    badge: '5 to 7 Business Days',
    badgeColor: 'teal',
    icon: FileText,
    windowSummary: 'Prepaid 5–7 days • COD to Bank / UPI',
    content: `Prepaid orders: 5 to 7 business days after we receive and check the item. COD orders: refunded to your bank account or UPI (we will ask for details). Delivery fee is refunded when the mistake is ours (damaged, wrong, missing, expired or defective item). Gift wrap and handling fees are not refundable. If you used a coupon, the refund is the amount you paid for that item.`,
    highlights: [
      'Prepaid orders: 5 to 7 business days following item check',
      'COD orders: Transferred to your verified bank account or UPI VPA',
      'Delivery fee refunded in full when error is ours (damaged, wrong, expired, defective)',
      'Gift wrap and handling fees are non-refundable',
      'Coupon purchases: Refund reflects the exact discounted price paid for that item',
    ],
  },
  {
    id: 'help',
    title: 'Need help? Concierge & Grievance',
    badge: '24-Hour SLA Reply',
    badgeColor: 'emerald',
    icon: Mail,
    windowSummary: 'Dedicated support & Grievance Officer',
    content: `Chat with ${BRAND.assistantName} (${BRAND.chatButtonLabel}), or email ${BRAND.supportEmail}. Grievance officer: ${BRAND.grievanceOfficer.name}, ${BRAND.grievanceOfficer.email}. We reply within 24 hours.`,
    highlights: [
      `AI Assistant available 24/7 for zero-wait instant answers`,
      `Customer Support email: ${BRAND.supportEmail}`,
      `Statutory Grievance Officer: ${BRAND.grievanceOfficer.name} (${BRAND.grievanceOfficer.email})`,
      'Guaranteed first-response resolution SLA within 24 hours',
    ],
  },
];

export default function PoliciesView({ onOpenChat = null, onNavigateHome = null }) {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [serverPolicyData, setServerPolicyData] = useState(null);

  // Fetch live policies metadata from backend API
  useEffect(() => {
    fetch(`${API_BASE}/api/policies`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setServerPolicyData(data);
      })
      .catch((err) => {
        console.warn('Notice: Using client policy copy:', err);
      });
  }, []);

  const filteredSections = POLICY_SECTIONS.filter((sec) => {
    const matchesFilter = selectedFilter === 'all' || sec.id === selectedFilter;
    const matchesSearch =
      !searchQuery ||
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getBadgeStyle = (color) => {
    switch (color) {
      case 'emerald':
        return { background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' };
      case 'amber':
        return { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' };
      case 'rose':
        return { background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3' };
      case 'blue':
        return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
      case 'indigo':
        return { background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' };
      case 'purple':
        return { background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' };
      default:
        return { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' };
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 20px 80px 20px' }}>
      {/* 1. Header Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1d3324 0%, #294732 100%)',
        color: '#ffffff',
        borderRadius: 20,
        padding: '48px 36px',
        marginBottom: 36,
        boxShadow: '0 12px 36px rgba(29, 51, 36, 0.16)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.04)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(255, 255, 255, 0.12)', fontSize: '0.82rem', fontWeight: 600, marginBottom: 16 }}>
          <ShieldCheck size={16} color="#86efac" />
          <span>Official Store Guidelines • Customer Guarantee</span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-heading, "Outfit", sans-serif)',
          fontSize: '2.5rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          margin: '0 0 14px 0',
          lineHeight: 1.15,
        }}>
          RETURNS, EXCHANGE AND REFUND POLICY
        </h1>

        <p style={{
          fontSize: '1.05rem',
          color: 'rgba(255, 255, 255, 0.85)',
          maxWidth: 780,
          margin: '0 0 24px 0',
          lineHeight: 1.6,
        }}>
          Fair, transparent, and deterministic. All returns, variant exchanges, and refund calculations follow
          strict business guardrails to ensure customer satisfaction and safety.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {onOpenChat && (
            <button
              onClick={() => onOpenChat(`Tell me about ${BRAND.name}'s return policy for my order`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#ffffff',
                color: '#1d3324',
                border: 'none',
                borderRadius: 10,
                padding: '11px 20px',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <MessageSquare size={16} />
              {BRAND.chatButtonLabel}
            </button>
          )}

          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: 10,
                padding: '11px 18px',
                fontSize: '0.92rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back to Catalog
            </button>
          )}
        </div>
      </div>

      {/* 2. Fast Navigation Category Pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 16,
        marginBottom: 28,
      }}>
        {[
          { id: 'all', label: 'All Policies' },
          { id: 'cancellation', label: 'Cancel Order' },
          { id: 'food_and_grocery', label: 'Food & Grocery' },
          { id: 'fresh_produce', label: 'Produce & Dairy' },
          { id: 'clothing', label: 'Clothing' },
          { id: 'electronics', label: 'Electronics' },
          { id: 'luxury', label: 'Luxury' },
          { id: 'refunds', label: 'Refunds' },
          { id: 'help', label: 'Help & Grievance' },
        ].map((item) => {
          const isActive = selectedFilter === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedFilter(item.id)}
              style={{
                whiteSpace: 'nowrap',
                padding: '9px 18px',
                borderRadius: 999,
                fontSize: '0.88rem',
                fontWeight: isActive ? 700 : 500,
                background: isActive ? '#294732' : '#ffffff',
                color: isActive ? '#ffffff' : '#374151',
                border: isActive ? '1px solid #294732' : '1px solid #e5e7eb',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* 3. Policy Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        {filteredSections.map((sec) => {
          const IconComp = sec.icon;
          const badgeStyle = getBadgeStyle(sec.badgeColor);

          return (
            <div
              key={sec.id}
              id={sec.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 16,
                padding: '28px 30px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 14,
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#294732',
                  }}>
                    <IconComp size={24} />
                  </div>
                  <div>
                    <h2 style={{
                      fontFamily: 'var(--font-heading, "Outfit", sans-serif)',
                      fontSize: '1.35rem',
                      fontWeight: 700,
                      color: '#111827',
                      margin: '0 0 4px 0',
                    }}>
                      {sec.title}
                    </h2>
                    <span style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 500 }}>
                      {sec.windowSummary}
                    </span>
                  </div>
                </div>

                <span style={{
                  ...badgeStyle,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: 999,
                  letterSpacing: '0.02em',
                }}>
                  {sec.badge}
                </span>
              </div>

              {/* Customer Policy Text Quote */}
              <div style={{
                background: '#f9fafb',
                borderLeft: '4px solid #294732',
                padding: '16px 20px',
                borderRadius: '0 10px 10px 0',
                fontSize: '0.96rem',
                lineHeight: 1.65,
                color: '#1f2937',
                marginBottom: 20,
              }}>
                {sec.content}
              </div>

              {/* Structured Key Points */}
              <div style={{ marginBottom: 18 }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Key Policy Highlights
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                  {sec.highlights.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.88rem', color: '#374151', lineHeight: 1.45 }}>
                      <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action trigger */}
              {onOpenChat && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  borderTop: '1px solid #f3f4f6',
                  paddingTop: 14,
                }}>
                  <button
                    onClick={() => onOpenChat(`Help me understand the ${sec.title} policy for my order.`)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#294732',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>Ask Concierge about this rule</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Grievance & Help Callout Box */}
      <div style={{
        marginTop: 48,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        padding: '32px 36px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 32,
      }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px 0' }}>
            Need Additional Assistance?
          </h3>
          <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, margin: 0 }}>
            Our {BRAND.name} autonomous shopping assistant and human quality review specialists are available to resolve
            any dispute, order question, or delivery grievance.
          </p>
        </div>

        <div>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0' }}>
            Official Channels & Grievance Officer
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.9rem', color: '#1e293b' }}>
            <div>
              <strong>Support Email:</strong>{' '}
              <a href={`mailto:${BRAND.supportEmail}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                {BRAND.supportEmail}
              </a>
            </div>
            <div>
              <strong>Grievance Officer:</strong> {BRAND.grievanceOfficer.name} (
              <a href={`mailto:${BRAND.grievanceOfficer.email}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                {BRAND.grievanceOfficer.email}
              </a>
              )
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 600, fontSize: '0.85rem', marginTop: 4 }}>
              <Clock size={15} />
              <span>Response SLA: We reply within 24 hours</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
