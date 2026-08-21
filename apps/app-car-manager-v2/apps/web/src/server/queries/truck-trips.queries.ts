import 'server-only';
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, ne, or, type SQL } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carTrips,
  carTripExtraCosts,
  carDrivers,
  carUsers,
  carVehicles,
  type CarTripStatus,
} from '@car-v2/db/schema';
import {
  parseAmount,
  loadTruckRegionSnapshots,
  loadTruckFixedAllocation,
  getTripCostAttachments,
  type TruckCostBreakdown,
  type TruckFuelMode,
} from '@car-v2/core/truck';
import { getSignedGetUrl } from '@/lib/s3-client';

const monthKey = (d: Date): string => d.toISOString().slice(0, 7);

/**
 * Snapshot-aware cost breakdown for ONE trip — the exact rule `listTruckTrips`
 * applies per row (km × the vehicle's own frozen money÷km once a report covers
 * it; otherwise the same allocation computed live from what's recorded so far).
 * The trip-detail pages go through this so detail always matches the
 * list / finance / P&L / report numbers (PLAN-20260707 S1.5).
 */
export async function getTruckTripBreakdown(
  entId: string,
  trip: {
    trpScheduledAt: Date;
    trpVehicleId: string | null;
    trpStartOdometer: number | null;
    trpEndOdometer: number | null;
    trpFuelLiters: string | null;
    trpFuelPrice: string | null;
    trpTollFee: string | null;
    trpRevenue: string | null;
    /* Last change — decides whether an existing report covers this trip. */
    trpUpdatedAt?: Date | null;
    trpCreatedAt?: Date | null;
  },
  extraAmounts: number[],
): Promise<{
  breakdown: TruckCostBreakdown;
  finalized: boolean;
  /** How `breakdown.fuelCost` was derived: AVERAGED (frozen month-end
   * allocation) | LIVE (same allocation, computed from the month's fuel so far)
   * | UNSET (no fuel recorded for that vehicle-month → 0). Independent of
   * `finalized`. */
  fuelMode: TruckFuelMode;
  /** This trip's km (end − start odometer) + cost of one km (đ/km) — the detail
   * page shows `{km} km × {fuelCostPerKm} ₫/km` under the fuel row. */
  km: number;
  fuelCostPerKm: number;
  /** "Nhiên liệu thực tế" (REQ-20260822) — this trip's OWN fuel spend
   * (`trp_fuel_liters × trp_fuel_price`), shown next to the allocated figure so
   * the detail page states both concepts instead of only the pooled one. */
  fuelActualCost: number;
  /** This trip's slice of the month's fixed cost (Sheet3 "phân bổ theo chuyến")
   * + the profit after it. `breakdown.profit` stays variable-only. */
  salaryAllocated: number;
  depreciationAllocated: number;
  profitAfterFixed: number;
  /** Trips the month's fixed cost was split across (for the "÷ N chuyến" note). */
  fixedTripCount: number;
  /** The trip's month + resolved operating region ('' = vehicle has no
   * region) — feeds `getTruckReportStatus` so the detail page can show WHEN
   * the report covering this trip was last generated. */
  month: string;
  region: string;
}> {
  const month = monthKey(trip.trpScheduledAt);
  const [snapshots, fixedAlloc] = await Promise.all([
    loadTruckRegionSnapshots(entId, [month]),
    loadTruckFixedAllocation(entId, [month]),
  ]);
  const region = trip.trpVehicleId ? snapshots.vehicleRegion.get(trip.trpVehicleId) ?? '' : '';
  /* "Đã lập BC" = a report for this (month, region) exists AND was generated
   * after this trip's last change; a trip added later isn't in it. */
  const changedAt = trip.trpUpdatedAt ?? trip.trpCreatedAt ?? null;
  const finalized = snapshots.isReported(month, trip.trpVehicleId, changedAt);
  const km =
    trip.trpStartOdometer != null && trip.trpEndOdometer != null
      ? trip.trpEndOdometer - trip.trpStartOdometer
      : 0;
  /* Fuel = frozen snapshot (only if it covers this trip) → live pool → 0. */
  const fuel = snapshots.fuelForTrip(month, trip.trpVehicleId, km, changedAt);
  /* Fixed allocation frozen by the covering report (REQ-20260821); live only
   * when no report covers this trip — same coverage rule as fuel. */
  const fixedShare =
    snapshots.fixedShareForTrip(month, trip.trpVehicleId, changedAt) ??
    fixedAlloc.forTrip(month, trip.trpVehicleId);
  const tollFee = Math.round(parseAmount(trip.trpTollFee));
  const extraTotal = Math.round(extraAmounts.reduce((s, n) => s + (n || 0), 0));
  const revenue = Math.round(parseAmount(trip.trpRevenue));
  const totalCost = fuel.cost + tollFee + extraTotal;
  return {
    breakdown: { fuelCost: fuel.cost, tollFee, extraTotal, totalCost, revenue, profit: revenue - totalCost },
    finalized,
    fuelMode: fuel.mode,
    km,
    fuelCostPerKm: fuel.costPerKm,
    fuelActualCost: Math.round(parseAmount(trip.trpFuelLiters) * parseAmount(trip.trpFuelPrice)),
    salaryAllocated: fixedShare.salary,
    depreciationAllocated: fixedShare.depreciation,
    profitAfterFixed: revenue - totalCost - fixedShare.total,
    fixedTripCount: fixedShare.tripCount,
    month,
    region,
  };
}

export interface TruckTripRow {
  trpId: string;
  ref: string;
  scheduledAt: Date;
  customer: string | null;
  bol: string | null;
  status: CarTripStatus;
  /** Vehicle plate / driver name for the trip-log table (design columns). */
  plate: string | null;
  /** Vehicle operating region code (cvh_region) — "Khu vực" column (QA P2). */
  region: string | null;
  driver: string | null;
  /** Distance = end − start odometer when both present. */
  km: number | null;
  breakdown: TruckCostBreakdown;
  updatedAt: Date | null;
  /* ── Extra detail for the trip-log Excel export (feedback #4). Not shown in
   * the on-screen table; populated for every row so "Tải xuống" mirrors the
   * monthly report's detailed columns. ── */
  startTime: Date | null;
  endTime: Date | null;
  startOdometer: number | null;
  endOdometer: number | null;
  pickup: string | null;
  dropoff: string | null;
  cdf: string | null;
  notes: string | null;
  /** Joined names of the trip's extra-cost lines ("Tên phí khác"). */
  extraNote: string | null;
  /** Fuel unit price for the export: month-avg when finalized, else own price. */
  fuelUnitPrice: number;
  /** Litres for the export: km × consumption when finalized, else own litres. */
  fuelLiters: number;
  /* ── "Nhiên liệu THỰC TẾ" (REQ-20260822) — what THIS trip actually filled and
   * paid: `trp_fuel_liters × trp_fuel_price`, straight from the trip's own
   * record. Deliberately separate from `breakdown.fuelCost`, which is the same
   * money POOLED per vehicle-month and re-spread by km. Operations screens (trip
   * list + its export) show these so a row always matches what the driver
   * entered; the finance/P&L side keeps the allocated figure. ── */
  fuelActualLiters: number;
  fuelActualPrice: number;
  /** liters × price, rounded to đồng. 0 when the trip recorded no fuel. */
  fuelActualCost: number;
  /** true once the trip's month is closed → fuel/profit are the official
   * month-end figures; false → provisional (liters × price). Lets list views
   * flag "Tạm tính" and keeps profit consistent with the finance/P&L screens. */
  finalized: boolean;
}

export interface ListTruckTripsOpts {
  /** Free-text on customer / BOL / ref. */
  q?: string;
  /** Restrict to one month, 'YYYY-MM'. */
  month?: string;
  /** Restrict to one vehicle. */
  vehicleId?: string;
  /** Restrict to one driver (Sheet-2 T7). */
  driverId?: string;
  /** Restrict to vehicles in one operating region (cvh_region code, QA P2). */
  region?: string;
  /**
   * Restrict to vehicles in ANY of these regions — the region-ACL scope for a
   * user narrowed to a subset (REQ-20260813). Ignored when `region` is set.
   */
  regions?: readonly string[];
  /** 'complete' = COMPLETED only · 'ongoing' = not completed · else all. */
  status?: 'all' | 'complete' | 'ongoing';
}

/** Truck trip-log rows (newest first) with per-trip cost/profit computed from
 * the same core math the completion flow uses. Optional search + month filter. */
export async function listTruckTrips(entId: string, opts: ListTruckTripsOpts = {}): Promise<TruckTripRow[]> {
  const filters: SQL[] = [
    eq(carTrips.entId, entId),
    eq(carTrips.trpKind, 'LOG'),
    isNull(carTrips.trpDeletedAt),
  ];
  if (opts.month && /^\d{4}-\d{2}$/.test(opts.month)) {
    const start = new Date(`${opts.month}-01T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    filters.push(gte(carTrips.trpScheduledAt, start), lt(carTrips.trpScheduledAt, end));
  }
  const term = opts.q?.trim();
  if (term) {
    const like = `%${term}%`;
    const search = or(
      ilike(carTrips.trpCustomer, like),
      ilike(carTrips.trpBol, like),
      ilike(carTrips.trpRef, like),
    );
    if (search) filters.push(search);
  }
  if (opts.vehicleId) filters.push(eq(carTrips.trpVehicleId, opts.vehicleId));
  if (opts.driverId) filters.push(eq(carTrips.trpDriverId, opts.driverId));
  if (opts.status === 'complete') filters.push(eq(carTrips.trpStatus, 'COMPLETED'));
  else if (opts.status === 'ongoing') filters.push(ne(carTrips.trpStatus, 'COMPLETED'));
  /* Region scope (QA P2) — a trip's region is its vehicle's cvh_region, so
   * resolve the region's vehicle ids first. No vehicles in region → no rows.
   * `regions` (REQ-20260813) is the same mechanism over a set of regions; an
   * empty set means "no region permitted", never "no filter". */
  const regionScope = opts.region
    ? eq(carVehicles.cvhRegion, opts.region)
    : opts.regions
      ? opts.regions.length === 0
        ? null
        : inArray(carVehicles.cvhRegion, [...opts.regions])
      : undefined;
  if (regionScope === null) return [];
  if (regionScope) {
    const vrows = await db
      .select({ id: carVehicles.cvhId })
      .from(carVehicles)
      .where(and(eq(carVehicles.entId, entId), regionScope, isNull(carVehicles.cvhDeletedAt)));
    if (vrows.length === 0) return [];
    filters.push(inArray(carTrips.trpVehicleId, vrows.map((v) => v.id)));
  }

  const trips = await db
    .select()
    .from(carTrips)
    .where(and(...filters))
    .orderBy(desc(carTrips.trpScheduledAt));

  const ids = trips.map((t) => t.trpId);
  const extras = ids.length
    ? await db
        .select({ trpId: carTripExtraCosts.trpId, name: carTripExtraCosts.tecName, amount: carTripExtraCosts.tecAmount })
        .from(carTripExtraCosts)
        .where(and(eq(carTripExtraCosts.entId, entId), inArray(carTripExtraCosts.trpId, ids)))
    : [];
  const extraByTrip = new Map<string, number[]>();
  const extraNoteByTrip = new Map<string, string[]>();
  for (const e of extras) {
    const arr = extraByTrip.get(e.trpId) ?? [];
    arr.push(parseAmount(e.amount));
    extraByTrip.set(e.trpId, arr);
    if (e.name?.trim()) {
      const narr = extraNoteByTrip.get(e.trpId) ?? [];
      narr.push(e.name.trim());
      extraNoteByTrip.set(e.trpId, narr);
    }
  }

  /* Plate + driver name for the table columns — batch lookups keep the main
   * query a flat select. */
  const vehIds = [...new Set(trips.map((t) => t.trpVehicleId).filter((v): v is string => !!v))];
  const plateByVeh = new Map<string, string>();
  const regionByVeh = new Map<string, string | null>();
  if (vehIds.length) {
    const vrows = await db
      .select({
        id: carVehicles.cvhId,
        plate: carVehicles.cvhPlateNumber,
        region: carVehicles.cvhRegion,
      })
      .from(carVehicles)
      .where(and(eq(carVehicles.entId, entId), inArray(carVehicles.cvhId, vehIds)));
    for (const v of vrows) {
      plateByVeh.set(v.id, v.plate);
      regionByVeh.set(v.id, v.region);
    }
  }
  const drvIds = [...new Set(trips.map((t) => t.trpDriverId).filter((v): v is string => !!v))];
  const driverByDrv = new Map<string, string>();
  if (drvIds.length) {
    const drows = await db
      .select({ id: carDrivers.drvId, name: carUsers.usrName })
      .from(carDrivers)
      .innerJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
      .where(and(eq(carDrivers.entId, entId), inArray(carDrivers.drvId, drvIds)));
    for (const d of drows) if (d.name) driverByDrv.set(d.id, d.name);
  }

  /* Per-vehicle fuel reconciliation (BUG-260730). A trip's official fuel is
   * its OWN vehicle's frozen money÷km once a report covers it, so per-trip
   * profit matches the finance/P&L screens; otherwise the same allocation
   * computed live from the month's fuel recorded so far. */
  const monthsInResult = [...new Set(trips.map((t) => monthKey(t.trpScheduledAt)))];
  const snapshots = await loadTruckRegionSnapshots(entId, monthsInResult);

  return trips.map((t) => {
    const km =
      t.trpStartOdometer != null && t.trpEndOdometer != null
        ? t.trpEndOdometer - t.trpStartOdometer
        : null;
    const extraCosts = extraByTrip.get(t.trpId) ?? [];
    const mk = monthKey(t.trpScheduledAt);
    /* Fuel = frozen snapshot (only when it covers this trip) → live pool → 0.
     * Unit price + litres shown mirror the same source. */
    const tChangedAt = t.trpUpdatedAt ?? t.trpCreatedAt ?? null;
    const fuel = snapshots.fuelForTrip(mk, t.trpVehicleId, km ?? 0, tChangedAt);
    const tollFee = Math.round(parseAmount(t.trpTollFee));
    const extraTotal = Math.round(extraCosts.reduce((s, n) => s + (n || 0), 0));
    const revenue = Math.round(parseAmount(t.trpRevenue));
    const totalCost = fuel.cost + tollFee + extraTotal;
    const breakdown: TruckCostBreakdown = {
      fuelCost: fuel.cost,
      tollFee,
      extraTotal,
      totalCost,
      revenue,
      profit: revenue - totalCost,
    };
    const fuelUnitPrice = fuel.unitPrice;
    const fuelLiters = fuel.liters;
    /* The trip's own fuel spend — never pooled, never affected by other trips
     * or by "Lập báo cáo" (REQ-20260822). */
    const fuelActualLiters = parseAmount(t.trpFuelLiters);
    const fuelActualPrice = parseAmount(t.trpFuelPrice);
    const fuelActualCost = Math.round(fuelActualLiters * fuelActualPrice);

    return {
      trpId: t.trpId,
      ref: t.trpRef,
      scheduledAt: t.trpScheduledAt,
      customer: t.trpCustomer,
      bol: t.trpBol,
      status: t.trpStatus,
      plate: t.trpVehicleId ? plateByVeh.get(t.trpVehicleId) ?? null : null,
      region: t.trpVehicleId ? regionByVeh.get(t.trpVehicleId) ?? null : null,
      driver: t.trpDriverId ? driverByDrv.get(t.trpDriverId) ?? null : null,
      km,
      breakdown,
      updatedAt: t.trpUpdatedAt,
      startTime: t.trpStartedAt,
      endTime: t.trpEndedAt,
      startOdometer: t.trpStartOdometer,
      endOdometer: t.trpEndOdometer,
      pickup: t.trpPickupAddress,
      dropoff: t.trpDropoffAddress,
      cdf: t.trpCdf,
      notes: t.trpNotes,
      extraNote: (extraNoteByTrip.get(t.trpId) ?? []).join(', ') || null,
      fuelUnitPrice,
      fuelLiters,
      fuelActualLiters,
      fuelActualPrice,
      fuelActualCost,
      /* "Đã lập BC" only when the report actually covers this trip (generated
       * after its last change) — see BUG-260730 case 1. */
      finalized: snapshots.isReported(mk, t.trpVehicleId, tChangedAt),
    };
  });
}

/** Most recent driver per truck (derived from trip-log history) — keyed by
 * vehicle id. Trucks aren't statically assigned a driver, so the fleet card
 * shows whoever drove the latest logged trip. */
export async function getLatestTruckDrivers(entId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({
      vehicleId: carTrips.trpVehicleId,
      driverName: carUsers.usrName,
      scheduledAt: carTrips.trpScheduledAt,
    })
    .from(carTrips)
    .leftJoin(carDrivers, eq(carTrips.trpDriverId, carDrivers.drvId))
    .leftJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .where(
      and(
        eq(carTrips.entId, entId),
        eq(carTrips.trpKind, 'LOG'),
        isNotNull(carTrips.trpVehicleId),
        isNull(carTrips.trpDeletedAt),
      ),
    )
    .orderBy(desc(carTrips.trpScheduledAt));

  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.vehicleId && r.driverName && !map.has(r.vehicleId)) map.set(r.vehicleId, r.driverName);
  }
  return map;
}

/** Most recent vehicle plate per driver (from trip-log history) — keyed by
 * driver id. Drivers aren't statically assigned a truck, so the roster shows
 * the latest one they drove. */
export async function getLatestVehiclesByDriver(entId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({
      driverId: carTrips.trpDriverId,
      plate: carVehicles.cvhPlateNumber,
      scheduledAt: carTrips.trpScheduledAt,
    })
    .from(carTrips)
    .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
    .where(
      and(
        eq(carTrips.entId, entId),
        eq(carTrips.trpKind, 'LOG'),
        isNotNull(carTrips.trpDriverId),
        isNotNull(carTrips.trpVehicleId),
        isNull(carTrips.trpDeletedAt),
      ),
    )
    .orderBy(desc(carTrips.trpScheduledAt));

  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.driverId && r.plate && !map.has(r.driverId)) map.set(r.driverId, r.plate);
  }
  return map;
}

export type TripCostKind = 'FUEL' | 'TOLL' | 'EXTRA';

export interface TripCostAttachmentView {
  id: string;
  costKind: TripCostKind;
  /** S3 key — the form echoes this back on save so kept attachments survive. */
  s3Key: string;
  mime: string;
  sizeBytes: number;
  /** Pre-signed GET URL (15-min TTL). Null when S3 isn't configured (dev). */
  signedUrl: string | null;
}

/** Live trip-cost receipt attachments (REQ-20260709) with signed GET URLs, for
 * the trip detail + edit form. Grouped by the caller via `costKind`. */
export async function getTripCostAttachmentsView(
  entId: string,
  tripId: string,
): Promise<TripCostAttachmentView[]> {
  const rows = await getTripCostAttachments(entId, tripId);
  return Promise.all(
    rows.map(async (r) => ({
      id: r.tcaId,
      costKind: r.tcaCostKind as TripCostKind,
      s3Key: r.tcaS3Key,
      mime: r.tcaMime,
      sizeBytes: r.tcaSizeBytes,
      signedUrl: await getSignedGetUrl(r.tcaS3Key),
    })),
  );
}

/** Structured extra-cost rows for one truck trip (detail breakdown). */
export async function getTripExtraCosts(
  entId: string,
  tripId: string,
): Promise<{ name: string; amount: number }[]> {
  const rows = await db
    .select({ name: carTripExtraCosts.tecName, amount: carTripExtraCosts.tecAmount })
    .from(carTripExtraCosts)
    .where(and(eq(carTripExtraCosts.entId, entId), eq(carTripExtraCosts.trpId, tripId)))
    .orderBy(carTripExtraCosts.tecCreatedAt);
  return rows.map((r) => ({ name: r.name, amount: parseAmount(r.amount) }));
}
