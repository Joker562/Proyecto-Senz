import axios from 'axios';

// En desarrollo: Vite proxy resuelve /api → localhost:4000
// En producción: usa la URL de Railway directamente
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1');

const RAILWAY_URL = 'https://proyecto-senz-production.up.railway.app';

const BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : isLocalhost
    ? '/api'
    : `${RAILWAY_URL}/api`;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Limpiar AMBAS claves: la que usa el interceptor de request y la de zustand persist
      localStorage.removeItem('token');
      localStorage.removeItem('auth-store');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
