import { and, eq, gte, lt, isNull, inArray } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carTrips,
  carTripExtraCosts,
  carTruckFixedCosts,
  carTruckMonthClose,
  carDrivers,
  carUserFleetAccess,
} from '@car-v2/db/schema';
import type { FleetActor } from '../types';
import { parseAmount, truckTripFuelCost } from './truck-cost';

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
  /** Sum of truck drivers' fixed monthly salary (fleet-level; 0 when filtered
   * to a single vehicle since driver salary isn't per-vehicle). */
  driverSalary: number;
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
    driverSalary: 0,
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
      startOdometer: carTrips.trpStartOdometer,
      endOdometer: carTrips.trpEndOdometer,
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

  /* Month-end fuel snapshot per closed month (REQ-20260629). The close is
   * dept-wide (ent, TRUCK, month) so the same avg price + consumption apply to
   * every truck's trips regardless of the vehicle filter. A month with a live
   * close row AND non-null snapshot → official fuel cost = km × consumption ×
   * avg price; otherwise the trip's own liters × price (fallback below). */
  const closeRows = await db
    .select({
      month: carTruckMonthClose.tmcMonth,
      avgPrice: carTruckMonthClose.tmcAvgPrice,
      consumption: carTruckMonthClose.tmcConsumption,
    })
    .from(carTruckMonthClose)
    .where(
      and(
        eq(carTruckMonthClose.entId, actor.entId),
        eq(carTruckMonthClose.tmcVehicleType, 'TRUCK'),
        inArray(carTruckMonthClose.tmcMonth, months),
        isNull(carTruckMonthClose.tmcDeletedAt),
      ),
    );
  const snapByMonth = new Map<string, { avgPrice: number; consumption: number }>();
  for (const c of closeRows) {
    if (c.avgPrice != null && c.consumption != null) {
      snapByMonth.set(c.month, {
        avgPrice: parseAmount(c.avgPrice),
        consumption: parseAmount(c.consumption),
      });
    }
  }

  /* Driver fixed salary — fleet-level monthly recurring cost. Only attributed
   * in the all-trucks view; a single-vehicle filter leaves it 0 because driver
   * salary isn't tied to a specific vehicle. */
  let driverSalaryTotal = 0;
  if (!q.vehicleId) {
    const drvRows = await db
      .select({ salary: carDrivers.drvFixedSalary })
      .from(carDrivers)
      .innerJoin(
        carUserFleetAccess,
        and(
          eq(carUserFleetAccess.usrId, carDrivers.drvUserId),
          eq(carUserFleetAccess.entId, actor.entId),
          eq(carUserFleetAccess.ufaVehicleType, 'TRUCK'),
          isNull(carUserFleetAccess.ufaDeletedAt),
        ),
      )
      .where(and(eq(carDrivers.entId, actor.entId), isNull(carDrivers.drvDeletedAt)));
    driverSalaryTotal = drvRows.reduce((s, r) => s + Math.round(parseAmount(r.salary)), 0);
  }

  const rows = new Map<string, TruckPnlRow>();
  for (const m of months) rows.set(m, emptyRow(m));

  for (const t of trips) {
    const mk = monthKey(t.scheduledAt);
    const row = rows.get(mk);
    if (!row) continue;
    row.revenue += Math.round(parseAmount(t.revenue));
    const snap = snapByMonth.get(mk);
    if (snap) {
      const km =
        t.startOdometer != null && t.endOdometer != null ? t.endOdometer - t.startOdometer : 0;
      row.fuelCost += truckTripFuelCost({ km, consumption: snap.consumption, avgPrice: snap.avgPrice });
    } else {
      row.fuelCost += Math.round(parseAmount(t.fuelLiters) * parseAmount(t.fuelPrice));
    }
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
    row.driverSalary = driverSalaryTotal;
    row.variableCost = row.fuelCost + row.tollFee + row.extraTotal;
    row.fixedCost = row.salary + row.depreciation + row.insurance + row.driverSalary;
    row.netProfit = row.revenue - row.variableCost - row.fixedCost;
  }

  return months.map((m) => rows.get(m)!);
}
