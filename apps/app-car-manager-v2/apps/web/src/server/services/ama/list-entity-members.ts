import 'server-only';
import { cookies } from 'next/headers';
import {
  AmaOpenApiError,
  getAmaOpenApiClient,
  warnLegacyMemberSyncOnce,
  type AmaOpenUser,
} from './ama-open-api';

/**
 * List all members of a tenant from aWorks (AMA).
 *
 * Source (in order):
 *   1. OAuth Open API — when AMA_OAUTH_CLIENT_ID / AMA_OAUTH_CLIENT_SECRET are
 *      set: exchange the caller's AMA token (`amb_ama_access` standalone, or
 *      the embed `amb_session` launch token) via grant `ama_session`, then
 *      `GET /open/users` (scope `users:read`). aWorks binds the OAuth token to
 *      the caller's OWN entity. Returns ACTIVE members only.
 *   2. Legacy `GET /entity-settings/members` with the AMA token as Bearer.
 *      - Standalone `amb_ama_access` is a real aWorks login session → still
 *        supported; also used as fallback if the OAuth call fails.
 *      - Embed `amb_session` (app launch token) → DEPRECATED: aWorks is
 *        phasing out launch tokens as login sessions (→ 401). Used only when
 *        OAuth env is not configured; logs a warning once.
 *
 * Used ONLY by the manual "Sync from AMA" admin button (Option 1b — JIT
 * sync remains the primary path via `ensureCarUser` on each login). NEVER
 * call from middleware or auto routes; this is an opt-in admin operation.
 *
 * Returns `null` when:
 *   - AMA endpoint unreachable (dev mode without AMA running)
 *   - 401/403 (token issue) — caller surfaces friendly error
 */

const AMA_API = process.env.AMA_API_BASE_URL ?? 'http://localhost:3009/api/v1';
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'amb_session';

export interface AmaMember {
  userId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  /** AMA role: OWNER / MASTER / MANAGER / MEMBER / VIEWER */
  amaRole: string;
  /** USER_LEVEL / ADMIN_LEVEL — admin-level rows are cross-entity sentinels. */
  levelCode: string;
  status: string;
  unit: string | null;
  jobTitle: string | null;
}

interface AmaMemberRaw {
  userId: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  role?: string;
  amaRole?: string;
  levelCode?: string;
  level_code?: string;
  status?: string;
  unit?: string | null;
  jobTitle?: string | null;
  job_title?: string | null;
}

interface ListResponse {
  data: AmaMemberRaw[];
  pagination?: { total: number; page: number };
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export async function listEntityMembersFromAma(entId: string): Promise<AmaMember[] | null> {
  const cookieStore = await cookies();
  /* Standalone mode keeps `amb_ama_access` (raw AMA session token); embed
   * mode only has `amb_session` (app launch token). */
  const sessionToken = cookieStore.get('amb_ama_access')?.value;
  const launchToken = cookieStore.get(SESSION_COOKIE)?.value;
  const token = sessionToken ?? launchToken;
  if (!token) return null;

  const openApi = getAmaOpenApiClient();
  if (openApi) {
    try {
      const users = await openApi.listUsers(entId, token);
      return users.map(openUserToAmaMember);
    } catch (err) {
      const detail =
        err instanceof AmaOpenApiError ? `${err.kind}: ${err.message}` : String(err);
      console.warn(`[listEntityMembersFromAma] OAuth Open API failed — ${detail}`);
      /* A real AMA session can still use the legacy endpoint; a launch token
       * cannot be relied on there, so surface the failure (CAR-E0502). */
      if (!sessionToken) return null;
    }
  } else if (!sessionToken) {
    warnLegacyMemberSyncOnce();
  }

  return listViaEntitySettings(entId, token);
}

/** `/open/users` row → AmaMember. Open API has no phone/jobTitle → null. */
export function openUserToAmaMember(u: AmaOpenUser): AmaMember {
  return {
    userId: u.userId,
    email: u.email,
    name: u.name,
    phone: null,
    amaRole: u.role ?? 'MEMBER',
    levelCode: u.levelCode ?? 'USER_LEVEL',
    status: u.status ?? 'ACTIVE',
    unit: u.unit,
    jobTitle: null,
  };
}

/** Legacy: `GET /entity-settings/members` with the AMA token as Bearer. */
async function listViaEntitySettings(entId: string, token: string): Promise<AmaMember[] | null> {
  const all: AmaMember[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `${AMA_API}/entity-settings/members` +
      `?entity_id=${encodeURIComponent(entId)}` +
      `&page=${page}&limit=${PAGE_SIZE}&status=ALL&include_cross_entity=true`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
    } catch {
      /* Network error (AMA unreachable in dev) — return null so caller can
       * surface "AMA không phản hồi" rather than crashing. */
      return null;
    }
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) return null;

    const body = (await res.json().catch(() => null)) as ListResponse | null;
    if (!body?.data) return null;

    for (const m of body.data) {
      all.push({
        userId: m.userId,
        email: m.email ?? null,
        name: m.name ?? null,
        phone: m.phone ?? null,
        amaRole: m.amaRole ?? m.role ?? 'MEMBER',
        levelCode: m.levelCode ?? m.level_code ?? 'USER_LEVEL',
        status: m.status ?? 'ACTIVE',
        unit: m.unit ?? null,
        jobTitle: m.jobTitle ?? m.job_title ?? null,
      });
    }
    if (body.data.length < PAGE_SIZE) break;
  }
  return all;
}
