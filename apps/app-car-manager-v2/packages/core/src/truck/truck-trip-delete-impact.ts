import { and, eq, gte, isNull, lt, ne } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTrips, carVehicles } from '@car-v2/db/schema';
import { loadTruckRegionSnapshots } from './truck-fuel-snapshot';
import { loadTruckFixedMonthly } from './truck-fixed-monthly';

/**
 * What else changes if ONE truck trip is deleted (BUG-261005 follow-up) — shown
 * in the delete confirmation so the operator sees the knock-on effects before
 * confirming, instead of discovering them in P&L afterwards.
 *
 * Only COMPLETED trips feed the fuel pool and P&L, so an open trip has no
 * knock-on effect and returns an empty impact.
 *
 *  1. `fuelShifts` — the vehicle's fuel spend for the month is spread over its
 *     km (money ÷ km), so removing a trip changes BOTH the money (its own
 *     fill-up, when the month has no fuel invoice) and the km of every sibling
 *     trip's allocation. Computed with the very same `fuelForTrip` the list,
 *     finance and P&L use, once as-is and once with the trip excluded — so a
 *     sibling frozen by a report (AVERAGED) correctly shows no change.
 *  2. `lastTripOfMonth` — when no other completed trip of that vehicle remains
 *     in the month, the month stops being "active": its salary + depreciation
 *     drop out of the vehicle's P&L (QA 2026-07-30 rule: no trip → no fixed-cost
 *     allocation), and a month before the first recorded rate loses the
 *     backfill too (BUG-260930 case 4).
 */
export interface TruckTripFuelShift {
  tripId: string;
  ref: string;
  scheduledAt: Date;
  before: number;
  after: number;
}

export interface TruckTripDeleteImpact {
  /** 'YYYY-MM' of the trip being deleted. */
  month: string;
  vehicleId: string | null;
  vehiclePlate: string | null;
  fuelShifts: TruckTripFuelShift[];
  lastTripOfMonth: { salary: number; depreciation: number } | null;
}

const monthKey = (d: Date): string => d.toISOString().slice(0, 7);

export async function getTruckTripDeleteImpact(entId: string, tripId: string): Promise<TruckTripDeleteImpact | null> {
  const trip = await db.query.carTrips.findFirst({
    where: and(
      eq(carTrips.trpId, tripId),
      eq(carTrips.entId, entId),
      eq(carTrips.trpKind, 'LOG'),
      isNull(carTrips.trpDeletedAt),
    ),
  });
  if (!trip) return null;

  const month = monthKey(trip.trpScheduledAt);
  const vehicleId = trip.trpVehicleId;
  const empty: TruckTripDeleteImpact = { month, vehicleId, vehiclePlate: null, fuelShifts: [], lastTripOfMonth: null };
  if (trip.trpStatus !== 'COMPLETED' || !vehicleId) return empty;

  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const [vehicle, siblings, before, after] = await Promise.all([
    db.query.carVehicles.findFirst({
      where: and(eq(carVehicles.cvhId, vehicleId), eq(carVehicles.entId, entId)),
      columns: { cvhPlateNumber: true },
    }),
    db
      .select({
        tripId: carTrips.trpId,
        ref: carTrips.trpRef,
        scheduledAt: carTrips.trpScheduledAt,
        so: carTrips.trpStartOdometer,
        eo: carTrips.trpEndOdometer,
        updatedAt: carTrips.trpUpdatedAt,
        createdAt: carTrips.trpCreatedAt,
      })
      .from(carTrips)
      .where(
        and(
          eq(carTrips.entId, entId),
          eq(carTrips.trpKind, 'LOG'),
          eq(carTrips.trpStatus, 'COMPLETED'),
          isNull(carTrips.trpDeletedAt),
          eq(carTrips.trpVehicleId, vehicleId),
          ne(carTrips.trpId, tripId),
          gte(carTrips.trpScheduledAt, start),
          lt(carTrips.trpScheduledAt, end),
        ),
      )
      .orderBy(carTrips.trpScheduledAt),
    loadTruckRegionSnapshots(entId, [month]),
    loadTruckRegionSnapshots(entId, [month], { excludeTripIds: [tripId] }),
  ]);

  const fuelShifts: TruckTripFuelShift[] = [];
  for (const s of siblings) {
    /* Same km + changedAt rule as listTruckTrips / getTruckTripBreakdown. */
    const km = s.so != null && s.eo != null ? s.eo - s.so : 0;
    const changedAt = s.updatedAt ?? s.createdAt ?? null;
    const b = before.fuelForTrip(month, vehicleId, km, changedAt).cost;
    const a = after.fuelForTrip(month, vehicleId, km, changedAt).cost;
    if (a !== b) fuelShifts.push({ tripId: s.tripId, ref: s.ref, scheduledAt: s.scheduledAt, before: b, after: a });
  }

  let lastTripOfMonth: TruckTripDeleteImpact['lastTripOfMonth'] = null;
  if (siblings.length === 0) {
    /* The month as P&L sees it TODAY — active, with this trip's driver standing
     * in when the truck has no default driver (computeTruckPnl's rule). */
    const k = `${month}|${vehicleId}`;
    const fixed = await loadTruckFixedMonthly(entId, [month], {
      vehicleId,
      activeKeys: new Set([k]),
      driverByKey: trip.trpDriverId ? new Map([[k, trip.trpDriverId]]) : undefined,
    });
    const fc = fixed.forVehicleMonth(month, vehicleId);
    if (fc.total > 0) lastTripOfMonth = { salary: fc.salary, depreciation: fc.depreciation };
  }

  return { month, vehicleId, vehiclePlate: vehicle?.cvhPlateNumber ?? null, fuelShifts, lastTripOfMonth };
}
