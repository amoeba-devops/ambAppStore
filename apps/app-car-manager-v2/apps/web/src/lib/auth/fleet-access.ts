import 'server-only';
import { cache } from 'react';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carUserFleetAccess, type CarVehicleType } from '@car-v2/db/schema';
import { CarError } from '@car-v2/shared/errors';
import type { LocalRole } from '@car-v2/shared/auth';
import type { AuthContext } from './get-current-user';

/** A fleet department === the vehicle-type discriminator (CAR | TRUCK). */
export type FleetDepartment = CarVehicleType;

/** Canonical order — CAR before TRUCK — for predictable default/switcher UI. */
export const ALL_FLEET_DEPARTMENTS: readonly FleetDepartment[] = ['CAR', 'TRUCK'];

/**
 * Departments the user may enter:
 *   - ADMIN  → both, implicitly (no membership rows required).
 *   - others → live rows in car_user_fleet_access.
 *
 * Keyed on primitives (not the AuthContext object) so React `cache()` dedupes
 * across the many getCurrentUser() calls in a single request — getCurrentUser
 * itself returns a fresh object each time, so an object key would never hit.
 */
const resolveFleetAccessCached = cache(
  async (entId: string, userId: string, role: LocalRole): Promise<FleetDepartment[]> => {
    if (role === 'ADMIN') return [...ALL_FLEET_DEPARTMENTS];

    const rows = await db
      .select({ type: carUserFleetAccess.ufaVehicleType })
      .from(carUserFleetAccess)
      .where(
        and(
          eq(carUserFleetAccess.entId, entId),
          eq(carUserFleetAccess.usrId, userId),
          isNull(carUserFleetAccess.ufaDeletedAt),
        ),
      );

    return ALL_FLEET_DEPARTMENTS.filter((d) => rows.some((r) => r.type === d));
  },
);

export function resolveFleetAccess(actor: AuthContext): Promise<FleetDepartment[]> {
  return resolveFleetAccessCached(actor.entId, actor.userId, actor.role);
}

export async function hasFleet(actor: AuthContext, type: FleetDepartment): Promise<boolean> {
  return (await resolveFleetAccess(actor)).includes(type);
}

/**
 * Enforce that the user has access to a fleet department. Throws CAR-E0403.
 * Mirrors `requireRole()` from get-current-user.ts. ADMIN always passes.
 */
export async function requireFleet(actor: AuthContext, type: FleetDepartment): Promise<void> {
  if (!(await hasFleet(actor, type))) {
    throw new CarError('CAR-E0403', 403, `Forbidden: no access to ${type} fleet`);
  }
}
