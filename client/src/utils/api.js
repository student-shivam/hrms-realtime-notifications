import axios from 'axios';

const trimTrailingSlash = (value) => value.replace(/\/$/, '');

const getEnvValue = (...keys) => {
  for (const key of keys) {
    const value = import.meta.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const configuredApiOrigin = getEnvValue('VITE_API_URL', 'REACT_APP_API');
const configuredSocketOrigin = getEnvValue('VITE_SOCKET_URL', 'REACT_APP_SOCKET_URL');
const DEFAULT_API_ORIGIN = configuredApiOrigin || (import.meta.env.DEV ? 'http://localhost:5001/api' : '/api');

const normalizeApiBaseUrl = (value) => {
  const rawValue = value ? value : DEFAULT_API_ORIGIN;
  return rawValue.endsWith('/api') ? rawValue : `${trimTrailingSlash(rawValue)}/api`;
};

export const API_BASE_URL = normalizeApiBaseUrl(configuredApiOrigin);
export const SOCKET_URL = trimTrailingSlash(configuredSocketOrigin || API_BASE_URL.replace(/\/api$/, ''));
export const ASSET_BASE_URL = SOCKET_URL;

export const getApiErrorMessage = (error, fallback = 'Something went wrong') => {
  if (!error) return fallback;

  const responseData = error.response?.data;
  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData;
  }

  return responseData?.message
    || responseData?.error
    || error.message
    || fallback;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = getApiErrorMessage(error, 'API request failed');
    
    // Auto-logout if token is invalid or expired (401)
    if (status === 401 && !error.config.url.includes('/auth/login')) {
      console.warn('[API] Unauthorized access detected, clearing session...');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    console.error('API error:', message);
    error.message = message;
    return Promise.reject(error);
  }
);

export default api;
