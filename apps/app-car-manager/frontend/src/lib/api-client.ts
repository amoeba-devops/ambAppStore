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
  } else {
    // JWT 없을 때 Entity 헤더로 대체 (스테이징 테스트용)
    const raw = sessionStorage.getItem('entity_context');
    if (raw) {
      try {
        const entity = JSON.parse(raw);
        config.headers['X-Entity-Id'] = entity.entityId;
        config.headers['X-Entity-Code'] = entity.entityCode;
        config.headers['X-Entity-Email'] = entity.email;
        config.headers['X-Entity-Name'] = entity.name;
      } catch { /* ignore */ }
    }
  }
  return config;
});

const isInIframe = window.self !== window.top;

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hasEntityContext = !!sessionStorage.getItem('entity_context');
      if (hasEntityContext) {
        // Entity 헤더 인증 사용 중이면 리다이렉트하지 않음
      } else if (isInIframe) {
        // iframe 내부에서는 리다이렉트 차단 — 부모 창에 알림
        try {
          window.parent.postMessage({ type: 'AUTH_REQUIRED', source: 'app-car-manager' }, '*');
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
