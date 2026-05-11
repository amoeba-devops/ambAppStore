import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'cc.accessToken';
const REFRESH_TOKEN_KEY = 'cc.refreshToken';

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setTokens(access: string, refresh?: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function refresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/api/mobile/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const access = json?.data?.accessToken as string | undefined;
  if (!access) return null;
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
  return access;
}

type RequestInitWithAuth = RequestInit & { skipAuth?: boolean; retry?: boolean };

export async function api<T = unknown>(
  path: string,
  init: RequestInitWithAuth = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  if (!init.skipAuth) {
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && !init.skipAuth && !init.retry) {
    const newAccess = await refresh();
    if (newAccess) {
      return api<T>(path, { ...init, retry: true });
    }
    await clearTokens();
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const code = json?.error?.code ?? `HTTP_${res.status}`;
    const message = json?.error?.message ?? `Request failed: ${res.status}`;
    throw new ApiError(res.status, code, message);
  }
  return json?.data as T;
}
