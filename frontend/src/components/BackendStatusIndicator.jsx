import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config';
import { Activity, AlertCircle, CheckCircle2, RefreshCw, X } from 'lucide-react';

/**
 * Dev-only Backend Status Indicator.
 * Renders in development mode to provide real-time connection status
 * to the FastAPI backend at /api/health.
 */
export default function BackendStatusIndicator() {
  // Only render in development mode
  if (!import.meta.env.DEV) {
    return null;
  }

  const [status, setStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [healthData, setHealthData] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const checkHealth = useCallback(async () => {
    setStatus((prev) => (prev === 'offline' ? 'checking' : prev));
    try {
      const url = `${API_BASE}/api/health`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setHealthData(data);
      setStatus('online');
      setErrorMsg(null);
      setLastChecked(new Date());
    } catch (err) {
      setStatus('offline');
      setErrorMsg(err.message || 'Connection refused');
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    checkHealth();
    // Poll every 25 seconds in dev
    const interval = setInterval(checkHealth, 25000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const isOnline = status === 'online';
  const isChecking = status === 'checking';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 9990,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '12px',
      }}
    >
      {/* Expanded Details Popover */}
      {isExpanded && (
        <div
          style={{
            marginBottom: 8,
            padding: 14,
            background: '#ffffff',
            borderRadius: 12,
            border: `1px solid ${isOnline ? '#86efac' : '#fca5a5'}`,
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
            maxWidth: 320,
            color: '#1f2937',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6 }}>
              {isOnline ? (
                <CheckCircle2 size={16} color="#16a34a" />
              ) : (
                <AlertCircle size={16} color="#dc2626" />
              )}
              Backend Status: {isOnline ? 'Online' : 'Offline'}
            </strong>
            <button
              onClick={() => setIsExpanded(false)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                padding: 2,
              }}
              aria-label="Close status panel"
            >
              <X size={14} />
            </button>
          </div>

          {isOnline && healthData ? (
            <div style={{ fontSize: '11px', color: '#4b5563', lineHeight: 1.6 }}>
              <div><strong>Port:</strong> {healthData.port || 8000}</div>
              <div><strong>Environment:</strong> {healthData.environment || 'development'}</div>
              <div><strong>DB:</strong> {healthData.database || 'connected'}</div>
              <div><strong>Checked:</strong> {lastChecked ? lastChecked.toLocaleTimeString() : 'now'}</div>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#991b1b', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 6px' }}>
                FastAPI backend is unreachable at <code>{API_BASE || 'http://localhost:8000'}/api/health</code>.
              </p>
              <p style={{ margin: '0 0 8px', color: '#4b5563' }}>
                Run this command in a new terminal:
                <br />
                <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>
                  python backend/main.py
                </code>
              </p>
            </div>
          )}

          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button
              onClick={checkHealth}
              disabled={isChecking}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#142017',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: isChecking ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={12} className={isChecking ? 'spin' : ''} />
              {isChecking ? 'Checking...' : 'Retry Connection'}
            </button>
          </div>
        </div>
      )}

      {/* Collapsed Pill Button */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '6px 12px',
          borderRadius: 20,
          background: isOnline ? 'rgba(240, 253, 244, 0.94)' : 'rgba(254, 242, 242, 0.94)',
          border: `1.5px solid ${isOnline ? '#86efac' : '#f87171'}`,
          color: isOnline ? '#166534' : '#991b1b',
          fontSize: '11px',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(6px)',
          transition: 'all 0.2s ease',
        }}
        title={`Backend status: ${status} (click for details)`}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isOnline ? '#22c55e' : isChecking ? '#f59e0b' : '#ef4444',
            boxShadow: isOnline ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
            display: 'inline-block',
          }}
        />
        <span>
          Backend: {isOnline ? 'Online' : isChecking ? 'Checking...' : 'Offline'}
        </span>
      </button>
    </div>
  );
}
