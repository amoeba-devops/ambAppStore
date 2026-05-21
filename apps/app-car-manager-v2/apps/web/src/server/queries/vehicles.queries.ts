import 'server-only';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carVehicles, type CarVehicle } from '@car-v2/db/schema';

export async function listVehicles(entId: string): Promise<CarVehicle[]> {
  return db
    .select()
    .from(carVehicles)
    .where(and(eq(carVehicles.entId, entId), isNull(carVehicles.cvhDeletedAt)))
    .orderBy(asc(carVehicles.cvhPlateNumber));
}

export async function getVehicle(entId: string, id: string): Promise<CarVehicle | null> {
  const row = await db.query.carVehicles.findFirst({
    where: and(
      eq(carVehicles.cvhId, id),
      eq(carVehicles.entId, entId),
      isNull(carVehicles.cvhDeletedAt),
    ),
  });
  return row ?? null;
}

export async function countVehiclesByStatus(entId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: carVehicles.cvhStatus })
    .from(carVehicles)
    .where(and(eq(carVehicles.entId, entId), isNull(carVehicles.cvhDeletedAt)));
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}
