import { and, eq, gte, lt, isNull, inArray } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTrips, carTripExtraCosts, carTruckFixedCosts } from '@car-v2/db/schema';
import type { FleetActor } from '../types';
import { parseAmount } from './truck-cost';

/**
 * Monthly P&L per truck (REQ-20260617, customer SRS §2.3):
 *   net profit = revenue − variable (fuel + toll + extra) − fixed (salary +
 *   depreciation + insurance). Variable costs auto-aggregate from COMPLETED
 *   LOG trips; fixed costs come from car_truck_fixed_costs.
 *
 * Small dataset (a handful of trucks) → aggregate in JS for clarity. Month
 * bucketing uses the trip's scheduled date in UTC ('YYYY-MM').
 */

export interface TruckPnlRow {
  month: string;
  revenue: number;
  fuelCost: number;
  tollFee: number;
  extraTotal: number;
  variableCost: number;
  salary: number;
  depreciation: number;
  insurance: number;
  fixedCost: number;
  tripCount: number;
  netProfit: number;
}

export interface TruckPnlQuery {
  vehicleId?: string | null;
  /** Months to report, 'YYYY-MM'. */
  months: string[];
}

function emptyRow(month: string): TruckPnlRow {
  return {
    month,
    revenue: 0,
    fuelCost: 0,
    tollFee: 0,
    extraTotal: 0,
    variableCost: 0,
    salary: 0,
    depreciation: 0,
    insurance: 0,
    fixedCost: 0,
    tripCount: 0,
    netProfit: 0,
  };
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function monthEndExclusive(month: string): Date {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

export async function computeTruckPnl(actor: FleetActor, q: TruckPnlQuery): Promise<TruckPnlRow[]> {
  const months = [...new Set(q.months)].sort();
  if (months.length === 0) return [];

  const firstMonth = months[0]!;
  const lastMonth = months[months.length - 1]!;
  const rangeStart = new Date(`${firstMonth}-01T00:00:00.000Z`);
  const rangeEnd = monthEndExclusive(lastMonth);

  const trips = await db
    .select({
      trpId: carTrips.trpId,
      scheduledAt: carTrips.trpScheduledAt,
      fuelLiters: carTrips.trpFuelLiters,
      fuelPrice: carTrips.trpFuelPrice,
      tollFee: carTrips.trpTollFee,
      revenue: carTrips.trpRevenue,
    })
    .from(carTrips)
    .where(
      and(
        eq(carTrips.entId, actor.entId),
        eq(carTrips.trpKind, 'LOG'),
        eq(carTrips.trpStatus, 'COMPLETED'),
        isNull(carTrips.trpDeletedAt),
        gte(carTrips.trpScheduledAt, rangeStart),
        lt(carTrips.trpScheduledAt, rangeEnd),
        q.vehicleId ? eq(carTrips.trpVehicleId, q.vehicleId) : undefined,
      ),
    );

  const tripIds = trips.map((t) => t.trpId);
  const extras = tripIds.length
    ? await db
        .select({ trpId: carTripExtraCosts.trpId, amount: carTripExtraCosts.tecAmount })
        .from(carTripExtraCosts)
        .where(
          and(
            eq(carTripExtraCosts.entId, actor.entId),
            inArray(carTripExtraCosts.trpId, tripIds),
          ),
        )
    : [];
  const extraByTrip = new Map<string, number>();
  for (const e of extras) {
    extraByTrip.set(e.trpId, (extraByTrip.get(e.trpId) ?? 0) + parseAmount(e.amount));
  }

  const fixed = await db
    .select()
    .from(carTruckFixedCosts)
    .where(
      and(
        eq(carTruckFixedCosts.entId, actor.entId),
        inArray(carTruckFixedCosts.tfcMonth, months),
        q.vehicleId ? eq(carTruckFixedCosts.cvhId, q.vehicleId) : undefined,
      ),
    );

  const rows = new Map<string, TruckPnlRow>();
  for (const m of months) rows.set(m, emptyRow(m));

  for (const t of trips) {
    const row = rows.get(monthKey(t.scheduledAt));
    if (!row) continue;
    row.revenue += Math.round(parseAmount(t.revenue));
    row.fuelCost += Math.round(parseAmount(t.fuelLiters) * parseAmount(t.fuelPrice));
    row.tollFee += Math.round(parseAmount(t.tollFee));
    row.extraTotal += Math.round(extraByTrip.get(t.trpId) ?? 0);
    row.tripCount += 1;
  }

  for (const f of fixed) {
    const row = rows.get(f.tfcMonth);
    if (!row) continue;
    row.salary += Math.round(parseAmount(f.tfcSalary));
    row.depreciation += Math.round(parseAmount(f.tfcDepreciation));
    row.insurance += Math.round(parseAmount(f.tfcInsurance));
  }

  for (const row of rows.values()) {
    row.variableCost = row.fuelCost + row.tollFee + row.extraTotal;
    row.fixedCost = row.salary + row.depreciation + row.insurance;
    row.netProfit = row.revenue - row.variableCost - row.fixedCost;
  }

  return months.map((m) => rows.get(m)!);
}
