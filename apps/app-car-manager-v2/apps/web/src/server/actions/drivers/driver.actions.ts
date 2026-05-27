'use server';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carDrivers, carUsers, type CarDriver } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { createDriverSchema, updateDriverSchema } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';
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
    return updated;
  });
}
