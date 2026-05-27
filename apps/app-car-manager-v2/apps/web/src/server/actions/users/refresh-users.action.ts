'use server';

import { syncTenantUsersAction, type SyncTenantResult } from '@/server/actions/onboarding/sync-tenant.action';
import type { ActionResult } from '@car-v2/shared/errors';

/**
 * Refresh button trên /users — alias cho syncTenantUsersAction.
 *
 * Trước REQ-20260526: action chỉ revalidatePath('/users'), không sync gì →
 * toast "Đã đồng bộ" misleading. Giờ thực sự call bulk upsert AMA → car_users.
 *
 * Idempotent — admin có thể click nhiều lần. Race condition giữa 2 admin:
 * ON CONFLICT DO UPDATE handle.
 */
export async function refreshUsersAction(): Promise<ActionResult<SyncTenantResult>> {
  return syncTenantUsersAction();
}
