import 'server-only';
import { and, asc, eq, ilike, isNotNull, isNull, notInArray, or, sql, type SQL } from 'drizzle-orm';
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
