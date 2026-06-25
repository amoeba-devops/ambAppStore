import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carPushSubscriptions } from '@car-v2/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { sendPushToSubscriptions, type PushSubscriptionRecord } from '@/server/services/push.service';

export const dynamic = 'force-dynamic';

/**
 * TEST ONLY — Send a push notification to the current user's subscriptions.
 *
 * Usage:
 *   POST /api/v1/push/test
 *   Body: { "title": "Test", "body": "Hello world", "url": "/today" }
 *
 * Only works in non-production. Remove or protect in prod.
 */
export async function POST(req: NextRequest) {
  /* Block in production */
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PUSH_TEST) {
    return NextResponse.json(
      { success: false, error: 'Push test disabled in production' },
      { status: 403 },
    );
  }

  try {
    const actor = await getCurrentUser();
    const body = await req.json();

    const title = body.title ?? 'Test Notification';
    const bodyText = body.body ?? `Test push for ${actor.userId.slice(0, 8)}`;
    const url = body.url ?? '/today';

    /* Get user's push subscriptions */
    const subs = await db.query.carPushSubscriptions.findMany({
      where: and(
        eq(carPushSubscriptions.entId, actor.entId),
        eq(carPushSubscriptions.pshUserId, actor.userId),
      ),
      columns: {
        pshId: true,
        pshEndpoint: true,
        pshP256dh: true,
        pshAuth: true,
      },
    });

    if (subs.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No push subscriptions found. Enable notifications first.',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    await sendPushToSubscriptions(subs as PushSubscriptionRecord[], {
      title,
      body: bodyText,
      url,
      ref: 'test-' + Date.now(),
    });

    return NextResponse.json({
      success: true,
      data: {
        sent: subs.length,
        title,
        body: bodyText,
        url,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[push.test] error', e);
    return NextResponse.json(
      { success: false, error: String(e), timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
