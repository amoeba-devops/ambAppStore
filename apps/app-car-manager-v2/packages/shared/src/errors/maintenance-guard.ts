/**
 * Maintenance-guard contract (REQ-20260904) — shared between server actions
 * and client forms, like assignment-guard.
 *
 * Unlike the assignment guard these are BLOCK-tier only: there is no
 * "Vẫn tiếp tục" — a maintenance window and a trip on the same truck/date are
 * mutually exclusive in both directions.
 *
 *   CAR-E1013  a trip is being created / assigned / edited / imported for a
 *              truck on a date inside a live maintenance window.
 *   CAR-E1014  a maintenance window is being created / edited over dates the
 *              truck already has trips on.
 *
 * `details` carry the structured facts so the client can localize the toast
 * instead of showing the English server message.
 */

export const VEHICLE_UNDER_MAINTENANCE_CODE = 'CAR-E1013';
export const MAINTENANCE_HAS_TRIPS_CODE = 'CAR-E1014';

export interface MaintenanceBlockDetails {
  plate: string;
  /** 'YYYY-MM-DD' inclusive window. */
  startDate: string;
  endDate: string;
  /** 1-based Excel row when the refusal came from the import pre-scan. */
  row?: number;
}

export interface MaintenanceTripsDetails {
  plate: string;
  /** Trips of the truck inside the requested window. */
  count: number;
  /** Up to 3 trip refs, oldest first. */
  refs: string[];
}

export function isMaintenanceBlockDetails(details: unknown): details is MaintenanceBlockDetails {
  return (
    typeof details === 'object' &&
    details !== null &&
    typeof (details as MaintenanceBlockDetails).plate === 'string' &&
    typeof (details as MaintenanceBlockDetails).startDate === 'string' &&
    typeof (details as MaintenanceBlockDetails).endDate === 'string'
  );
}

export function isMaintenanceTripsDetails(details: unknown): details is MaintenanceTripsDetails {
  return (
    typeof details === 'object' &&
    details !== null &&
    typeof (details as MaintenanceTripsDetails).count === 'number' &&
    Array.isArray((details as MaintenanceTripsDetails).refs)
  );
}
