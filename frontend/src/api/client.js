import { API_BASE } from '../config';

/**
 * Standard HTTP client with automatic JWT bearer injection,
 * request tracing via X-Request-ID, and normalized error envelopes.
 */
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || API_BASE;
  }

  getAuthToken() {
    return localStorage.getItem('moss_auth_token');
  }

  setAuthToken(token) {
    if (token) {
      localStorage.setItem('moss_auth_token', token);
    } else {
      localStorage.removeItem('moss_auth_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getAuthToken();
    const requestId = `req_${Math.random().toString(36).substring(2, 10)}`;

    const headers = {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      ...(options.headers || {}),
    };

    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized with token refresh and session recovery
      if (response.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/refresh')) {
        const refreshToken = localStorage.getItem('moss_refresh_token');
        if (refreshToken) {
          try {
            const refreshRes = await fetch(`${this.baseUrl}/api/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              if (refreshData?.access_token) {
                this.setAuthToken(refreshData.access_token);
                // Retry pending action with new token
                headers['Authorization'] = `Bearer ${refreshData.access_token}`;
                const retryRes = await fetch(url, { ...options, headers });
                if (retryRes.ok) {
                  return await retryRes.json();
                }
              }
            }
          } catch (e) {
            console.warn('Failed transparent token refresh:', e);
          }
        }

        // Refresh failed or no refresh token: clear access token but keep cart intact!
        this.setAuthToken(null);
        localStorage.removeItem('moss_user_profile');

        // Dispatch expired session event for UI to open login modal and retry pending action
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('moss_auth_expired', {
            detail: {
              endpoint,
              options,
              message: 'Your session has expired. Sign in to place your order.',
            }
          }));
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = errorData.message || errorData.detail;
        if (typeof errorMessage === 'object' && errorMessage !== null) {
          errorMessage = errorMessage.message || errorMessage.detail || JSON.stringify(errorMessage);
        }
        if (!errorMessage) {
          errorMessage = `Request failed with status ${response.status}`;
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = errorData;
        error.requestId = response.headers.get('X-Request-ID') || requestId;

        // Parse Retry-After header or regex from error message
        const retryHeader = response.headers.get('Retry-After');
        if (retryHeader && !isNaN(parseInt(retryHeader, 10))) {
          error.retryAfter = parseInt(retryHeader, 10);
        } else if (errorData && typeof errorData.retry_after === 'number') {
          error.retryAfter = errorData.retry_after;
        } else {
          const match = errorMessage.match(/wait\s+(\d+)\s*(?:seconds|s)/i);
          if (match) {
            error.retryAfter = parseInt(match[1], 10);
          }
        }

        throw error;
      }

      return await response.json();
    } catch (err) {
      console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, err.message);
      throw err;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
export default api;
