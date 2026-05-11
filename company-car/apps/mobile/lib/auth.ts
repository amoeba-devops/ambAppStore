import { api, clearTokens, setTokens } from './api-client';
import type { MobileLoginResponse, User } from '@repo/api-types';

export async function login(email: string, password: string): Promise<User> {
  const data = await api<MobileLoginResponse>('/api/mobile/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
  await setTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function logout() {
  try {
    const refreshToken = await import('expo-secure-store').then((m) =>
      m.getItemAsync('cc.refreshToken'),
    );
    if (refreshToken) {
      await api('/api/mobile/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        skipAuth: true,
      }).catch(() => undefined);
    }
  } finally {
    await clearTokens();
  }
}

export async function fetchMe(): Promise<User> {
  return api<User>('/api/auth/me');
}
