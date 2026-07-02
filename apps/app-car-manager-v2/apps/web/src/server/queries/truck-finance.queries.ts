import 'server-only';
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carTruckMonthClose,
  carTruckFuelInvoices,
  carTrips,
  carTripExtraCosts,
  carVehicles,
  carDrivers,
  carUsers,
} from '@car-v2/db/schema';
import { CarError } from '@car-v2/shared/errors';
import { parseAmount, truckTripFuelCost, computeTruckPnl, loadTruckRegionSnapshots } from '@car-v2/core/truck';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import type { AuthContext } from '@/lib/auth/get-current-user';

/** Months (of the given set) whose TRUCK book is closed. */
export async function getClosedTruckMonths(entId: string, months: string[]): Promise<Set<string>> {
  if (months.length === 0) return new Set();
  const rows = await db
    .select({ m: carTruckMonthClose.tmcMonth })
    .from(carTruckMonthClose)
    .where(
      and(
        eq(carTruckMonthClose.entId, entId),
        eq(carTruckMonthClose.tmcVehicleType, 'TRUCK'),
        inArray(carTruckMonthClose.tmcMonth, months),
        isNull(carTruckMonthClose.tmcDeletedAt),
      ),
    );
  return new Set(rows.map((r) => r.m));
}

/** Is (ent, TRUCK, month, region) closed? `region` null = the whole-fleet
 * (legacy / "all regions") close; a region code = that region's close. */
export async function isTruckMonthClosed(
  entId: string,
  month: string,
  region: string | null = null,
): Promise<boolean> {
  const rows = await db
    .select({ id: carTruckMonthClose.tmcId })
    .from(carTruckMonthClose)
    .where(
      and(
        eq(carTruckMonthClose.entId, entId),
        eq(carTruckMonthClose.tmcVehicleType, 'TRUCK'),
        eq(carTruckMonthClose.tmcMonth, month),
        region == null ? isNull(carTruckMonthClose.tmcRegion) : eq(carTruckMonthClose.tmcRegion, region),
        isNull(carTruckMonthClose.tmcDeletedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Financial period lock (REQ-20260623 P4, region-scoped REQ-20260630). Throws
 * CAR-E1002 when the book for the trip's (month, region) is closed — or a
 * whole-fleet close covers the month — so a finalized P&L can't change. Pass the
 * trip's region (its vehicle's cvh_region); omit for the whole-fleet check only.
 */
export async function assertTruckMonthOpen(
  entId: string,
  scheduledAt: Date,
  region: string | null = null,
): Promise<void> {
  const month = scheduledAt.toISOString().slice(0, 7);
  const closed =
    (region != null && (await isTruckMonthClosed(entId, month, region))) ||
    (await isTruckMonthClosed(entId, month, null));
  if (closed) {
    throw new CarError('CAR-E1002', 409, `Financial month ${month} is closed`);
  }
}

export interface FuelInvoiceRow {
  id: string;
  date: string;
  station: string | null;
  region: string | null;
  liters: number;
  price: number;
}

/** Fuel invoices for a month, optionally scoped to one region. */
export async function listFuelInvoices(
  entId: string,
  month: string,
  region?: string,
): Promise<FuelInvoiceRow[]> {
  const rows = await db
    .select()
    .from(carTruckFuelInvoices)
    .where(
      and(
        eq(carTruckFuelInvoices.entId, entId),
        eq(carTruckFuelInvoices.tfiVehicleType, 'TRUCK'),
        eq(carTruckFuelInvoices.tfiMonth, month),
        region ? eq(carTruckFuelInvoices.tfiRegion, region) : undefined,
        isNull(carTruckFuelInvoices.tfiDeletedAt),
      ),
    )
    .orderBy(asc(carTruckFuelInvoices.tfiDate));
  return rows.map((r) => ({
    id: r.tfiId,
    date: r.tfiDate,
    station: r.tfiStation,
    region: r.tfiRegion,
    liters: parseAmount(r.tfiLiters),
    price: parseAmount(r.tfiPrice),
  }));
}

export interface FuelStats {
  invoiceCount: number;
  /** Mean of invoice unit prices (đ/L) — customer rule: simple average, not
   * litre-weighted (netcost.txt §1.2). */
  avgPrice: number;
  /** Total litres filled this month (Σ invoice litres). */
  invoiceLiters: number;
  /** Km driven across the month's COMPLETED log trips (Σ end − start odometer). */
  totalKm: number;
  /** Consumption rate L/km = Σ invoice litres ÷ Σ trip km (netcost.txt §1.1). */
  consumption: number;
}

/**
 * Monthly fuel reconciliation = the month-end snapshot inputs (REQ-20260629).
 * Per customer SRS netcost.txt: consumption = Σ litres filled ÷ Σ km driven,
 * avg price = mean of invoice unit prices. The km base is the COMPLETED log
 * trips — the exact set the P&L allocates fuel cost over — so total allocated
 * fuel (Σ km × consumption × avgPrice) reconciles to invoiceLiters × avgPrice.
 * Computed live for an open month (preview); frozen onto car_truck_month_close
 * at close and read back from there for closed months.
 */
export async function getTruckFuelStats(entId: string, month: string, region?: string): Promise<FuelStats> {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const [invs, trips] = await Promise.all([
    listFuelInvoices(entId, month, region),
    db
      .select({ so: carTrips.trpStartOdometer, eo: carTrips.trpEndOdometer })
      .from(carTrips)
      .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
      .where(
        and(
          eq(carTrips.entId, entId),
          eq(carTrips.trpKind, 'LOG'),
          eq(carTrips.trpStatus, 'COMPLETED'),
          isNull(carTrips.trpDeletedAt),
          gte(carTrips.trpScheduledAt, start),
          lt(carTrips.trpScheduledAt, end),
          region ? eq(carVehicles.cvhRegion, region) : undefined,
        ),
      ),
  ]);
  const totalKm = trips.reduce((a, t) => a + (t.so != null && t.eo != null ? t.eo - t.so : 0), 0);
  const avgPrice = invs.length ? Math.round(invs.reduce((a, i) => a + i.price, 0) / invs.length) : 0;
  const invoiceLiters = invs.reduce((a, i) => a + i.liters, 0);
  return {
    invoiceCount: invs.length,
    avgPrice,
    invoiceLiters,
    totalKm,
    consumption: totalKm > 0 ? invoiceLiters / totalKm : 0,
  };
}

export interface TruckMonthCloseInfo {
  closed: boolean;
  closedAt: Date | null;
  /** Frozen snapshot stored at close; null for open months or pre-0016 closes. */
  snapshot: { avgPrice: number; consumption: number; totalLiters: number; totalKm: number } | null;
}

/** The live close row for a (month, region) — incl. frozen fuel snapshot — or
 * open state. `region` null = the whole-fleet (legacy) close. */
export async function getTruckMonthCloseInfo(
  entId: string,
  month: string,
  region: string | null = null,
): Promise<TruckMonthCloseInfo> {
  const [row] = await db
    .select()
    .from(carTruckMonthClose)
    .where(
      and(
        eq(carTruckMonthClose.entId, entId),
        eq(carTruckMonthClose.tmcVehicleType, 'TRUCK'),
        eq(carTruckMonthClose.tmcMonth, month),
        region == null ? isNull(carTruckMonthClose.tmcRegion) : eq(carTruckMonthClose.tmcRegion, region),
        isNull(carTruckMonthClose.tmcDeletedAt),
      ),
    )
    .limit(1);
  if (!row) return { closed: false, closedAt: null, snapshot: null };
  const snapshot =
    row.tmcAvgPrice != null && row.tmcConsumption != null
      ? {
          avgPrice: parseAmount(row.tmcAvgPrice),
          consumption: parseAmount(row.tmcConsumption),
          totalLiters: parseAmount(row.tmcTotalLiters),
          totalKm: parseAmount(row.tmcTotalKm),
        }
      : null;
  return { closed: true, closedAt: row.tmcClosedAt, snapshot };
}

export interface TruckRegionCloseState {
  region: string;
  closed: boolean;
  closedAt: Date | null;
  snapshot: TruckMonthCloseInfo['snapshot'];
}

/** Close state of every region for a month — drives the chốt-sổ-theo-khu-vực UI. */
export async function getTruckRegionCloseStates(
  entId: string,
  month: string,
): Promise<TruckRegionCloseState[]> {
  const rows = await db
    .select()
    .from(carTruckMonthClose)
    .where(
      and(
        eq(carTruckMonthClose.entId, entId),
        eq(carTruckMonthClose.tmcVehicleType, 'TRUCK'),
        eq(carTruckMonthClose.tmcMonth, month),
        isNotNull(carTruckMonthClose.tmcRegion),
        isNull(carTruckMonthClose.tmcDeletedAt),
      ),
    );
  const byRegion = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (r.tmcRegion) byRegion.set(r.tmcRegion, r);
  return TRUCK_REGIONS.map((region) => {
    const row = byRegion.get(region);
    const snapshot =
      row && row.tmcAvgPrice != null && row.tmcConsumption != null
        ? {
            avgPrice: parseAmount(row.tmcAvgPrice),
            consumption: parseAmount(row.tmcConsumption),
            totalLiters: parseAmount(row.tmcTotalLiters),
            totalKm: parseAmount(row.tmcTotalKm),
          }
        : null;
    return { region, closed: !!row, closedAt: row?.tmcClosedAt ?? null, snapshot };
  });
}

export interface TruckFinanceTripRow {
  trpId: string;
  ref: string;
  scheduledAt: Date;
  vehicleId: string | null;
  plate: string | null;
  model: string | null;
  driver: string | null;
  customer: string | null;
  km: number;
  toll: number;
  extra: number;
  /** Unit price shown: month avg (closed) or the trip's own price (open). */
  unitPrice: number;
  /** Litres shown: km × consumption (closed) or the trip's own litres (open). */
  liters: number;
  fuelCost: number;
  revenue: number;
  profit: number;
  /** true once the trip's month is closed → fuel/profit are official. */
  finalized: boolean;
}

/**
 * Per-trip cost & profit for the finance screen (REQ-20260629, R2). One row per
 * COMPLETED log trip in the month. When the month is closed the fuel cost is the
 * official month-end figure (km × snapshot consumption × snapshot avg price) and
 * `finalized` is true ("Đã chốt"); while open it's the trip's own litres × price,
 * flagged provisional ("Tạm tính"). Profit = revenue − fuel − toll − extra.
 */
export async function listTruckFinanceTrips(
  entId: string,
  opts: { month: string; vehicleId?: string | null; q?: string; region?: string | null },
): Promise<TruckFinanceTripRow[]> {
  const term = opts.q?.trim();
  const start = new Date(`${opts.month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const [snapshots, trips] = await Promise.all([
    loadTruckRegionSnapshots(entId, [opts.month]),
    db
      .select({
        trpId: carTrips.trpId,
        ref: carTrips.trpRef,
        scheduledAt: carTrips.trpScheduledAt,
        customer: carTrips.trpCustomer,
        vehicleId: carTrips.trpVehicleId,
        plate: carVehicles.cvhPlateNumber,
        model: carVehicles.cvhModel,
        driver: carUsers.usrName,
        fuelLiters: carTrips.trpFuelLiters,
        fuelPrice: carTrips.trpFuelPrice,
        so: carTrips.trpStartOdometer,
        eo: carTrips.trpEndOdometer,
        toll: carTrips.trpTollFee,
        revenue: carTrips.trpRevenue,
      })
      .from(carTrips)
      .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
      .leftJoin(carDrivers, eq(carTrips.trpDriverId, carDrivers.drvId))
      .leftJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
      .where(
        and(
          eq(carTrips.entId, entId),
          eq(carTrips.trpKind, 'LOG'),
          eq(carTrips.trpStatus, 'COMPLETED'),
          isNull(carTrips.trpDeletedAt),
          gte(carTrips.trpScheduledAt, start),
          lt(carTrips.trpScheduledAt, end),
          opts.vehicleId ? eq(carTrips.trpVehicleId, opts.vehicleId) : undefined,
          /* Region scope = the trip's vehicle operating region (cvh_region). */
          opts.region ? eq(carVehicles.cvhRegion, opts.region) : undefined,
          term
            ? or(
                ilike(carTrips.trpCustomer, `%${term}%`),
                ilike(carTrips.trpBol, `%${term}%`),
                ilike(carTrips.trpRef, `%${term}%`),
              )
            : undefined,
        ),
      )
      .orderBy(desc(carTrips.trpScheduledAt)),
  ]);

  const ids = trips.map((t) => t.trpId);
  const extras = ids.length
    ? await db
        .select({ trpId: carTripExtraCosts.trpId, amount: carTripExtraCosts.tecAmount })
        .from(carTripExtraCosts)
        .where(and(eq(carTripExtraCosts.entId, entId), inArray(carTripExtraCosts.trpId, ids)))
    : [];
  const extraByTrip = new Map<string, number>();
  for (const e of extras) {
    extraByTrip.set(e.trpId, (extraByTrip.get(e.trpId) ?? 0) + parseAmount(e.amount));
  }

  return trips.map((t) => {
    const km = t.so != null && t.eo != null ? t.eo - t.so : 0;
    const toll = Math.round(parseAmount(t.toll));
    const extra = Math.round(extraByTrip.get(t.trpId) ?? 0);
    const revenue = Math.round(parseAmount(t.revenue));
    /* Region-scoped snapshot: official fuel only when this trip's region's
     * month is closed (or a whole-fleet close exists). */
    const snap = snapshots.forTrip(opts.month, t.vehicleId);
    const finalized = snap != null;
    const unitPrice = finalized ? snap.avgPrice : parseAmount(t.fuelPrice);
    const liters = finalized ? km * snap.consumption : parseAmount(t.fuelLiters);
    const fuelCost = finalized
      ? truckTripFuelCost({ km, consumption: snap.consumption, avgPrice: snap.avgPrice })
      : Math.round(parseAmount(t.fuelLiters) * parseAmount(t.fuelPrice));
    return {
      trpId: t.trpId,
      ref: t.ref,
      scheduledAt: t.scheduledAt,
      vehicleId: t.vehicleId,
      plate: t.plate,
      model: t.model,
      driver: t.driver,
      customer: t.customer,
      km,
      toll,
      extra,
      unitPrice,
      liters,
      fuelCost,
      revenue,
      profit: revenue - fuelCost - toll - extra,
      finalized,
    };
  });
}

export interface TruckMonthAdjustment {
  reason: string;
  reopenedBy: string | null;
  reopenedAt: Date | null;
}

/** Reopen history for a (month, region) = soft-deleted close rows carrying a
 * reason. `region` null = whole-fleet (legacy) close history. */
export async function listTruckMonthAdjustments(
  entId: string,
  month: string,
  region: string | null = null,
): Promise<TruckMonthAdjustment[]> {
  const rows = await db
    .select()
    .from(carTruckMonthClose)
    .where(
      and(
        eq(carTruckMonthClose.entId, entId),
        eq(carTruckMonthClose.tmcVehicleType, 'TRUCK'),
        eq(carTruckMonthClose.tmcMonth, month),
        region == null ? isNull(carTruckMonthClose.tmcRegion) : eq(carTruckMonthClose.tmcRegion, region),
        isNotNull(carTruckMonthClose.tmcDeletedAt),
        isNotNull(carTruckMonthClose.tmcReopenReason),
      ),
    )
    .orderBy(desc(carTruckMonthClose.tmcReopenedAt));
  return rows.map((r) => ({
    reason: r.tmcReopenReason ?? '',
    reopenedBy: r.tmcReopenedBy,
    reopenedAt: r.tmcReopenedAt,
  }));
}

/* ── Report review (REQ-20260629, design "Lập báo cáo" Bước 2) ──────────────── */

export interface ReportReviewTrip {
  trpId: string;
  ref: string;
  scheduledAt: Date;
  customer: string | null;
  km: number;
  toll: number;
  extra: number;
  fuelCost: number;
  revenue: number;
  profit: number;
  finalized: boolean;
}

export interface ReportReviewVehicle {
  vehicleId: string | null;
  plate: string;
  model: string | null;
  tripCount: number;
  totalFuel: number;
  totalToll: number;
  totalExtra: number;
  totalRevenue: number;
  /** Σ trip profit (revenue − fuel − toll − extra) before fixed costs. */
  variableProfit: number;
  /** Monthly fixed cost (salary/depreciation/insurance/driver) for this truck. */
  fixedCost: number;
  trips: ReportReviewTrip[];
}

export interface TruckReportReview {
  month: string;
  /** Operating region the report is scoped to; `null` = all regions. */
  region: string | null;
  /** Closed → trips are locked, the review table is read-only. */
  closed: boolean;
  /** Fleet-level month fuel reconciliation (same number for every vehicle —
   * our fuel model is fleet-monthly, not per-vehicle). */
  avgPrice: number;
  consumption: number;
  refuelCount: number;
  vehicles: ReportReviewVehicle[];
  totals: {
    tripCount: number;
    revenue: number;
    fuel: number;
    toll: number;
    extra: number;
    fixedCost: number;
    net: number;
  };
}

/**
 * Per-vehicle review for the "Lập báo cáo" Bước 2 screen: every truck that had a
 * COMPLETED log trip in `month`, with its trips + summary (trip count, fuel,
 * fixed cost) and the fleet-level fuel reconciliation. Mirrors the design's
 * confirm screen so a manager can sanity-check (and edit) costs before the
 * report is generated. Read-only when the month is closed.
 */
export async function getTruckReportReview(
  actor: AuthContext,
  month: string,
  /** Operating region scope; `null` = all regions (whole-fleet reconciliation). */
  region: string | null = null,
): Promise<TruckReportReview> {
  const [trips, stats, closeInfo] = await Promise.all([
    listTruckFinanceTrips(actor.entId, { month, region }),
    getTruckFuelStats(actor.entId, month, region ?? undefined),
    getTruckMonthCloseInfo(actor.entId, month, region),
  ]);

  const byVeh = new Map<string, ReportReviewVehicle>();
  for (const t of trips) {
    const key = t.vehicleId ?? '∅';
    let g = byVeh.get(key);
    if (!g) {
      g = {
        vehicleId: t.vehicleId,
        plate: t.plate ?? '—',
        model: t.model,
        tripCount: 0,
        totalFuel: 0,
        totalToll: 0,
        totalExtra: 0,
        totalRevenue: 0,
        variableProfit: 0,
        fixedCost: 0,
        trips: [],
      };
      byVeh.set(key, g);
    }
    g.trips.push({
      trpId: t.trpId,
      ref: t.ref,
      scheduledAt: t.scheduledAt,
      customer: t.customer,
      km: t.km,
      toll: t.toll,
      extra: t.extra,
      fuelCost: t.fuelCost,
      revenue: t.revenue,
      profit: t.profit,
      finalized: t.finalized,
    });
    g.tripCount += 1;
    g.totalFuel += t.fuelCost;
    g.totalToll += t.toll;
    g.totalExtra += t.extra;
    g.totalRevenue += t.revenue;
    g.variableProfit += t.profit;
  }

  const vehicles = [...byVeh.values()].sort((a, b) => a.plate.localeCompare(b.plate));
  /* Per-vehicle fixed cost (salary/depreciation/insurance/driver) for the month. */
  await Promise.all(
    vehicles.map(async (v) => {
      if (!v.vehicleId) return;
      const [pnl] = await computeTruckPnl(actor, { vehicleId: v.vehicleId, months: [month] });
      v.fixedCost = pnl?.fixedCost ?? 0;
    }),
  );

  const totals = vehicles.reduce(
    (a, v) => ({
      tripCount: a.tripCount + v.tripCount,
      revenue: a.revenue + v.totalRevenue,
      fuel: a.fuel + v.totalFuel,
      toll: a.toll + v.totalToll,
      extra: a.extra + v.totalExtra,
      fixedCost: a.fixedCost + v.fixedCost,
      net: a.net + v.variableProfit - v.fixedCost,
    }),
    { tripCount: 0, revenue: 0, fuel: 0, toll: 0, extra: 0, fixedCost: 0, net: 0 },
  );

  return {
    month,
    region,
    closed: closeInfo.closed,
    avgPrice: stats.avgPrice,
    consumption: stats.consumption,
    refuelCount: stats.invoiceCount,
    vehicles,
    totals,
  };
}

/**
 * Completed-LOG-trip count per month (YYYY-MM). Drives the report month
 * picker's "has data" guard — a month with 0 completed trips can't be advanced
 * (the report would be empty), so the user is stopped at step 1 instead of
 * discovering emptiness at the review step.
 */
export async function getTruckMonthTripCounts(entId: string): Promise<Record<string, number>> {
  const monthExpr = sql<string>`to_char(${carTrips.trpScheduledAt}, 'YYYY-MM')`;
  const rows = await db
    .select({ month: monthExpr, n: sql<number>`count(*)::int` })
    .from(carTrips)
    .where(
      and(
        eq(carTrips.entId, entId),
        eq(carTrips.trpKind, 'LOG'),
        eq(carTrips.trpStatus, 'COMPLETED'),
        isNull(carTrips.trpDeletedAt),
      ),
    )
    .groupBy(monthExpr);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.month] = r.n;
  return out;
}

/**
 * Completed-LOG-trip counts for a month, split by operating region (a trip's
 * region = its vehicle's cvh_region). `total` counts every completed trip
 * (incl. vehicles with no region) → the "Tất cả khu vực" scope; `byRegion`
 * drives the per-region guard at step 2.
 */
export async function getTruckRegionTripCounts(
  entId: string,
  month: string,
): Promise<{ total: number; byRegion: Record<string, number> }> {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const rows = await db
    .select({ region: carVehicles.cvhRegion, n: sql<number>`count(*)::int` })
    .from(carTrips)
    .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
    .where(
      and(
        eq(carTrips.entId, entId),
        eq(carTrips.trpKind, 'LOG'),
        eq(carTrips.trpStatus, 'COMPLETED'),
        isNull(carTrips.trpDeletedAt),
        gte(carTrips.trpScheduledAt, start),
        lt(carTrips.trpScheduledAt, end),
      ),
    )
    .groupBy(carVehicles.cvhRegion);
  const byRegion: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    total += r.n;
    if (r.region) byRegion[r.region] = (byRegion[r.region] ?? 0) + r.n;
  }
  return { total, byRegion };
}
