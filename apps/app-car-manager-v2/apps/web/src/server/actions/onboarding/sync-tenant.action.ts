'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { revalidateTag } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTenantSettings, carUsers } from '@car-v2/db/schema';
import { mapAmaRoleToLocal, type AmaJwtClaims, type LocalRole } from '@car-v2/shared/auth';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listEntityMembersFromAma, type AmaMember } from '@/server/services/ama/list-entity-members';
import { logAudit } from '@/server/services/audit-log.service';
import { tenantSyncedAtTag } from '@/server/queries/tenant-onboarding.queries';
import { runAction } from '../_helpers';

export interface SyncTenantResult {
  count: number;
  /** Số members bị filter out (cross-entity ADMIN_LEVEL) — không vào car_users. */
  skipped: number;
  durationMs: number;
  syncedAt: string;
}

/** Map AMA usr_role string → LocalRole. Trả 'DRIVER' default cho role lạ
 *  (safe fallback — admin có thể chỉnh sửa role local sau). */
function mapRoleSafe(amaRole: string): LocalRole {
  const valid: AmaJwtClaims['role'][] = [
    'OWNER', 'MASTER', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'MEMBER', 'VIEWER',
  ];
  if (valid.includes(amaRole as AmaJwtClaims['role'])) {
    return mapAmaRoleToLocal(amaRole as AmaJwtClaims['role']);
  }
  return 'DRIVER';
}

/**
 * Bulk sync AMA members → car_users.
 *
 * Trigger:
 *   1. Lần đầu admin/manager access (qua /onboarding screen)
 *   2. Admin click nút "Đồng bộ" trên /users
 *
 * Behavior:
 *   - Fetch full member list từ AMA (pagination loop trong listEntityMembersFromAma)
 *   - Filter out cross-entity ADMIN_LEVEL (họ không thuộc entity về mặt logic)
 *   - Bulk upsert car_users với ON CONFLICT (ent_id, usr_ama_user_id) DO UPDATE
 *   - Update car_tenant_settings.tns_users_synced_at + count
 *   - Audit log SYSTEM.TENANT_SYNC
 *
 * Idempotent — gọi nhiều lần OK. Race condition giữa 2 admin: ON CONFLICT
 * xử lý, last writer wins.
 *
 * Phải đã có car_tenant_settings row cho entity (lazy-seed nếu không có).
 */
export async function syncTenantUsersAction(): Promise<ActionResult<SyncTenantResult>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    /* ADMIN-only: AMA `OwnEntityGuard` chỉ accept role MASTER/ADMIN cho
     * USER_LEVEL trên `/entity-settings/members`. MANAGER local role (mapped
     * từ AMA MANAGER) gọi sẽ bị AMA reject 403. Restrict v2-side để fail
     * sớm với CAR-E0102 thay vì AMA 401, và để UI ẩn nút sync cho manager. */
    requireRole(actor.role, ['ADMIN']);

    const start = Date.now();
    const members = await listEntityMembersFromAma(actor.entId);
    if (members === null) {
      throw new CarError(
        'CAR-E0101',
        401,
        'Phiên AMA hết hạn hoặc không thể kết nối. Vui lòng đăng nhập lại.',
      );
    }

    /* Filter cross-entity ADMIN_LEVEL — họ không thuộc entity, nếu insert sẽ
     * pollute /users list và confuse admin. Họ vẫn có thể login (ensureCarUser
     * tự tạo row lazy cho riêng họ khi cần). */
    const eligible = members.filter((m) => m.levelCode !== 'ADMIN_LEVEL');
    const skipped = members.length - eligible.length;

    if (eligible.length > 0) {
      await bulkUpsertUsers(actor.entId, eligible);
    }

    /* Update tenant settings — lazy seed nếu row chưa tồn tại. ON CONFLICT
     * fallback theo unique (ent_id). */
    const now = new Date();
    await db
      .insert(carTenantSettings)
      .values({
        tnsId: randomUUID(),
        entId: actor.entId,
        tnsUsersSyncedAt: now,
        tnsUsersSyncedCount: eligible.length,
        tnsUpdatedBy: actor.userId,
      })
      .onConflictDoUpdate({
        target: carTenantSettings.entId,
        set: {
          tnsUsersSyncedAt: now,
          tnsUsersSyncedCount: eligible.length,
          tnsUpdatedAt: now,
          tnsUpdatedBy: actor.userId,
        },
      });

    const durationMs = Date.now() - start;

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'SYSTEM.TENANT_SYNC',
      entity: 'System',
      entityRef: 'AMA members',
      after: { count: eligible.length, skipped, durationMs },
    });

    /* Invalidate middleware cache cho key onboarding check + revalidate /users.
     * KHÔNG revalidatePath('/onboarding') — sẽ trigger re-render page server,
     * page thấy syncedAt non-null → redirect /, user mất success state. UX flow:
     * client giữ result state → user click "Đi tới Bảng điều khiển" → manual nav. */
    revalidateTag(tenantSyncedAtTag(actor.entId));
    revalidatePath('/users');

    return {
      count: eligible.length,
      skipped,
      durationMs,
      syncedAt: now.toISOString(),
    };
  });
}

async function bulkUpsertUsers(entId: string, members: AmaMember[]): Promise<void> {
  /* Batch size 200 đủ an toàn với Postgres parameter limit (mỗi row ~7 fields). */
  const BATCH = 200;
  for (let i = 0; i < members.length; i += BATCH) {
    const slice = members.slice(i, i + BATCH);
    await db
      .insert(carUsers)
      .values(
        slice.map((m) => ({
          usrId: m.userId,
          entId,
          usrAmaUserId: m.userId,
          usrName: m.name,
          usrEmail: m.email,
          usrLocalRole: mapRoleSafe(m.amaRole),
          usrAmaRoleSnapshot: m.amaRole,
        })),
      )
      .onConflictDoUpdate({
        target: [carUsers.entId, carUsers.usrAmaUserId],
        set: {
          usrName: sql`EXCLUDED.usr_name`,
          usrEmail: sql`EXCLUDED.usr_email`,
          usrAmaRoleSnapshot: sql`EXCLUDED.usr_ama_role_snapshot`,
          /* KHÔNG overwrite usrLocalRole nếu admin đã đổi local role —
           * AMA role là source of truth cho role nhưng local role là override.
           * Chỉ update local role nếu chưa từng được set thủ công.
           * Strategy đơn giản: chỉ update khi local role match snapshot cũ.
           * Đơn giản hơn nữa: chỉ update name/email/snapshot, giữ local role.
           * → giữ usrLocalRole, admin tự edit nếu cần. */
          usrUpdatedAt: sql`NOW()`,
        },
      });
  }
}
