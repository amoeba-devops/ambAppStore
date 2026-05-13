import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { SalError } from '@v2/shared/errors';
import { mapAmaRoleToLocal, type AmaJwtClaims, type LocalRole } from '@v2/shared/auth';
import { ensureUserSynced } from '@/server/services/user-sync.service';

export interface AuthContext {
  entId: string;
  userId: string;
  amaRole: AmaJwtClaims['role'];
  role: LocalRole;
  email: string | null;
  name: string | null;
  username: string;
}

export const getCurrentUser = cache(async function getCurrentUser(): Promise<AuthContext> {
  const h = await headers();
  const entId = h.get('x-ent-id');
  const userId = h.get('x-user-id');
  const amaRoleRaw = h.get('x-user-role') as AmaJwtClaims['role'] | null;

  if (!entId || !userId || !amaRoleRaw) {
    throw new SalError('SAL-E0101', 401, 'Unauthenticated');
  }

  const email = h.get('x-user-email');
  const rawName = h.get('x-user-name');
  const name = rawName ? safeDecodeURIComponent(rawName) : null;

  // Upsert into sal_users + read persisted role/status (deduped per RSC render via React cache)
  const sync = await ensureUserSynced({
    entId,
    amaUserId: userId,
    amaRole: amaRoleRaw,
    email,
    name,
  });

  if (sync.status === 'INACTIVE') {
    throw new SalError('SAL-E0103', 403, 'Your account has been deactivated. Contact the administrator.');
  }

  return {
    entId,
    userId,
    amaRole: amaRoleRaw,
    role: sync.localRole,
    email,
    name,
    username: deriveUsername(email, name, userId),
  };
});

function safeDecodeURIComponent(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

function deriveUsername(email: string | null, name: string | null, userId: string): string {
  if (email) {
    const local = email.split('@')[0];
    if (local) return local.toLowerCase();
  }
  if (name) {
    return name.toLowerCase().replace(/\s+/g, '.');
  }
  return userId.slice(0, 8);
}

export function requireRole(role: LocalRole, allowed: readonly LocalRole[]): void {
  if (!allowed.includes(role)) {
    throw new SalError('SAL-E0102', 403, `Forbidden: requires ${allowed.join(' or ')}`);
  }
}
