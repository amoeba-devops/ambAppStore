import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carNotifications, type CarNotification } from '@car-v2/db/schema';

interface ListUserNotificationsOpts {
  entId: string;
  userId: string;
  limit?: number;
}

/* Pull a recent slice of in-app notifications for a single user.
 *
 * Ordering: `ntfCreatedAt DESC` — newest first. Unread state is conveyed via
 * UI styling, not ordering, so a freshly-read notification doesn't suddenly
 * jump in the list. */
export async function listUserNotifications(
  opts: ListUserNotificationsOpts,
): Promise<CarNotification[]> {
  const { entId, userId, limit = 50 } = opts;
  return db
    .select()
    .from(carNotifications)
    .where(and(eq(carNotifications.entId, entId), eq(carNotifications.ntfUserId, userId)))
    .orderBy(desc(carNotifications.ntfCreatedAt))
    .limit(limit);
}

/* Cheap unread badge count. The `idx_car_notifications_user_unread` covering
 * index on `(ntfUserId, ntfReadAt)` makes the `IS NULL` filter index-only. */
export async function countUnreadNotifications(entId: string, userId: string): Promise<number> {
  const rows = await db
    .select({ id: carNotifications.ntfId })
    .from(carNotifications)
    .where(
      and(
        eq(carNotifications.entId, entId),
        eq(carNotifications.ntfUserId, userId),
        isNull(carNotifications.ntfReadAt),
      ),
    );
  return rows.length;
}
