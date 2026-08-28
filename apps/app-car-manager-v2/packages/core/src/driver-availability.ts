import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carDrivers, carTrips, carVehicles, type CarDriver } from '@car-v2/db/schema';
import { CarError, type AssignmentWarning } from '@car-v2/shared/errors';

/**
 * Assignment-guard evaluation (driver/vehicle) — shared by the car dispatch
 * flow and the truck trip-log flow, since both write the same `car_drivers` /
 * `car_trips` / `car_vehicles` tables.
 *
 * Two tiers (see @car-v2/shared/errors/assignment-guard):
 *   BLOCK — `requireDriver` throws CAR-E1003 when the driver doesn't exist for
 *           this tenant. Vehicle existence/RETIRED stays with each flow's own
 *           hard check (state machine / assertTruckVehicle).
 *   WARN  — `evaluateAssignmentWarnings` RETURNS conditions instead of
 *           throwing; the action layer decides to confirm-or-refuse
 *           (ADMIN/MANAGER may confirm on the UI dialog, DRIVER may not).
 *
 * Warnings are computed against `car_trips` directly, not just the cached
 * `drv_status`, so a stale status can't hide a double-booking. "On an active
 * trip" per surface:
 *   · DISPATCH (car): `IN_PROGRESS` only — `CONFIRMED` means accepted but not
 *     yet departed, and booking a driver for a later trip is normal.
 *   · LOG (truck): `CONFIRMED` or `IN_PROGRESS` — truck trips have no start
 *     step (create → CONFIRMED → COMPLETED), so an open CONFIRMED log IS the
 *     driver being on the road.
 *
 * `excludeTripId` lets a reassign/update on a trip ignore that same trip when
 * checking for an active-trip conflict.
 */

/** BLOCK tier: the driver must exist (ent-scoped, not soft-deleted). */
export async function requireDriver(entId: string, driverId: string): Promise<CarDriver> {
  const driver = await db.query.carDrivers.findFirst({
    where: and(
      eq(carDrivers.drvId, driverId),
      eq(carDrivers.entId, entId),
      isNull(carDrivers.drvDeletedAt),
    ),
  });
  if (!driver) throw new CarError('CAR-E1003', 400, 'Driver not available');
  return driver;
}

export interface EvaluateAssignmentInput {
  driverId?: string | null;
  vehicleId?: string | null;
  excludeTripId?: string;
}

/**
 * WARN tier: collect every confirmable condition for this assignment. Returns
 * [] when the pairing is clean. Throws only CAR-E1003 (driver missing) — every
 * other integrity failure belongs to the caller's hard checks.
 */
export async function evaluateAssignmentWarnings(
  entId: string,
  input: EvaluateAssignmentInput,
): Promise<AssignmentWarning[]> {
  const warnings: AssignmentWarning[] = [];

  if (input.driverId) {
    const driver = await requireDriver(entId, input.driverId);

    const activeTripConditions = [
      eq(carTrips.trpDriverId, input.driverId),
      eq(carTrips.entId, entId),
      isNull(carTrips.trpDeletedAt),
      or(
        eq(carTrips.trpStatus, 'IN_PROGRESS'),
        and(eq(carTrips.trpKind, 'LOG'), eq(carTrips.trpStatus, 'CONFIRMED')),
      ),
    ];
    if (input.excludeTripId) {
      activeTripConditions.push(ne(carTrips.trpId, input.excludeTripId));
    }

    /* List up to 3 so the dialog can name every trip the driver is out on
     * (legacy data may hold more than one open log). */
    const activeTrips = await db.query.carTrips.findMany({
      where: and(...activeTripConditions),
      columns: { trpRef: true },
      limit: 3,
    });
    if (activeTrips.length > 0) {
      warnings.push({
        code: 'DRIVER_ON_ACTIVE_TRIP',
        refs: activeTrips.map((t) => t.trpRef),
      });
    }

    if (driver.drvStatus !== 'AVAILABLE') {
      warnings.push({ code: 'DRIVER_STATUS_NOT_AVAILABLE', status: driver.drvStatus });
    }
  }

  if (input.vehicleId) {
    const vehicle = await db.query.carVehicles.findFirst({
      where: and(
        eq(carVehicles.cvhId, input.vehicleId),
        eq(carVehicles.entId, entId),
        isNull(carVehicles.cvhDeletedAt),
      ),
      columns: { cvhStatus: true, cvhPlateNumber: true },
    });
    /* Missing/RETIRED vehicle is the caller's hard check — only warn on the
     * transient statuses an admin may knowingly override. */
    if (vehicle?.cvhStatus === 'IN_USE') {
      warnings.push({ code: 'VEHICLE_IN_USE', plate: vehicle.cvhPlateNumber });
    } else if (vehicle?.cvhStatus === 'MAINTENANCE') {
      warnings.push({ code: 'VEHICLE_MAINTENANCE', plate: vehicle.cvhPlateNumber });
    }
  }

  return warnings;
}
