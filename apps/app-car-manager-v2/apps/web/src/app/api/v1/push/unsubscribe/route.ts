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
    if (e instanceof CarError) {
      return NextResponse.json(
        { success: false, error: { code: e.code, message: e.message }, timestamp: new Date().toISOString() },
        { status: e.httpStatus },
      );
    }
    /* See subscribe route — never forward raw driver errors to the UI. */
    /* eslint-disable-next-line no-console */
    console.error('[push.unsubscribe] unexpected error', e);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CAR-E0500', message: 'Failed to disable push notifications. Please try again.' },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
