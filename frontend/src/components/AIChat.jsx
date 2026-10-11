import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, User, CheckCircle2, ShoppingBag, Star, Leaf, RefreshCw, Zap, Eye, RotateCcw, ShieldCheck, ShoppingCart, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import ProductDetailModal from './ProductDetailModal';
import { API_BASE } from '../config';

const SUGGESTIONS = [
  "⚡ Order 1 kg oats (Instant 1-Command)",
  "🥛 Order 1 litre cow milk",
  "👑 Rolex watch order kar do",
  "📱 iPhone 16 Pro Max order kar do",
  "⚡ Laptop #38 order kar do",
  "📦 Order 1 kg oats, 500 g honey, and two litres of milk within ₹800",
  "💻 Find a laptop under ₹60,000 for programming",
  "🎧 Find the cheapest suitable wireless headphones",
  "🍎 Find fresh organic produce under ₹300",
  "⚖️ Compare laptop #38 and #39",
];

export default function AIChat({
  onAddToCart,
  onRemoveFromCart,
  onBuyNowDirect,
  onOpenOrders,
  formatPrice = (p, inr) => inr ? `₹${inr.toLocaleString('en-IN')}` : `$${p.toFixed(2)}`,
  currency = 'INR',
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: "👋 Welcome to **ShopAI V3**! I am your autonomous, multi-category AI Shopping Agent.\n\n⚡ **Instant 1-Command Ordering**: Just tell me what you want to order (e.g. *'Order 1 kg oats'*, *'Order 1 litre cow milk'*, or *'Rolex watch order kar do'*), and I will directly place the order in a single command with real tracking!\n\nTry asking:\n- *'Order 1 litre cow milk'*\n- *'bread aur eggs order kar do'*\n- *'iPhone 16 Pro Max order kar do'*\n- *'Rolex watch order kar do'*\n- *'Order laptop #38'*\n- *'Find a laptop under ₹60,000 for programming'*\n- *'Order 1 kg oats, 500 g honey, and two litres of milk within ₹800'*",
      product_cards: [],
      placed_order: null,
      cart_action: null,
      order_bundle: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastFailedQuery, setLastFailedQuery] = useState(null);
  const [threadId] = useState(() => 'session-' + Math.random().toString(36).substring(2, 9));
  const [selectedProduct, setSelectedProduct] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend) => {
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

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, thread_id: threadId }),
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
      }

      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: data.reply || "I couldn't generate a response. Please try again.",
        product_cards: data.product_cards || [],
        placed_order: data.placed_order || null,
        cart_action: data.cart_action || null,
        order_bundle: data.order_bundle || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
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
    setIsLoading(true);
    try {
      const itemsPayload = bundle.items.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
      }));

      const res = await fetch(`${API_BASE}/api/order/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsPayload,
          customer_name: bundle.customer_name || 'Online Shopper',
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const orderRes = await res.json();

      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#00f2fe', '#38ef7d', '#22d3ee', '#fbbf24'],
      });

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

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        text: "✨ Conversation reset! What would you like to explore or order today?",
        product_cards: [],
        placed_order: null,
        order_bundle: null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Helper to render markdown tables and formatted text
  const renderFormattedText = (rawText) => {
    if (!rawText) return null;

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
              <p style={{ whiteSpace: 'pre-wrap', marginBottom: 10 }}>{nonTableBefore.join('\n')}</p>
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
                        {h.replace(/\*\*/g, '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((r, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      {r.map((c, ci) => (
                        <td key={ci} style={{ padding: '8px 12px', color: '#e2e8f0' }}>
                          {c.replace(/\*\*/g, '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nonTableAfter.length > 0 && (
              <p style={{ whiteSpace: 'pre-wrap' }}>{nonTableAfter.join('\n')}</p>
            )}
          </div>
        );
      }
    }

    return <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{rawText}</p>;
  };

  return (
    <div style={{
      maxWidth: 1050,
      margin: '0 auto',
      height: 'calc(100vh - 120px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
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

      {/* Top Banner */}
      <div className="glass-panel" style={{
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        background: 'rgba(10, 16, 29, 0.85)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--mint-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#04070d',
          }}>
            <Bot size={18} />
          </div>
          <div>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>ShopAI Autonomous Assistant</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--mint-cyan)', marginLeft: 8 }}>Multi-Category & One-Command Ordering</span>
          </div>
        </div>

        <button
          onClick={clearChat}
          className="btn-ghost"
          style={{ padding: '5px 10px', fontSize: '0.75rem' }}
          title="Reset conversation"
        >
          <RotateCcw size={13} style={{ marginRight: 4 }} /> Clear Chat
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '10px 4px',
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
              borderRadius: 'var(--radius-sm)',
              background: msg.role === 'user'
                ? 'rgba(0, 242, 254, 0.2)'
                : 'var(--mint-gradient)',
              border: msg.role === 'user' ? '1px solid var(--border-mint)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: msg.role === 'user' ? 'var(--mint-light)' : '#04070d',
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
                  ? 'rgba(0, 242, 254, 0.12)'
                  : 'rgba(10, 16, 29, 0.85)',
                border: msg.role === 'user'
                  ? '1px solid var(--border-mint)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                color: '#f8fafc',
                fontSize: '0.92rem',
                boxShadow: msg.role === 'user' ? '0 4px 14px var(--mint-glow)' : 'var(--shadow-sm)',
              }}>
                {renderFormattedText(msg.text)}
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>
                  {msg.timestamp}
                </div>
              </div>

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
                          ₹{it.total_inr.toLocaleString('en-IN')}
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
                        ₹{msg.order_bundle.total_inr.toLocaleString('en-IN')}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                          (${msg.order_bundle.total_usd?.toFixed(2)})
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleConfirmBundle(msg.order_bundle)}
                      className="btn-primary"
                      style={{ padding: '10px 18px', fontSize: '0.88rem' }}
                    >
                      <CheckCircle2 size={16} /> Confirm & Place Order
                    </button>
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
                  {onOpenOrders && (
                    <button
                      onClick={onOpenOrders}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                    >
                      <ShoppingBag size={14} /> View in My Orders <ArrowRight size={14} />
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
                ShopAI Agent verifying specs & inventory...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0' }}>
        {SUGGESTIONS.map((item, i) => (
          <button
            key={i}
            onClick={() => handleSend(item)}
            className="category-pill"
            style={{ fontSize: '0.76rem', padding: '6px 12px' }}
          >
            <span>{item}</span>
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="glass-panel" style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(10, 16, 29, 0.95)',
        border: '1px solid var(--border-mint)',
      }}>
        <textarea
          rows={1}
          placeholder="Ask ShopAI: 'Find a laptop under ₹60,000 for programming' or 'Order oats, honey, milk under ₹800'..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '0.92rem',
            resize: 'none',
            outline: 'none',
            padding: '8px 6px',
            fontFamily: 'inherit',
          }}
        />

        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="btn-primary"
          style={{
            padding: '10px 18px',
            opacity: !input.trim() || isLoading ? 0.4 : 1,
            cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
