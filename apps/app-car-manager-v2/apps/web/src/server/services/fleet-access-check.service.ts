import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carDrivers, carVehicles, type CarVehicleType } from '@car-v2/db/schema';

export interface FleetAccessRevokeWarning {
  type: 'default_driver_vehicles';
  count: number;
  message: string;
  refs: { id: string; label: string; subtitle?: string }[];
}

/**
 * Check for potential issues before revoking a user's fleet-department access.
 * Returns warnings but does NOT block revocation (soft-warning approach,
 * consistent with checkDriverDeleteWarnings).
 *
 * Checks: vehicles (in this department) that have the user (as a driver) set
 * as their default driver — revoking leaves those vehicles' default driver
 * reference stale (no trip auto-fill, no P&L salary line for that vehicle).
 */
export async function checkFleetAccessRevokeWarnings(
  entId: string,
  userId: string,
  vehicleType: CarVehicleType,
): Promise<FleetAccessRevokeWarning[]> {
  const driver = await db.query.carDrivers.findFirst({
    where: and(
      eq(carDrivers.entId, entId),
      eq(carDrivers.drvUserId, userId),
      isNull(carDrivers.drvDeletedAt),
    ),
  });
  if (!driver) return [];

  const vehicles = await db
    .select({
      cvhId: carVehicles.cvhId,
      cvhPlateNumber: carVehicles.cvhPlateNumber,
      cvhModel: carVehicles.cvhModel,
    })
    .from(carVehicles)
    .where(
      and(
        eq(carVehicles.entId, entId),
        eq(carVehicles.cvhType, vehicleType),
        eq(carVehicles.cvhDefaultDriverId, driver.drvId),
        isNull(carVehicles.cvhDeletedAt),
      ),
    )
    .limit(4);

  if (vehicles.length === 0) return [];

  return [
    {
      type: 'default_driver_vehicles',
      count: vehicles.length,
      message: `${vehicles.length} vehicle(s) have this driver set as default`,
      refs: vehicles.slice(0, 3).map((v) => ({
        id: v.cvhId,
        label: v.cvhPlateNumber,
        subtitle: v.cvhModel,
      })),
    },
  ];
}
