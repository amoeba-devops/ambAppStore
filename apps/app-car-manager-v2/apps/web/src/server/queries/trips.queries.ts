import 'server-only';
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carDrivers,
  carTrips,
  carTripStopovers,
  carUsers,
  carVehicles,
  type CarTrip,
  type CarTripKind,
  type CarTripStatus,
} from '@car-v2/db/schema';
import { CarError } from '@car-v2/shared/errors';
import type { LocalRole } from '@car-v2/shared/auth';
import { getDriverByUserId } from './drivers.queries';

const CALENDAR_RANGE_CAP = 500;

export interface TripListItem extends CarTrip {
  passengerName: string | null;
  driverName: string | null;
  vehiclePlate: string | null;
  /** True when the trip is soft-deleted (for list display styling) */
  isDeleted: boolean;
}

export type TripDeletedFilter = 'active' | 'deleted' | 'all';

const PAGE_SIZE = 20;

export type TripDateRange = 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'past';

interface ListInput {
  entId: string;
  role: LocalRole;
  userId: string;
  status?: CarTripStatus | 'all' | 'pending' | 'active' | 'completed';
  /** Free-text search: ref, pickup, dropoff, purpose, passenger name. ILIKE %q%. */
  q?: string;
  /** Date range filter dựa trên trpScheduledAt. Mặc định 'all'. */
  dateRange?: TripDateRange;
  page?: number;
  /** Filter by soft-deleted status. Mặc định 'active' (chỉ hiện trip chưa xóa). */
  deletedFilter?: TripDeletedFilter;
  /** Restrict to one fleet's trips: 'DISPATCH' (car) | 'LOG' (truck cargo).
   *  Omit for both. Car-workspace screens pass 'DISPATCH' so the truck trip log
   *  stays in /truck/trips (REQ-20260617). */
  kind?: CarTripKind;
}

export async function listTrips({
  entId,
  role,
  userId,
  status = 'all',
  q,
  dateRange = 'all',
  page = 1,
  deletedFilter = 'active',
  kind,
}: ListInput): Promise<{ items: TripListItem[]; total: number; page: number; pageSize: number }> {
  /* Admin AND Manager see the whole fleet's trips (Manager is staff, same
   * scope as Admin — only the /users, /audit, /settings admin-management
   * screens stay Admin-only). Driver sees only trips assigned to them. */
  const filters: SQL[] = [eq(carTrips.entId, entId)];

  if (kind) filters.push(eq(carTrips.trpKind, kind));

  /* Soft-delete filter: 'active' only shows live trips, 'deleted' only shows
   * soft-deleted, 'all' shows both. Default 'active' for normal operations. */
  if (deletedFilter === 'active') {
    filters.push(isNull(carTrips.trpDeletedAt));
  } else if (deletedFilter === 'deleted') {
    filters.push(sql`${carTrips.trpDeletedAt} IS NOT NULL`);
  }
  /* 'all' includes both — no filter on trpDeletedAt */

  if (role === 'DRIVER') {
    const driver = await getDriverByUserId(entId, userId);
    if (!driver) return { items: [], total: 0, page, pageSize: PAGE_SIZE };
    filters.push(eq(carTrips.trpDriverId, driver.drvId));
  }

  /* Status filter chips */
  const statusFilter = statusToWhere(status);
  if (statusFilter) filters.push(statusFilter);

  /* Free-text search: prefix `%q%` để match anywhere. Postgres ILIKE
   * case-insensitive. Join với carUsers (passenger) đã có ở SELECT bên dưới,
   * nên có thể search passenger name. */
  const term = q?.trim();
  if (term) {
    const like = `%${term}%`;
    const searchFilter = or(
      ilike(carTrips.trpRef, like),
      ilike(carTrips.trpPickupAddress, like),
      ilike(carTrips.trpDropoffAddress, like),
      ilike(carTrips.trpPurpose, like),
      ilike(carUsers.usrName, like),
    );
    if (searchFilter) filters.push(searchFilter);
  }

  /* Date range filter dựa trên trpScheduledAt */
  const dateFilter = dateRangeToWhere(dateRange);
  if (dateFilter) filters.push(dateFilter);

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

  /* count query must include passenger join because search filter references
   * carUsers.usrName. Trip→user is 1:1 nullable, so left join doesn't inflate
   * the row count. */
  const countPromise = db
    .select({ count: sql<number>`count(*)::int` })
    .from(carTrips)
    .leftJoin(passengerUsers, eq(carTrips.trpPassengerId, passengerUsers.usrId))
    .where(and(...filters));

  const [rows, countRows] = await Promise.all([rowsPromise, countPromise]);

  const items: TripListItem[] = rows.map((r) => ({
    ...r.trip,
    passengerName: r.passengerName ?? null,
    driverName: r.driverName ?? null,
    vehiclePlate: r.vehiclePlate ?? null,
    isDeleted: r.trip.trpDeletedAt !== null,
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
 * Admin and Manager share the same fleet-wide scope; Driver is restricted to
 * trips assigned to them. Pending = PENDING_ASSIGNMENT ∪ PENDING_DRIVER_CONFIRMATION
 * (same set as the `pending` filter chip on the list page so the number matches).
 */
export async function countPendingTrips(args: {
  entId: string;
  role: LocalRole;
  userId: string;
  kind?: CarTripKind;
}): Promise<number> {
  const { entId, role, userId, kind } = args;
  const filters: SQL[] = [
    eq(carTrips.entId, entId),
    isNull(carTrips.trpDeletedAt),
    inArray(carTrips.trpStatus, ['PENDING_ASSIGNMENT', 'PENDING_DRIVER_CONFIRMATION']),
  ];

  if (kind) filters.push(eq(carTrips.trpKind, kind));

  if (role === 'DRIVER') {
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

/**
 * Trip rows whose `trp_scheduled_at` falls within `[rangeStart, rangeEnd)`.
 *
 * - No pagination — calendar UI needs the whole range at once.
 * - Hard cap at 500 rows; over that we throw `CAR-E0413` so the UI can prompt
 *   the user to narrow the range (CLAUDE.md §4.4 error code convention).
 * - Visibility: Admin AND Manager see the full fleet schedule (the dashboard
 *   calendar is a shared dispatch board — Manager needs whole-fleet context to
 *   plan around other trips). Driver never reaches this query anyway: the page
 *   redirects them to `/today` first.
 */
export async function listTripsForCalendar(args: {
  entId: string;
  role: LocalRole;
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
  kind?: CarTripKind;
}): Promise<TripListItem[]> {
  const { entId, role, userId, rangeStart, rangeEnd, kind } = args;
  const filters: SQL[] = [
    eq(carTrips.entId, entId),
    isNull(carTrips.trpDeletedAt),
    gte(carTrips.trpScheduledAt, rangeStart),
    lt(carTrips.trpScheduledAt, rangeEnd),
  ];

  if (kind) filters.push(eq(carTrips.trpKind, kind));

  if (role === 'DRIVER') {
    const driver = await getDriverByUserId(entId, userId);
    if (!driver) return [];
    filters.push(eq(carTrips.trpDriverId, driver.drvId));
  }

  const passengerUsers = carUsers;
  const driverUsers = sql<string | null>`drv_user.usr_name`;

  const rows = await db
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
    .orderBy(asc(carTrips.trpScheduledAt))
    .limit(CALENDAR_RANGE_CAP + 1);

  if (rows.length > CALENDAR_RANGE_CAP) {
    throw new CarError('CAR-E0413', 413, 'Calendar range exceeds 500 trips — narrow the range');
  }

  return rows.map((r) => ({
    ...r.trip,
    passengerName: r.passengerName ?? null,
    driverName: r.driverName ?? null,
    vehiclePlate: r.vehiclePlate ?? null,
    isDeleted: false, // Calendar only shows live trips
  }));
}

const BOARD_CAP = 300;

/**
 * Trips for the Kanban board on `/trips`.
 *
 * Unlike `listTrips`, the board needs the WHOLE filtered set (no 20-row
 * pagination) because every status column must be populated at once. We
 * deliberately drop the status-bucket filter — columns ARE the statuses — but
 * keep Driver's own-scope restriction + free-text search + date range so the
 * board mirrors what the list view would show under the same q/date.
 *
 * Hard cap at {@link BOARD_CAP}: a 3-vehicle fleet (PRD) never approaches it,
 * but we return `capped` so the UI can surface a "narrow the range" hint
 * instead of silently truncating (CLAUDE.md — no silent caps).
 */
export async function listTripsForBoard(args: {
  entId: string;
  role: LocalRole;
  userId: string;
  q?: string;
  dateRange?: TripDateRange;
  deletedFilter?: TripDeletedFilter;
  kind?: CarTripKind;
}): Promise<{ items: TripListItem[]; capped: boolean }> {
  const { entId, role, userId, q, dateRange = 'all', deletedFilter = 'active', kind } = args;
  const filters: SQL[] = [eq(carTrips.entId, entId)];

  if (kind) filters.push(eq(carTrips.trpKind, kind));

  /* Soft-delete filter: 'active' only shows live trips, 'deleted' only shows
   * soft-deleted, 'all' shows both. Default 'active' for normal operations. */
  if (deletedFilter === 'active') {
    filters.push(isNull(carTrips.trpDeletedAt));
  } else if (deletedFilter === 'deleted') {
    filters.push(sql`${carTrips.trpDeletedAt} IS NOT NULL`);
  }
  /* 'all' includes both — no filter on trpDeletedAt */

  if (role === 'DRIVER') {
    const driver = await getDriverByUserId(entId, userId);
    if (!driver) return { items: [], capped: false };
    filters.push(eq(carTrips.trpDriverId, driver.drvId));
  }

  const passengerUsers = carUsers;
  const driverUsers = sql<string | null>`drv_user.usr_name`;

  const term = q?.trim();
  if (term) {
    const like = `%${term}%`;
    const searchFilter = or(
      ilike(carTrips.trpRef, like),
      ilike(carTrips.trpPickupAddress, like),
      ilike(carTrips.trpDropoffAddress, like),
      ilike(carTrips.trpPurpose, like),
      ilike(passengerUsers.usrName, like),
    );
    if (searchFilter) filters.push(searchFilter);
  }

  const dateFilter = dateRangeToWhere(dateRange);
  if (dateFilter) filters.push(dateFilter);

  const rows = await db
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
    .limit(BOARD_CAP + 1);

  const capped = rows.length > BOARD_CAP;
  const items: TripListItem[] = rows.slice(0, BOARD_CAP).map((r) => ({
    ...r.trip,
    passengerName: r.passengerName ?? null,
    driverName: r.driverName ?? null,
    vehiclePlate: r.vehiclePlate ?? null,
    isDeleted: r.trip.trpDeletedAt !== null,
  }));

  return { items, capped };
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

function dateRangeToWhere(range: TripDateRange): SQL | null {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    return and(gte(carTrips.trpScheduledAt, start), lt(carTrips.trpScheduledAt, end)) ?? null;
  }
  if (range === 'thisWeek') {
    /* Week starts Monday (vi locale convention). */
    const start = new Date(now);
    const dow = start.getDay(); // 0=Sun..6=Sat
    const offsetToMon = dow === 0 ? -6 : 1 - dow;
    start.setDate(start.getDate() + offsetToMon);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return and(gte(carTrips.trpScheduledAt, start), lt(carTrips.trpScheduledAt, end)) ?? null;
  }
  if (range === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return and(gte(carTrips.trpScheduledAt, start), lt(carTrips.trpScheduledAt, end)) ?? null;
  }
  if (range === 'past') {
    return lt(carTrips.trpScheduledAt, now);
  }
  return null;
}

export interface TripDetail extends TripListItem {
  passengerEmail: string | null;
  driverPhone: string | null;
  vehicleModel: string | null;
  stopovers: { address: string; order: number }[];
  /** Non-null when the assigned driver was soft-deleted after trip creation */
  driverDeletedAt: Date | null;
  /** Non-null when the assigned vehicle was soft-deleted after trip creation */
  vehicleDeletedAt: Date | null;
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
    isDeleted: row.trip.trpDeletedAt !== null,
    /* Soft-delete awareness: if the trip still has a FK reference but the
     * related entity was soft-deleted, surface the deletion timestamp so
     * UI can show a warning badge instead of just "Not assigned". */
    driverDeletedAt: row.driver?.drvDeletedAt ?? null,
    vehicleDeletedAt: row.vehicle?.cvhDeletedAt ?? null,
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
    isDeleted: false, // Vehicle history only shows live trips
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
    isDeleted: false, // Driver history only shows live trips
  }));
}
