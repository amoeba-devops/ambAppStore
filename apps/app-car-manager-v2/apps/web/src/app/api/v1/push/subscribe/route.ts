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
    const err =
      e instanceof CarError ? e : new CarError('CAR-E0500', 500, e instanceof Error ? e.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: { code: err.code, message: err.message }, timestamp: new Date().toISOString() },
      { status: err.httpStatus },
    );
  }
}
