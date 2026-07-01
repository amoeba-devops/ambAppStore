import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

/**
 * 공통 API 클라이언트. Base = {app-base}/api/v1.
 * 프로덕션 Nginx는 /app-hscode/api/ → bff-app-hscode:3102/api/ 로 프록시하므로
 * BASE_URL(=/app-hscode/) 기준으로 /app-hscode/api/v1 을 호출한다. (dev는 vite proxy 동일 경로)
 * 컴포넌트에서 직접 호출 금지 — 반드시 service 계층 경유 (CLAUDE.md FE 규칙).
 */
const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export const apiClient = axios.create({
  baseURL: `${APP_BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
  timestamp: string;
}

/** 표준 응답 언래퍼 — data만 반환, 에러는 코드와 함께 throw */
export async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  if (!res.data.success) {
    throw new Error(res.data.error?.code ?? 'HSC-E9999');
  }
  return res.data.data;
}
