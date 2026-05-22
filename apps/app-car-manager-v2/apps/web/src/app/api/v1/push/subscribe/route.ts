import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carPushSubscriptions } from '@car-v2/db/schema';
import { CarError } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPushConfig } from '@/lib/env';
import { ensureCarUser } from '@/server/services/users.service';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

/**
 * Upsert a Web Push subscription for the current user.
 *
 * Same browser hitting subscribe twice returns the same endpoint URL — we
 * dedupe on (psh_endpoint) which is globally unique. ON CONFLICT updates
 * the keys + user binding (in case the same device switched accounts).
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await getCurrentUser();

    /* Hard-fail if VAPID not configured — don't pretend to subscribe when
     * the server can't actually push anything. UI can read this 503 and
     * disable the toggle. */
    if (!getPushConfig()) {
      throw new CarError('CAR-E0503', 503, 'Web Push not configured on this server');
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new CarError('CAR-E0001', 400, parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const data = parsed.data;

    const h = await headers();
    const userAgent = h.get('user-agent')?.slice(0, 500) ?? null;

    /* The FK `car_push_subscriptions.psh_user_id → car_users.usr_id` raises
     * Postgres `23503 foreign_key_violation` if the user hasn't been seeded
     * locally — the default state for every fresh AMA SSO user (the seed
     * script only inserts the dev fixture trio). Materialise the row first
     * so the insert below always finds its parent. */
    await ensureCarUser({
      entId: actor.entId,
      userId: actor.userId,
      amaRole: actor.amaRole,
    });

    await db
      .insert(carPushSubscriptions)
      .values({
        pshId: randomUUID(),
        entId: actor.entId,
        pshUserId: actor.userId,
        pshEndpoint: data.endpoint,
        pshP256dh: data.keys.p256dh,
        pshAuth: data.keys.auth,
        pshUserAgent: userAgent,
      })
      .onConflictDoUpdate({
        target: carPushSubscriptions.pshEndpoint,
        set: {
          entId: actor.entId,
          pshUserId: actor.userId,
          pshP256dh: data.keys.p256dh,
          pshAuth: data.keys.auth,
          pshUserAgent: userAgent,
          pshLastUsedAt: sql`null`,
        },
      });

    return NextResponse.json({ success: true, data: { subscribed: true }, timestamp: new Date().toISOString() });
  } catch (e) {
    if (e instanceof CarError) {
      return NextResponse.json(
        { success: false, error: { code: e.code, message: e.message }, timestamp: new Date().toISOString() },
        { status: e.httpStatus },
      );
    }
    /* Unknown error path — never leak raw Postgres / driver messages to the
     * browser. Original bug surfaced `insert or update on table ... violates
     * foreign key constraint ...` inside the UI banner because the catch
     * block forwarded `e.message` verbatim. Log detail server-side, return
     * a generic, user-safe phrase. */
    /* eslint-disable-next-line no-console */
    console.error('[push.subscribe] unexpected error', e);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CAR-E0500', message: 'Failed to enable push notifications. Please try again.' },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
