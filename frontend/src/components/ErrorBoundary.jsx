import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { BRAND } from '../config/brand';

/**
 * Global React Error Boundary.
 * Catches JavaScript errors anywhere in the child component tree,
 * logs the error, and displays a graceful fallback UI instead of a blank white screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled runtime error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    try {
      // Clear potentially corrupt cached states, while keeping auth tokens
      localStorage.removeItem('moss_guest_cart');
      localStorage.removeItem('moss_agent_orders');
    } catch (e) {
      console.warn('Storage cleanup failed:', e);
    }
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          padding: 24,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{
            maxWidth: 520,
            width: '100%',
            background: '#ffffff',
            borderRadius: 16,
            padding: 36,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626',
            }}>
              <AlertCircle size={28} />
            </div>

            <h2 style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: '#1e293b',
              margin: 0,
            }}>
              Something went wrong
            </h2>

            <p style={{
              fontSize: '0.9rem',
              color: '#64748b',
              lineHeight: 1.5,
              margin: 0,
            }}>
              A temporary interface error occurred. Don't worry, your cart and session data are safe.
            </p>

            <div style={{
              display: 'flex',
              gap: 12,
              marginTop: 12,
              width: '100%',
            }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--moss-deep, #1b2a20)',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <RotateCcw size={16} />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetState}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Home size={16} />
                <span>Go to Store Home</span>
              </button>
            </div>

            {/* Error detail for developers in non-production */}
            {this.state.error && (
              <details style={{
                marginTop: 12,
                width: '100%',
                textAlign: 'left',
                fontSize: '0.75rem',
                color: '#94a3b8',
                background: '#f8fafc',
                padding: 10,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Error details</summary>
                <pre style={{
                  marginTop: 6,
                  whiteSpace: 'pre-wrap',
                  overflowX: 'auto',
                  color: '#dc2626',
                  fontFamily: 'monospace',
                }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
