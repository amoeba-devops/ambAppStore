/**
 * Assignment-guard pattern (driver/vehicle checks when creating or assigning a
 * trip) — shared contract between server actions and client forms.
 *
 * Two tiers:
 *   BLOCK — integrity violations (missing/retired records, invalid state,
 *           closed month, role). Plain CarError, never overridable.
 *   WARN  — risky-but-possible situations. The action refuses with
 *           `CONFIRM_REQUIRED_CODE` + `details.warnings`; the UI shows a
 *           confirm dialog and resubmits with `confirmed_warning_codes`.
 *           ADMIN/MANAGER may confirm; DRIVER never can (their warnings are
 *           re-thrown as hard errors).
 *
 * Lives in @car-v2/shared because Client Components import these types and
 * must not pull in @car-v2/core (which imports the DB client).
 */

export const ASSIGNMENT_WARNING_CODES = [
  /** Driver is on an active trip: car DISPATCH `IN_PROGRESS`, or an open
   * truck LOG (`CONFIRMED`/`IN_PROGRESS` — truck has no start step). */
  'DRIVER_ON_ACTIVE_TRIP',
  /** drv_status is ON_TRIP / OFF_DUTY / UNAVAILABLE. */
  'DRIVER_STATUS_NOT_AVAILABLE',
  /** cvh_status = IN_USE. */
  'VEHICLE_IN_USE',
  /** cvh_status = MAINTENANCE. */
  'VEHICLE_MAINTENANCE',
] as const;

export type AssignmentWarningCode = (typeof ASSIGNMENT_WARNING_CODES)[number];

export interface AssignmentWarning {
  code: AssignmentWarningCode;
  /** Conflicting trip refs (DRIVER_ON_ACTIVE_TRIP). */
  refs?: string[];
  /** Driver/vehicle status enum value (…_STATUS_NOT_AVAILABLE / VEHICLE_*). */
  status?: string;
  /** Vehicle plate number (VEHICLE_*). */
  plate?: string;
}

/** ActionResult error code meaning "resubmit with confirmed_warning_codes". */
export const CONFIRM_REQUIRED_CODE = 'CAR-E1012';

/** Type guard for the `details` payload carried by a CONFIRM_REQUIRED error. */
export function isConfirmRequiredDetails(
  details: unknown,
): details is { warnings: AssignmentWarning[] } {
  return (
    typeof details === 'object' &&
    details !== null &&
    Array.isArray((details as { warnings?: unknown }).warnings)
  );
}
