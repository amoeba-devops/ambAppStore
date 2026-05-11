import type { NextRequest } from 'next/server';
import { auth } from './auth';
import { verifyAccessToken } from './jwt';

export type AuthContext = {
  userId: string;
  role: 'ADMIN' | 'MANAGER' | 'DRIVER';
  language: 'en' | 'ko' | 'vi';
  source: 'web' | 'mobile';
};

/**
 * Unified auth resolver:
 *   - Try `Authorization: Bearer <jwt>` (mobile) first
 *   - Fall back to Auth.js cookie session (web)
 */
export async function getAuthFromRequest(req: NextRequest): Promise<AuthContext | null> {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyAccessToken(token);
    if (payload) {
      return {
        userId: payload.sub,
        role: payload.role,
        language: payload.language,
        source: 'mobile',
      };
    }
  }

  const session = await auth();
  if (session?.user?.id) {
    return {
      userId: session.user.id,
      role: session.user.role,
      language: session.user.language,
      source: 'web',
    };
  }

  return null;
}

export function requireRole(
  ctx: AuthContext | null,
  allowed: AuthContext['role'][],
): asserts ctx is AuthContext {
  if (!ctx) throw new ApiAuthError('Unauthorized', 401);
  if (!allowed.includes(ctx.role)) throw new ApiAuthError('Forbidden', 403);
}

export class ApiAuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
