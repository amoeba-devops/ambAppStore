import { and, asc, eq, gte, inArray, isNull, lt, lte, ne, notInArray, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTrips, carTruckMaintenances, carVehicles } from '@car-v2/db/schema';
import {
  CarError,
  MAINTENANCE_HAS_TRIPS_CODE,
  VEHICLE_UNDER_MAINTENANCE_CODE,
  type MaintenanceBlockDetails,
  type MaintenanceTripsDetails,
} from '@car-v2/shared/errors';
import { parseAmount } from './truck-cost';

/**
 * Truck maintenance (REQ-20260904) — pure domain helpers, no `next/*`.
 *
 * Two concerns share this file because they share the same rows:
 *
 *   • MONEY — `loadTruckMaintenanceMonthly` gives `computeTruckPnl` the month's
 *     maintenance total per scope. It is the third component of the fixed cost
 *     and is deliberately NOT part of the per-trip allocation
 *     (`loadTruckFixedAllocation`), nor zeroed for a trip-less month.
 *
 *   • SCHEDULE — `assertVehicleNotUnderMaintenance` (trip side, CAR-E1013) and
 *     `assertNoTripsInMaintenanceWindow` (maintenance side, CAR-E1014) make a
 *     maintenance window and a trip mutually exclusive on one truck. Both are
 *     BLOCK tier: the assignment guard's confirm dialog never applies.
 *
 * Dates: a trip's day is `utcDateKey(trp_scheduled_at)` — the same UTC slice the
 * whole truck module keys months by (`monthKey`). The form posts 'YYYY-MM-DD'
 * which `new Date()` reads as 00:00 UTC, and the Excel import builds
 * `${iso}T00:00:00.000Z`, so the day never shifts under a VN (UTC+7) clock.
 */

/** 'YYYY-MM-DD' of an instant, in UTC — matches how trips are bucketed. */
export const utcDateKey = (d: Date): string => d.toISOString().slice(0, 10);

/** First instant AFTER a 'YYYY-MM-DD' day (exclusive range end), in UTC. */
export function utcDayEndExclusive(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1));
}

/** Trip statuses that still occupy the truck (everything a LOG trip can be,
 * minus the two dead ends the car flow can produce). */
const DEAD_TRIP_STATUSES = ['CANCELLED', 'REJECTED_BY_DRIVER'] as const;

/* ── Money ─────────────────────────────────────────────────────────────────── */

export interface TruckMaintenanceMonthly {
  /** Σ maintenance cost of the scope in `month` (VND, rounded). */
  forMonth(month: string): number;
  /** One truck's maintenance cost in `month`. */
  forVehicleMonth(month: string, vehicleId: string | null): number;
}

export interface LoadTruckMaintenanceMonthlyOpts {
  vehicleId?: string | null;
  vehicleIds?: string[] | null;
}

const key = (month: string, vehicleId: string): string => `${month}|${vehicleId}`;

/**
 * Month × truck maintenance totals for the scope. Only live rows of live TRUCK
 * vehicles count — the same vehicle set `loadTruckFixedMonthly` resolves, so
 * every fixed-cost component covers the same trucks.
 */
export async function loadTruckMaintenanceMonthly(
  entId: string,
  months: string[],
  opts: LoadTruckMaintenanceMonthlyOpts = {},
): Promise<TruckMaintenanceMonthly> {
  const ZERO: TruckMaintenanceMonthly = { forMonth: () => 0, forVehicleMonth: () => 0 };
  const uniqMonths = [...new Set(months)].filter((m) => /^\d{4}-\d{2}$/.test(m));
  if (uniqMonths.length === 0) return ZERO;

  const conds = [
    eq(carTruckMaintenances.entId, entId),
    inArray(carTruckMaintenances.tmnMonth, uniqMonths),
    isNull(carTruckMaintenances.tmnDeletedAt),
    eq(carVehicles.cvhType, 'TRUCK'),
    isNull(carVehicles.cvhDeletedAt),
  ];
  if (opts.vehicleId) conds.push(eq(carTruckMaintenances.cvhId, opts.vehicleId));
  else if (opts.vehicleIds) {
    if (opts.vehicleIds.length === 0) return ZERO;
    conds.push(inArray(carTruckMaintenances.cvhId, opts.vehicleIds));
  }

  const rows = await db
    .select({
      vehicleId: carTruckMaintenances.cvhId,
      month: carTruckMaintenances.tmnMonth,
      cost: carTruckMaintenances.tmnCost,
    })
    .from(carTruckMaintenances)
    .innerJoin(carVehicles, eq(carTruckMaintenances.cvhId, carVehicles.cvhId))
    .where(and(...conds));

  const byMonth = new Map<string, number>();
  const byVehicleMonth = new Map<string, number>();
  for (const r of rows) {
    const amount = Math.round(parseAmount(r.cost));
    byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + amount);
    const k = key(r.month, r.vehicleId);
    byVehicleMonth.set(k, (byVehicleMonth.get(k) ?? 0) + amount);
  }

  return {
    forMonth: (month) => byMonth.get(month) ?? 0,
    forVehicleMonth: (month, vehicleId) => (vehicleId ? byVehicleMonth.get(key(month, vehicleId)) ?? 0 : 0),
  };
}

/* ── Schedule: trip side ───────────────────────────────────────────────────── */

export interface MaintenanceWindow {
  id: string;
  vehicleId: string;
  plate: string;
  /** 'YYYY-MM-DD' inclusive. */
  startDate: string;
  endDate: string;
}

/** The live maintenance window covering `dateIso` for `vehicleId`, or null. */
export async function findVehicleMaintenanceOn(
  entId: string,
  vehicleId: string,
  dateIso: string,
  excludeId?: string,
): Promise<MaintenanceWindow | null> {
  const conds = [
    eq(carTruckMaintenances.entId, entId),
    eq(carTruckMaintenances.cvhId, vehicleId),
    isNull(carTruckMaintenances.tmnDeletedAt),
    lte(carTruckMaintenances.tmnStartDate, dateIso),
    gte(carTruckMaintenances.tmnEndDate, dateIso),
  ];
  if (excludeId) conds.push(ne(carTruckMaintenances.tmnId, excludeId));
  const [row] = await db
    .select({
      id: carTruckMaintenances.tmnId,
      vehicleId: carTruckMaintenances.cvhId,
      plate: carVehicles.cvhPlateNumber,
      startDate: carTruckMaintenances.tmnStartDate,
      endDate: carTruckMaintenances.tmnEndDate,
    })
    .from(carTruckMaintenances)
    .innerJoin(carVehicles, eq(carTruckMaintenances.cvhId, carVehicles.cvhId))
    .where(and(...conds))
    .orderBy(asc(carTruckMaintenances.tmnStartDate))
    .limit(1);
  return row ?? null;
}

/**
 * BLOCK: refuse any trip write that would put `vehicleId` on the road on a day
 * it is booked for maintenance (BR-7). No vehicle → nothing to check. Pass
 * `row` from the import pre-scan so the message can name the sheet row.
 */
export async function assertVehicleNotUnderMaintenance(
  entId: string,
  vehicleId: string | null | undefined,
  scheduledAt: Date,
  row?: number,
): Promise<void> {
  if (!vehicleId) return;
  const day = utcDateKey(scheduledAt);
  const hit = await findVehicleMaintenanceOn(entId, vehicleId, day);
  if (!hit) return;
  const details: MaintenanceBlockDetails = {
    plate: hit.plate,
    startDate: hit.startDate,
    endDate: hit.endDate,
    ...(row != null ? { row } : {}),
  };
  throw new CarError(
    VEHICLE_UNDER_MAINTENANCE_CODE,
    409,
    `${row != null ? `Row ${row}: ` : ''}Vehicle ${hit.plate} is under maintenance ${hit.startDate} – ${hit.endDate}`,
    details,
  );
}

/** Every live window of the given trucks (all of them when `vehicleIds` is
 * omitted) — feeds the trip form so it can grey out a truck for the chosen
 * date before the server refuses. Small table; no date bound needed. */
export async function listVehicleMaintenanceWindows(
  entId: string,
  vehicleIds?: readonly string[],
): Promise<MaintenanceWindow[]> {
  if (vehicleIds && vehicleIds.length === 0) return [];
  const rows = await db
    .select({
      id: carTruckMaintenances.tmnId,
      vehicleId: carTruckMaintenances.cvhId,
      plate: carVehicles.cvhPlateNumber,
      startDate: carTruckMaintenances.tmnStartDate,
      endDate: carTruckMaintenances.tmnEndDate,
    })
    .from(carTruckMaintenances)
    .innerJoin(carVehicles, eq(carTruckMaintenances.cvhId, carVehicles.cvhId))
    .where(
      and(
        eq(carTruckMaintenances.entId, entId),
        isNull(carTruckMaintenances.tmnDeletedAt),
        vehicleIds ? inArray(carTruckMaintenances.cvhId, [...vehicleIds]) : undefined,
      ),
    )
    .orderBy(asc(carTruckMaintenances.tmnStartDate));
  return rows;
}

/* ── Schedule: maintenance side ────────────────────────────────────────────── */

export interface TripsInWindow {
  count: number;
  /** ≤ 3 refs, oldest first. */
  refs: string[];
}

/**
 * LOG trips of each truck in `vehicleIds` scheduled inside [start, end]
 * (inclusive days), grouped by truck. Soft-deleted and dead-end trips are
 * ignored. Powers both the hard check and the form's per-truck disabling.
 */
export async function listBusyVehiclesInWindow(
  entId: string,
  vehicleIds: readonly string[],
  startIso: string,
  endIso: string,
): Promise<Map<string, TripsInWindow>> {
  const out = new Map<string, TripsInWindow>();
  if (vehicleIds.length === 0) return out;
  const rows = await db
    .select({ vehicleId: carTrips.trpVehicleId, ref: carTrips.trpRef })
    .from(carTrips)
    .where(
      and(
        eq(carTrips.entId, entId),
        eq(carTrips.trpKind, 'LOG'),
        isNull(carTrips.trpDeletedAt),
        inArray(carTrips.trpVehicleId, [...vehicleIds]),
        notInArray(carTrips.trpStatus, [...DEAD_TRIP_STATUSES]),
        gte(carTrips.trpScheduledAt, new Date(`${startIso}T00:00:00.000Z`)),
        lt(carTrips.trpScheduledAt, utcDayEndExclusive(endIso)),
      ),
    )
    .orderBy(asc(carTrips.trpScheduledAt));
  for (const r of rows) {
    if (!r.vehicleId) continue;
    const g = out.get(r.vehicleId) ?? { count: 0, refs: [] };
    g.count += 1;
    if (g.refs.length < 3) g.refs.push(r.ref);
    out.set(r.vehicleId, g);
  }
  return out;
}

/**
 * BLOCK: refuse a maintenance window over days the truck already has trips on
 * (BR-8, user decision 2026-09-04: "cảnh báo và chặn"). The form shows the
 * same list live; this is the server's word.
 */
export async function assertNoTripsInMaintenanceWindow(
  entId: string,
  vehicleId: string,
  plate: string,
  startIso: string,
  endIso: string,
): Promise<void> {
  const busy = (await listBusyVehiclesInWindow(entId, [vehicleId], startIso, endIso)).get(vehicleId);
  if (!busy) return;
  const details: MaintenanceTripsDetails = { plate, count: busy.count, refs: busy.refs };
  throw new CarError(
    MAINTENANCE_HAS_TRIPS_CODE,
    409,
    `Vehicle ${plate} has ${busy.count} trip(s) in ${startIso} – ${endIso}: ${busy.refs.join(', ')}`,
    details,
  );
}

/** Other live windows of the same truck that intersect [start, end] — a soft
 * warning in the form (two jobs may legitimately overlap), never a block. */
export async function listOverlappingMaintenances(
  entId: string,
  vehicleId: string,
  startIso: string,
  endIso: string,
  excludeId?: string,
): Promise<{ id: string; startDate: string; endDate: string }[]> {
  const conds = [
    eq(carTruckMaintenances.entId, entId),
    eq(carTruckMaintenances.cvhId, vehicleId),
    isNull(carTruckMaintenances.tmnDeletedAt),
    lte(carTruckMaintenances.tmnStartDate, endIso),
    gte(carTruckMaintenances.tmnEndDate, startIso),
  ];
  if (excludeId) conds.push(ne(carTruckMaintenances.tmnId, excludeId));
  return db
    .select({
      id: carTruckMaintenances.tmnId,
      startDate: carTruckMaintenances.tmnStartDate,
      endDate: carTruckMaintenances.tmnEndDate,
    })
    .from(carTruckMaintenances)
    .where(and(...conds))
    .orderBy(asc(carTruckMaintenances.tmnStartDate));
}

/**
 * Last change touching a month's maintenance rows — create, edit OR delete —
 * so the report "stale" badge fires after any of them (BR-11). Deleted rows
 * are included on purpose: removing a job changes the month total too.
 */
export async function getTruckMaintenanceLastUpdated(entId: string, month: string): Promise<Date | null> {
  const [row] = await db
    .select({
      u: sql<Date | null>`max(greatest(coalesce(${carTruckMaintenances.tmnUpdatedAt}, ${carTruckMaintenances.tmnCreatedAt}), coalesce(${carTruckMaintenances.tmnDeletedAt}, ${carTruckMaintenances.tmnCreatedAt})))`,
    })
    .from(carTruckMaintenances)
    .where(and(eq(carTruckMaintenances.entId, entId), eq(carTruckMaintenances.tmnMonth, month)));
  return row?.u ? new Date(row.u) : null;
}
