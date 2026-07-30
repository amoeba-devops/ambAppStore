import { and, eq, gte, isNotNull, isNull, lt } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTrips, carTruckFuelInvoices, carVehicles } from '@car-v2/db/schema';
import { parseAmount } from './truck-cost';

/**
 * A vehicle's fuel pool for ONE month: what it actually spent on fuel, and the
 * km it ran. `costPerKm = money ÷ km` is what each trip km is charged, so
 * `Σ over the vehicle's trips (km × costPerKm) = money` — the allocation
 * reconciles exactly to the vehicle's real monthly fuel spend.
 *
 * This is the ONLY rule for per-trip fuel (QA 2026-07-30): fuel is NEVER
 * derived from the vehicle's định mức (quota × price). The quota/price fields
 * stay on the vehicle as reference data only.
 */
export interface VehicleFuelPool {
  month: string;
  vehicleId: string;
  /** Σ fuel spend for the month (VND) — from ONE channel: the monthly fuel
   * invoices when the vehicle has any, otherwise the fuel recorded on its trips. */
  money: number;
  /** Σ litres behind `money`. */
  liters: number;
  /** Σ km of the vehicle's completed trip-logs in the month. */
  km: number;
  /** money ÷ km (đ/km); 0 when either side is missing. */
  costPerKm: number;
  /** Mean unit price of the fuel entries (đ/L) — shown as the trip's "Đơn giá". */
  avgPrice: number;
  /** Which channel `money` came from — see the precedence in `loadVehicleFuelPool`. */
  source: 'INVOICE' | 'TRIP' | 'NONE';
}

export const fuelPoolKey = (month: string, vehicleId: string): string => `${month}|${vehicleId}`;

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/**
 * Per-vehicle, per-month fuel pools computed LIVE from what has been recorded.
 *
 * Two channels can carry the same spend, so they are NOT summed — the monthly
 * fuel ledger WINS and the trips only fill the gap:
 *  - `car_truck_fuel_invoices` rows tagged with the vehicle (the finance
 *    screen's "Hoá đơn xăng dầu tháng") → `source: 'INVOICE'`;
 *  - otherwise, fuel entered on the vehicle's own trips
 *    (`trp_fuel_liters × trp_fuel_price`) → `source: 'TRIP'`.
 *
 * Summing them would double-count a fill-up that was both invoiced by
 * accounting and written on the trip that bought it — inflating real money
 * (seen while verifying: 4,37 tr đồng of invoices + the same fuel logged on the
 * trips read as 6,18 tr). One channel per vehicle-month keeps `money` equal to
 * what was actually spent, whichever way the tenant records it.
 *
 * km comes from COMPLETED trip-logs (end − start odometer) regardless of channel.
 * A trip that records fuel but no km still adds to `money`: the fill serves the
 * vehicle's other trips, which is precisely why the cost is pooled per month
 * instead of charged to the trip that happened to pay for it.
 *
 * `region` scopes by the vehicle's `cvh_region` (a region report only freezes
 * its own vehicles); omit it for the live, fleet-wide load.
 */
export async function loadVehicleFuelPool(
  entId: string,
  months: string[],
  region?: string,
): Promise<Map<string, VehicleFuelPool>> {
  const out = new Map<string, VehicleFuelPool>();
  const uniq = [...new Set(months)].filter((m) => /^\d{4}-\d{2}$/.test(m));
  if (uniq.length === 0) return out;

  /* One range covering every requested month, then bucket by the row's own
   * month — cheaper than N queries and the months asked for are contiguous in
   * practice (a single month, or a year's P&L). */
  const sorted = [...uniq].sort();
  const rangeStart = new Date(`${sorted[0]}-01T00:00:00.000Z`);
  const lastStart = new Date(`${sorted[sorted.length - 1]}-01T00:00:00.000Z`);
  const rangeEnd = new Date(Date.UTC(lastStart.getUTCFullYear(), lastStart.getUTCMonth() + 1, 1));
  const wanted = new Set(uniq);

  const [invoices, trips] = await Promise.all([
    db
      .select({
        month: carTruckFuelInvoices.tfiMonth,
        vehicleId: carTruckFuelInvoices.tfiVehicleId,
        liters: carTruckFuelInvoices.tfiLiters,
        price: carTruckFuelInvoices.tfiPrice,
      })
      .from(carTruckFuelInvoices)
      .leftJoin(carVehicles, eq(carTruckFuelInvoices.tfiVehicleId, carVehicles.cvhId))
      .where(
        and(
          eq(carTruckFuelInvoices.entId, entId),
          eq(carTruckFuelInvoices.tfiVehicleType, 'TRUCK'),
          gte(carTruckFuelInvoices.tfiMonth, sorted[0]!),
          isNull(carTruckFuelInvoices.tfiDeletedAt),
          isNotNull(carTruckFuelInvoices.tfiVehicleId),
          region ? eq(carVehicles.cvhRegion, region) : undefined,
        ),
      ),
    db
      .select({
        scheduledAt: carTrips.trpScheduledAt,
        vehicleId: carTrips.trpVehicleId,
        so: carTrips.trpStartOdometer,
        eo: carTrips.trpEndOdometer,
        liters: carTrips.trpFuelLiters,
        price: carTrips.trpFuelPrice,
      })
      .from(carTrips)
      .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
      .where(
        and(
          eq(carTrips.entId, entId),
          eq(carTrips.trpKind, 'LOG'),
          eq(carTrips.trpStatus, 'COMPLETED'),
          isNull(carTrips.trpDeletedAt),
          gte(carTrips.trpScheduledAt, rangeStart),
          lt(carTrips.trpScheduledAt, rangeEnd),
          region ? eq(carVehicles.cvhRegion, region) : undefined,
        ),
      ),
  ]);

  interface Side {
    money: number;
    liters: number;
    prices: number[];
  }
  interface Agg {
    invoice: Side;
    trip: Side;
    km: number;
  }
  const agg = new Map<string, Agg>();
  const bucket = (month: string, vehicleId: string): Agg => {
    const k = fuelPoolKey(month, vehicleId);
    let g = agg.get(k);
    if (!g) {
      g = { invoice: { money: 0, liters: 0, prices: [] }, trip: { money: 0, liters: 0, prices: [] }, km: 0 };
      agg.set(k, g);
    }
    return g;
  };
  const add = (side: Side, liters: number, price: number) => {
    side.money += liters * price;
    side.liters += liters;
    if (price > 0) side.prices.push(price);
  };

  for (const i of invoices) {
    if (!i.vehicleId || !wanted.has(i.month)) continue;
    add(bucket(i.month, i.vehicleId).invoice, parseAmount(i.liters), parseAmount(i.price));
  }

  for (const t of trips) {
    if (!t.vehicleId) continue;
    const month = monthKey(t.scheduledAt);
    if (!wanted.has(month)) continue;
    const g = bucket(month, t.vehicleId);
    if (t.so != null && t.eo != null && t.eo > t.so) g.km += t.eo - t.so;
    const liters = parseAmount(t.liters);
    const price = parseAmount(t.price);
    if (liters > 0 && price > 0) add(g.trip, liters, price);
  }

  for (const [k, g] of agg) {
    const [month, vehicleId] = k.split('|') as [string, string];
    /* Ledger first, trips as the fallback — never both (see the note above). */
    const source: VehicleFuelPool['source'] =
      g.invoice.money > 0 ? 'INVOICE' : g.trip.money > 0 ? 'TRIP' : 'NONE';
    const side = source === 'INVOICE' ? g.invoice : g.trip;
    const money = source === 'NONE' ? 0 : side.money;
    out.set(k, {
      month,
      vehicleId,
      source,
      money: Math.round(money),
      liters: Math.round(side.liters * 100) / 100,
      km: g.km,
      /* 4 decimals: a đ/km rate multiplied by trip km, so the rounding error
       * per trip stays sub-đồng even on long hauls. */
      costPerKm: money > 0 && g.km > 0 ? Math.round((money / g.km) * 10000) / 10000 : 0,
      avgPrice: side.prices.length
        ? Math.round(side.prices.reduce((a, b) => a + b, 0) / side.prices.length)
        : 0,
    });
  }
  return out;
}
