'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carNotifications } from '@car-v2/db/schema';
import type { ActionResult } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { runAction } from '../_helpers';

/* Mark a single notification read.
 *
 * Idempotent — calling twice on the same row is a no-op (UPDATE matches no
 * rows the second time because of the `IS NULL` predicate). */
export async function markNotificationReadAction(
  ntfId: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    await db
      .update(carNotifications)
      .set({ ntfReadAt: new Date() })
      .where(
        and(
          eq(carNotifications.ntfId, ntfId),
          eq(carNotifications.entId, user.entId),
          eq(carNotifications.ntfUserId, user.userId),
          isNull(carNotifications.ntfReadAt),
        ),
      );
    revalidatePath('/inbox');
    return { id: ntfId };
  });
}

export async function markAllReadAction(): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    const rows = await db
      .update(carNotifications)
      .set({ ntfReadAt: new Date() })
      .where(
        and(
          eq(carNotifications.entId, user.entId),
          eq(carNotifications.ntfUserId, user.userId),
          isNull(carNotifications.ntfReadAt),
        ),
      )
      .returning({ id: carNotifications.ntfId });
    revalidatePath('/inbox');
    return { count: rows.length };
  });
}
