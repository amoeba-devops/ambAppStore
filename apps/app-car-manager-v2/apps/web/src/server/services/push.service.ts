import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carPushSubscriptions } from '@car-v2/db/schema';
import { ensureWebPushConfigured } from '@/lib/web-push-client';

interface PushPayload {
  title: string;
  body?: string;
  /* URL to navigate to when the user taps the notification. Resolved by the
   * SW `notificationclick` handler. Relative URLs are scoped to the SW
   * registration, which is the app root. */
  url?: string;
  /* Tag groups related notifications so the OS coalesces them — e.g. two
   * trip-assignment pushes within a minute show as one. Defaults to event. */
  tag?: string;
}

/* Fan out a payload to every push subscription a user has across devices.
 *
 * Robustness:
 *   - Subscriptions that return 404/410 from the push service are GONE — the
 *     UA has uninstalled / revoked. We delete the row on those codes so we
 *     don't keep retrying.
 *   - Other errors (e.g. 5xx from FCM/APNs) are logged + swallowed; the
 *     caller already has the in-app notification row inserted, so a missed
 *     push is degraded UX, not data loss. */
export async function sendPushToUser(
  entId: string,
  userId: string,
  payload: PushPayload,
): Promise<void> {
  let webpush: ReturnType<typeof ensureWebPushConfigured>;
  try {
    webpush = ensureWebPushConfigured();
  } catch (err) {
    /* VAPID not configured — silent no-op so notifyUser() keeps working in
     * envs that haven't set push up yet (e.g. local dev without VAPID). */
    /* eslint-disable-next-line no-console */
    console.warn('[push] not configured, skipping:', (err as Error).message);
    return;
  }

  const subs = await db
    .select()
    .from(carPushSubscriptions)
    .where(and(
      eq(carPushSubscriptions.entId, entId),
      eq(carPushSubscriptions.psbUserId, userId),
    ));

  if (subs.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body ?? '',
    url: payload.url ?? '/today',
    tag: payload.tag ?? 'fleet-default',
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.psbEndpoint,
            keys: { p256dh: sub.psbP256dh, auth: sub.psbAuth },
          },
          message,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          /* Subscription is dead — drop it. */
          await db
            .delete(carPushSubscriptions)
            .where(eq(carPushSubscriptions.psbId, sub.psbId))
            .catch(() => {});
          return;
        }
        /* eslint-disable-next-line no-console */
        console.error('[push] send failed', sub.psbId, err);
      }
    }),
  );
}
