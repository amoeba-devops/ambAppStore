import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from '@car-v2/db/client';
import { carNotifications } from '@car-v2/db/schema';

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
 * Drop a notification row into the queue.
 *
 * P1 stub: only inserts a DB row. Actual delivery (in-app bell, push, email)
 * is wired in P4. UI components read unread count from car_notifications.
 *
 * Never throws — notifying failure must not break the parent mutation.
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
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
  await Promise.all(userIds.map((userId) => notifyUser({ ...input, userId })));
}
