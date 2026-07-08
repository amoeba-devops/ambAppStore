import { create } from 'zustand';

export interface AuthUser {
  userId: string;
  entityId: string;
  entityCode: string;
  name: string;
  email: string;
  roles: string[];
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  clear: () => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('hsc_token'),
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem('hsc_token', token);
    set({ token, user });
  },
  clear: () => {
    localStorage.removeItem('hsc_token');
    set({ token: null, user: null });
  },
  isAdmin: () => get().user?.roles?.includes('ADMIN') ?? false,
}));
