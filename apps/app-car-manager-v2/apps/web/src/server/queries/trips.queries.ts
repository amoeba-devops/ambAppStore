import 'server-only';
import { and, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carDrivers,
  carTrips,
  carTripStopovers,
  carUsers,
  carVehicles,
  type CarTrip,
  type CarTripStatus,
} from '@car-v2/db/schema';
import type { LocalRole } from '@car-v2/shared/auth';
import { getDriverByUserId } from './drivers.queries';

export interface TripListItem extends CarTrip {
  passengerName: string | null;
  driverName: string | null;
  vehiclePlate: string | null;
}

const PAGE_SIZE = 20;

interface ListInput {
  entId: string;
  role: LocalRole;
  userId: string;
  status?: CarTripStatus | 'all' | 'pending' | 'active' | 'completed';
  page?: number;
}

export async function listTrips({
  entId,
  role,
  userId,
  status = 'all',
  page = 1,
}: ListInput): Promise<{ items: TripListItem[]; total: number; page: number; pageSize: number }> {
  /* Per PRD R-3 (REQ §3.7): Admin sees all, Manager sees own (creator OR passenger),
   * Driver sees only trips assigned to them. */
  const filters: SQL[] = [eq(carTrips.entId, entId), isNull(carTrips.trpDeletedAt)];

  if (role === 'MANAGER') {
    const visibility = or(eq(carTrips.trpCreatorId, userId), eq(carTrips.trpPassengerId, userId));
    if (visibility) filters.push(visibility);
  } else if (role === 'DRIVER') {
    const driver = await getDriverByUserId(entId, userId);
    if (!driver) return { items: [], total: 0, page, pageSize: PAGE_SIZE };
    filters.push(eq(carTrips.trpDriverId, driver.drvId));
  }

  /* Status filter chips */
  const statusFilter = statusToWhere(status);
  if (statusFilter) filters.push(statusFilter);

  const passengerUsers = carUsers;
  const driverUsers = sql<string | null>`drv_user.usr_name`;

  const rowsPromise = db
    .select({
      trip: carTrips,
      passengerName: passengerUsers.usrName,
      driverName: driverUsers,
      vehiclePlate: carVehicles.cvhPlateNumber,
    })
    .from(carTrips)
    .leftJoin(passengerUsers, eq(carTrips.trpPassengerId, passengerUsers.usrId))
    .leftJoin(carDrivers, eq(carTrips.trpDriverId, carDrivers.drvId))
    .leftJoin(sql`car_users AS drv_user`, sql`car_drivers.drv_user_id = drv_user.usr_id`)
    .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
    .where(and(...filters))
    .orderBy(desc(carTrips.trpScheduledAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const countPromise = db
    .select({ count: sql<number>`count(*)::int` })
    .from(carTrips)
    .where(and(...filters));

  const [rows, countRows] = await Promise.all([rowsPromise, countPromise]);

  const items: TripListItem[] = rows.map((r) => ({
    ...r.trip,
    passengerName: r.passengerName ?? null,
    driverName: r.driverName ?? null,
    vehiclePlate: r.vehiclePlate ?? null,
  }));

  return {
    items,
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize: PAGE_SIZE,
  };
}

/**
 * Lightweight count of trips currently in a "pending" state for this user's
 * visibility scope. Used by the sidebar to show a badge on the Trips nav item.
 *
 * PRD R-3 visibility rules apply (Admin all, Manager own, Driver assigned).
 * Pending = PENDING_ASSIGNMENT ∪ PENDING_DRIVER_CONFIRMATION (same set as the
 * `pending` filter chip on the list page so the number matches).
 */
export async function countPendingTrips(args: {
  entId: string;
  role: LocalRole;
  userId: string;
}): Promise<number> {
  const { entId, role, userId } = args;
  const filters: SQL[] = [
    eq(carTrips.entId, entId),
    isNull(carTrips.trpDeletedAt),
    inArray(carTrips.trpStatus, ['PENDING_ASSIGNMENT', 'PENDING_DRIVER_CONFIRMATION']),
  ];

  if (role === 'MANAGER') {
    const visibility = or(eq(carTrips.trpCreatorId, userId), eq(carTrips.trpPassengerId, userId));
    if (visibility) filters.push(visibility);
  } else if (role === 'DRIVER') {
    const driver = await getDriverByUserId(entId, userId);
    if (!driver) return 0;
    filters.push(eq(carTrips.trpDriverId, driver.drvId));
  }

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(carTrips)
    .where(and(...filters));
  return Number(rows[0]?.count ?? 0);
}

function statusToWhere(status: ListInput['status']): SQL | null {
  switch (status) {
    case 'all':
    case undefined:
      return null;
    case 'pending':
      return inArray(carTrips.trpStatus, ['PENDING_ASSIGNMENT', 'PENDING_DRIVER_CONFIRMATION']);
    case 'active':
      return inArray(carTrips.trpStatus, ['CONFIRMED', 'IN_PROGRESS']);
    case 'completed':
      return eq(carTrips.trpStatus, 'COMPLETED');
    default:
      return eq(carTrips.trpStatus, status);
  }
}

export interface TripDetail extends TripListItem {
  passengerEmail: string | null;
  driverPhone: string | null;
  vehicleModel: string | null;
  stopovers: { address: string; order: number }[];
}

export async function getTrip(entId: string, id: string): Promise<TripDetail | null> {
  const result = await db
    .select({
      trip: carTrips,
      passengerName: carUsers.usrName,
      passengerEmail: carUsers.usrEmail,
      driver: carDrivers,
      driverName: sql<string | null>`drv_user.usr_name`,
      vehicle: carVehicles,
    })
    .from(carTrips)
    .leftJoin(carUsers, eq(carTrips.trpPassengerId, carUsers.usrId))
    .leftJoin(carDrivers, eq(carTrips.trpDriverId, carDrivers.drvId))
    .leftJoin(sql`car_users AS drv_user`, sql`car_drivers.drv_user_id = drv_user.usr_id`)
    .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
    .where(
      and(
        eq(carTrips.trpId, id),
        eq(carTrips.entId, entId),
        isNull(carTrips.trpDeletedAt),
      ),
    )
    .limit(1);

  const row = result[0];
  if (!row) return null;

  const stops = await db
    .select({ address: carTripStopovers.tstAddress, order: carTripStopovers.tstOrder })
    .from(carTripStopovers)
    .where(eq(carTripStopovers.tstTripId, id))
    .orderBy(carTripStopovers.tstOrder);

  return {
    ...row.trip,
    passengerName: row.passengerName ?? null,
    passengerEmail: row.passengerEmail ?? null,
    driverName: row.driverName ?? null,
    driverPhone: row.driver?.drvPhone ?? null,
    vehiclePlate: row.vehicle?.cvhPlateNumber ?? null,
    vehicleModel: row.vehicle?.cvhModel ?? null,
    stopovers: stops,
  };
}

/* Vehicle + driver detail pages need history */
export async function listTripsForVehicle(entId: string, vehicleId: string, limit = 10): Promise<TripListItem[]> {
  const rows = await db
    .select({
      trip: carTrips,
      passengerName: carUsers.usrName,
      driverName: sql<string | null>`drv_user.usr_name`,
      vehiclePlate: carVehicles.cvhPlateNumber,
    })
    .from(carTrips)
    .leftJoin(carUsers, eq(carTrips.trpPassengerId, carUsers.usrId))
    .leftJoin(carDrivers, eq(carTrips.trpDriverId, carDrivers.drvId))
    .leftJoin(sql`car_users AS drv_user`, sql`car_drivers.drv_user_id = drv_user.usr_id`)
    .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
    .where(
      and(
        eq(carTrips.entId, entId),
        eq(carTrips.trpVehicleId, vehicleId),
        isNull(carTrips.trpDeletedAt),
      ),
    )
    .orderBy(desc(carTrips.trpScheduledAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r.trip,
    passengerName: r.passengerName ?? null,
    driverName: r.driverName ?? null,
    vehiclePlate: r.vehiclePlate ?? null,
  }));
}

export async function listTripsForDriver(entId: string, driverId: string, limit = 10): Promise<TripListItem[]> {
  const rows = await db
    .select({
      trip: carTrips,
      passengerName: carUsers.usrName,
      driverName: sql<string | null>`drv_user.usr_name`,
      vehiclePlate: carVehicles.cvhPlateNumber,
    })
    .from(carTrips)
    .leftJoin(carUsers, eq(carTrips.trpPassengerId, carUsers.usrId))
    .leftJoin(carDrivers, eq(carTrips.trpDriverId, carDrivers.drvId))
    .leftJoin(sql`car_users AS drv_user`, sql`car_drivers.drv_user_id = drv_user.usr_id`)
    .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
    .where(
      and(
        eq(carTrips.entId, entId),
        eq(carTrips.trpDriverId, driverId),
        isNull(carTrips.trpDeletedAt),
      ),
    )
    .orderBy(desc(carTrips.trpScheduledAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r.trip,
    passengerName: r.passengerName ?? null,
    driverName: r.driverName ?? null,
    vehiclePlate: r.vehiclePlate ?? null,
  }));
}
