import 'server-only';
import { and, asc, eq, isNull, notInArray, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carDrivers, carUsers, type CarDriver, type CarUser } from '@car-v2/db/schema';

export interface DriverWithUser extends CarDriver {
  user: Pick<CarUser, 'usrName' | 'usrEmail'>;
}

export async function listDrivers(entId: string): Promise<DriverWithUser[]> {
  const rows = await db
    .select({
      driver: carDrivers,
      user: { usrName: carUsers.usrName, usrEmail: carUsers.usrEmail },
    })
    .from(carDrivers)
    .innerJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .where(and(eq(carDrivers.entId, entId), isNull(carDrivers.drvDeletedAt)))
    .orderBy(asc(carUsers.usrName));

  return rows.map((r) => ({ ...r.driver, user: r.user }));
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
