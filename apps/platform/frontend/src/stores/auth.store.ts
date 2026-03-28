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
  isAdmin: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

function restoreUserFromToken(token: string | null): { user: User | null; isAdmin: boolean } {
  if (!token) return { user: null, isAdmin: false };
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return { user: null, isAdmin: false };
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('ama_token');
      return { user: null, isAdmin: false };
    }
    const roles = payload.roles || [];
    return {
      user: {
        userId: payload.sub || payload.userId || '',
        entityId: payload.ent_id || payload.entityId || '',
        entityCode: payload.ent_code || payload.entityCode || '',
        email: payload.email || '',
        name: payload.name || '',
        roles,
      },
      isAdmin: roles.includes('ADMIN'),
    };
  } catch {
    return { user: null, isAdmin: false };
  }
}

const savedToken = localStorage.getItem('ama_token');
const { user: restoredUser, isAdmin: restoredIsAdmin } = restoreUserFromToken(savedToken);

export const useAuthStore = create<AuthState>((set) => ({
  token: savedToken,
  user: restoredUser,
  isAuthenticated: !!restoredUser,
  isAdmin: restoredIsAdmin,
  setAuth: (token, user) => {
    localStorage.setItem('ama_token', token);
    set({
      token,
      user,
      isAuthenticated: true,
      isAdmin: user.roles?.includes('ADMIN') || false,
    });
  },
  clearAuth: () => {
    localStorage.removeItem('ama_token');
    set({ token: null, user: null, isAuthenticated: false, isAdmin: false });
  },
}));
