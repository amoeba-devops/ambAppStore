import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { refreshTokens, users } from '@/lib/db/schema';
import { LoginSchema } from '@repo/api-types';
import { verifyPassword } from '@/lib/auth/password';
import { generateRefreshToken, signAccessToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Invalid input', details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (!user || !user.passwordHash || user.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      { status: 401 },
    );
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      { status: 401 },
    );
  }

  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role,
    language: user.language,
  });
  const refresh = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: refresh.hash,
    expiresAt: refresh.expiresAt,
  });

  return NextResponse.json({
    data: {
      accessToken,
      refreshToken: refresh.token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        position: user.position,
        role: user.role,
        language: user.language,
        status: user.status,
        ssoProvider: user.ssoProvider,
        ssoId: user.ssoId,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    },
  });
}
