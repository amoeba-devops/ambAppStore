import 'server-only';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTrips, carVehicles, type CarVehicle } from '@car-v2/db/schema';

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

export interface DriverVehicleSummary extends CarVehicle {
  /** Number of trips this driver has had on this vehicle (any status, soft-deleted excluded). */
  tripCount: number;
  /** Most recent scheduled time on this vehicle for this driver — used for "last driven" hint. */
  lastTripAt: Date | null;
  /** True if a CONFIRMED or IN_PROGRESS trip currently assigns this vehicle to the driver. */
  isCurrentlyAssigned: boolean;
}

/** Vehicles the driver has been (or is) assigned to — derived from trip history.
 *  Drivers are not statically tied to a vehicle in v2; the "phương tiện của tôi"
 *  view is the union of any vehicle on a non-deleted trip for this driver. */
export async function listVehiclesForDriver(
  entId: string,
  driverId: string,
): Promise<DriverVehicleSummary[]> {
  const rows = await db
    .select({
      vehicle: carVehicles,
      tripCount: sql<number>`count(${carTrips.trpId})::int`,
      lastTripAt: sql<Date | null>`max(${carTrips.trpScheduledAt})`,
      activeCount: sql<number>`count(*) filter (where ${carTrips.trpStatus} in ('CONFIRMED','IN_PROGRESS'))::int`,
    })
    .from(carTrips)
    .innerJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
    .where(
      and(
        eq(carTrips.entId, entId),
        eq(carTrips.trpDriverId, driverId),
        isNull(carTrips.trpDeletedAt),
        isNull(carVehicles.cvhDeletedAt),
      ),
    )
    .groupBy(carVehicles.cvhId)
    .orderBy(desc(sql`max(${carTrips.trpScheduledAt})`));

  return rows.map((r) => ({
    ...r.vehicle,
    tripCount: Number(r.tripCount ?? 0),
    lastTripAt: r.lastTripAt ? new Date(r.lastTripAt) : null,
    isCurrentlyAssigned: Number(r.activeCount ?? 0) > 0,
  }));
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
