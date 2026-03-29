import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('asm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('asm_token');
      localStorage.removeItem('asm_refresh_token');
      const crpCode = localStorage.getItem('asm_crp_code');
      if (crpCode) {
        window.location.href = `/app-stock-management/login`;
      } else {
        window.location.href = `/app-stock-management/entity-info`;
      }
    }
    return Promise.reject(error);
  },
);
