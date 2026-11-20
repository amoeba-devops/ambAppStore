import 'server-only';
import { cookies } from 'next/headers';
import { MOCK_AMA_MEMBERS } from '@/lib/users-mock';
import { SalError } from '@v2/shared/errors';
import {
  AmaOpenApiError,
  getAmaOpenApiClient,
  warnLegacyMemberSyncOnce,
  type AmaOpenApiClient,
  type AmaOpenUser,
} from './ama-open-api.service';

export type AmaRole =
  | 'OWNER'
  | 'MASTER'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'MANAGER'
  | 'MEMBER'
  | 'VIEWER';
export type AmaStatus = 'ACTIVE' | 'INACTIVE';

export interface AmaMember {
  amaUserId: string;
  email: string;
  name: string | null;
  amaRole: AmaRole;
  amaStatus: AmaStatus;
}

export interface AmaClient {
  fetchEntityMembers(entId: string): Promise<AmaMember[]>;
}

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'amb_session';

/**
 * Offline/demo roster. NEVER used for real tenants — it ignores `entId` and
 * returns a fixed list, so it must stay gated behind `DEMO_AUTO_LOGIN`.
 */
class MockAmaClient implements AmaClient {
  async fetchEntityMembers(_entId: string): Promise<AmaMember[]> {
    return MOCK_AMA_MEMBERS.map((m) => ({
      amaUserId: m.amaUserId,
      email: m.email,
      name: m.name,
      amaRole: m.amaRole,
      amaStatus: 'ACTIVE' as const,
    }));
  }
}

/**
 * Preferred: aWorks OAuth Open API (`ama_session` exchange → `GET /open/users`).
 *
 * The embed `amb_session` launch token is exchanged server-side for an OAuth
 * access token (client id/secret from env, never sent to the browser). aWorks
 * binds the token to the launch token's OWN entity, so `/open/users` can only
 * ever return this tenant's roster — `entId` here is only the cache key.
 *
 * `/open/users` returns ACTIVE members only. The sync treats every member that
 * is missing from the list as INACTIVE, which matches the legacy behaviour
 * (non-ACTIVE statuses collapsed to INACTIVE).
 */
class OAuthAmaClient implements AmaClient {
  constructor(private readonly openApi: AmaOpenApiClient) {}

  async fetchEntityMembers(entId: string): Promise<AmaMember[]> {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) {
      throw new SalError('SAL-E0501', 401, 'Missing AMA session token for member sync');
    }
    let users: AmaOpenUser[];
    try {
      users = await this.openApi.listUsers(entId, token);
    } catch (err) {
      if (err instanceof AmaOpenApiError) {
        // Session refused → SAL-E0501 (re-open the app from aWorks);
        // anything else (client config, scope, aWorks down) → SAL-E0502.
        if (err.isSessionProblem) {
          throw new SalError('SAL-E0501', 401, `AMA session rejected for member sync: ${err.message}`);
        }
        throw new SalError('SAL-E0502', 502, `AMA member fetch failed: ${err.message}`);
      }
      throw err;
    }
    return users.map(openUserToAmaMember);
  }
}

/** `/open/users` row → AmaMember (Open API only lists ACTIVE users). */
export function openUserToAmaMember(u: AmaOpenUser): AmaMember {
  return {
    amaUserId: u.userId,
    email: u.email ?? '',
    name: u.name ?? null,
    amaRole: (u.role ?? 'MEMBER') as AmaRole,
    amaStatus: u.status === null || u.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
  };
}

/**
 * DEPRECATED fallback — used only when the OAuth env is not configured.
 *
 * Auth = on-behalf-of: forwards the current admin's `amb_session` launch token
 * as a Bearer token to `GET /entity-settings/members`. aWorks is phasing out
 * accepting app launch tokens as login sessions; once that switch is on this
 * path returns 401 (surfaced as SAL-E0502). Configure AMA_OAUTH_CLIENT_ID /
 * AMA_OAUTH_CLIENT_SECRET to use `OAuthAmaClient` instead.
 *
 * REQUIRES this app be registered in `amb_entity_custom_apps` WITHOUT a per-app
 * JWT secret (token signed with the shared global secret).
 */
class HttpAmaClient implements AmaClient {
  constructor(private readonly baseUrl: string) {}

  async fetchEntityMembers(entId: string): Promise<AmaMember[]> {
    warnLegacyMemberSyncOnce();
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) {
      throw new SalError('SAL-E0501', 401, 'Missing AMA session token for member sync');
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/entity-settings/members?entity_id=${encodeURIComponent(entId)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new SalError('SAL-E0502', 502, `AMA member fetch failed: ${msg}`);
    }
    if (!res.ok) {
      throw new SalError('SAL-E0502', 502, `AMA member fetch failed (HTTP ${res.status})`);
    }

    const json = (await res.json()) as { success?: boolean; data?: unknown };
    const list = Array.isArray(json.data) ? json.data : [];
    return list
      .map(toAmaMember)
      .filter((m): m is AmaMember => m !== null);
  }
}

interface RawMember {
  userId?: string;
  email?: string | null;
  name?: string | null;
  role?: string;
  status?: string;
}

/** AMA `/entity-settings/members` row → AmaMember. Drops rows without a userId. */
function toAmaMember(raw: unknown): AmaMember | null {
  const m = raw as RawMember;
  if (!m || typeof m.userId !== 'string' || m.userId.length === 0) return null;
  return {
    amaUserId: m.userId,
    email: m.email ?? '',
    name: m.name ?? null,
    amaRole: (m.role ?? 'MEMBER') as AmaRole,
    // Any non-active AMA status (INACTIVE/SUSPENDED/DELETED/...) collapses to
    // INACTIVE — the app only distinguishes active vs not.
    amaStatus: m.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
  };
}

/**
 * Resolve the member source for this environment.
 * - `AMA_API_BASE_URL` + `AMA_OAUTH_CLIENT_ID` + `AMA_OAUTH_CLIENT_SECRET` set
 *   → OAuth Open API (OAuthAmaClient) — preferred.
 * - `AMA_API_BASE_URL` only → legacy Bearer forwarding (HttpAmaClient,
 *   deprecated, logs a warning once).
 * - else `DEMO_AUTO_LOGIN=true` → MockAmaClient (offline demo roster).
 * - else → `null`: sync is not configured. Callers MUST treat `null` as
 *   "unavailable" and NOT run a sync — an empty roster would mass-deactivate
 *   real users, and the mock roster must never leak into real tenants.
 */
export function createAmaClient(): AmaClient | null {
  const openApi = getAmaOpenApiClient();
  if (openApi) return new OAuthAmaClient(openApi);
  const baseUrl = process.env.AMA_API_BASE_URL;
  if (baseUrl) return new HttpAmaClient(baseUrl);
  if (process.env.DEMO_AUTO_LOGIN === 'true') return new MockAmaClient();
  return null;
}
