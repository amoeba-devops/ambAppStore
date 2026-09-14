import 'server-only';
import {
  loadActiveMaintenanceByVehicle,
  resolveTruckVehicleStatus,
  utcDateKey,
  type TruckVehicleStatus,
} from '@car-v2/core/truck';
import { listVehicles, type VehicleListItem } from './vehicles.queries';

/**
 * Truck lists for the TRUCK workspace (REQ-20260907). Every truck screen reads
 * the EFFECTIVE status from here instead of the raw `cvh_status` column:
 * MAINTENANCE is derived from a live maintenance window covering today,
 * RETIRED from the stored value, everything else is AVAILABLE.
 */
export interface TruckListItem extends VehicleListItem {
  status: TruckVehicleStatus;
  /** 'YYYY-MM-DD' end of the window covering today — set only for MAINTENANCE. */
  maintenanceUntil: string | null;
}

/** Live trucks of the tenant with their effective status (one extra query). */
export async function listTrucksWithStatus(entId: string): Promise<TruckListItem[]> {
  const trucks = await listVehicles(entId, 'active', 'TRUCK');
  const active = await loadActiveMaintenanceByVehicle(
    entId,
    utcDateKey(new Date()),
    trucks.map((v) => v.cvhId),
  );
  return trucks.map((v) => {
    const window = active.get(v.cvhId) ?? null;
    const status = resolveTruckVehicleStatus(v.cvhStatus, window);
    return { ...v, status, maintenanceUntil: status === 'MAINTENANCE' && window ? window.endDate : null };
  });
}

/**
 * Trucks a trip / import / maintenance form may offer: everything except
 * RETIRED (BR-5). `keepId` re-admits the record's current truck on an edit
 * form so a retired truck's existing trip still renders its own selection.
 * Maintenance is NOT filtered here — the trip form greys trucks per DATE from
 * `maintenanceWindows` (REQ-20260904), which is the rule that actually blocks.
 */
export async function listDispatchableTrucks(entId: string, keepId?: string | null): Promise<VehicleListItem[]> {
  const trucks = await listVehicles(entId, 'active', 'TRUCK');
  return trucks.filter((v) => v.cvhStatus !== 'RETIRED' || (keepId != null && v.cvhId === keepId));
}
