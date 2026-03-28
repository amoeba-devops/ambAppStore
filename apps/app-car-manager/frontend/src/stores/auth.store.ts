import { create } from 'zustand';

interface User {
  userId: string;
  entityId: string;
  entityCode: string;
  email: string;
  name: string;
  roles: string[];
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('ama_token'),
  user: null,
  isAuthenticated: !!localStorage.getItem('ama_token'),
  setAuth: (token, user) => {
    localStorage.setItem('ama_token', token);
    set({ token, user, isAuthenticated: true });
  },
  clearAuth: () => {
    localStorage.removeItem('ama_token');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
