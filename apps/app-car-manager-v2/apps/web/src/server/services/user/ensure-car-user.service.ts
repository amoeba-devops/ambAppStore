import 'server-only';
import { cache } from 'react';
import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carUsers, carAuditLogs } from '@car-v2/db/schema';
import { mapAmaRoleToLocal, type AmaJwtClaims } from '@car-v2/shared/auth';

export interface EnsureCarUserInput {
  entId: string;
  amaUserId: string;       // JWT `sub`
  amaRole: AmaJwtClaims['role'];  // OWNER/MASTER/MANAGER/MEMBER
  email?: string | null;
  name?: string | null;
}

/**
 * Step 4 (D-006) — Upsert car_users row khi user verify JWT lần đầu hoặc role đổi.
 *
 * Flow:
 *   - Lookup by (ent_id, usr_ama_user_id)
 *   - Not exists → INSERT + audit USER/PROVISIONED
 *   - Exists + role changed → UPDATE usr_local_role + audit USER/ROLE_SYNC
 *   - Exists + role same → chỉ update usr_last_login_at (no audit để giảm noise)
 *
 * Idempotent — gọi mỗi RSC render là OK (React `cache()` dedupe per request).
 *
 * Audit fields theo schema thực tế (D-019):
 *   audAction (varchar), audEntity (varchar) — KHÔNG phải aud_event enum
 *   audUserId nullable — okay để self-reference khi provision
 */
async function ensureCarUserImpl(input: EnsureCarUserInput): Promise<void> {
  const localRole = mapAmaRoleToLocal(input.amaRole);
  const now = new Date();

  const existing = await db.query.carUsers.findFirst({
    where: and(
      eq(carUsers.entId, input.entId),
      eq(carUsers.usrAmaUserId, input.amaUserId),
    ),
  });

  if (!existing) {
    /* CRITICAL: usr_id = ama_user_id để JWT `sub` có thể dùng trực tiếp làm FK
     * tới car_users.usr_id ở mọi nơi (trip.trp_creator_id, expense.exp_submitted_by,
     * ntf.ntf_user_id, ...). Trước đó sinh random UUID gây FK violation khi
     * insert trip/expense với trpCreatorId = actor.userId (JWT sub).
     *
     * Seed data đã follow pattern này (xem db-seed.mjs:85 — U_ADMIN dùng cho
     * cả usr_id và usr_ama_user_id), nên đồng bộ với seed. */
    const usrId = input.amaUserId;
    await db.insert(carUsers).values({
      usrId,
      entId: input.entId,
      usrAmaUserId: input.amaUserId,
      usrEmail: input.email ?? null,
      usrName: input.name ?? null,
      usrLocalRole: localRole,
      usrAmaRoleSnapshot: input.amaRole,
      usrLastLoginAt: now,
    });

    await db.insert(carAuditLogs).values({
      audId: crypto.randomUUID(),
      entId: input.entId,
      audUserId: usrId,
      audAction: 'PROVISIONED',
      audEntity: 'USER',
      audEntityId: usrId,
      audAfter: {
        ama_role: input.amaRole,
        local_role: localRole,
        email: input.email,
        name: input.name,
      },
      audCreatedAt: now,
    });
    return;
  }

  /* Option 1b — Admin can soft-delete a user from car-v2 (`usr_deleted_at`).
   * Block them from accessing any RSC by short-circuiting here. They can
   * still sign in to AMA + other apps; only car-v2 is locked out. To restore,
   * an admin clears the flag via `/users/[id]/edit`. */
  if (existing.usrDeletedAt !== null) {
    redirect('/session-expired?reason=blocked');
  }

  /* Sanity check cho legacy row: nếu usr_id != usr_ama_user_id, đây là row di
   * sản từ version cũ (random UUID cho usr_id). KHÔNG self-heal ở đây — heal
   * trên hot path layout RSC sẽ chạy mỗi page load nếu lỡ fail.
   *
   * Chạy migration: `node scripts/db-heal-usr-id.mjs dev` (hoặc staging).
   * Log warning để dev biết cần migrate, nhưng không throw — vì các page chỉ
   * đọc (today, dashboard) vẫn work bình thường, chỉ INSERT có FK đến
   * car_users.usr_id (trip create, expense create) mới fail. */
  if (existing.usrId !== input.amaUserId) {
    /* eslint-disable-next-line no-console */
    console.warn(
      `[ensureCarUser] Legacy row detected (usr_id=${existing.usrId} != ama=${input.amaUserId}). ` +
      `Run: node scripts/db-heal-usr-id.mjs <dev|staging>`,
    );
  }

  /* Backfill name/email từ JWT — AMA là source of truth, mỗi lần login đồng bộ
   * lại để row v2 không lỗi thời. Chỉ overwrite nếu input có giá trị non-null
   * (tránh trường hợp JWT thiếu name làm rỗng row đã có dữ liệu). */
  const nameChanged = input.name && input.name !== existing.usrName;
  const emailChanged = input.email && input.email !== existing.usrEmail;

  if (existing.usrLocalRole !== localRole) {
    // UPDATE role + name/email + audit ROLE_SYNC
    await db.update(carUsers)
      .set({
        usrLocalRole: localRole,
        usrAmaRoleSnapshot: input.amaRole,
        usrName: nameChanged ? input.name : existing.usrName,
        usrEmail: emailChanged ? input.email : existing.usrEmail,
        usrLastLoginAt: now,
        usrUpdatedAt: now,
      })
      .where(eq(carUsers.usrId, existing.usrId));

    await db.insert(carAuditLogs).values({
      audId: crypto.randomUUID(),
      entId: input.entId,
      audUserId: existing.usrId,
      audAction: 'ROLE_SYNC',
      audEntity: 'USER',
      audEntityId: existing.usrId,
      audBefore: { local_role: existing.usrLocalRole },
      audAfter: { local_role: localRole, ama_role: input.amaRole },
      audCreatedAt: now,
    });
    return;
  }

  /* Role unchanged — vẫn backfill name/email nếu JWT mang giá trị mới. Touch
   * last_login để theo dõi activity. Bỏ qua UPDATE nếu không có gì đổi để giảm
   * write load (hot path mỗi page load). */
  if (nameChanged || emailChanged) {
    await db.update(carUsers)
      .set({
        usrName: nameChanged ? input.name : existing.usrName,
        usrEmail: emailChanged ? input.email : existing.usrEmail,
        usrLastLoginAt: now,
        usrUpdatedAt: now,
      })
      .where(eq(carUsers.usrId, existing.usrId));
  } else {
    await db.update(carUsers)
      .set({ usrLastLoginAt: now })
      .where(eq(carUsers.usrId, existing.usrId));
  }
}

/**
 * React cache wrapper — đảm bảo ensure chỉ chạy 1 lần / request RSC tree.
 * Layout + nested page đều gọi getCurrentUser → ensureCarUser, không double-insert.
 */
export const ensureCarUser = cache(ensureCarUserImpl);
