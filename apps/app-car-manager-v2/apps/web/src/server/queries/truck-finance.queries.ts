import 'server-only';
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
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
import { parseAmount, truckTripFuelCost } from '@car-v2/core/truck';

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

export async function isTruckMonthClosed(entId: string, month: string): Promise<boolean> {
  const rows = await db
    .select({ id: carTruckMonthClose.tmcId })
    .from(carTruckMonthClose)
    .where(
      and(
        eq(carTruckMonthClose.entId, entId),
        eq(carTruckMonthClose.tmcVehicleType, 'TRUCK'),
        eq(carTruckMonthClose.tmcMonth, month),
        isNull(carTruckMonthClose.tmcDeletedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Financial period lock (REQ-20260623 P4). Throws CAR-E1002 when the TRUCK book
 * for the trip's scheduled month is closed — blocks create/edit/delete/complete
 * so a finalized P&L can't change underneath the close.
 */
export async function assertTruckMonthOpen(entId: string, scheduledAt: Date): Promise<void> {
  const month = scheduledAt.toISOString().slice(0, 7);
  if (await isTruckMonthClosed(entId, month)) {
    throw new CarError('CAR-E1002', 409, `Financial month ${month} is closed`);
  }
}

export interface FuelInvoiceRow {
  id: string;
  date: string;
  station: string | null;
  liters: number;
  price: number;
}

export async function listFuelInvoices(entId: string, month: string): Promise<FuelInvoiceRow[]> {
  const rows = await db
    .select()
    .from(carTruckFuelInvoices)
    .where(
      and(
        eq(carTruckFuelInvoices.entId, entId),
        eq(carTruckFuelInvoices.tfiVehicleType, 'TRUCK'),
        eq(carTruckFuelInvoices.tfiMonth, month),
        isNull(carTruckFuelInvoices.tfiDeletedAt),
      ),
    )
    .orderBy(asc(carTruckFuelInvoices.tfiDate));
  return rows.map((r) => ({
    id: r.tfiId,
    date: r.tfiDate,
    station: r.tfiStation,
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
export async function getTruckFuelStats(entId: string, month: string): Promise<FuelStats> {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const [invs, trips] = await Promise.all([
    listFuelInvoices(entId, month),
    db
      .select({ so: carTrips.trpStartOdometer, eo: carTrips.trpEndOdometer })
      .from(carTrips)
      .where(
        and(
          eq(carTrips.entId, entId),
          eq(carTrips.trpKind, 'LOG'),
          eq(carTrips.trpStatus, 'COMPLETED'),
          isNull(carTrips.trpDeletedAt),
          gte(carTrips.trpScheduledAt, start),
          lt(carTrips.trpScheduledAt, end),
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

/** The live close row for a month (incl. frozen fuel snapshot) or open state. */
export async function getTruckMonthCloseInfo(entId: string, month: string): Promise<TruckMonthCloseInfo> {
  const [row] = await db
    .select()
    .from(carTruckMonthClose)
    .where(
      and(
        eq(carTruckMonthClose.entId, entId),
        eq(carTruckMonthClose.tmcVehicleType, 'TRUCK'),
        eq(carTruckMonthClose.tmcMonth, month),
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

export interface TruckFinanceTripRow {
  trpId: string;
  ref: string;
  scheduledAt: Date;
  plate: string | null;
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
  opts: { month: string; vehicleId?: string | null; q?: string },
): Promise<TruckFinanceTripRow[]> {
  const term = opts.q?.trim();
  const start = new Date(`${opts.month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const [closeInfo, trips] = await Promise.all([
    getTruckMonthCloseInfo(entId, opts.month),
    db
      .select({
        trpId: carTrips.trpId,
        ref: carTrips.trpRef,
        scheduledAt: carTrips.trpScheduledAt,
        customer: carTrips.trpCustomer,
        plate: carVehicles.cvhPlateNumber,
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

  const snap = closeInfo.closed ? closeInfo.snapshot : null;

  return trips.map((t) => {
    const km = t.so != null && t.eo != null ? t.eo - t.so : 0;
    const toll = Math.round(parseAmount(t.toll));
    const extra = Math.round(extraByTrip.get(t.trpId) ?? 0);
    const revenue = Math.round(parseAmount(t.revenue));
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
      plate: t.plate,
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

/** Reopen history for a month = soft-deleted close rows carrying a reason. */
export async function listTruckMonthAdjustments(
  entId: string,
  month: string,
): Promise<TruckMonthAdjustment[]> {
  const rows = await db
    .select()
    .from(carTruckMonthClose)
    .where(
      and(
        eq(carTruckMonthClose.entId, entId),
        eq(carTruckMonthClose.tmcVehicleType, 'TRUCK'),
        eq(carTruckMonthClose.tmcMonth, month),
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
