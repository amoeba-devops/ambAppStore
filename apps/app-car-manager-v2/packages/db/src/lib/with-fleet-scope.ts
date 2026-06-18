import { inArray, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * Constrain a CAR/TRUCK fleet-discriminator column (e.g. `car_vehicles.cvh_type`)
 * to the departments the current user may see. Complements `withEnt` — entity
 * scope is always applied first; this narrows further by department.
 *
 * An empty department list (user has no fleet access at all) yields an
 * always-false predicate so the query returns nothing — never an unscoped read.
 */
export function withFleetScope(
  typeColumn: PgColumn,
  departments: readonly string[],
): SQL {
  if (departments.length === 0) return sql`false`;
  return inArray(typeColumn, departments as string[]);
}
