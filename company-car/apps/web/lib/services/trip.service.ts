import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  drivers,
  systemSettings,
  trips,
  users,
  vehicles,
  type DbTrip,
} from '@/lib/db/schema';
import {
  type CreateTripInput,
  type Location,
  type TripStatus,
} from '@repo/api-types';
import { HttpError } from '@/lib/api/response';
import { buildMapsUrl } from '@/lib/maps/google-maps-url';

const DEFAULT_TRIP_DURATION_HOURS = 4;

// ============================================================================
// Helpers
// ============================================================================
function tripDateTimeToDate(date: string, time: string): Date {
  // Treat as local Asia/Ho_Chi_Minh and convert to UTC.
  // Simple approach: append the offset.
  return new Date(`${date}T${time}:00+07:00`);
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 60 * 60 * 1000);
}

async function getTripDurationHours(): Promise<number> {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'default_trip_duration_hours'))
    .limit(1);
  const v = row?.value;
  if (typeof v === 'number') return v;
  return DEFAULT_TRIP_DURATION_HOURS;
}

// ============================================================================
// Conflict check  (PRD §5.2)
// ============================================================================
export type ConflictItem = {
  type: 'vehicle' | 'driver';
  tripId: string;
  vehicleId: string;
  driverId: string;
  passengerName: string;
  tripDate: string;
  tripTime: string;
  estimatedEndTime: string | null;
  status: TripStatus;
};

export async function findConflicts(args: {
  vehicleId?: string;
  driverId?: string;
  date: string;
  time: string;
  durationHours?: number;
  excludeTripId?: string;
}): Promise<ConflictItem[]> {
  const { vehicleId, driverId, date, time, excludeTripId } = args;
  if (!vehicleId && !driverId) return [];

  const duration = args.durationHours ?? (await getTripDurationHours());
  const startA = tripDateTimeToDate(date, time);
  const endA = addHours(startA, duration);

  // Pull candidate trips for the same date with relevant vehicle/driver.
  const conditions = [
    eq(trips.tripDate, date),
    inArray(trips.status, ['PENDING_DRIVER_CONFIRM', 'CONFIRMED', 'IN_PROGRESS'] as const),
  ];
  if (excludeTripId) conditions.push(ne(trips.id, excludeTripId));

  const orFilters = [];
  if (vehicleId) orFilters.push(eq(trips.vehicleId, vehicleId));
  if (driverId) orFilters.push(eq(trips.driverId, driverId));
  conditions.push(or(...orFilters)!);

  const candidates = await db
    .select({
      trip: trips,
      passengerName: users.fullName,
    })
    .from(trips)
    .innerJoin(users, eq(users.id, trips.passengerId))
    .where(and(...conditions));

  const conflicts: ConflictItem[] = [];
  for (const { trip, passengerName } of candidates) {
    const startB = tripDateTimeToDate(trip.tripDate, trip.tripTime.slice(0, 5));
    const endTimeStr = trip.estimatedEndTime?.slice(0, 5);
    const endB = endTimeStr
      ? tripDateTimeToDate(trip.tripDate, endTimeStr)
      : addHours(startB, duration);

    const overlap = startA < endB && startB < endA;
    if (!overlap) continue;

    if (vehicleId && trip.vehicleId === vehicleId) {
      conflicts.push({
        type: 'vehicle',
        tripId: trip.id,
        vehicleId: trip.vehicleId,
        driverId: trip.driverId,
        passengerName,
        tripDate: trip.tripDate,
        tripTime: trip.tripTime.slice(0, 5),
        estimatedEndTime: endTimeStr ?? null,
        status: trip.status,
      });
    }
    if (driverId && trip.driverId === driverId) {
      conflicts.push({
        type: 'driver',
        tripId: trip.id,
        vehicleId: trip.vehicleId,
        driverId: trip.driverId,
        passengerName,
        tripDate: trip.tripDate,
        tripTime: trip.tripTime.slice(0, 5),
        estimatedEndTime: endTimeStr ?? null,
        status: trip.status,
      });
    }
  }
  return conflicts;
}

// ============================================================================
// Validation helpers
// ============================================================================
async function assertVehicleOk(vehicleId: string) {
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  if (!v) throw new HttpError(400, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
  if (v.status === 'MAINTENANCE') {
    throw new HttpError(400, 'VEHICLE_UNAVAILABLE', 'Vehicle is under maintenance (BR-02)');
  }
  if (v.status === 'INACTIVE') {
    throw new HttpError(400, 'VEHICLE_UNAVAILABLE', 'Vehicle is inactive');
  }
  return v;
}

async function assertDriverOk(driverId: string) {
  const [d] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
  if (!d) throw new HttpError(400, 'DRIVER_NOT_FOUND', 'Driver not found');
  if (d.status !== 'ACTIVE') {
    throw new HttpError(400, 'DRIVER_INACTIVE', 'Driver is inactive (BR-03)');
  }
  if (new Date(d.licenseExpiryDate) < new Date()) {
    throw new HttpError(400, 'LICENSE_EXPIRED', 'Driver license has expired (BR-03)');
  }
  return d;
}

async function assertPassengerOk(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw new HttpError(400, 'PASSENGER_NOT_FOUND', 'Passenger not found');
  if (u.status !== 'ACTIVE') {
    throw new HttpError(400, 'PASSENGER_INACTIVE', 'Passenger is inactive');
  }
  return u;
}

function assertNotInPast(date: string, time: string) {
  const start = tripDateTimeToDate(date, time);
  if (start.getTime() < Date.now()) {
    throw new HttpError(400, 'TRIP_IN_PAST', 'Trip date/time cannot be in the past (BR-01)');
  }
}

// ============================================================================
// Create
// ============================================================================
export async function createTrip(args: {
  input: CreateTripInput;
  createdBy: string;
  overrideConflict?: boolean;
  isAdmin?: boolean;
}) {
  const { input, createdBy, overrideConflict = false, isAdmin = false } = args;

  assertNotInPast(input.tripDate, input.tripTime);
  await Promise.all([
    assertPassengerOk(input.passengerId),
    assertDriverOk(input.driverId),
    assertVehicleOk(input.vehicleId),
  ]);

  const conflicts = await findConflicts({
    vehicleId: input.vehicleId,
    driverId: input.driverId,
    date: input.tripDate,
    time: input.tripTime,
  });

  if (conflicts.length > 0) {
    if (!overrideConflict || !isAdmin) {
      throw new HttpError(409, 'TRIP_CONFLICT', 'Trip conflicts with existing booking', {
        conflicts,
      });
    }
  }

  const mapsUrl = buildMapsUrl(input.pickupLocation, input.destination, input.stopovers);
  const duration = await getTripDurationHours();
  const startDate = tripDateTimeToDate(input.tripDate, input.tripTime);
  const endDate = addHours(startDate, duration);
  const estimatedEndTime = `${String(endDate.getUTCHours() + 7).padStart(2, '0')}:${String(endDate.getUTCMinutes()).padStart(2, '0')}`;

  const [created] = await db
    .insert(trips)
    .values({
      passengerId: input.passengerId,
      driverId: input.driverId,
      vehicleId: input.vehicleId,
      tripDate: input.tripDate,
      tripTime: `${input.tripTime}:00`,
      estimatedEndTime: estimatedEndTime.length <= 5 ? `${estimatedEndTime}:00` : estimatedEndTime,
      pickupLocation: input.pickupLocation as Location,
      destination: input.destination as Location,
      stopovers: input.stopovers as Location[],
      mapsUrl,
      note: input.note ?? null,
      status: 'PENDING_DRIVER_CONFIRM',
      createdBy,
    })
    .returning();

  if (!created) throw new HttpError(500, 'INSERT_FAILED', 'Failed to create trip');
  return created;
}

// ============================================================================
// List + Get
// ============================================================================
export type TripFilter = {
  from?: string;
  to?: string;
  driverId?: string;
  vehicleId?: string;
  passengerId?: string;
  status?: TripStatus;
  page?: number;
  limit?: number;
};

export async function listTrips(filter: TripFilter, viewer: { userId: string; role: 'ADMIN' | 'MANAGER' | 'DRIVER' }) {
  const conds = [];
  if (filter.from) conds.push(gte(trips.tripDate, filter.from));
  if (filter.to) conds.push(lte(trips.tripDate, filter.to));
  if (filter.driverId) conds.push(eq(trips.driverId, filter.driverId));
  if (filter.vehicleId) conds.push(eq(trips.vehicleId, filter.vehicleId));
  if (filter.passengerId) conds.push(eq(trips.passengerId, filter.passengerId));
  if (filter.status) conds.push(eq(trips.status, filter.status));

  // Authorization filtering — BR-06, BR-07
  if (viewer.role === 'MANAGER') {
    conds.push(or(eq(trips.passengerId, viewer.userId), eq(trips.createdBy, viewer.userId))!);
  } else if (viewer.role === 'DRIVER') {
    // Driver only sees trips where they are the assigned driver
    const [driverProfile] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.userId, viewer.userId))
      .limit(1);
    if (!driverProfile) return { items: [], total: 0 };
    conds.push(eq(trips.driverId, driverProfile.id));
  }

  const where = conds.length > 0 ? and(...conds) : undefined;
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 20;
  const offset = (page - 1) * limit;

  const [items, totalRows] = await Promise.all([
    db
      .select({
        trip: trips,
        passengerName: users.fullName,
        driverName: drivers.fullName,
        licensePlate: vehicles.licensePlate,
      })
      .from(trips)
      .innerJoin(users, eq(users.id, trips.passengerId))
      .innerJoin(drivers, eq(drivers.id, trips.driverId))
      .innerJoin(vehicles, eq(vehicles.id, trips.vehicleId))
      .where(where)
      .orderBy(desc(trips.tripDate), desc(trips.tripTime))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(trips).where(where),
  ]);

  return { items, total: totalRows[0]?.count ?? 0 };
}

export async function getTrip(id: string) {
  const [row] = await db
    .select({
      trip: trips,
      passenger: { id: users.id, fullName: users.fullName, email: users.email },
      driver: {
        id: drivers.id,
        fullName: drivers.fullName,
        licenseNumber: drivers.licenseNumber,
        phone: drivers.phone,
        userId: drivers.userId,
      },
      vehicle: {
        id: vehicles.id,
        licensePlate: vehicles.licensePlate,
        vehicleType: vehicles.vehicleType,
      },
    })
    .from(trips)
    .innerJoin(users, eq(users.id, trips.passengerId))
    .innerJoin(drivers, eq(drivers.id, trips.driverId))
    .innerJoin(vehicles, eq(vehicles.id, trips.vehicleId))
    .where(eq(trips.id, id))
    .limit(1);
  return row ?? null;
}

// ============================================================================
// Status transitions  (PRD §5.3)
// ============================================================================
const ALLOWED: Record<TripStatus, TripStatus[]> = {
  PENDING_DRIVER_CONFIRM: ['CONFIRMED', 'DRIVER_REJECTED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  DRIVER_REJECTED: ['PENDING_DRIVER_CONFIRM', 'CANCELLED'], // reassign moves back to pending
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: TripStatus, to: TripStatus): boolean {
  return ALLOWED[from].includes(to);
}

async function loadTripOrThrow(id: string): Promise<DbTrip> {
  const [t] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (!t) throw new HttpError(404, 'TRIP_NOT_FOUND', 'Trip not found');
  return t;
}

async function transitionTrip(
  id: string,
  to: TripStatus,
  patch: Partial<typeof trips.$inferInsert> = {},
): Promise<DbTrip> {
  const current = await loadTripOrThrow(id);
  if (!canTransition(current.status, to)) {
    throw new HttpError(
      409,
      'INVALID_TRANSITION',
      `Cannot transition trip from ${current.status} to ${to}`,
    );
  }
  const [updated] = await db
    .update(trips)
    .set({ ...patch, status: to, updatedAt: new Date() })
    .where(eq(trips.id, id))
    .returning();
  if (!updated) throw new HttpError(500, 'UPDATE_FAILED', 'Failed to update trip');
  return updated;
}

export async function confirmTrip(tripId: string, driverUserId: string) {
  const trip = await loadTripOrThrow(tripId);
  // BR-06: only assigned driver can confirm
  const [assigned] = await db.select().from(drivers).where(eq(drivers.id, trip.driverId)).limit(1);
  if (!assigned || assigned.userId !== driverUserId) {
    throw new HttpError(403, 'NOT_ASSIGNED_DRIVER', 'You are not the assigned driver for this trip');
  }
  return transitionTrip(tripId, 'CONFIRMED', { rejectionReason: null });
}

export async function rejectTrip(tripId: string, driverUserId: string, reason: string) {
  const trip = await loadTripOrThrow(tripId);
  const [assigned] = await db.select().from(drivers).where(eq(drivers.id, trip.driverId)).limit(1);
  if (!assigned || assigned.userId !== driverUserId) {
    throw new HttpError(403, 'NOT_ASSIGNED_DRIVER', 'You are not the assigned driver for this trip');
  }
  return transitionTrip(tripId, 'DRIVER_REJECTED', { rejectionReason: reason });
}

export async function reassignTrip(tripId: string, newDriverId: string) {
  const trip = await loadTripOrThrow(tripId);
  if (trip.status !== 'DRIVER_REJECTED' && trip.status !== 'PENDING_DRIVER_CONFIRM') {
    throw new HttpError(
      409,
      'INVALID_TRANSITION',
      `Cannot reassign trip in status ${trip.status}`,
    );
  }
  await assertDriverOk(newDriverId);
  // Check conflicts on new driver
  const conflicts = await findConflicts({
    driverId: newDriverId,
    date: trip.tripDate,
    time: trip.tripTime.slice(0, 5),
    excludeTripId: trip.id,
  });
  if (conflicts.length > 0) {
    throw new HttpError(409, 'TRIP_CONFLICT', 'New driver has conflicts', { conflicts });
  }
  const [updated] = await db
    .update(trips)
    .set({
      driverId: newDriverId,
      status: 'PENDING_DRIVER_CONFIRM',
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId))
    .returning();
  if (!updated) throw new HttpError(500, 'UPDATE_FAILED', 'Failed to reassign trip');
  return updated;
}

export async function startTrip(tripId: string, driverUserId: string) {
  const trip = await loadTripOrThrow(tripId);
  const [assigned] = await db.select().from(drivers).where(eq(drivers.id, trip.driverId)).limit(1);
  if (!assigned || assigned.userId !== driverUserId) {
    throw new HttpError(403, 'NOT_ASSIGNED_DRIVER', 'You are not the assigned driver for this trip');
  }
  return transitionTrip(tripId, 'IN_PROGRESS');
}

export async function completeTrip(tripId: string, driverUserId: string) {
  const trip = await loadTripOrThrow(tripId);
  const [assigned] = await db.select().from(drivers).where(eq(drivers.id, trip.driverId)).limit(1);
  if (!assigned || assigned.userId !== driverUserId) {
    throw new HttpError(403, 'NOT_ASSIGNED_DRIVER', 'You are not the assigned driver for this trip');
  }
  return transitionTrip(tripId, 'COMPLETED');
}

export async function cancelTrip(tripId: string, reason: string) {
  return transitionTrip(tripId, 'CANCELLED', { rejectionReason: reason });
}

export async function deleteTrip(tripId: string) {
  await db.delete(trips).where(eq(trips.id, tripId));
}

// ============================================================================
// Response mapping
// ============================================================================
export function toTripResponse(t: DbTrip) {
  return {
    id: t.id,
    passengerId: t.passengerId,
    driverId: t.driverId,
    vehicleId: t.vehicleId,
    tripDate: t.tripDate,
    tripTime: t.tripTime.slice(0, 5),
    estimatedEndTime: t.estimatedEndTime?.slice(0, 5) ?? null,
    pickupLocation: t.pickupLocation,
    destination: t.destination,
    stopovers: t.stopovers,
    mapsUrl: t.mapsUrl,
    note: t.note,
    status: t.status,
    rejectionReason: t.rejectionReason,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function toTripListItem(row: {
  trip: DbTrip;
  passengerName: string;
  driverName: string;
  licensePlate: string;
}) {
  return {
    ...toTripResponse(row.trip),
    passengerName: row.passengerName,
    driverName: row.driverName,
    licensePlate: row.licensePlate,
  };
}
