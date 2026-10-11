// Dynamic API Base URL:
// - In development: defaults to 'http://localhost:8000'
// - In production: defaults to '' (relative paths on same host) or VITE_API_BASE
export const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? 'http://localhost:8000' : '');
