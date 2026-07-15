import 'server-only';
import { cookies } from 'next/headers';
import { MOCK_AMA_MEMBERS } from '@/lib/users-mock';
import { SalError } from '@v2/shared/errors';

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
 * Real per-tenant member fetch against ambManagement (AMA).
 *
 * Auth = on-behalf-of: forwards the current admin's own AMA session token (the
 * `amb_session` cookie minted by AMA `generateAppToken`) as a Bearer token.
 * AMA's `@Auth()` + `OwnEntityGuard` then scope `GET /entity-settings/members`
 * to the caller's OWN entity — a tenant can only ever read its own roster, so
 * `entId` is enforced server-side by AMA, not trusted from here.
 *
 * REQUIRES this app be registered in `amb_entity_custom_apps` WITHOUT a per-app
 * JWT secret, so the token is signed with the shared global JWT_SECRET that
 * AMA's JwtStrategy verifies. With a per-app secret AMA rejects the forwarded
 * token (401) — surfaced as SAL-E0502.
 */
class HttpAmaClient implements AmaClient {
  constructor(private readonly baseUrl: string) {}

  async fetchEntityMembers(entId: string): Promise<AmaMember[]> {
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
 * - `AMA_API_BASE_URL` set → real per-tenant fetch (HttpAmaClient).
 * - else `DEMO_AUTO_LOGIN=true` → MockAmaClient (offline demo roster).
 * - else → `null`: sync is not configured. Callers MUST treat `null` as
 *   "unavailable" and NOT run a sync — an empty roster would mass-deactivate
 *   real users, and the mock roster must never leak into real tenants.
 */
export function createAmaClient(): AmaClient | null {
  const baseUrl = process.env.AMA_API_BASE_URL;
  if (baseUrl) return new HttpAmaClient(baseUrl);
  if (process.env.DEMO_AUTO_LOGIN === 'true') return new MockAmaClient();
  return null;
}
