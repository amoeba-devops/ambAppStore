import { and, eq, isNull, ne } from 'drizzle-orm';
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
 *  - the driver must not already be `IN_PROGRESS` on a different trip
 *    (checked directly against `car_trips`, not just the cached `drv_status`,
 *    so a stale status can't let a double-booking slip through)
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
    eq(carTrips.trpStatus, 'IN_PROGRESS'),
    isNull(carTrips.trpDeletedAt),
  ];
  if (excludeTripId) activeTripConditions.push(ne(carTrips.trpId, excludeTripId));

  const activeTrip = await db.query.carTrips.findFirst({
    where: and(...activeTripConditions),
  });
  if (activeTrip) {
    throw new CarError(
      'CAR-E1009',
      409,
      `Driver is already in progress on trip ${activeTrip.trpRef}`,
      { driverId, conflictTripId: activeTrip.trpId, conflictTripRef: activeTrip.trpRef },
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
