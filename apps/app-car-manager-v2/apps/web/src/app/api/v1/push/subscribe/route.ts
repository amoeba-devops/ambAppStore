import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@car-v2/db/client';
import { carPushSubscriptions } from '@car-v2/db/schema';
import { CarError } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/* POST /api/v1/push/subscribe
 *
 * Registers (or refreshes) a Web Push subscription for the current user.
 *
 * Idempotency: keyed on `psb_endpoint` (globally unique per push service).
 * If the endpoint already exists for this user, we just bump `last_seen_at`;
 * if it exists for a DIFFERENT user (rare — UA reinstall in another login),
 * we delete the old row and insert fresh.
 *
 * The User-Agent header is captured for debugging which device subscribed.
 * It's never used to filter sends (we always fan out to all of a user's
 * subscriptions). */
export async function POST(req: NextRequest) {
  try {
    const actor = await getCurrentUser();
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new CarError('CAR-E0001', 400, parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const { endpoint, keys } = parsed.data;
    const ua = req.headers.get('user-agent')?.slice(0, 255) ?? null;

    /* Upsert. Drizzle's `onConflictDoUpdate` on the endpoint unique index
     * handles the "same endpoint already registered" case. */
    await db
      .insert(carPushSubscriptions)
      .values({
        psbId: randomUUID(),
        entId: actor.entId,
        psbUserId: actor.userId,
        psbEndpoint: endpoint,
        psbP256dh: keys.p256dh,
        psbAuth: keys.auth,
        psbUserAgent: ua,
        psbLastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: carPushSubscriptions.psbEndpoint,
        set: {
          /* Refresh keys (they can rotate) + user binding (in case the
           * device was logged into a different account before). */
          entId: actor.entId,
          psbUserId: actor.userId,
          psbP256dh: keys.p256dh,
          psbAuth: keys.auth,
          psbUserAgent: ua,
          psbLastSeenAt: new Date(),
        },
      });

    return NextResponse.json({
      success: true,
      data: { subscribed: true },
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
