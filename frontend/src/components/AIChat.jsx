import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Sparkles, Bot, User, CheckCircle2, ShoppingBag, Star, Leaf,
  RefreshCw, Zap, Eye, RotateCcw, ShieldCheck, ShoppingCart, ArrowRight,
  X, AlertCircle, Maximize2, Minimize2, Mic, MicOff, Volume2, VolumeX, RotateCw, MapPin
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ProductDetailModal from './ProductDetailModal';
import OrderActionCard from './OrderActionCard';
import { API_BASE } from '../config';
import { BRAND } from '../config/brand';

const SUGGESTIONS = [
  "💻 Laptops for coding with 32GB RAM under ₹80k",
  "🍯 Pure wild honey & rolled oats with price per 100g",
  "👕 Men's linen shirts in size L & organic cotton tees",
  "🎧 Sony noise cancelling headphones under ₹30,000",
  "⚖️ Compare MacBook Pro vs DevBook 15X",
  "🔄 What is the return policy for laptops?",
  "📦 Track my active orders",
  "❌ Cancel my order",
];

export default function AIChat({
  onAddToCart,
  onRemoveFromCart,
  onBuyNowDirect,
  onOpenOrders,
  formatPrice = (p, inr) => {
    if (inr !== undefined && inr !== null && !isNaN(Number(inr))) return `₹${Math.round(Number(inr)).toLocaleString('en-IN')}`;
    const n = Number(p);
    return !isNaN(n) && p !== undefined && p !== null ? `₹${Math.round(n * 85).toLocaleString('en-IN')}` : '₹0';
  },
  currency = 'INR',
  isWidgetMode = false,
  initialPrompt = null,
  onCloseWidget = null,
  onMaximizeWidget = null,
  isMaximized = false,
  currentUser = null,
  onOpenAuthModal = null,
}) {
  const [threadId] = useState(() => {
    try {
      const stored = localStorage.getItem('moss_guest_thread_id');
      if (stored) return stored;
      const gen = 'guest_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('moss_guest_thread_id', gen);
      return gen;
    } catch {
      return 'guest_' + Math.random().toString(36).substring(2, 10);
    }
  });

  const effectiveThreadId = currentUser?.id ? `user_${currentUser.id}_session` : threadId;
  const storageKey = `moss_chat_history_${effectiveThreadId}`;

  const defaultWelcomeMessage = {
    id: 'welcome',
    role: 'assistant',
    text: BRAND.welcomeMessage,
    product_cards: [],
    placed_order: null,
    cart_action: null,
    order_bundle: null,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  const [messages, setMessages] = useState(() => {
    try {
      const activeStorageKey = currentUser?.id
        ? `moss_chat_history_user_${currentUser.id}_session`
        : (localStorage.getItem('moss_guest_thread_id') ? `moss_chat_history_${localStorage.getItem('moss_guest_thread_id')}` : 'moss_chat_history_guest');
      const saved = localStorage.getItem(activeStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not load chat history from storage:', e);
    }
    return [defaultWelcomeMessage];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastFailedQuery, setLastFailedQuery] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const messagesEndRef = useRef(null);

  // Automatically persist messages to localStorage whenever messages array changes
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save chat history to localStorage:', e);
    }
  }, [messages, storageKey]);

  // If user logs in, carry over guest conversation history so work is not lost
  useEffect(() => {
    if (currentUser?.id) {
      const userKey = `moss_chat_history_user_${currentUser.id}_session`;
      const existingUserHistory = localStorage.getItem(userKey);
      if (!existingUserHistory) {
        const guestKey = `moss_chat_history_${threadId}`;
        const guestHistory = localStorage.getItem(guestKey);
        if (guestHistory) {
          try {
            const parsed = JSON.parse(guestHistory);
            if (Array.isArray(parsed) && parsed.length > 1) {
              localStorage.setItem(userKey, guestHistory);
              setMessages(parsed);
              return;
            }
          } catch (e) {}
        }
      } else {
        try {
          const parsed = JSON.parse(existingUserHistory);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        } catch (e) {}
      }
    }
  }, [currentUser?.id, threadId]);

  // Sync historical messages from backend SQLite agent_traces
  useEffect(() => {
    let isCancelled = false;
    const fetchRemoteHistory = async () => {
      try {
        const token = localStorage.getItem('moss_auth_token');
        const url = `${API_BASE}/api/chat/history?thread_id=${encodeURIComponent(effectiveThreadId)}`;
        const res = await fetch(url, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages((prev) => {
              const isOnlyWelcome = prev.length === 1 && (prev[0].id === 'welcome' || prev[0].id === 'welcome-reset');
              if (isOnlyWelcome || prev.length < data.messages.length) {
                const hasWelcome = data.messages.some((m) => m.id === 'welcome');
                const finalMessages = hasWelcome ? data.messages : [defaultWelcomeMessage, ...data.messages];
                try {
                  localStorage.setItem(storageKey, JSON.stringify(finalMessages));
                } catch (e) {}
                return finalMessages;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn('Could not sync chat history from backend:', err);
      }
    };
    fetchRemoteHistory();
    return () => { isCancelled = true; };
  }, [effectiveThreadId, storageKey]);

  // Voice Assistant State
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(
    () => localStorage.getItem('moss_voice_enabled') === 'true'
  );
  const recognitionRef = useRef(null);

  // Initialize Web Speech API Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInterimTranscript(transcript);
        setInput(transcript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript((prev) => {
          if (prev && prev.trim()) {
            handleSend(prev.trim());
          }
          return '';
        });
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Text to Speech
  const speakText = (text) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/[*#_`~\[\]\(\)]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .slice(0, 320);
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'en-IN';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  const toggleVoiceAudio = () => {
    setIsVoiceEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('moss_voice_enabled', String(next));
      if (!next && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        recognitionRef.current.stop();
        setTimeout(() => recognitionRef.current.start(), 200);
      }
    }
  };

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
    }
  }, [initialPrompt]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend, customIdempotencyKey = null) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      text: query,
      product_cards: [],
      placed_order: null,
      cart_action: null,
      order_bundle: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setLastFailedQuery(null);

    // Resolve current customer name, email, and saved delivery address
    const custName = currentUser?.full_name || 'Aarav Sharma';
    const custEmail = currentUser?.email || localStorage.getItem('moss_customer_email') || 'shopper@trovi.internal';
    const custAddress = localStorage.getItem('moss_selected_address') || 'Flat 402, Green Park Avenue, 12th Main Road, Indiranagar, Bengaluru - 560038';

    const token = localStorage.getItem('moss_auth_token');
    const effectiveThreadId = currentUser?.id ? `user_${currentUser.id}_session` : threadId;

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: query,
          thread_id: effectiveThreadId,
          idempotency_key: customIdempotencyKey,
          customer_name: custName,
          customer_email: custEmail,
          customer_address: custAddress,
        }),
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      // Handle AI-controlled Cart Action
      if (data.cart_action) {
        if (data.cart_action.action === 'ADD_TO_CART' && data.cart_action.product) {
          onAddToCart(data.cart_action.product, data.cart_action.quantity || 1);
          confetti({
            particleCount: 60,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#00f2fe', '#22d3ee', '#14b8a6'],
          });
        } else if (data.cart_action.action === 'REMOVE_FROM_CART' && onRemoveFromCart) {
          onRemoveFromCart(data.cart_action.product_id);
        }
      }

      if (data.placed_order) {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#00f2fe', '#38ef7d', '#3b82f6', '#fbbf24'],
        });

        // Store order number in recent orders for instant visibility in Orders tab
        const ordNo = data.placed_order.order_number;
        if (ordNo) {
          try {
            const existing = JSON.parse(localStorage.getItem('moss_agent_orders') || '[]');
            if (!existing.includes(ordNo)) {
              existing.unshift(ordNo);
              localStorage.setItem('moss_agent_orders', JSON.stringify(existing.slice(0, 50)));
            }
          } catch (e) {
            console.warn(e);
          }
          window.dispatchEvent(new CustomEvent('moss_order_placed', { detail: data.placed_order }));
        }
      }

      // If return, exchange, or refund was performed, notify Orders tab to update
      if (data.return_action || data.exchange_action || data.refund_action) {
        window.dispatchEvent(new CustomEvent('moss_order_placed', { detail: data }));
      }

      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: data.reply || data.response || "I couldn't generate a response. Please try again.",
        product_cards: data.product_cards || [],
        placed_order: data.placed_order || null,
        cart_action: data.cart_action || null,
        order_bundle: data.order_bundle || null,
        action_card: data.action_card || null,
        return_action: data.return_action || null,
        exchange_action: data.exchange_action || null,
        refund_action: data.refund_action || null,
        requires_auth: Boolean(data.requires_auth),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);

      // Speak response aloud if voice output is turned on
      if (data.reply) {
        speakText(data.reply);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setLastFailedQuery(query);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          isError: true,
          text: `⚠️ **Connection Error**: Unable to reach backend agent at \`${API_BASE}\`. Please verify the backend server is active.`,
          product_cards: [],
          placed_order: null,
          order_bundle: null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // One-click confirmation of an order bundle
  const handleConfirmBundle = async (bundle) => {
    if (!currentUser) {
      if (onOpenAuthModal) {
        onOpenAuthModal({ message: 'Sign in to place your order', returnTo: 'chat' });
      }
      return;
    }
    setIsLoading(true);
    try {
      const itemsPayload = bundle.items.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
      }));

      const idempotencyKey = `idemp_bundle_${threadId}_${Date.now()}`;
      const token = localStorage.getItem('moss_auth_token');

      const res = await fetch(`${API_BASE}/api/order/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          items: itemsPayload,
          customer_name: currentUser?.full_name || bundle.customer_name || 'Online Shopper',
          idempotency_key: idempotencyKey,
          target_budget_inr: bundle.total_inr || undefined,
          budget_approved: true,
        }),
      });

      if (res.status === 401) {
        if (onOpenAuthModal) {
          onOpenAuthModal({ message: 'Sign in to place your order', returnTo: 'chat' });
        }
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Checkout failed (HTTP ${res.status})`);
      }
      const orderRes = await res.json();

      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#00f2fe', '#38ef7d', '#22d3ee', '#fbbf24'],
      });

      // Save order number to localStorage for persistent tracking across tabs & sections
      if (orderRes.order_number) {
        try {
          const existing = JSON.parse(localStorage.getItem('moss_agent_orders') || '[]');
          if (!existing.includes(orderRes.order_number)) {
            existing.unshift(orderRes.order_number);
            localStorage.setItem('moss_agent_orders', JSON.stringify(existing.slice(0, 50)));
          }
        } catch (e) {
          console.warn(e);
        }
        window.dispatchEvent(new CustomEvent('moss_order_placed', { detail: orderRes }));
      }

      const confirmMsg = {
        id: Date.now().toString(),
        role: 'assistant',
        text: `🎉 **Order Confirmed!**\n\nYour order **#${orderRes.order_number}** has been confirmed for **₹${orderRes.total_price_inr?.toLocaleString('en-IN')}**. You can track it under the **My Orders** section.`,
        product_cards: [],
        placed_order: orderRes,
        order_bundle: null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, confirmMsg]);
    } catch (e) {
      console.error('Order checkout error:', e);
      alert(`Checkout failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = async () => {
    const confirmed = window.confirm("Are you sure you want to clear your conversation history?");
    if (!confirmed) return;

    const resetMsg = {
      id: 'welcome-reset',
      role: 'assistant',
      text: "✨ Conversation reset! What would you like to explore or order today?",
      product_cards: [],
      placed_order: null,
      order_bundle: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([resetMsg]);
    try {
      localStorage.removeItem(storageKey);
      const token = localStorage.getItem('moss_auth_token');
      await fetch(`${API_BASE}/api/chat/history?thread_id=${encodeURIComponent(effectiveThreadId)}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
    } catch (e) {
      console.warn('Failed to clear remote history:', e);
    }
  };

  // Safe inline markdown renderer (bold, italic, code) without innerHTML
  const renderInline = (str) => {
    if (!str) return null;
    const parts = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let last = 0;
    let m;
    let idx = 0;
    while ((m = regex.exec(str)) !== null) {
      if (m.index > last) {
        parts.push(str.substring(last, m.index));
      }
      const token = m[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(<strong key={idx++} style={{ fontWeight: 700, color: 'inherit' }}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(<em key={idx++} style={{ fontStyle: 'italic' }}>{token.slice(1, -1)}</em>);
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={idx++} style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '2px 5px', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.88em', color: 'var(--mint-light, #22d3ee)' }}>
            {token.slice(1, -1)}
          </code>
        );
      }
      last = regex.lastIndex;
    }
    if (last < str.length) {
      parts.push(str.substring(last));
    }
    return parts.length > 0 ? parts : str;
  };

  // Helper to render markdown tables, lists, and formatted text safely
  const renderFormattedText = (rawText) => {
    if (rawText === null || rawText === undefined) return null;
    if (typeof rawText !== 'string') {
      try {
        return typeof rawText === 'object' ? JSON.stringify(rawText) : String(rawText);
      } catch (e) {
        return String(rawText);
      }
    }

    if (rawText.includes('|') && rawText.includes('---')) {
      const lines = rawText.split('\n');
      const tableLines = [];
      const nonTableBefore = [];
      const nonTableAfter = [];
      let inTable = false;

      for (const line of lines) {
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
          inTable = true;
          tableLines.push(line.trim());
        } else {
          if (!inTable) nonTableBefore.push(line);
          else nonTableAfter.push(line);
        }
      }

      if (tableLines.length >= 3) {
        const headerCells = tableLines[0].split('|').map((s) => s.trim()).filter(Boolean);
        const bodyRows = tableLines.slice(2).map((row) =>
          row.split('|').map((s) => s.trim()).filter(Boolean)
        );

        return (
          <div>
            {nonTableBefore.length > 0 && (
              <p style={{ whiteSpace: 'pre-wrap', marginBottom: 10 }}>{renderInline(nonTableBefore.join('\n'))}</p>
            )}
            <div style={{ overflowX: 'auto', marginBottom: 12 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.82rem',
                border: '1px solid var(--border-mint)',
                borderRadius: 8,
                overflow: 'hidden',
              }}>
                <thead>
                  <tr style={{ background: 'rgba(0, 242, 254, 0.1)', color: 'var(--mint-light)' }}>
                    {headerCells.map((h, i) => (
                      <th key={i} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-mint)' }}>
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((r, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      {r.map((c, ci) => (
                        <td key={ci} style={{ padding: '8px 12px', color: '#e2e8f0' }}>
                          {renderInline(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nonTableAfter.length > 0 && (
              <p style={{ whiteSpace: 'pre-wrap' }}>{renderInline(nonTableAfter.join('\n'))}</p>
            )}
          </div>
        );
      }
    }

    // Line-by-line rendering supporting bullet lists
    const lines = rawText.split('\n');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lines.map((l, i) => {
          const trimmed = l.trim();
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={i} style={{ display: 'flex', gap: 8, paddingLeft: 8, alignItems: 'baseline' }}>
                <span style={{ color: 'var(--mint-primary, #00f2fe)', fontSize: '0.8rem' }}>•</span>
                <span>{renderInline(trimmed.substring(2))}</span>
              </div>
            );
          }
          if (!trimmed) {
            return <div key={i} style={{ height: 4 }} />;
          }
          return <p key={i} style={{ margin: 0, lineHeight: 1.6 }}>{renderInline(l)}</p>;
        })}
      </div>
    );
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: isWidgetMode ? '100%' : 1050,
      margin: isWidgetMode ? 0 : '0 auto',
      height: isWidgetMode ? '100%' : 'calc(100vh - 120px)',
      display: 'flex',
      flexDirection: 'column',
      gap: isWidgetMode ? 0 : 16,
      overflow: 'hidden',
    }}>
      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={onAddToCart}
          onAskInChat={(p) => handleSend(p)}
          formatPrice={formatPrice}
          currency={currency}
        />
      )}

      {/* Top Banner / Widget Header */}
      {isWidgetMode ? (
        <div id="moss-ai-chat-header" style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, var(--moss-deep) 0%, #142017 100%)',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-yellow, #f5e6cc)',
              }}>
                <Sparkles size={16} />
              </div>
              <span style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
                border: '1.5px solid #142017',
              }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{BRAND.assistantName}</span>
                <span style={{ fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.18)', padding: '1px 6px', borderRadius: 9999, fontWeight: 600 }}>Active</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.72)' }}>
                Autonomous Shopping & Auto Confirmation
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={toggleVoiceAudio}
              style={{
                background: isVoiceEnabled ? 'rgba(0, 242, 254, 0.2)' : 'transparent',
                border: isVoiceEnabled ? '1px solid var(--border-mint)' : 'none',
                color: isVoiceEnabled ? 'var(--mint-light)' : 'rgba(255, 255, 255, 0.75)',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title={isVoiceEnabled ? "Voice replies enabled (Click to mute)" : "Voice replies muted (Click to enable audio speech)"}
            >
              {isVoiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button
              onClick={clearChat}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.75)',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Clear conversation"
            >
              <RotateCcw size={15} />
            </button>
            {onMaximizeWidget && (
              <button
                onClick={onMaximizeWidget}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.75)',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={isMaximized ? "Restore window" : "Maximize window"}
              >
                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            )}
            {onCloseWidget && (
              <button
                onClick={onCloseWidget}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Minimize to bottom-right launcher"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          padding: '14px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--moss-border)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: 'var(--moss-deep)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}>
              <Bot size={19} />
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--moss-deep)' }}>{BRAND.assistantName}</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--moss-sage)', marginLeft: 8, fontWeight: 600 }}>{BRAND.tagline}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={toggleVoiceAudio}
              className="btn-ghost"
              style={{
                padding: '6px 12px',
                fontSize: '0.76rem',
                color: isVoiceEnabled ? 'var(--moss-deep)' : 'var(--text-muted)',
                background: isVoiceEnabled ? 'var(--moss-tint)' : 'transparent',
                border: isVoiceEnabled ? '1px solid var(--moss-sage)' : '1px solid var(--moss-border)',
              }}
              title={isVoiceEnabled ? "Voice replies enabled (Click to mute)" : "Voice replies muted (Click to enable audio speech)"}
            >
              {isVoiceEnabled ? <Volume2 size={14} style={{ marginRight: 4 }} /> : <VolumeX size={14} style={{ marginRight: 4 }} />}
              {isVoiceEnabled ? 'Voice: On' : 'Voice: Muted'}
            </button>
            <button
              onClick={clearChat}
              className="btn-ghost"
              style={{ padding: '6px 12px', fontSize: '0.76rem' }}
              title="Reset conversation"
            >
              <RotateCcw size={13} style={{ marginRight: 4 }} /> Clear Chat
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: isWidgetMode ? 14 : 20,
        padding: isWidgetMode ? '12px 14px' : '10px 4px',
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: msg.role === 'user'
                ? 'var(--moss-tint)'
                : 'var(--moss-deep)',
              border: msg.role === 'user' ? '1px solid var(--moss-border)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: msg.role === 'user' ? 'var(--moss-deep)' : '#ffffff',
              flexShrink: 0,
            }}>
              {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
            </div>

            {/* Message Bubble & Cards */}
            <div style={{
              maxWidth: '82%',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                background: msg.role === 'user'
                  ? 'var(--moss-deep)'
                  : 'var(--bg-card)',
                border: msg.role === 'user'
                  ? 'none'
                  : '1px solid var(--moss-border)',
                borderRadius: msg.role === 'user'
                  ? '18px 18px 4px 18px'
                  : '18px 18px 18px 4px',
                padding: '14px 20px',
                color: msg.role === 'user' ? '#ffffff' : 'var(--text-primary)',
                fontSize: '0.92rem',
                boxShadow: 'var(--shadow-sm)',
              }}>
                {renderFormattedText(msg.text)}

                {msg.requires_auth && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(28, 48, 36, 0.12)' }}>
                    <button
                      id="chat-sign-in-btn"
                      onClick={() => {
                        if (onOpenAuthModal) {
                          onOpenAuthModal({ message: 'Sign in to place your order', returnTo: 'chat' });
                        }
                      }}
                      style={{
                        background: 'var(--moss-deep)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '9px 18px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <User size={14} />
                      <span>Sign In to Place Order</span>
                    </button>
                  </div>
                )}

                <div style={{
                  fontSize: '0.68rem',
                  color: msg.role === 'user' ? 'rgba(255, 255, 255, 0.65)' : 'var(--text-muted)',
                  marginTop: 8,
                  textAlign: 'right',
                }}>
                  {msg.timestamp}
                </div>
              </div>

              {/* Deterministic Order Action Card */}
              {msg.action_card && (
                <OrderActionCard
                  actionCard={msg.action_card}
                  currentUser={currentUser}
                  onOpenAuthModal={onOpenAuthModal}
                  formatPrice={formatPrice}
                  onActionCompleted={(result) => {
                    // 1. Dispatch global window event to update Orders tab
                    window.dispatchEvent(new CustomEvent('moss_order_placed', { detail: result }));
                    // 2. Add system result message to chat history so LLM can talk about it afterwards
                    const systemResultMsg = {
                      id: (Date.now() + 2).toString(),
                      role: 'assistant',
                      isSystemMessage: true,
                      text: `✓ **Action Completed**: Order #${result.order_number} has been updated to **${result.new_status}**. ${
                        result.refund ? `Refund: ₹${result.refund.refund_amount_inr?.toLocaleString('en-IN')} (${result.refund.status || 'Initiated'}).` : ''
                      } ${result.ticket ? `Support Ticket: ${result.ticket.ticket_number} (Flagged for human review).` : ''}`,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    };
                    setMessages((prev) => [...prev, systemResultMsg]);
                  }}
                  onDismiss={() => {
                    setMessages((prev) =>
                      prev.map((m) => (m.id === msg.id ? { ...m, action_card: null } : m))
                    );
                  }}
                />
              )}

              {/* Order Bundle Card (One-Command Order Proposal) */}
              {msg.order_bundle && (
                <div className="glass-panel" style={{
                  padding: 20,
                  width: '100%',
                  border: '1px solid var(--mint-primary)',
                  boxShadow: '0 0 25px rgba(0, 242, 254, 0.18)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={18} color="var(--mint-primary)" />
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                        Itemized Order Bundle
                      </h4>
                    </div>
                    <span className="badge-mint">Ready for Confirmation</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {msg.order_bundle.items.map((it, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: 6,
                        fontSize: '0.84rem',
                      }}>
                        <div>
                          <strong>{it.quantity}x {it.name}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                            (₹{it.unit_price_inr} each)
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--mint-light)' }}>
                          ₹{(Number(it.total_inr) || ((Number(it.unit_price_inr) || 0) * (Number(it.quantity) || 1))).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    paddingTop: 10,
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    marginBottom: 14,
                  }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Grand Total Payable:</span>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--mint-primary)' }}>
                        ₹{(Number(msg.order_bundle.total_inr) || 0).toLocaleString('en-IN')}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                          (${Number(msg.order_bundle.total_usd || 0).toFixed(2)})
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleSend('cancel')}
                        style={{
                          padding: '10px 14px',
                          fontSize: '0.85rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        title="Cancel this pending bundle"
                      >
                        <X size={15} /> Cancel Draft
                      </button>
                      <button
                        onClick={() => handleConfirmBundle(msg.order_bundle)}
                        className="btn-primary"
                        style={{ padding: '10px 18px', fontSize: '0.88rem' }}
                      >
                        <CheckCircle2 size={16} /> Confirm & Place Order
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Placed Order Confirmation Banner */}
              {msg.placed_order && (
                <div style={{
                  background: 'rgba(0, 242, 254, 0.12)',
                  border: '1px solid var(--mint-primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  boxShadow: '0 0 25px rgba(0, 242, 254, 0.18)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 42,
                      height: 42,
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(0, 242, 254, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <CheckCircle2 size={24} color="var(--mint-primary)" />
                    </div>
                    <div>
                      <h4 style={{ color: 'var(--mint-light)', fontSize: '1.05rem', fontWeight: 800 }}>
                        Order Confirmed #{msg.placed_order.order_number || msg.placed_order.order_id}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Placed in 1-command • ₹{(msg.placed_order.total_price_inr || msg.placed_order.total_price)?.toLocaleString('en-IN')} • Delivery to {msg.placed_order.delivery_address || 'Bengaluru'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleSend(`return order ${msg.placed_order.order_number || msg.placed_order.order_id}`)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        background: 'rgba(234, 88, 12, 0.12)',
                        color: '#f97316',
                        border: '1px solid rgba(234, 88, 12, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                      title="Request return for this order"
                    >
                      <RotateCw size={13} /> Return
                    </button>
                    <button
                      onClick={() => handleSend(`exchange order ${msg.placed_order.order_number || msg.placed_order.order_id}`)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                      title="Request exchange for this order"
                    >
                      <RefreshCw size={13} /> Exchange
                    </button>
                    <button
                      onClick={() => handleSend(`refund order ${msg.placed_order.order_number || msg.placed_order.order_id}`)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                      title="Request refund for this order"
                    >
                      <ShieldCheck size={13} /> Refund
                    </button>
                    <button
                      onClick={() => handleSend(`cancel order ${msg.placed_order.order_number || msg.placed_order.order_id}`)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.28)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                      title="Cancel this order and restore catalog stock"
                    >
                      <RotateCcw size={13} /> Cancel
                    </button>
                    {onOpenOrders && (
                      <button
                        onClick={onOpenOrders}
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      >
                        <ShoppingBag size={14} /> My Orders <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Order Action Service Interactive Card */}
              {msg.action_card && (
                <OrderActionCard
                  actionCard={msg.action_card}
                  currentUser={currentUser}
                  onOpenAuthModal={onOpenAuthModal}
                  onActionCompleted={(result) => {
                    const actionSysMsg = {
                      id: Date.now().toString(),
                      role: 'assistant',
                      text: `✓ **${result.action?.toUpperCase() || 'ACTION'} COMPLETED**: Order #${result.order_number} is now marked as \`${result.new_status}\`. ${
                        result.refund ? `Refund of ₹${result.refund.refund_amount_inr} initiated (${result.refund.destination}).` : ''
                      } ${result.ticket ? `Support Ticket #${result.ticket.ticket_number} created for human review.` : ''}`,
                      product_cards: [],
                      placed_order: null,
                      cart_action: null,
                      order_bundle: null,
                      action_card: null,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    };
                    setMessages((prev) => [...prev, actionSysMsg]);
                    window.dispatchEvent(new CustomEvent('moss_order_placed', { detail: result }));
                  }}
                  formatPrice={formatPrice}
                />
              )}

              {/* Return Action Banner */}
              {msg.return_action && (
                <div style={{
                  background: 'rgba(234, 88, 12, 0.12)',
                  border: '1px solid #f97316',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'rgba(234, 88, 12, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <RotateCw size={20} color="#f97316" />
                    </div>
                    <div>
                      <h4 style={{ color: '#fed7aa', fontSize: '0.98rem', fontWeight: 800 }}>
                        Return Initiated #{msg.return_action.order_number}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Status: <strong style={{ color: '#fdba74' }}>{msg.return_action.status}</strong> • Reverse pickup scheduled from registered address.
                      </p>
                    </div>
                  </div>
                  {onOpenOrders && (
                    <button onClick={onOpenOrders} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                      Track in Orders
                    </button>
                  )}
                </div>
              )}

              {/* Exchange Action Banner */}
              {msg.exchange_action && (
                <div style={{
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid #3b82f6',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'rgba(59, 130, 246, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <RefreshCw size={20} color="#60a5fa" />
                    </div>
                    <div>
                      <h4 style={{ color: '#bfdbfe', fontSize: '0.98rem', fontWeight: 800 }}>
                        Exchange Scheduled #{msg.exchange_action.order_number}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Status: <strong style={{ color: '#93c5fd' }}>{msg.exchange_action.status}</strong> • Replacement variant confirmed.
                      </p>
                    </div>
                  </div>
                  {onOpenOrders && (
                    <button onClick={onOpenOrders} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                      Track in Orders
                    </button>
                  )}
                </div>
              )}

              {/* Refund Action Banner */}
              {msg.refund_action && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid #10b981',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'rgba(16, 185, 129, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <ShieldCheck size={20} color="#34d399" />
                    </div>
                    <div>
                      <h4 style={{ color: '#a7f3d0', fontSize: '0.98rem', fontWeight: 800 }}>
                        Refund Processed #{msg.refund_action.order_number}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        ₹{(msg.refund_action.amount_inr || 0).toLocaleString('en-IN')} refunded to original payment method. Status: <strong style={{ color: '#6ee7b7' }}>{msg.refund_action.status}</strong>
                      </p>
                    </div>
                  </div>
                  {onOpenOrders && (
                    <button onClick={onOpenOrders} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                      View in Orders
                    </button>
                  )}
                </div>
              )}

              {/* Product Cards Grid */}
              {msg.product_cards && msg.product_cards.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: 12,
                  width: '100%',
                  marginTop: 4,
                }}>
                  {msg.product_cards.map((product) => (
                    <div
                      key={product.id}
                      className="glass-panel"
                      style={{
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        border: '1px solid var(--border-mint)',
                      }}
                    >
                      <div
                        style={{ height: 110, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                        onClick={() => setSelectedProduct(product)}
                      >
                        <img
                          src={product.image_url}
                          alt={product.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{ position: 'absolute', bottom: 6, right: 6 }}>
                          <span className="badge-rating" style={{ fontSize: '0.7rem' }}>
                            <Star size={10} fill="#f59e0b" color="#f59e0b" />
                            {product.rating ? product.rating.toFixed(1) : '4.5'}
                          </span>
                        </div>
                      </div>

                      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', flex: 1, gap: 6 }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--mint-cyan)', textTransform: 'uppercase', fontWeight: 700 }}>
                          {product.brand || 'Store'} • {product.category}
                        </div>
                        <div
                          style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}
                          onClick={() => setSelectedProduct(product)}
                        >
                          {product.name}
                        </div>
                        <div style={{
                          fontSize: '1rem',
                          fontWeight: 800,
                          color: 'var(--mint-primary)',
                          marginTop: 'auto',
                          paddingTop: 4,
                        }}>
                          {formatPrice(product.price, product.price_inr)}
                        </div>

                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <button
                            onClick={() => setSelectedProduct(product)}
                            className="btn-ghost"
                            style={{ flex: 1, padding: '5px 8px', fontSize: '0.72rem' }}
                          >
                            <Eye size={12} /> Specs
                          </button>
                          <button
                            onClick={() => onAddToCart(product, 1)}
                            className="btn-primary"
                            style={{ flex: 1, padding: '5px 8px', fontSize: '0.72rem' }}
                          >
                            + Cart
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--mint-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#04070d',
            }}>
              <Sparkles size={18} />
            </div>
            <div style={{
              background: 'rgba(10, 16, 29, 0.85)',
              border: '1px solid var(--border-mint)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span className="typing-dot" />
              <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
              <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginLeft: 6 }}>
                {BRAND.assistantName} verifying specs & inventory...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: isWidgetMode ? '6px 14px' : '2px 0',
        flexShrink: 0,
      }}>
        {SUGGESTIONS.map((item, i) => (
          <button
            key={i}
            onClick={() => handleSend(item)}
            className="category-pill"
            style={{
              fontSize: isWidgetMode ? '0.72rem' : '0.76rem',
              padding: isWidgetMode ? '5px 11px' : '6px 12px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span>{item}</span>
          </button>
        ))}
      </div>

      {/* Voice Recognition Live Banner */}
      {(isListening || interimTranscript) && (
        <div style={{
          margin: isWidgetMode ? '0 12px 6px 12px' : '0 0 6px 0',
          padding: '8px 14px',
          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, rgba(0, 242, 254, 0.15) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#ef4444',
              display: 'inline-block',
              boxShadow: '0 0 8px #ef4444',
            }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>
              Listening:
            </span>
            <span style={{
              fontSize: '0.82rem',
              color: 'var(--text-primary)',
              fontStyle: 'italic',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              "{interimTranscript || 'Listening to your command... Speak now'}"
            </span>
          </div>
          <button
            onClick={toggleListening}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ef4444',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Stop
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div style={{
        padding: isWidgetMode ? '6px 10px 6px 14px' : '8px 14px',
        margin: isWidgetMode ? '0 12px 12px 12px' : 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#ffffff',
        border: '1px solid var(--moss-border)',
        borderRadius: 'var(--radius-full)',
        boxShadow: 'var(--shadow-md)',
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={toggleListening}
          style={{
            background: isListening ? '#fee2e2' : 'var(--moss-tint)',
            border: isListening ? '1.5px solid #ef4444' : '1px solid var(--moss-border)',
            color: isListening ? '#b91c1c' : 'var(--moss-deep)',
            borderRadius: 'var(--radius-full)',
            padding: isWidgetMode ? '6px 8px' : '7px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: '0.76rem',
            fontWeight: 700,
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
          title={isListening ? "Listening... Click to stop" : "Speak to Voice Assistant"}
        >
          {isListening ? <MicOff size={15} color="#ef4444" /> : <Mic size={15} />}
          <span style={{ display: isWidgetMode ? 'none' : 'inline' }}>
            {isListening ? 'Listening' : 'Voice'}
          </span>
        </button>

        <textarea
          id="chat-input-textarea"
          data-testid="chat-input-textarea"
          rows={1}
          placeholder={isWidgetMode ? "Ask, order, 'confirm' or 'cancel'..." : `Inquire with ${BRAND.assistantName}: 'Auto order 500g honey to home', 'return order 1001', 'refund'...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: isWidgetMode ? '0.86rem' : '0.92rem',
            resize: 'none',
            outline: 'none',
            padding: '8px 4px',
            fontFamily: 'inherit',
          }}
        />

        <button
          id="chat-send-btn"
          data-testid="chat-send-btn"
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="btn-primary"
          style={{
            padding: isWidgetMode ? '8px 16px' : '10px 20px',
            borderRadius: 'var(--radius-full)',
            opacity: !input.trim() || isLoading ? 0.4 : 1,
            cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
