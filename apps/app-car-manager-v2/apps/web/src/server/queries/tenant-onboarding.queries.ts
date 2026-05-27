import 'server-only';
import { unstable_cache } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTenantSettings } from '@car-v2/db/schema';

/** Cache tag key cho per-tenant onboarding status — invalidate sau khi sync. */
export function tenantSyncedAtTag(entId: string): string {
  return `tenant:${entId}:synced`;
}

/**
 * Đọc `tns_users_synced_at` cho entity. NULL = chưa onboard.
 *
 * Cache strategy:
 *   - Production: unstable_cache 60s + tag-based invalidation
 *   - Dev (NODE_ENV !== 'production'): bypass cache để E2E test setup
 *     có thể reset DB và thấy state mới ngay (revalidateTag trong dev có
 *     race với streaming RSC).
 *
 * Invalidate sau khi syncTenantUsersAction commit thành công (production).
 */
export async function getTenantSyncedAt(entId: string): Promise<Date | null> {
  if (process.env.NODE_ENV !== 'production') {
    const rows = await db
      .select({ syncedAt: carTenantSettings.tnsUsersSyncedAt })
      .from(carTenantSettings)
      .where(eq(carTenantSettings.entId, entId))
      .limit(1);
    return rows[0]?.syncedAt ?? null;
  }

  return unstable_cache(
    async () => {
      const rows = await db
        .select({ syncedAt: carTenantSettings.tnsUsersSyncedAt })
        .from(carTenantSettings)
        .where(eq(carTenantSettings.entId, entId))
        .limit(1);
      return rows[0]?.syncedAt ?? null;
    },
    [`tenant-synced-at-${entId}`],
    { tags: [tenantSyncedAtTag(entId)], revalidate: 60 },
  )();
}

export interface TenantSyncSummary {
  syncedAt: Date | null;
  syncedCount: number;
}

/** Lấy summary đầy đủ cho UI display (footer /users + onboarding result). */
export async function getTenantSyncSummary(entId: string): Promise<TenantSyncSummary> {
  const rows = await db
    .select({
      syncedAt: carTenantSettings.tnsUsersSyncedAt,
      syncedCount: carTenantSettings.tnsUsersSyncedCount,
    })
    .from(carTenantSettings)
    .where(eq(carTenantSettings.entId, entId))
    .limit(1);
  return {
    syncedAt: rows[0]?.syncedAt ?? null,
    syncedCount: rows[0]?.syncedCount ?? 0,
  };
}
