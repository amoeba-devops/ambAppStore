import { create } from 'zustand';

interface AuthUser {
  userId: string;
  entId: string | null;
  crpCode: string | null;
  role: string;
  name: string;
  tempPassword: boolean;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  crpCode: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, refreshToken: string, user: AuthUser) => void;
  setCrpCode: (code: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('drd_token'),
  refreshToken: localStorage.getItem('drd_refresh_token'),
  user: null,
  crpCode: localStorage.getItem('drd_crp_code'),
  isAuthenticated: !!localStorage.getItem('drd_token'),
  setAuth: (token, refreshToken, user) => {
    localStorage.setItem('drd_token', token);
    localStorage.setItem('drd_refresh_token', refreshToken);
    if (user.crpCode) localStorage.setItem('drd_crp_code', user.crpCode);
    set({ token, refreshToken, user, crpCode: user.crpCode, isAuthenticated: true });
  },
  setCrpCode: (code) => {
    localStorage.setItem('drd_crp_code', code);
    set({ crpCode: code });
  },
  clearAuth: () => {
    localStorage.removeItem('drd_token');
    localStorage.removeItem('drd_refresh_token');
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
  },
}));
