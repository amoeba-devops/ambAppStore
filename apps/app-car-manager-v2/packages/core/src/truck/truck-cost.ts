/**
 * Pure truck cost/profit math (REQ-20260617). No DB, no framework — unit-testable.
 *
 * Per the customer SRS (truck-req.txt §2.2):
 *   fuel_cost = fuel_qty (L) × fuel_price (VND/L)
 *   profit    = revenue − fuel_cost − toll_fee − Σ(other costs)
 * All amounts are VND integers; we round to whole đồng to avoid float drift.
 */

export interface TruckCostInput {
  fuelLiters: number | null;
  /** VND per litre. */
  fuelPrice: number | null;
  tollFee: number | null;
  /** Amounts of the structured "other costs" rows. */
  extraCosts: number[];
  revenue: number | null;
}

export interface TruckCostBreakdown {
  fuelCost: number;
  tollFee: number;
  extraTotal: number;
  /** fuelCost + tollFee + extraTotal */
  totalCost: number;
  revenue: number;
  /** revenue − totalCost */
  profit: number;
}

/** Parse a Drizzle DECIMAL (returned as string) into a number; null → 0. */
export function parseAmount(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function computeTruckCost(input: TruckCostInput): TruckCostBreakdown {
  const fuelCost = Math.round((input.fuelLiters ?? 0) * (input.fuelPrice ?? 0));
  const tollFee = Math.round(input.tollFee ?? 0);
  const extraTotal = Math.round(input.extraCosts.reduce((s, n) => s + (n || 0), 0));
  const totalCost = fuelCost + tollFee + extraTotal;
  const revenue = Math.round(input.revenue ?? 0);
  return { fuelCost, tollFee, extraTotal, totalCost, revenue, profit: revenue - totalCost };
}

/**
 * Month-end ("official") fuel cost of a single trip, per customer SRS
 * (`netcost.txt`): once a month is closed we know the fleet's monthly
 *   consumption rate (L/km) = Σ liters filled ÷ Σ km driven, and
 *   average price (đ/L)     = mean of that month's fuel-invoice unit prices.
 * Then  fuel cost of a trip = trip km × consumption × average price.
 *
 * Both factors are whole-month aggregates, so this is only computable after
 * close — before that the trip's fuel cost is "Tạm tính" (provisional). All
 * inputs are read from the frozen `car_truck_month_close` snapshot; result is
 * rounded to whole đồng. Returns 0 if km is non-positive.
 */
export function truckTripFuelCost(input: {
  km: number | null;
  consumption: number | null;
  avgPrice: number | null;
}): number {
  const km = input.km ?? 0;
  if (km <= 0) return 0;
  return Math.round(km * (input.consumption ?? 0) * (input.avgPrice ?? 0));
}

/**
 * DEFAULT per-trip fuel cost from the vehicle's own rate (REQ-20260724), used
 * live when the trip's month/region has NO frozen reconciliation snapshot — so
 * editing km recomputes the fuel immediately without any fuel invoices:
 *
 *   fuel cost = km × (quotaPer100Km / 100) × pricePerLitre
 *
 * `quotaPer100Km` = car_vehicles.cvh_fuel_quota (định mức, L/100km);
 * `pricePerLitre` = car_vehicles.cvh_fuel_price (đ/L). Returns 0 when km ≤ 0 or
 * either rate is missing/≤0 (the trip then surfaces the "Chưa đặt định mức"
 * badge — the vehicle needs its quota + price set). Rounded to whole đồng.
 */
export function truckTripFuelCostByVehicleRate(input: {
  km: number | null;
  quotaPer100Km: number | null;
  pricePerLitre: number | null;
}): number {
  const km = input.km ?? 0;
  const quota = input.quotaPer100Km ?? 0;
  const price = input.pricePerLitre ?? 0;
  if (km <= 0 || quota <= 0 || price <= 0) return 0;
  return Math.round(km * (quota / 100) * price);
}

/** True when the vehicle has both a fuel quota and price set (> 0) — i.e. the
 * vehicle-rate default fuel cost is computable. Drives the "Theo định mức" vs
 * "Chưa đặt định mức" distinction. */
export function hasVehicleFuelRate(quotaPer100Km: number | null, pricePerLitre: number | null): boolean {
  return (quotaPer100Km ?? 0) > 0 && (pricePerLitre ?? 0) > 0;
}
