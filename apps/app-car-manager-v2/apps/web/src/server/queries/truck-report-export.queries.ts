import 'server-only';
import { and, asc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carTrips,
  carTripExtraCosts,
  carTripStopovers,
  carVehicles,
  carDrivers,
  carUsers,
} from '@car-v2/db/schema';
import {
  parseAmount,
  computeTruckPnl,
  loadTruckRegionSnapshots,
} from '@car-v2/core/truck';
import type { AuthContext } from '@/lib/auth/get-current-user';
import { getTruckFuelStats, isTruckMonthClosed } from './truck-finance.queries';

/**
 * Full report dataset for the "complex" truck report workbook (client NEW RULE
 * template): a detailed trip log, a per-vehicle monthly P&L, and the fleet
 * total — all for one (month × region). Numbers come from the same core logic
 * as the finance screen (`computeTruckPnl`, region fuel snapshots) so the report
 * always matches what the app shows. See truck-report-workbook.ts for layout.
 */

/** One row of the "Danh sách chuyến đi" sheet (all NEW RULE columns). */
export interface ReportTripLogRow {
  date: Date;
  plate: string;
  driver: string | null;
  startTime: string | null;
  endTime: string | null;
  customer: string | null;
  depot: string | null; // Bãi xuất phát (ORIGIN)
  pickup: string | null; // Lấy hàng / Giao hàng / Điểm khác (PICKUP)
  delivery: string | null; // Giao hàng (DELIVERY)
  waypoint: string | null; // Thêm điểm (WAYPOINT)
  back: string | null; // Về bãi (RETURN)
  startKm: number | null;
  endKm: number | null;
  km: number;
  toll: number;
  extra: number;
  extraNote: string | null;
  avgPrice: number; // Giá xăng bình quân tháng (đ/L)
  liters: number;
  fuelCost: number; // Phí xăng của chuyến
  revenue: number;
  profit: number; // = revenue − fuel − toll − extra (trước chi phí cố định)
  finalized: boolean; // Đã chốt / Tạm tính
  bol: string | null;
  cdf: string | null;
}

/** One row of the "Chi phí & Lợi nhuận — theo xe" sheet. */
export interface ReportVehiclePnlRow {
  plate: string;
  /** Vehicle model / internal name ("Tên xe") — feeds the client template's
   * "Xe / Tài xế" column note (REQ-20260713 B46). */
  model: string | null;
  driver: string | null;
  depreciation: number; // Khấu hao xe
  salary: number; // Lương tài xế
  revenue: number; // Doanh thu tháng
  fixedOther: number; // Chi phí cố định (= bảo hiểm & CP cố định khác)
  toll: number; // Phí cầu đường
  fuel: number; // Phí xăng dầu
  extra: number; // Tổng phí phát sinh
  net: number; // Lợi nhuận ròng
  /* Monthly Summary template additions (REQ-20260713). */
  tripCount: number; // Số chuyến
  km: number; // Σ km chuyến trong tháng
  liters: number; // Nhiên liệu (L): km × định mức (allocated) hoặc Σ lít chuyến
  costTotal: number; // Tổng chi phí xe = biến đổi + cố định (= revenue − net)
  /** Business status for the template (priority order): MAINTENANCE (xe bảo
   * dưỡng, cvh_status) | IDLE (không bảo dưỡng nhưng 0 chuyến trong tháng —
   * chỉ gánh chi phí cố định) | BREAKEVEN (net = 0) | PROFIT (net > 0) | LOSS
   * (net < 0). Labels resolved in the workbook. */
  status: 'PROFIT' | 'LOSS' | 'MAINTENANCE' | 'IDLE' | 'BREAKEVEN';
}

/** KPI header block of the Monthly Summary template (REQ-20260713 §3.2). */
export interface TruckReportSummary {
  truckCount: number; // Tổng xe trong khu vực (kể cả bảo dưỡng)
  activeCount: number; // Xe hoạt động (cvh_status ≠ MAINTENANCE)
  maintenanceCount: number; // Xe bảo dưỡng (cvh_status = MAINTENANCE)
  tripCount: number; // Tổng chuyến
  totalKm: number; // Tổng km
  avgTripsPerActive: number; // TB chuyến / xe hoạt động (QĐ-5)
  avgKmPerActive: number; // TB km / xe hoạt động
  revenue: number;
  netProfit: number;
  margin: number; // netProfit / revenue (0 khi revenue = 0)
}

/** Author header of the Monthly Summary template. Company name/address/tel-fax
 * + logo are fixed to the client template inside the workbook builder (user
 * decision 2026-07-14) — only app-mappable info is carried here. */
export interface TruckReportHeader {
  /** Display name of the user who generated the report ("Người lập"). */
  preparedBy: string | null;
}

export interface TruckReportExport {
  month: string;
  region: string | null;
  closed: boolean;
  fuel: { avgPrice: number; consumption: number; invoiceCount: number };
  trips: ReportTripLogRow[];
  vehicles: ReportVehiclePnlRow[];
  summary: TruckReportSummary;
  header: TruckReportHeader;
  totals: {
    salary: number;
    revenue: number;
    fixedOther: number; // depreciation + insurance (Tổng hợp gộp khấu hao)
    depreciation: number; // Khấu hao (tách riêng cho template — B23)
    toll: number;
    fuel: number;
    extra: number;
    net: number;
  };
}

function hhmm(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toISOString().slice(11, 16);
}

export async function getTruckReportExport(
  actor: AuthContext,
  month: string,
  region: string | null,
  /** includeIdle (REQ-20260713): also emit a per-vehicle row for TRUCKs with NO
   * completed trip this month (e.g. under maintenance) — they still carry fixed
   * costs — and compute `totals` as Σ of the per-vehicle rows so the template's
   * TỔNG row reconciles exactly with the A/B/C blocks. Off (default) keeps the
   * legacy PNL behaviour: rows for trip-vehicles only, totals via a region call. */
  opts: { includeIdle?: boolean } = {},
): Promise<TruckReportExport> {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const [snapshots, fuel, closedLegacy, rows] = await Promise.all([
    loadTruckRegionSnapshots(actor.entId, [month]),
    getTruckFuelStats(actor.entId, month, region ?? undefined),
    isTruckMonthClosed(actor.entId, month, region),
    db
      .select({
        trpId: carTrips.trpId,
        scheduledAt: carTrips.trpScheduledAt,
        startedAt: carTrips.trpStartedAt,
        endedAt: carTrips.trpEndedAt,
        customer: carTrips.trpCustomer,
        vehicleId: carTrips.trpVehicleId,
        plate: carVehicles.cvhPlateNumber,
        driver: carUsers.usrName,
        pickupAddress: carTrips.trpPickupAddress,
        dropoffAddress: carTrips.trpDropoffAddress,
        so: carTrips.trpStartOdometer,
        eo: carTrips.trpEndOdometer,
        fuelLiters: carTrips.trpFuelLiters,
        fuelPrice: carTrips.trpFuelPrice,
        toll: carTrips.trpTollFee,
        revenue: carTrips.trpRevenue,
        bol: carTrips.trpBol,
        cdf: carTrips.trpCdf,
      })
      .from(carTrips)
      .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
      .leftJoin(carDrivers, eq(carTrips.trpDriverId, carDrivers.drvId))
      .leftJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
      .where(
        and(
          eq(carTrips.entId, actor.entId),
          eq(carTrips.trpKind, 'LOG'),
          eq(carTrips.trpStatus, 'COMPLETED'),
          isNull(carTrips.trpDeletedAt),
          gte(carTrips.trpScheduledAt, start),
          lt(carTrips.trpScheduledAt, end),
          region ? eq(carVehicles.cvhRegion, region) : undefined,
        ),
      )
      .orderBy(asc(carTrips.trpScheduledAt)),
  ]);

  const ids = rows.map((r) => r.trpId);

  /* Extra costs (sum + concatenated names → "Ghi chú chi phí phát sinh"). */
  const extraByTrip = new Map<string, { amount: number; notes: string[] }>();
  if (ids.length) {
    const extras = await db
      .select({ trpId: carTripExtraCosts.trpId, name: carTripExtraCosts.tecName, amount: carTripExtraCosts.tecAmount })
      .from(carTripExtraCosts)
      .where(and(eq(carTripExtraCosts.entId, actor.entId), inArray(carTripExtraCosts.trpId, ids)));
    for (const e of extras) {
      const g = extraByTrip.get(e.trpId) ?? { amount: 0, notes: [] };
      g.amount += parseAmount(e.amount);
      if (e.name?.trim()) g.notes.push(e.name.trim());
      extraByTrip.set(e.trpId, g);
    }
  }

  /* Route stopovers, grouped by trip then by type (first address per type). */
  const routeByTrip = new Map<string, Partial<Record<string, string>>>();
  if (ids.length) {
    const stops = await db
      .select({
        trpId: carTripStopovers.tstTripId,
        type: carTripStopovers.tstType,
        address: carTripStopovers.tstAddress,
      })
      .from(carTripStopovers)
      .where(and(eq(carTripStopovers.entId, actor.entId), inArray(carTripStopovers.tstTripId, ids)))
      .orderBy(asc(carTripStopovers.tstOrder));
    for (const s of stops) {
      const g = routeByTrip.get(s.trpId) ?? {};
      if (g[s.type] == null) g[s.type] = s.address; // first per type
      routeByTrip.set(s.trpId, g);
    }
  }

  const trips: ReportTripLogRow[] = rows.map((t) => {
    const km = t.so != null && t.eo != null ? t.eo - t.so : 0;
    const ex = extraByTrip.get(t.trpId) ?? { amount: 0, notes: [] };
    const extra = Math.round(ex.amount);
    const toll = Math.round(parseAmount(t.toll));
    const revenue = Math.round(parseAmount(t.revenue));
    /* No trip timestamp passed on purpose: this workbook IS the report, whose
     * row was inserted moments ago, so every trip in scope is covered by it. */
    const finalized = snapshots.isReported(month, t.vehicleId);
    /* Fuel = frozen snapshot → live pool → 0, shared helper. */
    const fuel = snapshots.fuelForTrip(month, t.vehicleId, km);
    const avgPrice = fuel.unitPrice;
    const liters = fuel.liters;
    const fuelCost = fuel.cost;
    const route = routeByTrip.get(t.trpId) ?? {};
    return {
      date: t.scheduledAt,
      plate: t.plate ?? '—',
      driver: t.driver,
      startTime: hhmm(t.startedAt),
      endTime: hhmm(t.endedAt),
      customer: t.customer,
      depot: route.ORIGIN ?? t.pickupAddress ?? null,
      pickup: route.PICKUP ?? null,
      delivery: route.DELIVERY ?? t.dropoffAddress ?? null,
      waypoint: route.WAYPOINT ?? null,
      back: route.RETURN ?? null,
      startKm: t.so ?? null,
      endKm: t.eo ?? null,
      km,
      toll,
      extra,
      extraNote: ex.notes.length ? ex.notes.join(', ') : null,
      avgPrice: Math.round(avgPrice),
      liters: Math.round(liters * 10) / 10,
      fuelCost,
      revenue,
      profit: revenue - fuelCost - toll - extra,
      finalized,
      bol: t.bol,
      cdf: t.cdf,
    };
  });

  /* Scope vehicles = every live TRUCK in the region (all regions when null),
   * with its default driver's name (QĐ-1b / B46). This is the authoritative
   * vehicle set — it includes idle/maintenance trucks that had no trip. */
  const scopeVehicles = await db
    .select({
      id: carVehicles.cvhId,
      plate: carVehicles.cvhPlateNumber,
      model: carVehicles.cvhModel,
      status: carVehicles.cvhStatus,
      defaultDriver: carUsers.usrName,
    })
    .from(carVehicles)
    .leftJoin(carDrivers, eq(carVehicles.cvhDefaultDriverId, carDrivers.drvId))
    .leftJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .where(
      and(
        eq(carVehicles.entId, actor.entId),
        eq(carVehicles.cvhType, 'TRUCK'),
        isNull(carVehicles.cvhDeletedAt),
        region ? eq(carVehicles.cvhRegion, region) : undefined,
      ),
    )
    .orderBy(asc(carVehicles.cvhPlateNumber));

  interface VInfo {
    plate: string;
    model: string | null;
    status: string;
    defaultDriver: string | null;
  }
  const vinfo = new Map<string, VInfo>();
  for (const v of scopeVehicles) {
    vinfo.set(v.id, { plate: v.plate ?? '—', model: v.model, status: v.status, defaultDriver: v.defaultDriver });
  }
  /* A trip-vehicle missing from scopeVehicles (e.g. soft-deleted since) still
   * gets a row from its trip data so the legacy PNL export loses nobody. */
  const tripDriverByVeh = new Map<string, string | null>();
  for (const r of rows) {
    if (!r.vehicleId) continue;
    if (!vinfo.has(r.vehicleId)) {
      vinfo.set(r.vehicleId, { plate: r.plate ?? '—', model: null, status: 'AVAILABLE', defaultDriver: null });
    }
    if (!tripDriverByVeh.has(r.vehicleId)) tripDriverByVeh.set(r.vehicleId, r.driver);
  }

  /* Per-vehicle km / litres / trip aggregate from the month's completed trips,
   * mirroring the trip-log fuel model (allocated litres when a snapshot exists). */
  const aggByVeh = new Map<string, { km: number; liters: number }>();
  for (const t of rows) {
    if (!t.vehicleId) continue;
    const km = t.so != null && t.eo != null ? t.eo - t.so : 0;
    const liters = snapshots.fuelForTrip(month, t.vehicleId, km).liters;
    const g = aggByVeh.get(t.vehicleId) ?? { km: 0, liters: 0 };
    g.km += km;
    g.liters += liters;
    aggByVeh.set(t.vehicleId, g);
  }

  const vehiclesWithTrips = new Set(rows.map((r) => r.vehicleId).filter((v): v is string => !!v));
  const rowVehicleIds = opts.includeIdle ? [...vinfo.keys()] : [...vehiclesWithTrips];

  /* Per-vehicle P&L via the core service (one call per vehicle so each row
   * carries its own fixed costs — incl. depreciation + default-driver salary
   * for an idle truck). */
  const vehicles: ReportVehiclePnlRow[] = [];
  await Promise.all(
    rowVehicleIds.map(async (vid) => {
      const [p] = await computeTruckPnl(actor, { vehicleId: vid, months: [month] });
      if (!p) return;
      const info = vinfo.get(vid);
      const agg = aggByVeh.get(vid) ?? { km: 0, liters: 0 };
      /* Priority: maintenance (cvh_status) → idle (ran no trip this month, but
       * still carries fixed costs) → break-even (net exactly 0) → profit/loss. */
      const status: ReportVehiclePnlRow['status'] =
        info?.status === 'MAINTENANCE'
          ? 'MAINTENANCE'
          : p.tripCount === 0
            ? 'IDLE'
            : p.netProfit === 0
              ? 'BREAKEVEN'
              : p.netProfit > 0
                ? 'PROFIT'
                : 'LOSS';
      vehicles.push({
        plate: info?.plate ?? '—',
        model: info?.model ?? null,
        driver: info?.defaultDriver ?? tripDriverByVeh.get(vid) ?? null,
        depreciation: p.depreciation,
        salary: p.salary,
        revenue: p.revenue,
        fixedOther: p.insurance,
        toll: p.tollFee,
        fuel: p.fuelCost,
        extra: p.extraTotal,
        net: p.netProfit,
        tripCount: p.tripCount,
        km: agg.km,
        liters: Math.round(agg.liters * 10) / 10,
        costTotal: p.variableCost + p.fixedCost,
        status,
      });
    }),
  );
  vehicles.sort((a, b) => a.plate.localeCompare(b.plate));

  /* Totals. includeIdle → Σ of the per-vehicle rows so the template's TỔNG row
   * reconciles exactly with A/B/C (no fleet-level driverSalary path). Otherwise
   * the legacy region-level call (keeps PNL export byte-for-byte unchanged). */
  let totals: TruckReportExport['totals'];
  if (opts.includeIdle) {
    totals = vehicles.reduce(
      (a, v) => ({
        salary: a.salary + v.salary,
        revenue: a.revenue + v.revenue,
        fixedOther: a.fixedOther + v.depreciation + v.fixedOther, // dep + insurance (PNL totals convention)
        depreciation: a.depreciation + v.depreciation,
        toll: a.toll + v.toll,
        fuel: a.fuel + v.fuel,
        extra: a.extra + v.extra,
        net: a.net + v.net,
      }),
      { salary: 0, revenue: 0, fixedOther: 0, depreciation: 0, toll: 0, fuel: 0, extra: 0, net: 0 },
    );
  } else {
    const [tot] = await computeTruckPnl(actor, { region, months: [month] });
    totals = {
      salary: tot?.salary ?? 0,
      revenue: tot?.revenue ?? 0,
      fixedOther: (tot?.depreciation ?? 0) + (tot?.insurance ?? 0),
      depreciation: tot?.depreciation ?? 0,
      toll: tot?.tollFee ?? 0,
      fuel: tot?.fuelCost ?? 0,
      extra: tot?.extraTotal ?? 0,
      net: tot?.netProfit ?? 0,
    };
  }

  /* KPI summary — counts over ALL scope trucks; averages over active trucks
   * (QĐ-5). tripCount/totalKm sum the emitted rows so they equal the E-table
   * SUM exactly. */
  const truckCount = scopeVehicles.length;
  const maintenanceCount = scopeVehicles.filter((v) => v.status === 'MAINTENANCE').length;
  const activeCount = truckCount - maintenanceCount;
  const sumTripCount = vehicles.reduce((a, v) => a + v.tripCount, 0);
  const sumKm = vehicles.reduce((a, v) => a + v.km, 0);
  const summary: TruckReportSummary = {
    truckCount,
    activeCount,
    maintenanceCount,
    tripCount: sumTripCount,
    totalKm: sumKm,
    avgTripsPerActive: activeCount > 0 ? sumTripCount / activeCount : 0,
    avgKmPerActive: activeCount > 0 ? sumKm / activeCount : 0,
    revenue: totals.revenue,
    netProfit: totals.net,
    margin: totals.revenue !== 0 ? totals.net / totals.revenue : 0,
  };

  /* "Người lập" = the CURRENT user generating the report (their car_users
   * display name; JWT name as fallback). Only needed for the Monthly Summary
   * template, so skip the lookup on the legacy PNL path. */
  let header: TruckReportHeader = { preparedBy: null };
  if (opts.includeIdle) {
    const [author] = await db
      .select({ name: carUsers.usrName })
      .from(carUsers)
      .where(and(eq(carUsers.entId, actor.entId), eq(carUsers.usrId, actor.userId)))
      .limit(1);
    header = { preparedBy: author?.name ?? actor.name ?? null };
  }

  /* "Official" when the scope has a frozen snapshot — since PLAN-20260707 that
   * is the report's own recomputed snapshot (inserted before this runs); legacy
   * manual closes still count for historical months. */
  const scopeSnap = snapshots.snap.get(`${month}|${region ?? ''}`) ?? null;

  return {
    month,
    region,
    closed: closedLegacy || scopeSnap != null,
    fuel: { avgPrice: fuel.avgPrice, consumption: fuel.consumption, invoiceCount: fuel.invoiceCount },
    trips,
    vehicles,
    summary,
    header,
    totals,
  };
}
