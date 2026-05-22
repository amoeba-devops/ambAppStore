'use server';

import { revalidatePath } from 'next/cache';
import { runAction } from '../_helpers';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import type { ActionResult } from '@car-v2/shared/errors';

/**
 * Force re-fetch user list từ AMA (clear Next.js cache).
 * Vì `listEntityMembersFromAma` đã dùng `cache:'no-store'`, không có
 * client-cache. Action này chủ yếu để revalidate path → re-render RSC.
 *
 * Access: ADMIN/MANAGER (DRIVER không thấy nút).
 */
export async function refreshUsersAction(): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    revalidatePath('/users');
    return { ok: true as const };
  });
}
