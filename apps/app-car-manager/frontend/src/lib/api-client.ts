import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('ama_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (import.meta.env.DEV) {
    config.headers['X-Entity-Id'] = 'dev-entity-001';
    config.headers['X-Entity-Code'] = 'DEV';
    config.headers['X-Entity-Name'] = 'Dev Entity';
    config.headers['X-Entity-Email'] = 'dev@localhost';
  }
  return config;
});

const isInIframe = window.self !== window.top;

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (isInIframe) {
        // iframe 내부에서는 부모 창에 알림
        try {
          window.parent.postMessage({ type: 'TOKEN_EXPIRED', source: 'app-car-manager' }, '*');
        } catch { /* cross-origin 차단 시 무시 */ }
      } else {
        localStorage.removeItem('ama_token');
        const loginUrl = import.meta.env.VITE_AMA_LOGIN_URL;
        if (loginUrl) {
          window.location.href = loginUrl;
        }
      }
    }
    return Promise.reject(error);
  },
);
