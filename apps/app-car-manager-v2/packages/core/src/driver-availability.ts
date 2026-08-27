import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carDrivers, carTrips, type CarDriver } from '@car-v2/db/schema';
import { CarError } from '@car-v2/shared/errors';

/**
 * Guard before assigning a driver to a trip — shared by the car dispatch flow
 * (trip-state-machine.service.ts) and the truck trip-log flow
 * (truck/truck-trip.service.ts), since both write the same `car_drivers` /
 * `car_trips` tables.
 *
 * Two hard blocks (unlike the future schedule-conflict soft-warning, which only
 * warns): a driver already driving another trip right now is a physical
 * impossibility, not a scheduling estimate, so this throws instead of letting
 * the caller save anyway.
 *
 *  - the driver must not already be on an ACTIVE trip (checked directly
 *    against `car_trips`, not just the cached `drv_status`, so a stale status
 *    can't let a double-booking slip through). "Active" per surface:
 *      · DISPATCH (car): `IN_PROGRESS` only — `CONFIRMED` means accepted but
 *        not yet departed, and booking a driver for a later trip is normal.
 *      · LOG (truck): `CONFIRMED` or `IN_PROGRESS` — truck trips have no
 *        start step (create → CONFIRMED → COMPLETED), so an open CONFIRMED
 *        log IS the driver being on the road.
 *  - `drv_status` must be `AVAILABLE` (rejects `OFF_DUTY` / `UNAVAILABLE` and
 *    any other non-available status)
 *
 * `excludeTripId` lets a reassign/update on a trip ignore that same trip when
 * checking for an active-trip conflict.
 *
 * Error codes skip CAR-E1007/E1008/E1010 — reserved (unimplemented) in
 * docs/plan/PLAN-20260513-p1-trip-mvp.md for trip-ref retry / stopover limit.
 */
export async function assertDriverAvailableForAssignment(
  entId: string,
  driverId: string,
  excludeTripId?: string,
): Promise<CarDriver> {
  const driver = await db.query.carDrivers.findFirst({
    where: and(
      eq(carDrivers.drvId, driverId),
      eq(carDrivers.entId, entId),
      isNull(carDrivers.drvDeletedAt),
    ),
  });
  if (!driver) throw new CarError('CAR-E1003', 400, 'Driver not available');

  const activeTripConditions = [
    eq(carTrips.trpDriverId, driverId),
    eq(carTrips.entId, entId),
    isNull(carTrips.trpDeletedAt),
    or(
      eq(carTrips.trpStatus, 'IN_PROGRESS'),
      and(eq(carTrips.trpKind, 'LOG'), eq(carTrips.trpStatus, 'CONFIRMED')),
    ),
  ];
  if (excludeTripId) activeTripConditions.push(ne(carTrips.trpId, excludeTripId));

  /* List up to 3 so the warning can name every trip the driver is out on
   * (legacy data may hold more than one open log). */
  const activeTrips = await db.query.carTrips.findMany({
    where: and(...activeTripConditions),
    columns: { trpId: true, trpRef: true },
    limit: 3,
  });
  if (activeTrips.length > 0) {
    const refs = activeTrips.map((t) => t.trpRef);
    throw new CarError(
      'CAR-E1009',
      409,
      `Driver is already on active trip(s) ${refs.join(', ')}`,
      {
        driverId,
        conflictTripIds: activeTrips.map((t) => t.trpId),
        conflictTripRef: refs.join(', '),
      },
    );
  }

  if (driver.drvStatus !== 'AVAILABLE') {
    throw new CarError(
      'CAR-E1011',
      409,
      `Driver is not available for assignment (status: ${driver.drvStatus})`,
      { driverId, driverStatus: driver.drvStatus },
    );
  }

  return driver;
}
