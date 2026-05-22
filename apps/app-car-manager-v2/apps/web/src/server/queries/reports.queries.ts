import 'server-only';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carExpenses, carTrips, carVehicles } from '@car-v2/db/schema';

/**
 * Period helpers — chuyển N tuần thành ISO date string YYYY-MM-DD cho DATE column
 * `exp_occurred_at` (column type DATE, không phải TIMESTAMPTZ).
 */
function dateSinceWeeksAgo(weeks: number): string {
  const d = new Date(Date.now() - weeks * 7 * 86_400_000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Drizzle's `db.execute(sql\`...\`)` shape varies by driver:
 *   - neon-http: { rows: [...], command, ... } — extract `.rows`
 *   - some drivers: raw array
 * Defensive: support both.
 */
function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows ?? [];
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Report KPIs — tổng quan + delta so với period trước
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportKpis {
  totalTrips: number;
  totalSpendVnd: number;
  avgCostVnd: number;
  /** Percent (0-100). Tỷ lệ chuyến hoàn thành / chuyến đã lên (CONFIRMED + IN_PROGRESS + COMPLETED). */
  utilizationPct: number;
  /** Delta so với period trước (cùng độ dài, ngay trước). */
  delta: {
    tripsPct: number;
    spendPct: number;
    avgCostPct: number;
    utilizationPts: number;
  };
}

/**
 * Lấy KPIs cho period N tuần gần đây + delta vs period trước đó.
 * Mặc định: 12 tuần (≈ 3 tháng).
 */
export async function getReportKpis(entId: string, weeks = 12): Promise<ReportKpis> {
  const now = new Date();
  const periodStart = dateSinceWeeksAgo(weeks);
  const prevStart = dateSinceWeeksAgo(weeks * 2);
  const prevEnd = periodStart;

  /* Trips count + utilization — query trên car_trips. */
  const tripStatsCurrent = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${carTrips.trpStatus} = 'COMPLETED')::int`,
    })
    .from(carTrips)
    .where(
      and(
        eq(carTrips.entId, entId),
        isNull(carTrips.trpDeletedAt),
        gte(carTrips.trpScheduledAt, sql`${periodStart}::timestamptz`),
      ),
    );

  const tripStatsPrev = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${carTrips.trpStatus} = 'COMPLETED')::int`,
    })
    .from(carTrips)
    .where(
      and(
        eq(carTrips.entId, entId),
        isNull(carTrips.trpDeletedAt),
        gte(carTrips.trpScheduledAt, sql`${prevStart}::timestamptz`),
        sql`${carTrips.trpScheduledAt} < ${prevEnd}::timestamptz`,
      ),
    );

  /* Spend sum — chỉ tính APPROVED + AUTO_APPROVED. */
  const spendCurrent = await db
    .select({ total: sql<string>`COALESCE(SUM(${carExpenses.expAmount}), 0)::text` })
    .from(carExpenses)
    .where(
      and(
        eq(carExpenses.entId, entId),
        sql`${carExpenses.expStatus} IN ('APPROVED', 'AUTO_APPROVED')`,
        gte(carExpenses.expOccurredAt, periodStart),
        isNull(carExpenses.expDeletedAt),
      ),
    );

  const spendPrev = await db
    .select({ total: sql<string>`COALESCE(SUM(${carExpenses.expAmount}), 0)::text` })
    .from(carExpenses)
    .where(
      and(
        eq(carExpenses.entId, entId),
        sql`${carExpenses.expStatus} IN ('APPROVED', 'AUTO_APPROVED')`,
        gte(carExpenses.expOccurredAt, prevStart),
        sql`${carExpenses.expOccurredAt} < ${prevEnd}`,
        isNull(carExpenses.expDeletedAt),
      ),
    );

  const trips = tripStatsCurrent[0]?.total ?? 0;
  const completed = tripStatsCurrent[0]?.completed ?? 0;
  const prevTrips = tripStatsPrev[0]?.total ?? 0;
  const totalSpend = Number(spendCurrent[0]?.total ?? '0');
  const prevSpend = Number(spendPrev[0]?.total ?? '0');

  const avgCost = trips > 0 ? totalSpend / trips : 0;
  const prevAvgCost = prevTrips > 0 ? prevSpend / prevTrips : 0;
  const utilization = trips > 0 ? (completed / trips) * 100 : 0;
  const prevUtilization = prevTrips > 0 ? ((tripStatsPrev[0]?.completed ?? 0) / prevTrips) * 100 : 0;

  const safePct = (cur: number, prev: number): number => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };

  return {
    totalTrips: trips,
    totalSpendVnd: totalSpend,
    avgCostVnd: Math.round(avgCost),
    utilizationPct: Math.round(utilization),
    delta: {
      tripsPct: Math.round(safePct(trips, prevTrips) * 10) / 10,
      spendPct: Math.round(safePct(totalSpend, prevSpend) * 10) / 10,
      avgCostPct: Math.round(safePct(avgCost, prevAvgCost) * 10) / 10,
      utilizationPts: Math.round((utilization - prevUtilization) * 10) / 10,
    },
  };
  // `now` reserved for future use (e.g. label period end)
  void now;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Spend by category (donut chart)
// ─────────────────────────────────────────────────────────────────────────────

export interface CategorySpend {
  expType: string;
  amountVnd: number;
}

/**
 * Tổng spend N tuần gần đây, GROUP BY loại chi phí.
 * Chỉ tính APPROVED + AUTO_APPROVED.
 */
export async function getSpendByCategory(entId: string, weeks = 12): Promise<CategorySpend[]> {
  const periodStart = dateSinceWeeksAgo(weeks);
  const rows = await db
    .select({
      expType: carExpenses.expType,
      amount: sql<string>`COALESCE(SUM(${carExpenses.expAmount}), 0)::text`,
    })
    .from(carExpenses)
    .where(
      and(
        eq(carExpenses.entId, entId),
        sql`${carExpenses.expStatus} IN ('APPROVED', 'AUTO_APPROVED')`,
        gte(carExpenses.expOccurredAt, periodStart),
        isNull(carExpenses.expDeletedAt),
      ),
    )
    .groupBy(carExpenses.expType);

  return rows.map((r) => ({
    expType: r.expType,
    amountVnd: Number(r.amount),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Weekly spend per category (stacked bar chart)
// ─────────────────────────────────────────────────────────────────────────────

export interface WeeklySpend extends Record<string, unknown> {
  /** 'W1' .. 'W12' relative to period start (oldest → newest). */
  week: string;
  FUEL: number;
  REPAIR: number;
  MEAL: number;
  OIL: number;
  PARKING: number;
  TOLL: number;
  ACCIDENT: number;
  INSPECTION: number;
}

/**
 * Spend per week (N tuần gần đây), broken down theo loại chi phí.
 * Trả về N slot tuần — slot rỗng = 0 cho tất cả loại.
 *
 * Đơn vị: VND chuyển sang triệu (M) — chia 1_000_000 để display dễ trong chart.
 */
export async function getSpendByWeek(entId: string, weeks = 12): Promise<WeeklySpend[]> {
  const periodStart = dateSinceWeeksAgo(weeks);
  // Raw SQL — Drizzle bindings make GROUP BY expression không match SELECT.
  // Dùng query thẳng + parameterized values qua sql template.
  // Neon-HTTP `db.execute()` trả về { rows, ... } object — extract `.rows`.
  const result = (await db.execute(sql`
    SELECT
      FLOOR(EXTRACT(EPOCH FROM (exp_occurred_at::timestamptz - ${periodStart}::timestamptz)) / (7 * 86400))::int AS week_offset,
      exp_type AS exp_type,
      COALESCE(SUM(exp_amount), 0)::text AS amount
    FROM car_expenses
    WHERE ent_id = ${entId}
      AND exp_status IN ('APPROVED', 'AUTO_APPROVED')
      AND exp_occurred_at >= ${periodStart}
      AND exp_deleted_at IS NULL
    GROUP BY week_offset, exp_type
  `)) as unknown;
  const rows = extractRows<{ week_offset: number; exp_type: string; amount: string }>(result);

  // Initialize N empty week buckets
  const buckets: WeeklySpend[] = Array.from({ length: weeks }, (_, i) => ({
    week: `W${i + 1}`,
    FUEL: 0, REPAIR: 0, MEAL: 0, OIL: 0,
    PARKING: 0, TOLL: 0, ACCIDENT: 0, INSPECTION: 0,
  }));

  for (const r of rows) {
    const idx = Math.max(0, Math.min(weeks - 1, r.week_offset));
    const m = Number(r.amount) / 1_000_000;
    const slot = buckets[idx]!;
    (slot as unknown as Record<string, number>)[r.exp_type] = m;
  }
  return buckets;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Vehicle utilization per week (line chart)
// ─────────────────────────────────────────────────────────────────────────────

export interface VehicleUtilization {
  vehicleId: string;
  plate: string;
}

export interface WeeklyUtilization {
  week: string;
  /** Map plate → utilization % (0-100) for that week. */
  [plate: string]: string | number;
}

/**
 * Trả về 2 thứ:
 *   - Danh sách xe (plate) cho legend
 *   - Mảng N tuần × utilization% per xe
 *
 * Utilization = số chuyến trong tuần / 7 ngày × 100 (giả định 1 chuyến / ngày
 * là 100%). Đơn giản để chart display có ý nghĩa.
 */
export async function getVehicleUtilization(
  entId: string,
  weeks = 12,
): Promise<{ vehicles: VehicleUtilization[]; data: WeeklyUtilization[] }> {
  const periodStart = dateSinceWeeksAgo(weeks);

  const vehicles = await db
    .select({
      vehicleId: carVehicles.cvhId,
      plate: carVehicles.cvhPlateNumber,
    })
    .from(carVehicles)
    .where(and(eq(carVehicles.entId, entId), isNull(carVehicles.cvhDeletedAt)))
    .orderBy(carVehicles.cvhPlateNumber)
    .limit(8); // max 8 xe trong chart — tránh chart quá rối

  if (vehicles.length === 0) {
    return { vehicles: [], data: [] };
  }

  // Same Drizzle GROUP BY mismatch issue — use raw SQL.
  const tripResult = (await db.execute(sql`
    SELECT
      trp_vehicle_id AS vehicle_id,
      FLOOR(EXTRACT(EPOCH FROM (trp_scheduled_at - ${periodStart}::timestamptz)) / (7 * 86400))::int AS week_offset,
      COUNT(*)::int AS count
    FROM car_trips
    WHERE ent_id = ${entId}
      AND trp_status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
      AND trp_scheduled_at >= ${periodStart}::timestamptz
      AND trp_deleted_at IS NULL
      AND trp_vehicle_id IS NOT NULL
    GROUP BY trp_vehicle_id, week_offset
  `)) as unknown;
  const tripCounts = extractRows<{ vehicle_id: string; week_offset: number; count: number }>(tripResult);

  // Init buckets: N tuần × mỗi xe = 0
  const data: WeeklyUtilization[] = Array.from({ length: weeks }, (_, i) => {
    const slot: WeeklyUtilization = { week: `W${i + 1}` };
    for (const v of vehicles) slot[v.plate] = 0;
    return slot;
  });

  // Fill
  const plateById = new Map(vehicles.map((v) => [v.vehicleId, v.plate]));
  for (const r of tripCounts) {
    if (!r.vehicle_id) continue;
    const plate = plateById.get(r.vehicle_id);
    if (!plate) continue;
    const idx = Math.max(0, Math.min(weeks - 1, r.week_offset));
    // Utilization % = trips / 7 days × 100, cap at 100
    const pct = Math.min(100, Math.round((r.count / 7) * 100));
    data[idx]![plate] = pct;
  }

  return { vehicles, data };
}
