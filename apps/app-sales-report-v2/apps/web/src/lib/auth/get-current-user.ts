import 'server-only';
import { headers } from 'next/headers';
import { SalError } from '@v2/shared/errors';
import { mapAmaRoleToLocal, type AmaJwtClaims, type LocalRole } from '@v2/shared/auth';

export interface AuthContext {
  entId: string;
  userId: string;
  amaRole: AmaJwtClaims['role'];
  role: LocalRole;
}

export async function getCurrentUser(): Promise<AuthContext> {
  const h = await headers();
  const entId = h.get('x-ent-id');
  const userId = h.get('x-user-id');
  const amaRoleRaw = h.get('x-user-role') as AmaJwtClaims['role'] | null;

  if (!entId || !userId || !amaRoleRaw) {
    throw new SalError('SAL-E0101', 401, 'Unauthenticated');
  }

  return {
    entId,
    userId,
    amaRole: amaRoleRaw,
    role: mapAmaRoleToLocal(amaRoleRaw),
  };
}

export function requireRole(role: LocalRole, allowed: readonly LocalRole[]): void {
  if (!allowed.includes(role)) {
    throw new SalError('SAL-E0102', 403, `Forbidden: requires ${allowed.join(' or ')}`);
  }
}
