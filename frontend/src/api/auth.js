import { api } from './client';

export const authApi = {
  async register(email, password, fullName, phone, phoneConsent = false) {
    const data = await api.post('/api/auth/register', {
      email,
      password,
      full_name: fullName,
      phone: phone || undefined,
      phone_consent: Boolean(phoneConsent),
    });
    if (data.access_token) {
      api.setAuthToken(data.access_token);
      localStorage.setItem('moss_refresh_token', data.refresh_token);
      localStorage.setItem('moss_user_profile', JSON.stringify(data.user));
      localStorage.setItem('moss_customer_email', data.user.email);
    }
    return data;
  },

  async login(email, password) {
    const data = await api.post('/api/auth/login', { email, password });
    if (data.access_token) {
      api.setAuthToken(data.access_token);
      localStorage.setItem('moss_refresh_token', data.refresh_token);
      localStorage.setItem('moss_user_profile', JSON.stringify(data.user));
      localStorage.setItem('moss_customer_email', data.user.email);
    }
    return data;
  },

  async getMe() {
    return await api.get('/api/auth/me');
  },

  async getApiMe() {
    return await api.get('/api/me');
  },

  async getUserAddresses() {
    return await api.get('/api/user/addresses');
  },

  async addUserAddress(addressData) {
    return await api.post('/api/user/addresses', addressData);
  },

  async deleteUserAddress(addressId) {
    return await api.delete(`/api/user/addresses/${addressId}`);
  },

  async updateProfile(fullName, phone, phoneConsent) {
    const payload = {
      full_name: fullName,
      phone: phone || undefined,
    };
    if (phoneConsent !== undefined) {
      payload.phone_consent = Boolean(phoneConsent);
    }
    const data = await api.put('/api/auth/profile', payload);
    const current = authApi.getStoredUser() || {};
    const updated = { ...current, ...data };
    localStorage.setItem('moss_user_profile', JSON.stringify(updated));
    return updated;
  },

  async forgotPassword(identifier, channel = 'email') {
    const isPhone = typeof identifier === 'string' && !identifier.includes('@') && /^\+?[\d\s\-]+$/.test(identifier);
    const body = {
      channel,
      ...(isPhone ? { phone: identifier.replace(/[\s\-]/g, '') } : { email: identifier }),
    };
    return await api.post('/api/auth/forgot-password', body);
  },

  async resetPassword(identifier, code, newPassword) {
    const isPhone = typeof identifier === 'string' && !identifier.includes('@') && /^\+?[\d\s\-]+$/.test(identifier);
    const body = {
      code,
      new_password: newPassword,
      ...(isPhone ? { phone: identifier.replace(/[\s\-]/g, '') } : { email: identifier }),
    };
    return await api.post('/api/auth/reset-password', body);
  },

  async changePassword(currentPassword, newPassword) {
    return await api.post('/api/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  async deleteAccount() {
    const data = await api.delete('/api/auth/account');
    authApi.logout();
    return data;
  },

  logout() {
    api.setAuthToken(null);
    localStorage.removeItem('moss_refresh_token');
    localStorage.removeItem('moss_user_profile');
  },

  async getCart() {
    return await api.get('/api/cart');
  },

  async addToCart(productId, quantity = 1) {
    return await api.post('/api/cart/items', { product_id: productId, quantity });
  },

  async mergeCart(items) {
    return await api.post('/api/cart/merge', { items });
  },

  async clearCart() {
    return await api.delete('/api/cart');
  },

  async refreshAccessToken() {
    const refreshToken = localStorage.getItem('moss_refresh_token');
    if (!refreshToken) return null;
    const data = await api.post('/api/auth/refresh', { refresh_token: refreshToken });
    if (data?.access_token) {
      api.setAuthToken(data.access_token);
    }
    return data;
  },

  getStoredUser() {
    try {
      const raw = localStorage.getItem('moss_user_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated() {
    return !!api.getAuthToken();
  },
};

export default authApi;
