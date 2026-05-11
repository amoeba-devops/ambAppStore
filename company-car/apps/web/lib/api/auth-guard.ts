import type { NextRequest } from 'next/server';
import { getAuthFromRequest, type AuthContext } from '@/lib/auth/get-auth';
import { HttpError } from './response';

type Role = AuthContext['role'];

export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const ctx = await getAuthFromRequest(req);
  if (!ctx) throw new HttpError(401, 'UNAUTHORIZED', 'Unauthorized');
  return ctx;
}

export async function requireRole(req: NextRequest, allowed: Role[]): Promise<AuthContext> {
  const ctx = await requireAuth(req);
  if (!allowed.includes(ctx.role)) {
    throw new HttpError(403, 'FORBIDDEN', `Role ${ctx.role} cannot access this resource`);
  }
  return ctx;
}
