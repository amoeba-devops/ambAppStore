import { useAuthStore, type AuthUser } from '@/stores/auth.store';

/**
 * AMA SSO(ama_token) 수신 유틸.
 * AMA 호스트는 앱을 iframe `{app.url}?ama_token=<JWT>&locale=xx` 로 임베드한다
 * (ambManagement CustomAppHostPage). SPA 클라이언트 라우팅으로 쿼리가 유실되기 전에
 * 앱 부팅 시 1회 캡처하여 스토어/localStorage에 저장한다. 이후 모든 API는 Bearer로 전송.
 *
 * App Store SSO 토큰 payload: { sub, email, role, entityId, scope:'app_store:context', appSlug?, iat, exp }
 * (단일 role 문자열 — roles[]/level 없음. 백엔드 jwt.strategy가 role을 roles[]로 접어 처리.)
 */

const STORAGE_KEY = 'hsc_token';

/** AMA 엔티티 관리자 역할 (백엔드 RoleGuard ADMIN_ROLES 와 일치). */
const ADMIN_ROLES = ['ADMIN', 'MASTER', 'SUPER_ADMIN'];

export interface AmaTokenPayload {
  sub?: string;
  userId?: string;
  email?: string;
  name?: string;
  entityId?: string;
  ent_id?: string;
  entityCode?: string;
  ent_code?: string;
  level?: string;
  role?: string;
  roles?: string[];
  scope?: string;
  exp?: number;
  iat?: number;
}

/** base64url JWT payload → 객체 (서명 검증 없음 — 표시/컨텍스트 용도, UTF-8 안전). */
export function decodeAmaToken(token: string): AmaTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as AmaTokenPayload;
  } catch {
    return null;
  }
}

function isExpired(p: AmaTokenPayload): boolean {
  return typeof p.exp === 'number' && p.exp * 1000 < Date.now();
}

function toAuthUser(p: AmaTokenPayload): AuthUser {
  const roles = Array.isArray(p.roles) ? [...p.roles] : [];
  if (p.role && !roles.includes(p.role)) roles.push(p.role);
  // 관리자면 프론트 isAdmin()(roles.includes('ADMIN'))도 참이 되도록 정규화.
  const isAdmin = p.level === 'ADMIN_LEVEL' || roles.some((r) => ADMIN_ROLES.includes(r));
  if (isAdmin && !roles.includes('ADMIN')) roles.push('ADMIN');
  return {
    userId: p.sub || p.userId || '',
    entityId: p.ent_id || p.entityId || '',
    entityCode: p.ent_code || p.entityCode || '',
    name: p.name || '',
    email: p.email || '',
    roles,
  };
}

/**
 * 부팅 시 AMA 인증 복원. URL ?ama_token 우선, 없으면 저장된 토큰 사용.
 * @returns URL로 전달된 locale (있으면) — i18n 초기 언어 설정용
 */
export function bootstrapAmaAuth(): string | null {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('ama_token');
  const locale = params.get('locale');

  const token = urlToken || localStorage.getItem(STORAGE_KEY);
  if (token) {
    const payload = decodeAmaToken(token);
    if (payload && !isExpired(payload)) {
      useAuthStore.getState().setAuth(token, toAuthUser(payload));
    } else {
      // 만료/파싱불가 → 저장된 stale 토큰 정리 (401 반복 방지)
      useAuthStore.getState().clear();
    }
  }

  // 주소창/히스토리 노출·중복 캡처 방지 — URL에서 ama_token 제거
  if (urlToken) {
    params.delete('ama_token');
    const qs = params.toString();
    const clean = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    window.history.replaceState({}, '', clean);
  }

  return locale;
}
