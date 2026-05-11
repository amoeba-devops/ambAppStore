import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { drivers, type DbDriver } from '@/lib/db/schema';
import type { CreateDriverInput, DriverStatus, UpdateDriverInput } from '@repo/api-types';
import { HttpError } from '@/lib/api/response';

export async function listDrivers(filter?: { status?: DriverStatus }): Promise<DbDriver[]> {
  return db
    .select()
    .from(drivers)
    .where(filter?.status ? eq(drivers.status, filter.status) : undefined)
    .orderBy(drivers.fullName);
}

export async function getDriver(id: string): Promise<DbDriver | null> {
  const [row] = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
  return row ?? null;
}

export async function createDriver(input: CreateDriverInput): Promise<DbDriver> {
  const [created] = await db
    .insert(drivers)
    .values({
      userId: input.userId ?? null,
      fullName: input.fullName,
      licenseNumber: input.licenseNumber,
      licenseClass: input.licenseClass ?? null,
      licenseExpiryDate: input.licenseExpiryDate,
      phone: input.phone ?? null,
      avatarUrl: input.avatarUrl ?? null,
      status: input.status ?? 'ACTIVE',
    })
    .returning();
  if (!created) throw new HttpError(500, 'INSERT_FAILED', 'Failed to create driver');
  return created;
}

export async function updateDriver(id: string, patch: UpdateDriverInput): Promise<DbDriver> {
  const [current] = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
  if (!current) throw new HttpError(404, 'DRIVER_NOT_FOUND', 'Driver not found');

  const [updated] = await db
    .update(drivers)
    .set({
      userId: patch.userId !== undefined ? patch.userId ?? null : current.userId,
      fullName: patch.fullName ?? current.fullName,
      licenseNumber: patch.licenseNumber ?? current.licenseNumber,
      licenseClass:
        patch.licenseClass !== undefined ? patch.licenseClass ?? null : current.licenseClass,
      licenseExpiryDate: patch.licenseExpiryDate ?? current.licenseExpiryDate,
      phone: patch.phone !== undefined ? patch.phone ?? null : current.phone,
      avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl ?? null : current.avatarUrl,
      status: patch.status ?? current.status,
      updatedAt: new Date(),
    })
    .where(eq(drivers.id, id))
    .returning();
  if (!updated) throw new HttpError(500, 'UPDATE_FAILED', 'Failed to update driver');
  return updated;
}

export async function deleteDriver(id: string): Promise<void> {
  await db.delete(drivers).where(eq(drivers.id, id));
}

export function toDriverResponse(d: DbDriver) {
  return {
    id: d.id,
    userId: d.userId,
    fullName: d.fullName,
    licenseNumber: d.licenseNumber,
    licenseClass: d.licenseClass,
    licenseExpiryDate: d.licenseExpiryDate,
    phone: d.phone,
    avatarUrl: d.avatarUrl,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export function isLicenseExpired(d: DbDriver, on = new Date()): boolean {
  return new Date(d.licenseExpiryDate) < on;
}

export function daysUntilExpiry(d: DbDriver, on = new Date()): number {
  const diff = new Date(d.licenseExpiryDate).getTime() - on.getTime();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}
