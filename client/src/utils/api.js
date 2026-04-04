import axios from 'axios';

const DEFAULT_API_ORIGIN = 'http://localhost:5001';

const normalizeApiBaseUrl = (value) => {
  const rawValue = value || `${DEFAULT_API_ORIGIN}/api`;
  return rawValue.endsWith('/api') ? rawValue : `${rawValue.replace(/\/$/, '')}/api`;
};

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api$/, '')).replace(/\/$/, '');
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
    const message = getApiErrorMessage(error, 'API request failed');
    console.error('API error:', message);
    error.message = message;
    return Promise.reject(error);
  }
);

export default api;
