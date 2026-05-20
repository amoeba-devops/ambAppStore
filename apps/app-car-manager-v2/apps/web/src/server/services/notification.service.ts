import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from '@car-v2/db/client';
import { carNotifications } from '@car-v2/db/schema';
import { sendPushToUser } from './push.service';

interface NotifyInput {
  entId: string;
  userId: string;
  /** Upper-snake event identifier: TRIP.ASSIGNED, TRIP.REJECTED, ... */
  event: string;
  title: string;
  body?: string;
  entityId?: string;
  entityRef?: string;
}

/**
 * Drop a notification row into the in-app inbox AND fan out to Web Push.
 *
 * Two delivery channels:
 *   1. `car_notifications` INSERT — the inbox (always succeeds even if push
 *      isn't configured)
 *   2. Web Push fanout to all of the user's subscriptions
 *
 * Both are best-effort — failures are logged but never re-thrown. The
 * mutation that triggered the notification has already happened and must
 * not be unwound because a notification couldn't be delivered.
 *
 * Push body mirrors the inbox body. URL routing for tap-through derives from
 * event family (TRIP.* → trip detail; EXPENSE.* → expense list).
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  try {
    await db.insert(carNotifications).values({
      ntfId: randomUUID(),
      entId: input.entId,
      ntfUserId: input.userId,
      ntfEvent: input.event,
      ntfTitle: input.title,
      ntfBody: input.body ?? null,
      ntfEntityId: input.entityId ?? null,
      ntfEntityRef: input.entityRef ?? null,
    });
  } catch (err) {
    /* eslint-disable-next-line no-console */
    console.error('[notify] failed to queue notification', input.event, err);
  }

  /* Web Push — fire-and-forget. `sendPushToUser` swallows its own errors. */
  void sendPushToUser(input.entId, input.userId, {
    title: input.title,
    body: input.body,
    url: pushUrlFor(input.event, input.entityId),
    tag: input.event,
  });
}

/* Map an event family to the in-app URL the user should land on when they
 * tap the push notification. Falls back to `/today` for unknown families
 * so the user still ends up somewhere useful. */
function pushUrlFor(event: string, entityId: string | undefined): string {
  if (event.startsWith('TRIP.') && entityId) return `/trips/${entityId}`;
  if (event.startsWith('EXPENSE.')) return '/expenses';
  return '/today';
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
  await Promise.all(userIds.map((userId) => notifyUser({ ...input, userId })));
}
