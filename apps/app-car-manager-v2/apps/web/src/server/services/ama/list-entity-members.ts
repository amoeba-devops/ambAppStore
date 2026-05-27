import 'server-only';
import { cookies } from 'next/headers';

const AMA_API = process.env.AMA_API_BASE_URL ?? 'http://localhost:3009/api/v1';
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'amb_session';

/** Safety guard: tối đa 50 trang × 100/trang = 5000 user/tenant. Tránh runaway
 *  loop khi AMA trả pagination malformed (vd total = 99999). */
const MAX_PAGES = 50;
const PAGE_LIMIT = 100;

export interface AmaMember {
  userId: string;
  email: string;
  name: string | null;
  /** SĐT đăng nhập (`amb_users.usr_phone`). Source of truth duy nhất cho phone-login. */
  phone: string | null;
  /** AMA usr_role: SUPER_ADMIN | ADMIN | MANAGER | MEMBER | VIEWER ... */
  amaRole: string;
  levelCode: string;
  status: string;
  unit: string | null;
  jobTitle: string | null;
}

interface AmaMemberRaw {
  userId: string;
  email: string;
  name: string | null;
  phone?: string | null;
  role: string;
  levelCode: string;
  status: string;
  unit?: string | null;
  jobTitle?: string | null;
}

function mapRaw(m: AmaMemberRaw): AmaMember {
  return {
    userId: m.userId,
    email: m.email,
    name: m.name,
    phone: m.phone ?? null,
    amaRole: m.role,
    levelCode: m.levelCode,
    status: m.status,
    unit: m.unit ?? null,
    jobTitle: m.jobTitle ?? null,
  };
}

/**
 * Fetch full member list của entity từ AMA (source of truth).
 *
 * Auth token resolve theo thứ tự ưu tiên (Option B trong REQ-20260526):
 *   1. `amb_ama_access` — user accessToken từ standalone phone-login (full scope)
 *   2. `amb_session` — app-token từ AMA embed flow (`?ama_token=`)
 *      AMA endpoint /entity-settings/members PHẢI accept app-token với
 *      claim role ∈ ADMIN/MANAGER/OWNER/MASTER. AMA team cần expose support.
 *
 * Cả 2 cookie cùng dùng JWT_SECRET. Standalone admin có cả 2 → dùng accessToken.
 * Embed admin chỉ có amb_session → dùng app-token. Driver KHÔNG bao giờ trigger
 * function này (syncTenantUsersAction enforce ADMIN/MANAGER trước khi gọi).
 *
 * Pagination: loop tới khi đủ `pagination.total` hoặc page cuối trả < `PAGE_LIMIT`.
 * Best-effort với AMA chưa hỗ trợ pagination: page 1 sẽ trả full list, loop dừng
 * ngay vì `data.length < PAGE_LIMIT` (trừ khi tenant có đúng 100 user — edge case
 * sẽ thử page 2 và stop khi empty).
 *
 * Returns null nếu:
 *   - cả 2 cookie đều không tồn tại
 *   - AMA endpoint trả non-200 (kể cả 403 nếu app-token role không đủ)
 *   - AMA endpoint không reach được
 *
 * Caller xử lý null → fail gracefully (sync action throw CAR-E0101).
 */
export async function listEntityMembersFromAma(
  entityId: string,
): Promise<AmaMember[] | null> {
  const cookieStore = await cookies();
  /* Ưu tiên user accessToken (broader scope) cho standalone; fallback app-token
   * cho embed mode. Cả 2 đều JWT bearer, AMA-side verify cùng JWT_SECRET. */
  const amaAccess =
    cookieStore.get('amb_ama_access')?.value ??
    cookieStore.get(SESSION_COOKIE)?.value;
  if (!amaAccess) return null;

  const all: AmaMember[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = new URL(`${AMA_API}/entity-settings/members`);
      url.searchParams.set('entity_id', entityId);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', String(PAGE_LIMIT));
      url.searchParams.set('status', 'ALL');
      url.searchParams.set('include_cross_entity', 'true');

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${amaAccess}` },
        cache: 'no-store',
      });

      if (!res.ok) {
        console.warn(
          `[listEntityMembersFromAma] page=${page} status=${res.status} ent=${entityId}`,
        );
        return null;
      }

      const body = await res.json();
      const data = (body?.data ?? []) as AmaMemberRaw[];
      all.push(...data.map(mapRaw));

      const total: number | undefined = body?.pagination?.total;
      if (typeof total === 'number' && all.length >= total) break;
      // AMA chưa hỗ trợ pagination → page 1 trả full list → length < PAGE_LIMIT → stop.
      // Hoặc page cuối có < PAGE_LIMIT row → cũng stop.
      if (data.length < PAGE_LIMIT) break;
    } catch (e) {
      console.error('[listEntityMembersFromAma] fetch failed', e);
      return null;
    }
  }

  if (all.length >= MAX_PAGES * PAGE_LIMIT) {
    console.warn(
      `[listEntityMembersFromAma] hit max page guard (${MAX_PAGES} pages) for ent=${entityId}`,
    );
  }

  return all;
}
