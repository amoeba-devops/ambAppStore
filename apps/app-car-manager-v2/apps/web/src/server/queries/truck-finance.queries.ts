import 'server-only';
import { and, asc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckMonthClose, carTruckFuelInvoices, carTrips } from '@car-v2/db/schema';
import { CarError } from '@car-v2/shared/errors';
import { parseAmount } from '@car-v2/core/truck';

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
  /** Mean of invoice unit prices (đ/L). */
  avgPrice: number;
  invoiceLiters: number;
  /** Liters reported across the month's trips. */
  tripLiters: number;
  /** Km driven across the month's trips (end − start odometer). */
  totalKm: number;
  /** Consumption rate L/km = tripLiters ÷ totalKm. */
  consumption: number;
}

/** Monthly fuel reconciliation (REQ-20260623 P3): avg invoice price + the
 * fleet's consumption rate derived from trip distance. Analytics only. */
export async function getTruckFuelStats(entId: string, month: string): Promise<FuelStats> {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const [invs, trips] = await Promise.all([
    listFuelInvoices(entId, month),
    db
      .select({ liters: carTrips.trpFuelLiters, so: carTrips.trpStartOdometer, eo: carTrips.trpEndOdometer })
      .from(carTrips)
      .where(
        and(
          eq(carTrips.entId, entId),
          eq(carTrips.trpKind, 'LOG'),
          isNull(carTrips.trpDeletedAt),
          gte(carTrips.trpScheduledAt, start),
          lt(carTrips.trpScheduledAt, end),
        ),
      ),
  ]);
  const tripLiters = trips.reduce((a, t) => a + parseAmount(t.liters), 0);
  const totalKm = trips.reduce((a, t) => a + (t.so != null && t.eo != null ? t.eo - t.so : 0), 0);
  const avgPrice = invs.length ? Math.round(invs.reduce((a, i) => a + i.price, 0) / invs.length) : 0;
  const invoiceLiters = invs.reduce((a, i) => a + i.liters, 0);
  return {
    invoiceCount: invs.length,
    avgPrice,
    invoiceLiters,
    tripLiters,
    totalKm,
    consumption: totalKm > 0 ? tripLiters / totalKm : 0,
  };
}
