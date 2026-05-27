'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTenantSettings, carUsers } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { mapAmaRoleToLocal } from '@car-v2/shared/auth';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listEntityMembersFromAma } from '@/server/services/ama/list-entity-members';
import { runAction } from '../_helpers';

/**
 * Manual "Sync from AMA" — admin-triggered bulk import (Option 1b parallel
 * path). The primary sync is automatic per-user JIT via `ensureCarUser` on
 * every login — this action is for the edge case where admin needs to
 * pre-populate `car_users` with members who haven't logged in yet (e.g.
 * before assigning a brand-new MEMBER to a driver record).
 *
 * Idempotent — upserts by (ent_id, usr_ama_user_id). Skips ADMIN_LEVEL
 * cross-entity rows (those are AMA platform admins, not org members).
 *
 * Does NOT touch `usr_local_role` or `usr_deleted_at` for existing rows —
 * those are local-only fields admin controls via `/users/[id]/edit`.
 */

export interface SyncFromAmaResult {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
}

export async function syncUsersFromAmaAction(): Promise<ActionResult<SyncFromAmaResult>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);

    const members = await listEntityMembersFromAma(actor.entId);
    if (members === null) {
      /* Either AMA unreachable, or token rejected — distinguishable for the
       * user with a single message. */
      throw new CarError(
        'CAR-E0502',
        503,
        'Không kết nối được AMA. Kiểm tra AMA server hoặc phiên đăng nhập.',
      );
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const now = new Date();

    for (const m of members) {
      /* Cross-entity ADMIN_LEVEL rows are AMA platform admins, not part of
       * this tenant's working roster. */
      if (m.levelCode === 'ADMIN_LEVEL') {
        skipped++;
        continue;
      }

      const existing = await db.query.carUsers.findFirst({
        where: and(eq(carUsers.entId, actor.entId), eq(carUsers.usrAmaUserId, m.userId)),
      });

      if (!existing) {
        /* usr_id = ama_user_id — same pattern as ensureCarUser. New rows
         * land with default usr_local_role from AMA mapping; admin can
         * override later via /users/[id]/edit. */
        await db.insert(carUsers).values({
          usrId: m.userId,
          entId: actor.entId,
          usrAmaUserId: m.userId,
          usrEmail: m.email,
          usrName: m.name,
          usrLocalRole: mapAmaRoleToLocal(m.amaRole as 'OWNER' | 'MASTER' | 'MANAGER' | 'MEMBER'),
          usrAmaRoleSnapshot: m.amaRole,
        });
        inserted++;
        continue;
      }

      /* For existing rows: refresh AMA-side fields ONLY (name, email,
       * ama_role snapshot). Do NOT touch usr_local_role (admin override)
       * or usr_deleted_at (local block flag). */
      const nameChanged = m.name && m.name !== existing.usrName;
      const emailChanged = m.email && m.email !== existing.usrEmail;
      const roleSnapshotChanged = m.amaRole !== existing.usrAmaRoleSnapshot;

      if (nameChanged || emailChanged || roleSnapshotChanged) {
        await db
          .update(carUsers)
          .set({
            usrName: nameChanged ? m.name : existing.usrName,
            usrEmail: emailChanged ? m.email : existing.usrEmail,
            usrAmaRoleSnapshot: m.amaRole,
            usrUpdatedAt: now,
          })
          .where(eq(carUsers.usrId, existing.usrId));
        updated++;
      } else {
        skipped++;
      }
    }

    /* Stamp the manual-sync timestamp so the UI can show "last synced
     * X ago". This re-uses the column that previously gated the onboarding
     * flow — onboarding is gone but the indicator is still useful. */
    await db
      .insert(carTenantSettings)
      .values({
        tnsId: randomUUID(),
        entId: actor.entId,
        tnsUsersSyncedAt: now,
        tnsUsersSyncedCount: members.length,
        tnsUpdatedAt: now,
        tnsUpdatedBy: actor.userId,
      })
      .onConflictDoUpdate({
        target: carTenantSettings.entId,
        set: {
          tnsUsersSyncedAt: now,
          tnsUsersSyncedCount: members.length,
          tnsUpdatedAt: now,
          tnsUpdatedBy: actor.userId,
        },
      });

    revalidatePath('/users');
    return {
      fetched: members.length,
      inserted,
      updated,
      skipped,
    };
  });
}
