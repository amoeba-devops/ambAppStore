'use server';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import {
  carDrivers,
  carUserFleetAccess,
  carUsers,
  carVehicles,
  type CarDriver,
} from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { createDriverSchema, updateDriverSchema } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';
import {
  checkDriverDeleteWarnings,
  type DriverDeleteWarning,
} from '@/server/services/driver-delete-check.service';
import { runAction } from '../_helpers';

export async function createDriverAction(input: unknown): Promise<ActionResult<CarDriver>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    const data = createDriverSchema.parse(input);

    // Verify the user exists in this tenant.
    const user = await db.query.carUsers.findFirst({
      where: and(eq(carUsers.usrId, data.user_id), eq(carUsers.entId, actor.entId)),
    });
    if (!user) throw new CarError('CAR-E0404', 404, 'User not found in this tenant');

    /* One live driver row per user. `listDriverCandidates` already hides users
     * who have one, so this only catches a stale form / direct action POST —
     * but a second live row would put the user in the roster twice and break
     * the "at most one live driver record per user" invariant. */
    const live = await db.query.carDrivers.findFirst({
      where: and(
        eq(carDrivers.entId, actor.entId),
        eq(carDrivers.drvUserId, data.user_id),
        isNull(carDrivers.drvDeletedAt),
      ),
    });
    if (live) {
      throw new CarError('CAR-E0409', 409, 'This user is already a driver');
    }

    const fields = {
      drvLicenseNumber: data.license_number,
      drvLicenseClass: data.license_class,
      drvLicenseExpiry: data.license_expiry,
      drvPhone: data.phone?.trim() || null,
      drvEmergencyContact: data.emergency_contact ?? null,
      drvFixedSalary: data.fixed_salary != null ? String(data.fixed_salary) : null,
      /* Initial status (QA P2) — omitted falls back to the schema default,
       * which the revive path has to spell out (the old row keeps whatever
       * status it was retired with, e.g. ON_LEAVE). */
      drvStatus: data.status ?? ('AVAILABLE' as const),
      drvNotes: data.notes ?? null,
      /* Set updated_at on insert so the roster "Cập nhật" column isn't blank
       * right after create (Sheet-2 DR8). */
      drvUpdatedAt: new Date(),
    };

    /* Re-linking someone who was a driver before REVIVES their retired row
     * instead of minting a new drv_id.
     *
     * car_trips.trp_driver_id and car_expenses.exp_driver_id point at drv_id,
     * and deleteDriverAction leaves those references on the row it soft-
     * deletes. A fresh id therefore strands the driver's entire history: they
     * open /today and see an empty screen, while /truck/trips keeps printing
     * their name (getDriverNamesByIds ignores soft-delete) so nobody notices
     * anything is wrong. Seen on staging 2026-07-27 — TR-3024 and TR-3025 were
     * orphaned exactly this way by a delete-then-recreate.
     *
     * The MOST RECENTLY retired row wins: that is the one whose history the
     * last delete orphaned, so reviving it is the honest undo. */
    const retired = await db
      .select({ id: carDrivers.drvId, deletedAt: carDrivers.drvDeletedAt })
      .from(carDrivers)
      .where(
        and(
          eq(carDrivers.entId, actor.entId),
          eq(carDrivers.drvUserId, data.user_id),
          isNotNull(carDrivers.drvDeletedAt),
        ),
      )
      .orderBy(desc(carDrivers.drvDeletedAt))
      .limit(1);

    const revive = retired[0];
    const [created] = revive
      ? await db
          .update(carDrivers)
          .set({ ...fields, drvDeletedAt: null })
          .where(and(eq(carDrivers.drvId, revive.id), eq(carDrivers.entId, actor.entId)))
          .returning()
      : await db
          .insert(carDrivers)
          .values({
            drvId: randomUUID(),
            entId: actor.entId,
            drvUserId: data.user_id,
            ...fields,
          })
          .returning();
    if (!created) throw new CarError('CAR-E0500', 500, revive ? 'Revive returned no row' : 'Insert returned no row');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'DRIVER.CREATE',
      entity: 'Driver',
      entityId: created.drvId,
      entityRef: user.usrName ?? data.license_number,
      after: {
        license: created.drvLicenseNumber,
        user_id: created.drvUserId,
        /* Says whether this reattached an existing history or started fresh —
         * the difference matters when reconciling a driver's trip list. */
        ...(revive ? { revivedDriverId: revive.id, retiredAt: revive.deletedAt } : {}),
      },
    });

    /* Created from a department surface (e.g. /truck/drivers/new) → also grant
     * that fleet membership so the driver appears in the dept roster, which is
     * filtered by car_user_fleet_access. Idempotent: skip if already present.
     * ADMIN + MANAGER both allowed (gated above). */
    if (data.vehicle_type) {
      /* A DRIVER belongs to exactly ONE department (same rule enforced by
       * grantFleetAccessAction). Creating them as a driver of `vehicle_type`
       * MEANS they now drive for that department, so retire memberships of the
       * other one instead of throwing — a throw would dead-end the admin, who
       * would have to revoke via /settings/fleet-access (hidden from the menu)
       * before retrying.
       *
       * Without this, a driver soft-deleted in one dept and re-created in the
       * other ended up holding BOTH rows (the stale one survives the delete):
       * they showed in both rosters yet were assignable in neither. Managers /
       * admins are untouched — multi-department access is legitimate for them
       * (that IS the request/approve flow). */
      if (user.usrLocalRole === 'DRIVER') {
        const retired = await db
          .update(carUserFleetAccess)
          .set({ ufaDeletedAt: new Date() })
          .where(
            and(
              eq(carUserFleetAccess.entId, actor.entId),
              eq(carUserFleetAccess.usrId, data.user_id),
              ne(carUserFleetAccess.ufaVehicleType, data.vehicle_type),
              isNull(carUserFleetAccess.ufaDeletedAt),
            ),
          )
          .returning({ type: carUserFleetAccess.ufaVehicleType });

        for (const r of retired) {
          await logAudit({
            entId: actor.entId,
            userId: actor.userId,
            action: 'FLEET.ACCESS_REVOKED',
            entity: 'User',
            entityId: data.user_id,
            entityRef: user.usrName ?? user.usrEmail ?? data.user_id,
            before: { vehicleType: r.type },
            after: { vehicleType: data.vehicle_type, via: 'DRIVER.CREATE' },
          });
          revalidatePath(r.type === 'TRUCK' ? '/truck/drivers' : '/drivers');
        }
      }

      const existing = await db.query.carUserFleetAccess.findFirst({
        where: and(
          eq(carUserFleetAccess.entId, actor.entId),
          eq(carUserFleetAccess.usrId, data.user_id),
          eq(carUserFleetAccess.ufaVehicleType, data.vehicle_type),
          isNull(carUserFleetAccess.ufaDeletedAt),
        ),
      });
      if (!existing) {
        await db.insert(carUserFleetAccess).values({
          ufaId: randomUUID(),
          entId: actor.entId,
          usrId: data.user_id,
          ufaVehicleType: data.vehicle_type,
          ufaGrantedBy: actor.userId,
        });
        await logAudit({
          entId: actor.entId,
          userId: actor.userId,
          action: 'FLEET.ACCESS_GRANTED',
          entity: 'User',
          entityId: data.user_id,
          entityRef: user.usrName ?? user.usrEmail ?? data.user_id,
          after: { vehicleType: data.vehicle_type, via: 'DRIVER.CREATE' },
        });
      }
      revalidatePath(data.vehicle_type === 'TRUCK' ? '/truck/drivers' : '/drivers');
      if (data.vehicle_type === 'TRUCK') revalidatePath('/truck/pnl');
    }

    revalidatePath('/drivers');
    return created;
  });
}

export async function updateDriverAction(id: string, input: unknown): Promise<ActionResult<CarDriver>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    const data = updateDriverSchema.parse(input);

    const existing = await db.query.carDrivers.findFirst({
      where: and(eq(carDrivers.drvId, id), eq(carDrivers.entId, actor.entId)),
    });
    if (!existing) throw new CarError('CAR-E0404', 404, 'Driver not found');

    const patch: Partial<typeof carDrivers.$inferInsert> = { drvUpdatedAt: new Date() };
    if (data.license_number !== undefined) patch.drvLicenseNumber = data.license_number;
    if (data.license_class  !== undefined) patch.drvLicenseClass = data.license_class;
    if (data.license_expiry !== undefined) patch.drvLicenseExpiry = data.license_expiry;
    if (data.emergency_contact !== undefined) patch.drvEmergencyContact = data.emergency_contact;
    if (data.notes          !== undefined) patch.drvNotes = data.notes;
    if (data.status         !== undefined) patch.drvStatus = data.status;
    if (data.phone          !== undefined) patch.drvPhone = data.phone.trim() || null;
    if (data.fixed_salary   !== undefined) patch.drvFixedSalary = data.fixed_salary != null ? String(data.fixed_salary) : null;

    const [updated] = await db
      .update(carDrivers)
      .set(patch)
      .where(and(eq(carDrivers.drvId, id), eq(carDrivers.entId, actor.entId)))
      .returning();
    if (!updated) throw new CarError('CAR-E0500', 500, 'Update returned no row');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'DRIVER.UPDATE',
      entity: 'Driver',
      entityId: updated.drvId,
      before: { status: existing.drvStatus },
      after: { status: updated.drvStatus },
    });

    revalidatePath('/drivers');
    revalidatePath(`/drivers/${id}`);
    /* Salary feeds the truck P&L driver-salary line. */
    if (data.fixed_salary !== undefined) revalidatePath('/truck/pnl');
    return updated;
  });
}

export async function deleteDriverAction(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);

    // Fetch driver with user name via JOIN (no relations defined)
    const rows = await db
      .select({
        driver: carDrivers,
        userName: carUsers.usrName,
        userRole: carUsers.usrLocalRole,
      })
      .from(carDrivers)
      .leftJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
      .where(
        and(
          eq(carDrivers.drvId, id),
          eq(carDrivers.entId, actor.entId),
          isNull(carDrivers.drvDeletedAt),
        ),
      )
      .limit(1);

    const existing = rows[0];
    if (!existing) throw new CarError('CAR-E0404', 404, 'Driver not found');

    await db
      .update(carDrivers)
      .set({ drvDeletedAt: new Date(), drvUpdatedAt: new Date() })
      .where(and(eq(carDrivers.drvId, id), eq(carDrivers.entId, actor.entId)));

    /* A deleted driver must not stay a vehicle's default driver. The truck P&L
     * reads the default driver's fixed salary but joins with
     * `drv_deleted_at IS NULL`, so a dangling reference makes the salary line
     * silently drop to 0 while /truck/fleet keeps printing the name
     * (getDriverNamesByIds ignores soft-delete) — the numbers go wrong with no
     * visible cause. Clearing it instead surfaces the gap: the vehicle shows no
     * default driver, prompting a reassignment. checkDriverDeleteWarnings
     * already warns about these vehicles before the admin confirms. */
    const unlinked = await db
      .update(carVehicles)
      .set({ cvhDefaultDriverId: null, cvhUpdatedAt: new Date() })
      .where(
        and(
          eq(carVehicles.entId, actor.entId),
          eq(carVehicles.cvhDefaultDriverId, id),
          isNull(carVehicles.cvhDeletedAt),
        ),
      )
      .returning({ id: carVehicles.cvhId, plate: carVehicles.cvhPlateNumber });

    /* A DRIVER's fleet membership only says which fleet they drive for, so it
     * dies with the driver record — leaving it behind is what let a re-created
     * driver end up in both departments. A MANAGER/ADMIN's membership is
     * workspace access that has nothing to do with this driver row: revoking it
     * would lock them out of /truck entirely. */
    const revoked =
      existing.userRole === 'DRIVER'
        ? await db
            .update(carUserFleetAccess)
            .set({ ufaDeletedAt: new Date() })
            .where(
              and(
                eq(carUserFleetAccess.entId, actor.entId),
                eq(carUserFleetAccess.usrId, existing.driver.drvUserId),
                isNull(carUserFleetAccess.ufaDeletedAt),
              ),
            )
            .returning({ type: carUserFleetAccess.ufaVehicleType })
        : [];

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'DRIVER.DELETE',
      entity: 'Driver',
      entityId: id,
      entityRef: existing.userName ?? existing.driver.drvLicenseNumber,
      before: { license: existing.driver.drvLicenseNumber, status: existing.driver.drvStatus },
      after: {
        unlinkedDefaultDriverVehicles: unlinked.map((v) => v.plate),
        revokedFleetAccess: revoked.map((r) => r.type),
      },
    });

    revalidatePath('/drivers');
    /* The truck surfaces read this driver too: its roster is membership-filtered,
     * the fleet roster prints the default-driver column, and the P&L / finance
     * pages sum the salary we just detached. */
    if (revoked.length > 0) revalidatePath('/truck/drivers');
    if (unlinked.length > 0) {
      revalidatePath('/truck/fleet');
      revalidatePath('/truck/pnl');
      revalidatePath('/truck/finance');
    }
    return { id };
  });
}

/**
 * Get warnings before deleting a driver.
 * Returns warnings about active trips and pending expenses.
 * Does NOT block deletion (soft-warning approach).
 */
export async function getDriverDeleteWarningsAction(
  driverId: string,
): Promise<ActionResult<{ warnings: DriverDeleteWarning[] }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);

    const result = await checkDriverDeleteWarnings(actor.entId, driverId);
    return { warnings: result.warnings };
  });
}
