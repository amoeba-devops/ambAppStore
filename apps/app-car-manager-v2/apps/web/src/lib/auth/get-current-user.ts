import 'server-only';
import { headers } from 'next/headers';
import { CarError } from '@car-v2/shared/errors';
import { mapAmaRoleToLocal, type AmaJwtClaims, type LocalRole } from '@car-v2/shared/auth';

export interface AuthContext {
  /** Entity ID — multi-tenancy key. Every Drizzle query must filter by this. */
  entId: string;
  /** AMA-issued entity display name. Optional — older tokens don't carry it. */
  entName: string | null;
  /** AMA user ID (subject of JWT). */
  userId: string;
  /** Raw AMA role from JWT. */
  amaRole: AmaJwtClaims['role'];
  /** Mapped local role per PRD §4 (DRIVER / MANAGER / ADMIN). */
  role: LocalRole;
  /** Email từ JWT — optional, dùng cho ensureCarUser. */
  email: string | null;
  /** Tên hiển thị từ JWT — optional. */
  name: string | null;
}

/**
 * Read the auth context for the current request. Throws CAR-E0101 if middleware
 * didn't set the x-ent-id / x-user-id / x-user-role headers (i.e. unauthenticated).
 * Use in Server Components, Route Handlers, Server Actions.
 */
export async function getCurrentUser(): Promise<AuthContext> {
  const h = await headers();
  const entId = h.get('x-ent-id');
  const userId = h.get('x-user-id');
  const amaRoleRaw = h.get('x-user-role') as AmaJwtClaims['role'] | null;
  const entName = h.get('x-ent-name');

  if (!entId || !userId || !amaRoleRaw) {
    throw new CarError('CAR-E0101', 401, 'Unauthenticated');
  }

  const emailRaw = h.get('x-user-email');
  const nameRaw = h.get('x-user-name');

  return {
    entId,
    entName: entName ?? null,
    userId,
    amaRole: amaRoleRaw,
    role: mapAmaRoleToLocal(amaRoleRaw),
    email: emailRaw ?? null,
    name: nameRaw ? safeDecodeURIComponent(nameRaw) : null,
  };
}

function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Enforce that the current local role is in the allowed list. Throws CAR-E0102.
 * Usage: `requireRole(user.role, ['ADMIN'])` or `requireRole(user.role, ['ADMIN','MANAGER'])`.
 */
export function requireRole(role: LocalRole, allowed: readonly LocalRole[]): void {
  if (!allowed.includes(role)) {
    throw new CarError('CAR-E0102', 403, `Forbidden: requires ${allowed.join(' or ')}`);
  }
}
