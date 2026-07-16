import 'server-only';
import { and, asc, eq, ilike, inArray, isNotNull, isNull, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carDrivers,
  carUsers,
  carUserFleetAccess,
  type CarDriver,
  type CarUser,
  type CarVehicleType,
} from '@car-v2/db/schema';

export interface DriverWithUser extends CarDriver {
  user: Pick<CarUser, 'usrName' | 'usrEmail'>;
  /** True if soft-deleted (for filter 'all' or 'deleted'). */
  isDeleted?: boolean;
}

/** Whether a driver's user has a live TRUCK fleet membership — drives the
 * dept-specific salary field on the shared edit form. */
export async function isTruckDriver(entId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: carUserFleetAccess.ufaId })
    .from(carUserFleetAccess)
    .where(
      and(
        eq(carUserFleetAccess.entId, entId),
        eq(carUserFleetAccess.usrId, userId),
        eq(carUserFleetAccess.ufaVehicleType, 'TRUCK'),
        isNull(carUserFleetAccess.ufaDeletedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Filter type for listing drivers. */
type DriverListFilter = 'active' | 'deleted' | 'all';

/**
 * Active drivers belonging to one fleet department (REQ-20260622 audit G5).
 * Joins the per-user fleet membership so the Xe tải workspace shows only its
 * own drivers instead of the whole CCMS roster.
 */
export async function listFleetDrivers(
  entId: string,
  dept: CarVehicleType,
): Promise<DriverWithUser[]> {
  const rows = await db
    .select({
      driver: carDrivers,
      user: { usrName: carUsers.usrName, usrEmail: carUsers.usrEmail },
    })
    .from(carDrivers)
    .innerJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .innerJoin(
      carUserFleetAccess,
      and(
        eq(carUserFleetAccess.usrId, carDrivers.drvUserId),
        eq(carUserFleetAccess.entId, entId),
        eq(carUserFleetAccess.ufaVehicleType, dept),
        isNull(carUserFleetAccess.ufaDeletedAt),
      ),
    )
    .where(and(eq(carDrivers.entId, entId), isNull(carDrivers.drvDeletedAt)))
    /* Stable order: name, then drvId as tiebreaker so same-named drivers keep a
     * deterministic position across reloads (QA "2 lists lúc này lúc kia"). */
    .orderBy(asc(carUsers.usrName), asc(carDrivers.drvId));

  return rows.map((r) => ({ ...r.driver, user: r.user, isDeleted: false }));
}

/**
 * Drivers in the tenant who do NOT have a live TRUCK fleet membership — used by
 * CAR-side driver pickers (trip assignment) so a car trip can't pick a truck
 * driver. Unlike TRUCK (explicit membership), car/untagged drivers stay visible
 * because the car create flow doesn't grant a CAR membership row (BUG-260624).
 */
export async function listNonTruckDrivers(entId: string): Promise<DriverWithUser[]> {
  const rows = await db
    .select({
      driver: carDrivers,
      user: { usrName: carUsers.usrName, usrEmail: carUsers.usrEmail },
    })
    .from(carDrivers)
    .innerJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .where(
      and(
        eq(carDrivers.entId, entId),
        isNull(carDrivers.drvDeletedAt),
        sql`NOT EXISTS (
          SELECT 1 FROM car_user_fleet_access f
          WHERE f.usr_id = ${carDrivers.drvUserId}
            AND f.ent_id = ${entId}
            AND f.ufa_vehicle_type = 'TRUCK'
            AND f.ufa_deleted_at IS NULL
        )`,
      ),
    )
    .orderBy(asc(carUsers.usrName));

  return rows.map((r) => ({ ...r.driver, user: r.user, isDeleted: false }));
}

/** List drivers trong 1 tenant, optional free-text search trên tên/email/license/phone.
 *  Ent_id filter là bắt buộc (multi-tenancy).
 *  @param filter - 'active' (default), 'deleted', or 'all' */
export async function listDrivers(
  entId: string,
  q?: string,
  filter: DriverListFilter = 'active',
): Promise<DriverWithUser[]> {
  const filters: SQL[] = [eq(carDrivers.entId, entId)];

  // Apply deleted filter
  if (filter === 'active') {
    filters.push(isNull(carDrivers.drvDeletedAt));
  } else if (filter === 'deleted') {
    filters.push(isNotNull(carDrivers.drvDeletedAt));
  }
  // 'all' - no deleted filter, show both

  const term = q?.trim();
  if (term) {
    const like = `%${term}%`;
    const searchFilter = or(
      ilike(carUsers.usrName, like),
      ilike(carUsers.usrEmail, like),
      ilike(carDrivers.drvLicenseNumber, like),
      ilike(carDrivers.drvPhone, like),
    );
    if (searchFilter) filters.push(searchFilter);
  }

  const rows = await db
    .select({
      driver: carDrivers,
      user: { usrName: carUsers.usrName, usrEmail: carUsers.usrEmail },
    })
    .from(carDrivers)
    .innerJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .where(and(...filters))
    .orderBy(asc(carUsers.usrName));

  return rows.map((r) => ({
    ...r.driver,
    user: r.user,
    isDeleted: r.driver.drvDeletedAt !== null,
  }));
}

export async function getDriver(entId: string, id: string): Promise<DriverWithUser | null> {
  const row = await db
    .select({
      driver: carDrivers,
      user: { usrName: carUsers.usrName, usrEmail: carUsers.usrEmail },
    })
    .from(carDrivers)
    .innerJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .where(
      and(
        eq(carDrivers.drvId, id),
        eq(carDrivers.entId, entId),
        isNull(carDrivers.drvDeletedAt),
      ),
    )
    .limit(1);
  if (!row[0]) return null;
  return { ...row[0].driver, user: row[0].user };
}

/**
 * Look up a driver by id regardless of soft-delete or fleet-access status —
 * used to display a stale `cvh_default_driver_id` reference (a vehicle's
 * saved default driver who has since been removed or lost department access)
 * instead of silently rendering blank.
 */
export async function getDriverAnyStatus(entId: string, id: string): Promise<DriverWithUser | null> {
  const row = await db
    .select({
      driver: carDrivers,
      user: { usrName: carUsers.usrName, usrEmail: carUsers.usrEmail },
    })
    .from(carDrivers)
    .innerJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .where(and(eq(carDrivers.drvId, id), eq(carDrivers.entId, entId)))
    .limit(1);
  if (!row[0]) return null;
  return { ...row[0].driver, user: row[0].user, isDeleted: row[0].driver.drvDeletedAt !== null };
}

/**
 * Resolve display names for a set of driver ids in one query — used by the truck
 * roster to show each vehicle's default driver without an N+1 lookup. Ignores
 * soft-delete / fleet-access status so a still-linked (but stale) driver renders
 * a name; unlinked vehicles simply have no entry (caller shows empty).
 */
export async function getDriverNamesByIds(entId: string, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      drvId: carDrivers.drvId,
      usrName: carUsers.usrName,
      usrEmail: carUsers.usrEmail,
    })
    .from(carDrivers)
    .innerJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .where(and(eq(carDrivers.entId, entId), inArray(carDrivers.drvId, ids)));

  const map = new Map<string, string>();
  for (const r of rows) map.set(r.drvId, r.usrName ?? r.usrEmail ?? r.drvId);
  return map;
}

/** Look up a driver row by the underlying user (used to enforce driver self-actions). */
export async function getDriverByUserId(entId: string, userId: string): Promise<CarDriver | null> {
  const row = await db.query.carDrivers.findFirst({
    where: and(
      eq(carDrivers.drvUserId, userId),
      eq(carDrivers.entId, entId),
      isNull(carDrivers.drvDeletedAt),
    ),
  });
  return row ?? null;
}

/**
 * Users in this tenant who can become a driver — i.e. role=DRIVER (or MEMBER if
 * not yet mapped) and not already linked to a live car_drivers row.
 * Used to populate the driver-create form's user select.
 */
export async function listDriverCandidates(entId: string): Promise<Pick<CarUser, 'usrId' | 'usrName' | 'usrEmail'>[]> {
  const alreadyLinked = await db
    .select({ id: carDrivers.drvUserId })
    .from(carDrivers)
    .where(and(eq(carDrivers.entId, entId), isNull(carDrivers.drvDeletedAt)));
  const linkedIds = alreadyLinked.map((r) => r.id);

  const candidates = await db
    .select({ usrId: carUsers.usrId, usrName: carUsers.usrName, usrEmail: carUsers.usrEmail })
    .from(carUsers)
    .where(
      and(
        eq(carUsers.entId, entId),
        isNull(carUsers.usrDeletedAt),
        linkedIds.length > 0 ? notInArray(carUsers.usrId, linkedIds) : sql`true`,
      ),
    )
    .orderBy(asc(carUsers.usrName));
  return candidates;
}
