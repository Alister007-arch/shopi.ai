import React, { useState } from 'react';
import { X, User, Lock, Mail, Phone, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Shield, KeyRound } from 'lucide-react';
import { authApi } from '../api/auth';
import { BRAND } from '../config/brand';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, promptMessage = null }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot'
  const [forgotStep, setForgotStep] = useState('request'); // 'request' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  React.useEffect(() => {
    if (isOpen) {
      setTab('login');
      setForgotStep('request');
      setError(null);
      setSuccessMessage(null);
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (tab === 'login') {
        const data = await authApi.login(email.trim(), password);
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      } else if (tab === 'register') {
        if (!fullName.trim() || fullName.trim().length < 2) {
          throw new Error('Please enter your full name (minimum 2 characters).');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters.');
        }
        if (phone && !/^[6-9]\d{9}$/.test(phone.trim())) {
          throw new Error('Phone number must be a valid 10-digit Indian mobile number.');
        }
        const data = await authApi.register(email.trim(), password, fullName.trim(), phone.trim() || undefined);
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      } else if (tab === 'forgot') {
        if (forgotStep === 'request') {
          if (!email.trim()) {
            throw new Error('Please enter your registered email address.');
          }
          const data = await authApi.forgotPassword(email.trim());
          setSuccessMessage(data.message || 'A 6-digit verification code has been sent to your email.');
          setResetCode('');
          setForgotStep('reset');
        } else {
          if (!resetCode.trim()) {
            throw new Error('Please enter the 6-digit verification code sent to your email.');
          }
          if (newPassword.length < 8) {
            throw new Error('New password must be at least 8 characters.');
          }
          if (newPassword !== confirmPassword) {
            throw new Error('Passwords do not match.');
          }
          const data = await authApi.resetPassword(email.trim(), resetCode.trim(), newPassword);
          setSuccessMessage(data.message || 'Password reset successfully. You can now sign in with your new password.');
          setTab('login');
          setPassword('');
          setResetCode('');
          setNewPassword('');
          setConfirmPassword('');
          setForgotStep('request');
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchTab = (newTab) => {
    setTab(newTab);
    setError(null);
    setSuccessMessage(null);
    if (newTab === 'forgot') {
      setForgotStep('request');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div id="auth-modal" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(27, 42, 32, 0.65)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#ffffff',
        borderRadius: 'var(--radius-lg, 16px)',
        border: '1px solid var(--moss-border, #e2e8f0)',
        boxShadow: 'var(--shadow-xl, 0 20px 40px rgba(0,0,0,0.15))',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--moss-border, #f1f5f9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--moss-deep, #1b2a20)',
            }}>
              {BRAND.name} Customer Account
            </span>
            <h3 style={{
              margin: '4px 0 0',
              fontSize: '1.25rem',
              fontWeight: 700,
              fontFamily: 'var(--font-serif, serif)',
              color: 'var(--moss-deep, #1b2a20)',
            }}>
              {tab === 'login' ? 'Welcome Back' : (tab === 'register' ? 'Create Account' : (forgotStep === 'request' ? 'Reset Password' : 'New Password'))}
            </h3>
          </div>

          <button
            id="auth-close-btn"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #64748b)',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation / Tab Switcher */}
        {tab === 'forgot' ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid var(--moss-border, #f1f5f9)',
            background: 'var(--bg-card-muted, #f8fafc)',
          }}>
            <button
              id="auth-back-to-login-tab-btn"
              type="button"
              onClick={() => handleSwitchTab('login')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                color: 'var(--moss-deep, #1b2a20)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              <ArrowLeft size={15} /> Back to Sign In
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>
              {forgotStep === 'request' ? 'Step 1: Request Code' : 'Step 2: Reset'}
            </span>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--moss-border, #f1f5f9)',
            background: 'var(--bg-card-muted, #f8fafc)',
          }}>
            <button
              type="button"
              onClick={() => handleSwitchTab('login')}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: 'none',
                background: tab === 'login' ? '#ffffff' : 'transparent',
                fontWeight: tab === 'login' ? 700 : 500,
                color: tab === 'login' ? 'var(--moss-deep, #1b2a20)' : 'var(--text-secondary, #64748b)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                borderBottom: tab === 'login' ? '2px solid var(--moss-deep, #1b2a20)' : 'none',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('register')}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: 'none',
                background: tab === 'register' ? '#ffffff' : 'transparent',
                fontWeight: tab === 'register' ? 700 : 500,
                color: tab === 'register' ? 'var(--moss-deep, #1b2a20)' : 'var(--text-secondary, #64748b)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                borderBottom: tab === 'register' ? '2px solid var(--moss-deep, #1b2a20)' : 'none',
              }}
            >
              New to {BRAND.name}? Register
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {promptMessage && (
            <div
              id="auth-prompt-message"
              style={{
                background: 'rgba(28, 48, 36, 0.08)',
                border: '1px solid var(--moss-sage, #8fa892)',
                borderRadius: 8,
                padding: '10px 14px',
                color: 'var(--moss-deep, #142017)',
                fontSize: '0.84rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Shield size={16} color="var(--moss-deep)" />
              <span>{promptMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              id="auth-success-message"
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle2 size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div
              id="auth-error-message"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {tab === 'forgot' && forgotStep === 'reset' && (
            <div
              id="auth-email-otp-notice"
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#334155',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: '0.82rem',
                lineHeight: 1.45,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <Mail size={16} color="var(--moss-deep, #1b2a20)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                A 6-digit verification code was sent to <strong>{email}</strong>. Please check your inbox or spam folder and enter the code below.
              </div>
            </div>
          )}

          {tab === 'register' && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                <input
                  id="auth-name-input"
                  type="text"
                  required
                  placeholder="e.g. Aditi Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: 8,
                    border: '1px solid var(--moss-border, #cbd5e1)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Email input (used across login, register, and forgot password) */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
              <input
                id="auth-email-input"
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                disabled={tab === 'forgot' && forgotStep === 'reset'}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 8,
                  border: '1px solid var(--moss-border, #cbd5e1)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  backgroundColor: (tab === 'forgot' && forgotStep === 'reset') ? '#f8fafc' : '#ffffff',
                }}
              />
            </div>
          </div>

          {/* Password input for Login and Register */}
          {tab !== 'forgot' && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                <input
                  id="auth-password-input"
                  type="password"
                  required
                  placeholder={tab === 'register' ? 'Minimum 8 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: 8,
                    border: '1px solid var(--moss-border, #cbd5e1)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>

              {tab === 'login' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <button
                    id="auth-forgot-password-link"
                    type="button"
                    onClick={() => handleSwitchTab('forgot')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--moss-deep, #1b2a20)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Registration phone number */}
          {tab === 'register' && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Mobile Number (India) <span style={{ color: '#94a3b8' }}>(Optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                <input
                  id="auth-phone-input"
                  type="tel"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: 8,
                    border: '1px solid var(--moss-border, #cbd5e1)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Forgot password Step 2 inputs */}
          {tab === 'forgot' && forgotStep === 'reset' && (
            <>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  6-Digit Verification Code
                </label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                  <input
                    id="auth-reset-code-input"
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. 123456"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      borderRadius: 8,
                      border: '1px solid var(--moss-border, #cbd5e1)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      letterSpacing: '0.1em',
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                  <input
                    id="auth-new-password-input"
                    type="password"
                    required
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      borderRadius: 8,
                      border: '1px solid var(--moss-border, #cbd5e1)',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                  <input
                    id="auth-confirm-password-input"
                    type="password"
                    required
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      borderRadius: 8,
                      border: '1px solid var(--moss-border, #cbd5e1)',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            id={tab === 'forgot' ? (forgotStep === 'request' ? 'auth-send-code-btn' : 'auth-reset-password-btn') : 'auth-submit-btn'}
            type="submit"
            disabled={isLoading}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.9rem',
              fontWeight: 700,
              marginTop: 8,
            }}
          >
            {isLoading
              ? 'Processing...'
              : tab === 'login'
              ? `Sign In to ${BRAND.name}`
              : tab === 'register'
              ? 'Create Customer Account'
              : forgotStep === 'request'
              ? 'Send Verification Code'
              : 'Reset Password'}
          </button>

          {/* Extra recovery helpers */}
          {tab === 'forgot' && (
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <button
                id="auth-back-to-login-btn"
                type="button"
                onClick={() => handleSwitchTab('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--text-secondary, #64748b)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Remember your password? Sign In
              </button>
            </div>
          )}

          <p style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary, #64748b)',
            textAlign: 'center',
            margin: '6px 0 0',
          }}>
            Protected with secure token authentication & session isolation.
          </p>
        </form>
      </div>
    </div>
  );
}
