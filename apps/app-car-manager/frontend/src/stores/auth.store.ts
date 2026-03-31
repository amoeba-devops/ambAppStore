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
  setEntityAuth: (user: User) => void;
  clearAuth: () => void;
}

function restoreUserFromParams(): User | null {
  const raw = sessionStorage.getItem('entity_context');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const savedToken = localStorage.getItem('ama_token');
const restoredEntity = !savedToken ? restoreUserFromParams() : null;

export const useAuthStore = create<AuthState>((set) => ({
  token: savedToken,
  user: restoredEntity,
  isAuthenticated: !!savedToken || !!restoredEntity,
  setAuth: (token, user) => {
    localStorage.setItem('ama_token', token);
    set({ token, user, isAuthenticated: true });
  },
  setEntityAuth: (user) => {
    sessionStorage.setItem('entity_context', JSON.stringify(user));
    set({ token: null, user, isAuthenticated: true });
  },
  clearAuth: () => {
    localStorage.removeItem('ama_token');
    sessionStorage.removeItem('entity_context');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
