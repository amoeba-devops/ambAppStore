import 'server-only';
import { isTruckDriver } from '@/server/queries/drivers.queries';
import { hasFleet, type FleetDepartment } from './auth/fleet-access';
import type { AuthContext } from './auth/get-current-user';

export interface DriverRosterRef {
  /** The list page this driver is actually listed on. */
  href: string;
  /** Which workspace that list belongs to — pick the breadcrumb label from it. */
  dept: FleetDepartment;
}

/**
 * The roster a driver belongs to — the parent list for the shared driver detail
 * / edit screens (back button, breadcrumb, post-delete redirect).
 *
 * `/drivers` and `/truck/drivers` partition the roster with the SAME rule
 * `deptPredicate()` uses: a live TRUCK membership means the driver shows up in
 * the truck list ONLY (`listDrivers(..., 'CAR')` filters them out of the car
 * one). So the parent has to follow the driver's own department, not the sticky
 * active workspace: hard-coding `/drivers` sent a truck user viewing a truck
 * driver to the car roster — a list that cannot contain the driver they just
 * came from (BUG-20260729).
 *
 * Clamped to `hasFleet` because `/truck/*` is gated: a car-only manager who
 * deep-links into a truck driver would otherwise be handed a back button that
 * bounces them at the truck layout.
 */
export async function driverRosterRef(
  actor: AuthContext,
  driverUserId: string,
): Promise<DriverRosterRef> {
  if (
    (await isTruckDriver(actor.entId, driverUserId)) &&
    (await hasFleet(actor, 'TRUCK'))
  ) {
    return { href: '/truck/drivers', dept: 'TRUCK' };
  }
  return { href: '/drivers', dept: 'CAR' };
}
