import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { getAuthFromRequest } from '@/lib/auth/get-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const ctx = await getAuthFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, ctx.userId)).limit(1);
  if (!user) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      position: user.position,
      role: user.role,
      language: user.language,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  });
}
