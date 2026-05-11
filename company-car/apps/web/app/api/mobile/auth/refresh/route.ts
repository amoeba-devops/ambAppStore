import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { refreshTokens, users } from '@/lib/db/schema';
import { hashRefreshToken, signAccessToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';

const RefreshSchema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RefreshSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Invalid input' } },
      { status: 400 },
    );
  }

  const hash = hashRefreshToken(parsed.data.refreshToken);

  const [token] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, hash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!token) {
    return NextResponse.json(
      { error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' } },
      { status: 401 },
    );
  }

  const [user] = await db.select().from(users).where(eq(users.id, token.userId)).limit(1);
  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: { code: 'USER_INACTIVE', message: 'User not active' } },
      { status: 401 },
    );
  }

  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role,
    language: user.language,
  });

  return NextResponse.json({ data: { accessToken } });
}
