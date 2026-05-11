import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { costs, drivers, trips, users, vehicles, costAttachments } from '@/lib/db/schema';
import type { CostType } from '@repo/api-types';

// ============================================================================
// Dashboard summary  (PRD §5.8 area 3)
// ============================================================================
export type DashboardSummary = {
  vehicles: { inUse: number; available: number; maintenance: number };
  period: {
    from: string;
    to: string;
    totalTrips: number;
    totalCost: number;
    totalCostByType: Record<CostType, number>;
    topPassengers: Array<{ userId: string; fullName: string; tripCount: number }>;
    costByVehicle: Array<{ vehicleId: string; licensePlate: string; total: number }>;
    costOverTime: Array<{ date: string; total: number }>;
  };
};

export async function getDashboardSummary(args: { from: string; to: string }): Promise<DashboardSummary> {
  const { from, to } = args;

  // Vehicle counts
  const [vehicleCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      maintenance: sql<number>`count(*) filter (where status = 'MAINTENANCE')::int`,
      active: sql<number>`count(*) filter (where status = 'ACTIVE')::int`,
    })
    .from(vehicles);

  const inUseRows = await db
    .selectDistinct({ vehicleId: trips.vehicleId })
    .from(trips)
    .where(eq(trips.status, 'IN_PROGRESS'));
  const inUse = inUseRows.length;

  // Trips in period
  const [tripCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trips)
    .where(and(gte(trips.tripDate, from), lte(trips.tripDate, to)));

  // Costs in period
  const costAggRows = await db
    .select({
      type: costs.type,
      total: sql<string>`coalesce(sum(${costs.amount}), 0)::text`,
    })
    .from(costs)
    .where(
      and(
        gte(costs.costDate, from),
        lte(costs.costDate, to),
        inArray(costs.status, ['APPROVED', 'SUBMITTED'] as const),
      ),
    )
    .groupBy(costs.type);

  const totalCostByType: Record<CostType, number> = {
    FUEL: 0,
    OIL_CHANGE: 0,
    ACCIDENT: 0,
    MEAL: 0,
    REPAIR_MAINTENANCE: 0,
  };
  let totalCost = 0;
  for (const row of costAggRows) {
    const n = Number(row.total);
    totalCostByType[row.type] = n;
    totalCost += n;
  }

  // Top 5 passengers in period
  const topPassengers = await db
    .select({
      userId: trips.passengerId,
      fullName: users.fullName,
      tripCount: sql<number>`count(*)::int`,
    })
    .from(trips)
    .innerJoin(users, eq(users.id, trips.passengerId))
    .where(and(gte(trips.tripDate, from), lte(trips.tripDate, to)))
    .groupBy(trips.passengerId, users.fullName)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  // Cost by vehicle
  const costByVehicle = await db
    .select({
      vehicleId: costs.vehicleId,
      licensePlate: vehicles.licensePlate,
      total: sql<string>`coalesce(sum(${costs.amount}), 0)::text`,
    })
    .from(costs)
    .innerJoin(vehicles, eq(vehicles.id, costs.vehicleId))
    .where(
      and(
        gte(costs.costDate, from),
        lte(costs.costDate, to),
        inArray(costs.status, ['APPROVED', 'SUBMITTED'] as const),
      ),
    )
    .groupBy(costs.vehicleId, vehicles.licensePlate)
    .orderBy(desc(sql`sum(${costs.amount})`));

  // Cost over time (daily)
  const costOverTime = await db
    .select({
      date: costs.costDate,
      total: sql<string>`coalesce(sum(${costs.amount}), 0)::text`,
    })
    .from(costs)
    .where(
      and(
        gte(costs.costDate, from),
        lte(costs.costDate, to),
        inArray(costs.status, ['APPROVED', 'SUBMITTED'] as const),
      ),
    )
    .groupBy(costs.costDate)
    .orderBy(asc(costs.costDate));

  return {
    vehicles: {
      inUse,
      available: Math.max(0, (vehicleCounts?.active ?? 0) - inUse),
      maintenance: vehicleCounts?.maintenance ?? 0,
    },
    period: {
      from,
      to,
      totalTrips: tripCount?.count ?? 0,
      totalCost,
      totalCostByType,
      topPassengers: topPassengers.map((p) => ({
        userId: p.userId,
        fullName: p.fullName,
        tripCount: p.tripCount,
      })),
      costByVehicle: costByVehicle.map((c) => ({
        vehicleId: c.vehicleId,
        licensePlate: c.licensePlate,
        total: Number(c.total),
      })),
      costOverTime: costOverTime.map((c) => ({ date: c.date, total: Number(c.total) })),
    },
  };
}

// ============================================================================
// Export queries
// ============================================================================
export type CostExportRow = {
  costDate: string;
  type: CostType;
  licensePlate: string;
  vehicleType: string;
  amount: string;
  currency: string;
  description: string | null;
  status: string;
  submitterName: string;
  approverName: string | null;
  metadata: Record<string, unknown>;
};

export async function fetchCostsForExport(args: {
  from: string;
  to: string;
  vehicleId?: string;
  type?: CostType;
}): Promise<CostExportRow[]> {
  const conds = [gte(costs.costDate, args.from), lte(costs.costDate, args.to)];
  if (args.vehicleId) conds.push(eq(costs.vehicleId, args.vehicleId));
  if (args.type) conds.push(eq(costs.type, args.type));

  const submitter = users;
  const approver = users;

  const rows = await db
    .select({
      cost: costs,
      vehicle: { licensePlate: vehicles.licensePlate, vehicleType: vehicles.vehicleType },
      submitterName: submitter.fullName,
    })
    .from(costs)
    .innerJoin(vehicles, eq(vehicles.id, costs.vehicleId))
    .innerJoin(submitter, eq(submitter.id, costs.submittedBy))
    .where(and(...conds))
    .orderBy(asc(costs.costDate));

  // Approver join is optional — fetch separately to avoid duplicate alias
  const approverIds = rows.map((r) => r.cost.approvedBy).filter((x): x is string => Boolean(x));
  const approverMap = new Map<string, string>();
  if (approverIds.length > 0) {
    const approverRows = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, approverIds));
    for (const a of approverRows) approverMap.set(a.id, a.fullName);
  }

  return rows.map((r) => ({
    costDate: r.cost.costDate,
    type: r.cost.type,
    licensePlate: r.vehicle.licensePlate,
    vehicleType: r.vehicle.vehicleType,
    amount: r.cost.amount,
    currency: r.cost.currency,
    description: r.cost.description,
    status: r.cost.status,
    submitterName: r.submitterName,
    approverName: r.cost.approvedBy ? approverMap.get(r.cost.approvedBy) ?? null : null,
    metadata: r.cost.metadata as Record<string, unknown>,
  }));
}

export type TripExportRow = {
  tripDate: string;
  tripTime: string;
  estimatedEndTime: string | null;
  passengerName: string;
  driverName: string;
  licensePlate: string;
  pickupAddress: string;
  destinationAddress: string;
  status: string;
  note: string | null;
};

export async function fetchTripsForExport(args: {
  from: string;
  to: string;
  vehicleId?: string;
  driverId?: string;
}): Promise<TripExportRow[]> {
  const conds = [gte(trips.tripDate, args.from), lte(trips.tripDate, args.to)];
  if (args.vehicleId) conds.push(eq(trips.vehicleId, args.vehicleId));
  if (args.driverId) conds.push(eq(trips.driverId, args.driverId));

  const rows = await db
    .select({
      trip: trips,
      passengerName: users.fullName,
      driverName: drivers.fullName,
      licensePlate: vehicles.licensePlate,
    })
    .from(trips)
    .innerJoin(users, eq(users.id, trips.passengerId))
    .innerJoin(drivers, eq(drivers.id, trips.driverId))
    .innerJoin(vehicles, eq(vehicles.id, trips.vehicleId))
    .where(and(...conds))
    .orderBy(asc(trips.tripDate), asc(trips.tripTime));

  return rows.map((r) => ({
    tripDate: r.trip.tripDate,
    tripTime: r.trip.tripTime.slice(0, 5),
    estimatedEndTime: r.trip.estimatedEndTime?.slice(0, 5) ?? null,
    passengerName: r.passengerName,
    driverName: r.driverName,
    licensePlate: r.licensePlate,
    pickupAddress: (r.trip.pickupLocation as { address: string }).address,
    destinationAddress: (r.trip.destination as { address: string }).address,
    status: r.trip.status,
    note: r.trip.note,
  }));
}

export async function fetchCostsByTypeForExport(args: {
  from: string;
  to: string;
  type: CostType;
}): Promise<Array<CostExportRow & { attachments: number }>> {
  const rows = await fetchCostsForExport({ from: args.from, to: args.to, type: args.type });
  // Count attachments per cost
  const ids: string[] = [];
  for (const r of rows) {
    // Need to fetch cost ids — refetch with id
  }
  // Simpler: fetch attachments grouped
  const attachmentCounts = await db
    .select({
      costId: costAttachments.costId,
      count: sql<number>`count(*)::int`,
    })
    .from(costAttachments)
    .innerJoin(costs, eq(costs.id, costAttachments.costId))
    .where(
      and(
        gte(costs.costDate, args.from),
        lte(costs.costDate, args.to),
        eq(costs.type, args.type),
      ),
    )
    .groupBy(costAttachments.costId);
  const map = new Map<string, number>();
  for (const a of attachmentCounts) map.set(a.costId, a.count);

  // Refetch with cost id for join
  const detailedRows = await db
    .select({
      cost: costs,
      vehicle: { licensePlate: vehicles.licensePlate, vehicleType: vehicles.vehicleType },
      submitterName: users.fullName,
    })
    .from(costs)
    .innerJoin(vehicles, eq(vehicles.id, costs.vehicleId))
    .innerJoin(users, eq(users.id, costs.submittedBy))
    .where(
      and(gte(costs.costDate, args.from), lte(costs.costDate, args.to), eq(costs.type, args.type)),
    )
    .orderBy(asc(costs.costDate));

  return detailedRows.map((r) => ({
    costDate: r.cost.costDate,
    type: r.cost.type,
    licensePlate: r.vehicle.licensePlate,
    vehicleType: r.vehicle.vehicleType,
    amount: r.cost.amount,
    currency: r.cost.currency,
    description: r.cost.description,
    status: r.cost.status,
    submitterName: r.submitterName,
    approverName: null,
    metadata: r.cost.metadata as Record<string, unknown>,
    attachments: map.get(r.cost.id) ?? 0,
  }));
}
