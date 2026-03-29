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
  token: localStorage.getItem('asm_token'),
  refreshToken: localStorage.getItem('asm_refresh_token'),
  user: null,
  crpCode: localStorage.getItem('asm_crp_code'),
  isAuthenticated: !!localStorage.getItem('asm_token'),
  setAuth: (token, refreshToken, user) => {
    localStorage.setItem('asm_token', token);
    localStorage.setItem('asm_refresh_token', refreshToken);
    if (user.crpCode) localStorage.setItem('asm_crp_code', user.crpCode);
    set({ token, refreshToken, user, crpCode: user.crpCode, isAuthenticated: true });
  },
  setCrpCode: (code) => {
    localStorage.setItem('asm_crp_code', code);
    set({ crpCode: code });
  },
  clearAuth: () => {
    localStorage.removeItem('asm_token');
    localStorage.removeItem('asm_refresh_token');
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
  },
}));
