import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carTrips,
  carTripExtraCosts,
  carTripStopovers,
  carDrivers,
  carVehicles,
  type CarTrip,
  type CarStopType,
} from '@car-v2/db/schema';
import { CarError } from '@car-v2/shared/errors';
import type { FleetActor } from '../types';
import { computeTruckCost, parseAmount, type TruckCostBreakdown } from './truck-cost';

/**
 * Truck trip-log lifecycle (REQ-20260617 + REQ-20260623 multi-stop). Kept
 * SEPARATE from the car dispatch state machine (trip-state-machine.service.ts)
 * so the live car flow is untouched. Truck trips are `trp_kind='LOG'`:
 *
 *   create (with driver+vehicle) → CONFIRMED   (auto-confirm, no driver accept)
 *   create (unassigned)          → PENDING_ASSIGNMENT
 *   assign                       → CONFIRMED
 *   complete                     → COMPLETED   (+ metrics + structured extra costs)
 *
 * Stopovers: ordered list of stops (ORIGIN → PICKUP → WAYPOINTs → DELIVERY →
 * WAYPOINTs → RETURN). Stored in car_trip_stopovers. upsertStopovers is a
 * delete-then-insert (idempotent, compatible with Neon HTTP no-txn constraint).
 *
 * Pure domain: ent-scoped DB ops only. Audit / notify / revalidate are the
 * caller (server action)'s responsibility.
 */

export interface StopoverInput {
  type: CarStopType;
  address: string;
  /** Odometer at this stop (km). Optional at create time; filled in real-time. */
  km?: number | null;
  arrivedAt?: Date | null;
  notes?: string | null;
}

export interface CreateTruckTripInput {
  /** Caller-generated trip ref (use the app's trip-ref.service). */
  ref: string;
  scheduledAt: Date;
  vehicleId?: string | null;
  driverId?: string | null;
  customer?: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  bol?: string | null;
  cdf?: string | null;
  /** VND per litre, captured at trip time. */
  fuelPrice?: number | null;
  revenue?: number | null;
  /** Odometer at trip start (truck log). End odometer is set on completion. */
  startOdometer?: number | null;
  notes?: string | null;
  /** Ordered stop list (REQ-20260623). When present, replaces the flat
   * pickup/dropoff addresses as the canonical route. */
  stopovers?: StopoverInput[];
}

export interface CompleteTruckTripInput {
  startedAt?: Date | null;
  finishedAt?: Date | null;
  endOdometer?: number | null;
  fuelLiters?: number | null;
  /** Unit price of the fuel filled on this trip (đ/L). With `fuelLiters` this
   * is the trip's fuel SPEND, which feeds the vehicle's monthly fuel pool. */
  fuelPrice?: number | null;
  tollFee?: number | null;
  /** Structured "other costs": replaces any existing rows for the trip. */
  extraCosts: { name: string; amount: number }[];
}

/**
 * Replace all stopovers for a trip. Delete-then-insert is idempotent and works
 * with the Neon HTTP driver (no interactive transactions).
 * Caller is responsible for ensuring `stops` is non-empty and correctly ordered.
 */
export async function upsertStopovers(
  entId: string,
  tripId: string,
  stops: StopoverInput[],
): Promise<void> {
  await db
    .delete(carTripStopovers)
    .where(and(eq(carTripStopovers.tstTripId, tripId), eq(carTripStopovers.entId, entId)));

  if (stops.length === 0) return;

  await db.insert(carTripStopovers).values(
    stops.map((s, i) => ({
      tstId: randomUUID(),
      entId,
      tstTripId: tripId,
      tstAddress: s.address,
      tstOrder: i + 1,
      tstType: s.type,
      tstKm: s.km ?? null,
      tstArrivedAt: s.arrivedAt ?? null,
      tstNotes: s.notes ?? null,
    })),
  );
}

async function loadLogTrip(actor: FleetActor, tripId: string): Promise<CarTrip> {
  const trip = await db.query.carTrips.findFirst({
    where: and(
      eq(carTrips.trpId, tripId),
      eq(carTrips.entId, actor.entId),
      isNull(carTrips.trpDeletedAt),
    ),
  });
  if (!trip) throw new CarError('CAR-E1004', 404, 'Trip not found');
  if (trip.trpKind !== 'LOG') {
    throw new CarError('CAR-E1001', 409, 'Not a truck trip-log');
  }
  return trip;
}

async function assertTruckVehicle(actor: FleetActor, vehicleId: string): Promise<void> {
  const vehicle = await db.query.carVehicles.findFirst({
    where: and(
      eq(carVehicles.cvhId, vehicleId),
      eq(carVehicles.entId, actor.entId),
      isNull(carVehicles.cvhDeletedAt),
    ),
  });
  if (!vehicle) throw new CarError('CAR-E1002', 400, 'Vehicle not available');
  if (vehicle.cvhStatus === 'RETIRED') throw new CarError('CAR-E1002', 400, 'Vehicle is retired');
  if (vehicle.cvhType !== 'TRUCK') throw new CarError('CAR-E1002', 400, 'Vehicle is not a truck');
}

async function assertDriver(actor: FleetActor, driverId: string): Promise<void> {
  const driver = await db.query.carDrivers.findFirst({
    where: and(
      eq(carDrivers.drvId, driverId),
      eq(carDrivers.entId, actor.entId),
      isNull(carDrivers.drvDeletedAt),
    ),
  });
  if (!driver) throw new CarError('CAR-E1003', 400, 'Driver not available');
}

export async function createTruckTrip(
  actor: FleetActor,
  input: CreateTruckTripInput,
): Promise<CarTrip> {
  const assigned = Boolean(input.driverId && input.vehicleId);
  if (input.vehicleId) await assertTruckVehicle(actor, input.vehicleId);
  if (input.driverId) await assertDriver(actor, input.driverId);

  const [created] = await db
    .insert(carTrips)
    .values({
      trpId: randomUUID(),
      entId: actor.entId,
      trpRef: input.ref,
      trpKind: 'LOG',
      trpCreatorId: actor.userId,
      /* Truck trips skip driver confirmation: auto-CONFIRMED when assigned. */
      trpStatus: assigned ? 'CONFIRMED' : 'PENDING_ASSIGNMENT',
      trpDriverId: input.driverId ?? null,
      trpVehicleId: input.vehicleId ?? null,
      trpPickupAddress: input.pickupAddress,
      trpDropoffAddress: input.dropoffAddress,
      trpScheduledAt: input.scheduledAt,
      trpStartOdometer: input.startOdometer ?? null,
      trpCustomer: input.customer ?? null,
      trpBol: input.bol ?? null,
      trpCdf: input.cdf ?? null,
      trpFuelPrice: input.fuelPrice != null ? String(input.fuelPrice) : null,
      trpRevenue: input.revenue != null ? String(input.revenue) : null,
      trpNotes: input.notes ?? null,
    })
    .returning();
  if (!created) throw new CarError('CAR-E0500', 500, 'Insert returned no row');

  if (input.stopovers && input.stopovers.length > 0) {
    await upsertStopovers(actor.entId, created.trpId, input.stopovers);
  }

  return created;
}

export async function assignTruckTrip(
  actor: FleetActor,
  tripId: string,
  payload: { driverId: string; vehicleId: string },
): Promise<CarTrip> {
  const trip = await loadLogTrip(actor, tripId);
  if (trip.trpStatus !== 'PENDING_ASSIGNMENT' && trip.trpStatus !== 'CONFIRMED') {
    throw new CarError('CAR-E1001', 409, `Cannot assign a truck trip in '${trip.trpStatus}'`);
  }
  await assertTruckVehicle(actor, payload.vehicleId);
  await assertDriver(actor, payload.driverId);

  const [updated] = await db
    .update(carTrips)
    .set({
      trpDriverId: payload.driverId,
      trpVehicleId: payload.vehicleId,
      /* Auto-confirm — no PENDING_DRIVER_CONFIRMATION for truck. */
      trpStatus: 'CONFIRMED',
      trpUpdatedAt: new Date(),
    })
    .where(and(eq(carTrips.trpId, tripId), eq(carTrips.entId, actor.entId)))
    .returning();
  if (!updated) throw new CarError('CAR-E1004', 404, 'Trip vanished mid-assign');
  return updated;
}

export async function completeTruckTrip(
  actor: FleetActor,
  tripId: string,
  input: CompleteTruckTripInput,
): Promise<{ trip: CarTrip; breakdown: TruckCostBreakdown }> {
  const trip = await loadLogTrip(actor, tripId);
  if (trip.trpStatus !== 'CONFIRMED' && trip.trpStatus !== 'IN_PROGRESS') {
    throw new CarError('CAR-E1001', 409, `Cannot complete a truck trip in '${trip.trpStatus}'`);
  }

  const [updated] = await db
    .update(carTrips)
    .set({
      trpStatus: 'COMPLETED',
      trpStartedAt: input.startedAt ?? trip.trpStartedAt,
      trpEndedAt: input.finishedAt ?? new Date(),
      trpEndOdometer: input.endOdometer ?? trip.trpEndOdometer,
      trpFuelLiters: input.fuelLiters != null ? String(input.fuelLiters) : trip.trpFuelLiters,
      trpFuelPrice: input.fuelPrice != null ? String(input.fuelPrice) : trip.trpFuelPrice,
      trpTollFee: input.tollFee != null ? String(input.tollFee) : trip.trpTollFee,
      trpUpdatedAt: new Date(),
    })
    .where(and(eq(carTrips.trpId, tripId), eq(carTrips.entId, actor.entId)))
    .returning();
  if (!updated) throw new CarError('CAR-E1004', 404, 'Trip vanished mid-complete');

  /* Replace structured extra costs (neon-http has no interactive txn; delete +
   * insert is idempotent for a re-submitted completion). */
  await db
    .delete(carTripExtraCosts)
    .where(and(eq(carTripExtraCosts.entId, actor.entId), eq(carTripExtraCosts.trpId, tripId)));
  if (input.extraCosts.length > 0) {
    await db.insert(carTripExtraCosts).values(
      input.extraCosts.map((c) => ({
        tecId: randomUUID(),
        entId: actor.entId,
        trpId: tripId,
        tecName: c.name,
        tecAmount: String(c.amount),
      })),
    );
  }

  /* Bump the truck odometer if this trip ended higher (fuel-quota tracking). */
  if (updated.trpVehicleId && updated.trpEndOdometer != null) {
    await db
      .update(carVehicles)
      .set({
        cvhOdometerKm: sql`GREATEST(${carVehicles.cvhOdometerKm}, ${updated.trpEndOdometer})` as unknown as number,
        cvhUpdatedAt: new Date(),
      })
      .where(and(eq(carVehicles.cvhId, updated.trpVehicleId), eq(carVehicles.entId, actor.entId)));
  }

  const breakdown = computeTruckCost({
    fuelLiters: input.fuelLiters ?? parseAmount(trip.trpFuelLiters),
    fuelPrice: parseAmount(updated.trpFuelPrice),
    tollFee: input.tollFee ?? parseAmount(trip.trpTollFee),
    extraCosts: input.extraCosts.map((c) => c.amount),
    revenue: parseAmount(updated.trpRevenue),
  });

  return { trip: updated, breakdown };
}

export interface UpdateTruckTripInput {
  scheduledAt: Date;
  vehicleId?: string | null;
  driverId?: string | null;
  customer?: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  bol?: string | null;
  cdf?: string | null;
  fuelPrice?: number | null;
  revenue?: number | null;
  startOdometer?: number | null;
  endOdometer?: number | null;
  fuelLiters?: number | null;
  tollFee?: number | null;
  /* Free-text trip note (printed in the trip-log export) and the actual run
   * window. All three are "only when provided": leaving them out keeps what is
   * stored, so editing a trip never silently wipes times a driver recorded. */
  notes?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  extraCosts: { name: string; amount: number }[];
  /** When provided, replaces the full stopover list for this trip. */
  stopovers?: StopoverInput[];
}

/** Edit an existing truck trip-log (manager correction). Keeps the current
 * status; replaces structured extra costs. */
export async function updateTruckTrip(
  actor: FleetActor,
  tripId: string,
  input: UpdateTruckTripInput,
): Promise<{ trip: CarTrip; breakdown: TruckCostBreakdown }> {
  const trip = await loadLogTrip(actor, tripId);
  if (input.vehicleId) await assertTruckVehicle(actor, input.vehicleId);
  if (input.driverId) await assertDriver(actor, input.driverId);

  const [updated] = await db
    .update(carTrips)
    .set({
      trpScheduledAt: input.scheduledAt,
      trpDriverId: input.driverId ?? null,
      trpVehicleId: input.vehicleId ?? null,
      trpCustomer: input.customer ?? null,
      trpPickupAddress: input.pickupAddress,
      trpDropoffAddress: input.dropoffAddress,
      trpBol: input.bol ?? null,
      trpCdf: input.cdf ?? null,
      trpFuelPrice: input.fuelPrice != null ? String(input.fuelPrice) : null,
      trpRevenue: input.revenue != null ? String(input.revenue) : null,
      trpStartOdometer: input.startOdometer ?? null,
      trpEndOdometer: input.endOdometer ?? null,
      trpFuelLiters: input.fuelLiters != null ? String(input.fuelLiters) : null,
      trpTollFee: input.tollFee != null ? String(input.tollFee) : null,
      /* undefined → Drizzle leaves the column alone (see the note on the type). */
      trpNotes: input.notes !== undefined ? input.notes : undefined,
      trpStartedAt: input.startedAt !== undefined ? input.startedAt : undefined,
      trpEndedAt: input.finishedAt !== undefined ? input.finishedAt : undefined,
      trpUpdatedAt: new Date(),
    })
    .where(and(eq(carTrips.trpId, tripId), eq(carTrips.entId, actor.entId)))
    .returning();
  if (!updated) throw new CarError('CAR-E1004', 404, 'Trip vanished mid-update');

  await db
    .delete(carTripExtraCosts)
    .where(and(eq(carTripExtraCosts.entId, actor.entId), eq(carTripExtraCosts.trpId, tripId)));
  if (input.extraCosts.length > 0) {
    await db.insert(carTripExtraCosts).values(
      input.extraCosts.map((c) => ({
        tecId: randomUUID(),
        entId: actor.entId,
        trpId: tripId,
        tecName: c.name,
        tecAmount: String(c.amount),
      })),
    );
  }

  if (input.stopovers && input.stopovers.length > 0) {
    await upsertStopovers(actor.entId, updated.trpId, input.stopovers);
  }

  const breakdown = computeTruckCost({
    fuelLiters: parseAmount(updated.trpFuelLiters),
    fuelPrice: parseAmount(updated.trpFuelPrice),
    tollFee: parseAmount(updated.trpTollFee),
    extraCosts: input.extraCosts.map((c) => c.amount),
    revenue: parseAmount(updated.trpRevenue),
  });
  return { trip: updated, breakdown };
}

/** Soft-delete a truck trip-log. */
export async function deleteTruckTrip(actor: FleetActor, tripId: string): Promise<void> {
  const trip = await loadLogTrip(actor, tripId);
  await db
    .update(carTrips)
    .set({ trpDeletedAt: new Date(), trpUpdatedAt: new Date() })
    .where(and(eq(carTrips.trpId, trip.trpId), eq(carTrips.entId, actor.entId)));
}
