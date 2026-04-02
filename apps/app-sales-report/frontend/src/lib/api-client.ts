import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('drd_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('drd_token');
      localStorage.removeItem('drd_refresh_token');
      const crpCode = localStorage.getItem('drd_crp_code');
      if (crpCode) {
        window.location.href = `/app-sales-report/login`;
      } else {
        window.location.href = `/app-sales-report/entity-info`;
      }
    }
    return Promise.reject(error);
  },
);
