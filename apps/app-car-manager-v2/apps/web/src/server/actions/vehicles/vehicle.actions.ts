'use server';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carVehicles, type CarVehicle } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import {
  createVehicleSchema,
  updateVehicleSchema,
} from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';
import {
  checkVehicleDeleteWarnings,
  type VehicleDeleteWarning,
} from '@/server/services/vehicle-delete-check.service';
import { runAction } from '../_helpers';

export async function createVehicleAction(input: unknown): Promise<ActionResult<CarVehicle>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    const data = createVehicleSchema.parse(input);

    const [created] = await db
      .insert(carVehicles)
      .values({
        cvhId: randomUUID(),
        entId: actor.entId,
        cvhPlateNumber: data.plate_number,
        cvhModel: data.model,
        cvhMake: data.make ?? null,
        cvhYear: data.year ?? null,
        cvhColor: data.color ?? null,
        cvhFuelType: data.fuel_type ?? 'PETROL',
        cvhOdometerKm: data.odometer_km ?? 0,
        cvhOilIntervalKm: data.oil_interval_km ?? 5000,
        cvhOilIntervalMonths: data.oil_interval_months ?? 3,
        cvhHomeBase: data.home_base ?? null,
        cvhNotes: data.notes ?? null,
      })
      .returning();
    if (!created) throw new CarError('CAR-E0500', 500, 'Insert returned no row');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'VEHICLE.CREATE',
      entity: 'Vehicle',
      entityId: created.cvhId,
      entityRef: created.cvhPlateNumber,
      after: { plate: created.cvhPlateNumber, model: created.cvhModel },
    });

    revalidatePath('/vehicles');
    return created;
  });
}

export async function updateVehicleAction(id: string, input: unknown): Promise<ActionResult<CarVehicle>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    const data = updateVehicleSchema.parse(input);

    const existing = await db.query.carVehicles.findFirst({
      where: and(eq(carVehicles.cvhId, id), eq(carVehicles.entId, actor.entId)),
    });
    if (!existing) throw new CarError('CAR-E0404', 404, 'Vehicle not found');

    const patch: Partial<typeof carVehicles.$inferInsert> = { cvhUpdatedAt: new Date() };
    if (data.plate_number !== undefined) patch.cvhPlateNumber = data.plate_number;
    if (data.model       !== undefined) patch.cvhModel = data.model;
    if (data.make        !== undefined) patch.cvhMake = data.make;
    if (data.year        !== undefined) patch.cvhYear = data.year;
    if (data.color       !== undefined) patch.cvhColor = data.color;
    if (data.fuel_type   !== undefined) patch.cvhFuelType = data.fuel_type;
    if (data.status      !== undefined) patch.cvhStatus = data.status;
    if (data.odometer_km !== undefined) patch.cvhOdometerKm = data.odometer_km;
    if (data.oil_interval_km     !== undefined) patch.cvhOilIntervalKm = data.oil_interval_km;
    if (data.oil_interval_months !== undefined) patch.cvhOilIntervalMonths = data.oil_interval_months;
    if (data.home_base !== undefined) patch.cvhHomeBase = data.home_base;
    if (data.notes     !== undefined) patch.cvhNotes = data.notes;

    const [updated] = await db
      .update(carVehicles)
      .set(patch)
      .where(and(eq(carVehicles.cvhId, id), eq(carVehicles.entId, actor.entId)))
      .returning();
    if (!updated) throw new CarError('CAR-E0500', 500, 'Update returned no row');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'VEHICLE.UPDATE',
      entity: 'Vehicle',
      entityId: updated.cvhId,
      entityRef: updated.cvhPlateNumber,
      before: { status: existing.cvhStatus, plate: existing.cvhPlateNumber },
      after: { status: updated.cvhStatus, plate: updated.cvhPlateNumber },
    });

    revalidatePath('/vehicles');
    revalidatePath(`/vehicles/${id}`);
    return updated;
  });
}

export async function deleteVehicleAction(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);

    const existing = await db.query.carVehicles.findFirst({
      where: and(
        eq(carVehicles.cvhId, id),
        eq(carVehicles.entId, actor.entId),
        isNull(carVehicles.cvhDeletedAt),
      ),
    });
    if (!existing) throw new CarError('CAR-E0404', 404, 'Vehicle not found');

    await db
      .update(carVehicles)
      .set({ cvhDeletedAt: new Date(), cvhUpdatedAt: new Date() })
      .where(and(eq(carVehicles.cvhId, id), eq(carVehicles.entId, actor.entId)));

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'VEHICLE.DELETE',
      entity: 'Vehicle',
      entityId: id,
      entityRef: existing.cvhPlateNumber,
      before: { plate: existing.cvhPlateNumber, status: existing.cvhStatus },
    });

    revalidatePath('/vehicles');
    return { id };
  });
}

/**
 * Get warnings before deleting a vehicle.
 * Returns warnings about active trips and linked expenses.
 * Does NOT block deletion (soft-warning approach).
 */
export async function getVehicleDeleteWarningsAction(
  vehicleId: string,
): Promise<ActionResult<{ warnings: VehicleDeleteWarning[] }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);

    const result = await checkVehicleDeleteWarnings(actor.entId, vehicleId);
    return { warnings: result.warnings };
  });
}
