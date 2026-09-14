import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckMaintenances, carVehicles, type CarVehicleStatus } from '@car-v2/db/schema';
import type { MaintenanceWindow } from './truck-maintenance';

/**
 * Truck vehicle status (REQ-20260907) — pure domain helpers, no `next/*`.
 *
 * A truck shows exactly three states in the TRUCK workspace:
 *
 *   • AVAILABLE   "Sẵn sàng"      — may run trips.
 *   • MAINTENANCE "Bảo trì"       — DERIVED: a live `car_truck_maintenances`
 *                                   window covers today. Never stored on the
 *                                   vehicle (BR-2); the Maintenance menu is the
 *                                   single source of truth, so adding, moving or
 *                                   deleting a job flips the status instantly
 *                                   with no cron.
 *   • RETIRED     "Ngừng sử dụng" — stored; the only other value a user may set
 *                                   (BR-3). Wins over MAINTENANCE (BR-4).
 *
 * `IN_USE` exists on the shared enum for the CAR dispatch flow only; truck LOG
 * trips never set it, so it is read as AVAILABLE here. Migration 0031 clears
 * any hand-set MAINTENANCE / IN_USE left on trucks.
 *
 * "Today" is the UTC date key — the same convention as the maintenance list
 * chips and the CAR-E1013 guard (see truck-maintenance.ts).
 */
export type TruckVehicleStatus = 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED';

/** Display order for filters and the dashboard fleet-status card. */
export const TRUCK_VEHICLE_STATUSES: readonly TruckVehicleStatus[] = ['AVAILABLE', 'MAINTENANCE', 'RETIRED'];

/** The two values a user may STORE on a truck (form select + action guard). */
export const TRUCK_STORED_STATUSES = ['AVAILABLE', 'RETIRED'] as const;
export type TruckStoredStatus = (typeof TRUCK_STORED_STATUSES)[number];

export function isTruckStoredStatus(s: string): s is TruckStoredStatus {
  return (TRUCK_STORED_STATUSES as readonly string[]).includes(s);
}

/**
 * Effective status of one truck: stored RETIRED wins; otherwise a maintenance
 * window covering the reference day means MAINTENANCE; anything else (including
 * a stale hand-set MAINTENANCE / IN_USE) reads as AVAILABLE.
 */
export function resolveTruckVehicleStatus(
  stored: CarVehicleStatus,
  activeWindow: MaintenanceWindow | null | undefined,
): TruckVehicleStatus {
  if (stored === 'RETIRED') return 'RETIRED';
  if (activeWindow) return 'MAINTENANCE';
  return 'AVAILABLE';
}

/**
 * The live maintenance window covering `dateIso` for each truck of the scope
 * (all trucks of the tenant when `vehicleIds` is omitted). One query; when
 * several windows overlap the day, the one ending LAST is kept so "đến dd/mm"
 * tells the user when the truck is really back.
 */
export async function loadActiveMaintenanceByVehicle(
  entId: string,
  dateIso: string,
  vehicleIds?: readonly string[],
): Promise<Map<string, MaintenanceWindow>> {
  const out = new Map<string, MaintenanceWindow>();
  if (vehicleIds && vehicleIds.length === 0) return out;
  const rows = await db
    .select({
      id: carTruckMaintenances.tmnId,
      vehicleId: carTruckMaintenances.cvhId,
      plate: carVehicles.cvhPlateNumber,
      startDate: carTruckMaintenances.tmnStartDate,
      endDate: carTruckMaintenances.tmnEndDate,
    })
    .from(carTruckMaintenances)
    .innerJoin(carVehicles, eq(carTruckMaintenances.cvhId, carVehicles.cvhId))
    .where(
      and(
        eq(carTruckMaintenances.entId, entId),
        isNull(carTruckMaintenances.tmnDeletedAt),
        lte(carTruckMaintenances.tmnStartDate, dateIso),
        gte(carTruckMaintenances.tmnEndDate, dateIso),
        vehicleIds ? inArray(carTruckMaintenances.cvhId, [...vehicleIds]) : undefined,
      ),
    )
    .orderBy(asc(carTruckMaintenances.tmnEndDate));
  for (const row of rows) {
    const prev = out.get(row.vehicleId);
    if (!prev || row.endDate > prev.endDate) out.set(row.vehicleId, row);
  }
  return out;
}
