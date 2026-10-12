// Single source of truth for API Base URL:
// Uses VITE_API_BASE_URL if explicitly provided; defaults to empty string so
// all requests in development leverage the Vite dev proxy seamlessly.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
export default API_BASE;
