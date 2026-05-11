import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { refreshTokens } from '@/lib/db/schema';
import { hashRefreshToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';

const LogoutSchema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LogoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Invalid input' } },
      { status: 400 },
    );
  }

  const hash = hashRefreshToken(parsed.data.refreshToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, hash), isNull(refreshTokens.revokedAt)));

  return NextResponse.json({ data: { ok: true } });
}
