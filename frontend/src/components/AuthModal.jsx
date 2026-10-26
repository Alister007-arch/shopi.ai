import React, { useState, useEffect } from 'react';
import { X, User, Lock, Mail, Phone, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Shield, KeyRound, Clock, MessageCircle } from 'lucide-react';
import { authApi } from '../api/auth';
import { BRAND } from '../config/brand';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, promptMessage = null }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot'
  const [forgotStep, setForgotStep] = useState('request'); // 'request' | 'reset'
  const [channel, setChannel] = useState('email'); // 'email' | 'sms' | 'whatsapp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneConsent, setPhoneConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // Live second-by-second countdown timer for rate limiting
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  useEffect(() => {
    if (isOpen) {
      setTab('login');
      setForgotStep('request');
      setChannel('email');
      setError(null);
      setSuccessMessage(null);
      setEmail('');
      setPassword('');
      setPhone('');
      setForgotPhone('');
      setPhoneConsent(false);
      setFullName('');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
      setRateLimitSeconds(0);
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
        const data = await authApi.register(email.trim(), password, fullName.trim(), phone.trim() || undefined, phoneConsent);
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      } else if (tab === 'forgot') {
        if (forgotStep === 'request') {
          let data;
          if (channel === 'email') {
            if (!email.trim() || !email.includes('@')) {
              throw new Error('Please enter a valid registered email address.');
            }
            data = await authApi.forgotPassword(email.trim(), 'email');
          } else {
            const cleanPhone = forgotPhone.replace(/[\s\-]/g, '');
            if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
              throw new Error('Please enter a valid 10-digit Indian mobile number.');
            }
            data = await authApi.forgotPassword(cleanPhone, channel);
          }
          setSuccessMessage(data.message || 'A 6-digit verification code has been dispatched.');
          setResetCode('');
          setForgotStep('reset');
        } else {
          if (!resetCode.trim()) {
            throw new Error('Please enter the 6-digit verification code.');
          }
          if (newPassword.length < 8) {
            throw new Error('New password must be at least 8 characters.');
          }
          if (newPassword !== confirmPassword) {
            throw new Error('Passwords do not match.');
          }
          const identifier = channel === 'email' ? email.trim() : forgotPhone.replace(/[\s\-]/g, '');
          const data = await authApi.resetPassword(identifier, resetCode.trim(), newPassword);
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
      if (err.status === 429 || (err.message && err.message.toLowerCase().includes('too many login attempts'))) {
        const seconds = err.retryAfter || 60;
        setRateLimitSeconds(seconds);
        setError(`Too many login attempts. Please wait ${seconds} seconds before trying again.`);
      } else {
        setError(err.message || 'Authentication failed. Please verify your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError(null);
    setIsLoading(true);
    try {
      let data;
      if (channel === 'email') {
        data = await authApi.forgotPassword(email.trim(), 'email');
      } else {
        const clean = forgotPhone.replace(/[\s\-]/g, '');
        data = await authApi.forgotPassword(clean, channel);
      }
      setSuccessMessage(data.message || 'A new 6-digit verification code has been dispatched.');
    } catch (err) {
      setError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchTab = (newTab) => {
    setTab(newTab);
    setError(null);
    setSuccessMessage(null);
    setPhoneConsent(false);
    if (newTab === 'forgot') {
      setForgotStep('request');
      setChannel('email');
      setForgotPhone('');
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

        {/* Navigation / Tab Switcher (3 Tabs: Sign In | Register | Forgot Password) */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--moss-border, #f1f5f9)',
          background: 'var(--bg-card-muted, #f8fafc)',
        }}>
          <button
            type="button"
            id="auth-tab-login"
            onClick={() => handleSwitchTab('login')}
            style={{
              flex: 1,
              padding: '12px 10px',
              border: 'none',
              background: tab === 'login' ? '#ffffff' : 'transparent',
              fontWeight: tab === 'login' ? 700 : 500,
              color: tab === 'login' ? 'var(--moss-deep, #1b2a20)' : 'var(--text-secondary, #64748b)',
              fontSize: '0.84rem',
              cursor: 'pointer',
              borderBottom: tab === 'login' ? '2px solid var(--moss-deep, #1b2a20)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            id="auth-tab-register"
            onClick={() => handleSwitchTab('register')}
            style={{
              flex: 1.2,
              padding: '12px 10px',
              border: 'none',
              background: tab === 'register' ? '#ffffff' : 'transparent',
              fontWeight: tab === 'register' ? 700 : 500,
              color: tab === 'register' ? 'var(--moss-deep, #1b2a20)' : 'var(--text-secondary, #64748b)',
              fontSize: '0.84rem',
              cursor: 'pointer',
              borderBottom: tab === 'register' ? '2px solid var(--moss-deep, #1b2a20)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Register
          </button>
          <button
            type="button"
            id="auth-tab-forgot"
            onClick={() => handleSwitchTab('forgot')}
            style={{
              flex: 1.2,
              padding: '12px 10px',
              border: 'none',
              background: tab === 'forgot' ? '#ffffff' : 'transparent',
              fontWeight: tab === 'forgot' ? 700 : 500,
              color: tab === 'forgot' ? 'var(--moss-deep, #1b2a20)' : 'var(--text-secondary, #64748b)',
              fontSize: '0.84rem',
              cursor: 'pointer',
              borderBottom: tab === 'forgot' ? '2px solid var(--moss-deep, #1b2a20)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Forgot Password
          </button>
        </div>

        {/* Step indicator and back navigation when Forgot Password tab is active */}
        {tab === 'forgot' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 20px',
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
                padding: '2px 0',
              }}
            >
              <ArrowLeft size={15} /> Back to Sign In
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>
              {forgotStep === 'request' ? 'Step 1: Request Code' : 'Step 2: Reset'}
            </span>
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
              {rateLimitSeconds > 0 ? (
                <Clock size={16} style={{ flexShrink: 0 }} />
              ) : (
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
              )}
              <span>
                {rateLimitSeconds > 0
                  ? `Too many login attempts. Please wait ${rateLimitSeconds}s before trying again.`
                  : error}
              </span>
            </div>
          )}

          {/* Forgot password Channel Selector in Step 1 */}
          {tab === 'forgot' && forgotStep === 'request' && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Deliver Verification Code Via:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  id="auth-channel-email"
                  onClick={() => setChannel('email')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: channel === 'email' ? '2px solid var(--moss-deep, #1b2a20)' : '1px solid var(--moss-border, #cbd5e1)',
                    background: channel === 'email' ? 'rgba(28, 48, 36, 0.08)' : '#ffffff',
                    fontWeight: channel === 'email' ? 700 : 500,
                    color: channel === 'email' ? 'var(--moss-deep, #1b2a20)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: '0.8rem',
                    transition: 'all 0.2s',
                  }}
                >
                  <Mail size={15} />
                  <span>Email</span>
                </button>

                <button
                  type="button"
                  id="auth-channel-sms"
                  onClick={() => setChannel('sms')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: channel === 'sms' ? '2px solid var(--moss-deep, #1b2a20)' : '1px solid var(--moss-border, #cbd5e1)',
                    background: channel === 'sms' ? 'rgba(28, 48, 36, 0.08)' : '#ffffff',
                    fontWeight: channel === 'sms' ? 700 : 500,
                    color: channel === 'sms' ? 'var(--moss-deep, #1b2a20)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: '0.8rem',
                    transition: 'all 0.2s',
                  }}
                >
                  <Phone size={15} />
                  <span>SMS</span>
                </button>

                <button
                  type="button"
                  id="auth-channel-whatsapp"
                  onClick={() => setChannel('whatsapp')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: channel === 'whatsapp' ? '2px solid #25D366' : '1px solid var(--moss-border, #cbd5e1)',
                    background: channel === 'whatsapp' ? 'rgba(37, 211, 102, 0.1)' : '#ffffff',
                    fontWeight: channel === 'whatsapp' ? 700 : 500,
                    color: channel === 'whatsapp' ? '#128C7E' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: '0.8rem',
                    transition: 'all 0.2s',
                  }}
                >
                  <MessageCircle size={15} />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          )}

          {/* Full Name input for registration */}
          {tab === 'register' && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Full Customer Name *
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
                    backgroundColor: '#ffffff',
                  }}
                />
              </div>
            </div>
          )}

          {/* Email input (used across login, register, and email forgot password) */}
          {(tab !== 'forgot' || (tab === 'forgot' && forgotStep === 'request' && channel === 'email')) && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                {tab === 'login' ? 'Email Address or Mobile Number' : (tab === 'forgot' ? 'Registered Email Address *' : 'Email Address *')}
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                <input
                  id="auth-email-input"
                  type={tab === 'login' ? 'text' : 'email'}
                  required
                  placeholder={tab === 'login' ? 'you@domain.com or 10-digit mobile' : 'you@domain.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: 8,
                    border: '1px solid var(--moss-border, #cbd5e1)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                  }}
                />
              </div>
            </div>
          )}

          {/* Phone input for SMS & WhatsApp forgot password */}
          {tab === 'forgot' && forgotStep === 'request' && channel !== 'email' && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Registered Mobile Number (India) *
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--moss-border, #cbd5e1)',
                  background: '#f8fafc',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--moss-deep, #1b2a20)',
                }}>
                  +91
                </span>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Phone size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                  <input
                    id="auth-forgot-phone-input"
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, ''))}
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
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                {channel === 'whatsapp'
                  ? 'We will send a 6-digit verification code directly via WhatsApp.'
                  : 'Standard carrier SMS delivery rates may apply.'}
              </span>
            </div>
          )}

          {/* Quick Demo Account for Forgot Password testing (strictly DEV & VITE_DEMO_MODE=true only, never in production) */}
          {import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true' && tab === 'forgot' && forgotStep === 'request' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
              <button
                id="auth-fill-demo-forgot-btn"
                type="button"
                onClick={() => {
                  if (channel === 'email') {
                    setEmail('shopper@moss.internal');
                  } else {
                    setForgotPhone('9876543210');
                  }
                  setError(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--moss-deep, #1b2a20)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Fill Demo Account ({channel === 'email' ? 'shopper@moss.internal' : '9876543210'})
              </button>
            </div>
          )}

          {/* Step 2 Dispatch Notice */}
          {tab === 'forgot' && forgotStep === 'reset' && (
            <div
              id="auth-email-otp-notice"
              data-testid="auth-otp-dispatch-notice"
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#334155',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: '0.82rem',
                lineHeight: 1.45,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              {channel === 'whatsapp' ? (
                <MessageCircle size={18} color="#128C7E" style={{ marginTop: 2, flexShrink: 0 }} />
              ) : channel === 'sms' ? (
                <Phone size={18} color="var(--moss-deep, #1b2a20)" style={{ marginTop: 2, flexShrink: 0 }} />
              ) : (
                <Mail size={18} color="var(--moss-deep, #1b2a20)" style={{ marginTop: 2, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div>
                  A 6-digit verification code was dispatched via <strong>{channel.toUpperCase()}</strong> to{' '}
                  <strong>{channel === 'email' ? email : `+91 ${forgotPhone}`}</strong>.
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                  (Note: In local testing without live SMTP/Twilio, the code is printed in your backend terminal console)
                </div>
                <button
                  type="button"
                  onClick={() => setForgotStep('request')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--moss-deep, #1b2a20)',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: 6,
                    textDecoration: 'underline',
                  }}
                >
                  Change channel or destination
                </button>
              </div>
            </div>
          )}

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
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 6 }}>

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

          {/* Registration phone number & consent */}
          {tab === 'register' && (
            <>
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

              <div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <input
                    id="auth-phone-consent-checkbox"
                    type="checkbox"
                    checked={phoneConsent}
                    onChange={(e) => setPhoneConsent(e.target.checked)}
                    style={{ marginTop: 2, accentColor: 'var(--moss-deep, #1b2a20)', width: 15, height: 15 }}
                  />
                  <span>
                    I consent to receiving order updates & security codes via SMS / WhatsApp.
                  </span>
                </label>
              </div>
            </>
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
            disabled={isLoading || (tab === 'login' && rateLimitSeconds > 0)}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.9rem',
              fontWeight: 700,
              marginTop: 8,
              color: '#ffffff',
              opacity: (tab === 'login' && rateLimitSeconds > 0) ? 0.75 : 1,
              cursor: (isLoading || (tab === 'login' && rateLimitSeconds > 0)) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isLoading ? (
              'Processing...'
            ) : tab === 'login' && rateLimitSeconds > 0 ? (
              <>
                <Clock size={16} />
                <span>Locked (Wait {rateLimitSeconds}s)</span>
              </>
            ) : tab === 'login' ? (
              `Sign In to ${BRAND.name}`
            ) : tab === 'register' ? (
              'Create Customer Account'
            ) : forgotStep === 'request' ? (
              'Send Verification Code'
            ) : (
              'Reset Password & Sign In'
            )}
          </button>

          {/* Resend Code in Step 2 */}
          {tab === 'forgot' && forgotStep === 'reset' && (
            <div style={{ textAlign: 'center', marginTop: 2 }}>
              <button
                id="auth-resend-code-btn"
                type="button"
                disabled={isLoading}
                onClick={handleResendCode}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--moss-deep, #1b2a20)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Didn't receive the code? Resend Code
              </button>
            </div>
          )}

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
        </form>
      </div>
    </div>
  );
}
