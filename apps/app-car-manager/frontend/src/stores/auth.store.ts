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

/**
 * 모듈 로드 시점에 URL 쿼리파라미터를 동기적으로 파싱하여 sessionStorage에 저장.
 * EntityContextInitializer(useEffect)보다 먼저 실행되어 Race Condition 방지.
 */
function initEntityFromQueryParams(): User | null {
  const params = new URLSearchParams(window.location.search);
  const entId = params.get('ent_id');
  const entCode = params.get('ent_code');
  if (!entId || !entCode) return null;

  const user: User = {
    userId: entId,
    entityId: entId,
    entityCode: entCode,
    email: params.get('email') ?? '',
    name: params.get('ent_name') ?? '',
    roles: [],
  };
  sessionStorage.setItem('entity_context', JSON.stringify(user));
  return user;
}

const entityFromParams = initEntityFromQueryParams();
const savedToken = localStorage.getItem('ama_token');
const restoredEntity = entityFromParams || (!savedToken ? restoreUserFromParams() : null);

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
