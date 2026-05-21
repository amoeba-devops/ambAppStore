import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carPushSubscriptions } from '@car-v2/db/schema';
import { CarError } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  endpoint: z.string().url().max(2000),
});

/**
 * Remove a push subscription. Scoped to the authenticated user's records —
 * cannot delete someone else's even with their endpoint URL.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await getCurrentUser();

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new CarError('CAR-E0001', 400, parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    await db
      .delete(carPushSubscriptions)
      .where(
        and(
          eq(carPushSubscriptions.entId, actor.entId),
          eq(carPushSubscriptions.pshUserId, actor.userId),
          eq(carPushSubscriptions.pshEndpoint, parsed.data.endpoint),
        ),
      );

    return NextResponse.json({ success: true, data: { unsubscribed: true }, timestamp: new Date().toISOString() });
  } catch (e) {
    const err =
      e instanceof CarError ? e : new CarError('CAR-E0500', 500, e instanceof Error ? e.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: { code: err.code, message: err.message }, timestamp: new Date().toISOString() },
      { status: err.httpStatus },
    );
  }
}
