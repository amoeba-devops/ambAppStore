'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@car-v2/db/client';
import { carUsers, localRoleEnum } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { runAction } from '../_helpers';

/**
 * Local-only member update (Option 1b).
 *
 * car-v2 no longer mutates AMA-side member data. Email / phone / department /
 * jobTitle / AMA role are owned by AMA — admins manage them on the AMA UI.
 *
 * What car-v2 still owns:
 *   - `usr_local_role`: app-level role override (DRIVER | MANAGER | ADMIN)
 *   - `usr_deleted_at`: soft-delete = block this user from car-v2 only
 *     (their AMA login still works for other apps)
 */
const updateLocalMemberSchema = z.object({
  userId: z.string().uuid(),
  localRole: z.enum(localRoleEnum.enumValues).optional(),
  /** true = soft-delete (block from car-v2); false = restore. */
  blocked: z.boolean().optional(),
});

export type UpdateMemberInput = z.infer<typeof updateLocalMemberSchema>;

export async function updateMemberAction(
  input: UpdateMemberInput,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);

    const dto = updateLocalMemberSchema.parse(input);

    /* Guard against admin locking themselves out — UI also disables the
     * button but the server check is the source of truth. */
    if (dto.blocked === true && dto.userId === actor.userId) {
      throw new CarError('CAR-E0102', 403, 'Cannot block your own account.');
    }

    const patch: Partial<typeof carUsers.$inferInsert> = {
      usrUpdatedAt: new Date(),
    };
    if (dto.localRole !== undefined) patch.usrLocalRole = dto.localRole;
    if (dto.blocked === true) patch.usrDeletedAt = new Date();
    if (dto.blocked === false) patch.usrDeletedAt = null;

    const result = await db
      .update(carUsers)
      .set(patch)
      .where(and(eq(carUsers.usrId, dto.userId), eq(carUsers.entId, actor.entId)))
      .returning({ id: carUsers.usrId });

    if (result.length === 0) {
      throw new CarError('CAR-E2002', 404, 'Người dùng không tồn tại trong app này.');
    }

    revalidatePath('/users');
    revalidatePath(`/users/${dto.userId}/edit`);
    return { ok: true as const };
  });
}
