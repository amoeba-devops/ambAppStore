import 'server-only';
import { cookies } from 'next/headers';

const AMA_API = process.env.AMA_API_BASE_URL ?? 'http://localhost:3009/api/v1';

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

/**
 * Fetch full member list của entity từ AMA (source of truth).
 * Yêu cầu cookie `amb_ama_access` (set ở /api/auth/login).
 *
 * Returns null nếu:
 *   - cookie không tồn tại / hết hạn
 *   - AMA endpoint trả 403 (MANAGER bị OwnEntityGuard block)
 *   - AMA endpoint không reach được
 *
 * Caller xử lý null → fall back tới car_users local cache.
 */
export async function listEntityMembersFromAma(
  entityId: string,
): Promise<AmaMember[] | null> {
  const cookieStore = await cookies();
  const amaAccess = cookieStore.get('amb_ama_access')?.value;
  if (!amaAccess) return null;

  try {
    const res = await fetch(
      `${AMA_API}/entity-settings/members?entity_id=${entityId}`,
      {
        headers: { Authorization: `Bearer ${amaAccess}` },
        // Tránh Next caching giữa request — list members có thể đổi sau mỗi
        // admin create.
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      console.warn(`[listEntityMembersFromAma] ${res.status} for entity ${entityId}`);
      return null;
    }
    const body = await res.json();
    const data = (body?.data ?? []) as Array<{
      userId: string;
      email: string;
      name: string | null;
      phone?: string | null;
      role: string;
      levelCode: string;
      status: string;
      unit?: string | null;
      jobTitle?: string | null;
    }>;

    return data.map((m) => ({
      userId: m.userId,
      email: m.email,
      name: m.name,
      phone: m.phone ?? null,
      amaRole: m.role,
      levelCode: m.levelCode,
      status: m.status,
      unit: m.unit ?? null,
      jobTitle: m.jobTitle ?? null,
    }));
  } catch (e) {
    console.error('[listEntityMembersFromAma] fetch failed', e);
    return null;
  }
}
