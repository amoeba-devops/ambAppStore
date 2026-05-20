import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carPushSubscriptions } from '@car-v2/db/schema';
import { CarError } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  endpoint: z.string().url(),
});

/* POST /api/v1/push/unsubscribe — drop the subscription for the current user
 * + given endpoint. Idempotent (deleting a non-existent row returns 0 rows
 * affected; we still return 200). */
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
      .where(and(
        eq(carPushSubscriptions.entId, actor.entId),
        eq(carPushSubscriptions.psbUserId, actor.userId),
        eq(carPushSubscriptions.psbEndpoint, parsed.data.endpoint),
      ));
    return NextResponse.json({
      success: true,
      data: { unsubscribed: true },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const err =
      e instanceof CarError ? e : new CarError('CAR-E0500', 500, e instanceof Error ? e.message : 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        error: { code: err.code, message: err.message },
        timestamp: new Date().toISOString(),
      },
      { status: err.httpStatus },
    );
  }
}
