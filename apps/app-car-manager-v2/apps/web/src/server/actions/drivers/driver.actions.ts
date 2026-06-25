'use server';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carDrivers, carUserFleetAccess, carUsers, type CarDriver } from '@car-v2/db/schema';
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

    const [created] = await db
      .insert(carDrivers)
      .values({
        drvId: randomUUID(),
        entId: actor.entId,
        drvUserId: data.user_id,
        drvLicenseNumber: data.license_number,
        drvLicenseClass: data.license_class,
        drvLicenseExpiry: data.license_expiry,
        drvPhone: data.phone?.trim() || null,
        drvEmergencyContact: data.emergency_contact ?? null,
        drvFixedSalary: data.fixed_salary != null ? String(data.fixed_salary) : null,
        drvNotes: data.notes ?? null,
      })
      .returning();
    if (!created) throw new CarError('CAR-E0500', 500, 'Insert returned no row');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'DRIVER.CREATE',
      entity: 'Driver',
      entityId: created.drvId,
      entityRef: user.usrName ?? data.license_number,
      after: { license: created.drvLicenseNumber, user_id: created.drvUserId },
    });

    /* Created from a department surface (e.g. /truck/drivers/new) → also grant
     * that fleet membership so the driver appears in the dept roster, which is
     * filtered by car_user_fleet_access. Idempotent: skip if already present.
     * ADMIN + MANAGER both allowed (gated above). */
    if (data.vehicle_type) {
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

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'DRIVER.DELETE',
      entity: 'Driver',
      entityId: id,
      entityRef: existing.userName ?? existing.driver.drvLicenseNumber,
      before: { license: existing.driver.drvLicenseNumber, status: existing.driver.drvStatus },
    });

    revalidatePath('/drivers');
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
