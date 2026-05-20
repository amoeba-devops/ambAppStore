import 'server-only';
import { inArray } from 'drizzle-orm';
import webpush from 'web-push';
import { db } from '@car-v2/db/client';
import { carPushSubscriptions } from '@car-v2/db/schema';
import { getPushConfig } from '@/lib/env';

/**
 * Web Push (RFC 8030) send wrapper using `web-push` lib.
 *
 * Returns no-op if VAPID env not configured. Removes subscriptions that
 * the push provider rejects with 404/410 (Gone) — those are the spec'd
 * codes for "user uninstalled / disabled the app" and we must drop them
 * to stop spamming dead endpoints.
 */

export interface PushSubscriptionRecord {
  pshId: string;
  pshEndpoint: string;
  pshP256dh: string;
  pshAuth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Absolute URL the service worker opens on click. */
  url: string;
  /** Trip ref — set as `tag` so re-pushes coalesce in the notification tray. */
  ref?: string;
}

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const cfg = getPushConfig();
  if (!cfg) return false;
  webpush.setVapidDetails(cfg.contact, cfg.vapidPublic, cfg.vapidPrivate);
  vapidConfigured = true;
  return true;
}

/**
 * Send push to a fixed list of subscriptions. Loaded by caller because the
 * notification service already had to query the user — passing records in
 * saves a round-trip.
 *
 * Best-effort: never throws. Each subscription is sent independently so one
 * 410 doesn't block the others. Dead subscriptions get deleted on the spot.
 */
export async function sendPushToSubscriptions(
  subs: PushSubscriptionRecord[],
  payload: PushPayload,
): Promise<void> {
  if (subs.length === 0) return;
  if (!ensureVapidConfigured()) return;

  const json = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.ref ?? 'ccms',
  });

  const deadIds: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.pshEndpoint, keys: { p256dh: sub.pshP256dh, auth: sub.pshAuth } },
          json,
        );
      } catch (e) {
        const statusCode = (e as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          /* Subscription expired or user uninstalled. Cleanup. */
          deadIds.push(sub.pshId);
        } else {
          /* eslint-disable-next-line no-console */
          console.error('[push] send failed', sub.pshEndpoint.slice(0, 60), statusCode, e);
        }
      }
    }),
  );

  if (deadIds.length > 0) {
    try {
      await db.delete(carPushSubscriptions).where(inArray(carPushSubscriptions.pshId, deadIds));
    } catch (err) {
      /* eslint-disable-next-line no-console */
      console.error('[push] failed to prune dead subscriptions', err);
    }
  }
}
