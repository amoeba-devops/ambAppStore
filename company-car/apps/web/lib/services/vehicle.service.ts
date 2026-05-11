import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { vehicles, drivers, type DbVehicle } from '@/lib/db/schema';
import type { CreateVehicleInput, UpdateVehicleInput, VehicleStatus } from '@repo/api-types';
import { HttpError } from '@/lib/api/response';

export type VehicleWithDriver = DbVehicle & {
  assignedDriver: { id: string; fullName: string; licenseNumber: string } | null;
};

export async function listVehicles(filter?: {
  status?: VehicleStatus;
}): Promise<VehicleWithDriver[]> {
  const rows = await db
    .select({
      vehicle: vehicles,
      driver: {
        id: drivers.id,
        fullName: drivers.fullName,
        licenseNumber: drivers.licenseNumber,
      },
    })
    .from(vehicles)
    .leftJoin(drivers, eq(drivers.id, vehicles.assignedDriverId))
    .where(filter?.status ? eq(vehicles.status, filter.status) : undefined)
    .orderBy(vehicles.licensePlate);

  return rows.map((r) => ({
    ...r.vehicle,
    assignedDriver: r.driver?.id ? r.driver : null,
  }));
}

export async function getVehicle(id: string): Promise<VehicleWithDriver | null> {
  const [row] = await db
    .select({
      vehicle: vehicles,
      driver: {
        id: drivers.id,
        fullName: drivers.fullName,
        licenseNumber: drivers.licenseNumber,
      },
    })
    .from(vehicles)
    .leftJoin(drivers, eq(drivers.id, vehicles.assignedDriverId))
    .where(eq(vehicles.id, id))
    .limit(1);

  if (!row) return null;
  return { ...row.vehicle, assignedDriver: row.driver?.id ? row.driver : null };
}

export async function createVehicle(input: CreateVehicleInput): Promise<DbVehicle> {
  const [created] = await db
    .insert(vehicles)
    .values({
      licensePlate: input.licensePlate,
      vehicleType: input.vehicleType,
      manufactureYear: input.manufactureYear ?? null,
      color: input.color ?? null,
      photos: input.photos ?? [],
      currentKm: input.currentKm ?? 0,
      oilChangeIntervalKm: input.oilChangeIntervalKm ?? 5000,
      lastOilChangeKm: input.lastOilChangeKm ?? 0,
      assignedDriverId: input.assignedDriverId ?? null,
      status: input.status ?? 'ACTIVE',
    })
    .returning();
  if (!created) throw new HttpError(500, 'INSERT_FAILED', 'Failed to create vehicle');
  return created;
}

export async function updateVehicle(id: string, patch: UpdateVehicleInput): Promise<DbVehicle> {
  const [current] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  if (!current) throw new HttpError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');

  const [updated] = await db
    .update(vehicles)
    .set({
      licensePlate: patch.licensePlate ?? current.licensePlate,
      vehicleType: patch.vehicleType ?? current.vehicleType,
      manufactureYear:
        patch.manufactureYear !== undefined ? patch.manufactureYear : current.manufactureYear,
      color: patch.color !== undefined ? patch.color : current.color,
      photos: patch.photos ?? current.photos,
      currentKm: patch.currentKm ?? current.currentKm,
      oilChangeIntervalKm: patch.oilChangeIntervalKm ?? current.oilChangeIntervalKm,
      lastOilChangeKm: patch.lastOilChangeKm ?? current.lastOilChangeKm,
      assignedDriverId:
        patch.assignedDriverId !== undefined ? patch.assignedDriverId : current.assignedDriverId,
      status: patch.status ?? current.status,
      updatedAt: new Date(),
    })
    .where(eq(vehicles.id, id))
    .returning();
  if (!updated) throw new HttpError(500, 'UPDATE_FAILED', 'Failed to update vehicle');
  return updated;
}

export async function setVehicleStatus(id: string, status: VehicleStatus): Promise<DbVehicle> {
  const [updated] = await db
    .update(vehicles)
    .set({ status, updatedAt: new Date() })
    .where(eq(vehicles.id, id))
    .returning();
  if (!updated) throw new HttpError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
  return updated;
}

export async function deleteVehicle(id: string): Promise<void> {
  await db.delete(vehicles).where(eq(vehicles.id, id));
}

export function toVehicleResponse(v: VehicleWithDriver) {
  return {
    id: v.id,
    licensePlate: v.licensePlate,
    vehicleType: v.vehicleType,
    manufactureYear: v.manufactureYear,
    color: v.color,
    photos: v.photos,
    currentKm: v.currentKm,
    oilChangeIntervalKm: v.oilChangeIntervalKm,
    lastOilChangeKm: v.lastOilChangeKm,
    assignedDriverId: v.assignedDriverId,
    assignedDriver: v.assignedDriver,
    status: v.status,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}
