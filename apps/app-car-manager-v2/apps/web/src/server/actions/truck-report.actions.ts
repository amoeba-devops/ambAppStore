'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { db } from '@car-v2/db/client';
import { carTruckReports, carUsers, TRUCK_REPORT_TYPES, type TruckReportType } from '@car-v2/db/schema';
import type { ActionResult } from '@car-v2/shared/errors';
import { computeTruckPnl } from '@car-v2/core/truck';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { listVehicles } from '@/server/queries/vehicles.queries';
import {
  getTruckFuelStats,
  getTruckFuelStatsByVehicle,
  getTruckRegionTripCounts,
  listTruckFinanceTrips,
} from '@/server/queries/truck-finance.queries';
import { getTruckReportExport } from '@/server/queries/truck-report-export.queries';
import { buildTruckReportWorkbook } from '@/server/lib/truck-report-workbook';
import {
  buildTruckMonthlySummaryWorkbook,
  type SummarySheetSpec,
  type SummaryTranslator,
} from '@/server/lib/truck-monthly-summary-workbook';
import { bcp47, monthName, resolveUiLocale } from '@/i18n/ui-locale';
import { buildExcel, type ExcelColumn } from '@/server/lib/excel';
import { putObject } from '@/lib/s3-client';
import { logAudit } from '@/server/services/audit-log.service';
import { runAction } from './_helpers';

const MONTH = /^\d{4}-\d{2}$/;

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `Tháng ${Number(m)}/${y}`;
}

/* MONTHLY_SUMMARY is trilingual — one file with a `tiếng việt`, an `English`
 * and a `Korean` sheet, exactly like the client template "Báo Cáo form (R1)"
 * (i18n, exportContent.truckMonthlySummary — vi reproduces it verbatim). No
 * longer tied to the generator's UI locale: every download carries all three.
 * The legacy PNL/TRIP_LOG/VEHICLE files stay Vietnamese inside (operational
 * documents for the VN company) — but their NAME follows the exporter, see
 * reportName() below. */

/** Stored list name (`trr_name`), written in the language the user was in when
 * they pressed "Lập báo cáo" — same source as the download filename. Scoped to
 * the chosen operating region ("· Khu vực HCM" / "· Tất cả khu vực") so the list
 * makes the scope obvious; the list still groups by month. Rows generated before
 * 2026-07-31 keep their Vietnamese name (stored value, not re-rendered). */
async function reportName(locale: string, type: string, region: string | null): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'screens.truckReports' });
  const tRegion = await getTranslations({ locale, namespace: 'region' });
  /* Dynamic i18n keys — cast as elsewhere in this file. */
  const typeName = t(`type_${type}` as Parameters<typeof t>[0]);
  const scope = region
    ? t('nameScopeRegion', { name: tRegion(region as Parameters<typeof tRegion>[0]) })
    : t('regionAll');
  return `${typeName} · ${scope}`;
}

/* Workbook-internal scope label for the Vietnamese-only legacy reports. */
const REGION_LABEL: Record<string, string> = { HCM: 'HCM', DONG_NAI: 'Đồng Nai', BAIKSAN: 'Baiksan' };
function regionSuffix(region: string | null): string {
  return region ? `Khu vực ${REGION_LABEL[region] ?? region}` : 'Tất cả khu vực';
}

/* Sheet order inside the MONTHLY_SUMMARY file — R1's order, which is also
 * routing.locales. */
const SUMMARY_LOCALES = ['vi', 'en', 'ko'] as const;

async function buildReportWorkbook(
  actor: Awaited<ReturnType<typeof getCurrentUser>>,
  month: string,
  type: string,
  region: string | null,
  generatedAt: Date,
): Promise<Buffer> {
  if (type === 'MONTHLY_SUMMARY') {
    /* Client "Báo cáo xe truck hàng tháng" template (REQ-20260713, R1 revision):
     * ONE file with three same-layout sheets — vi / en / ko. includeIdle=true so
     * maintenance/idle trucks appear and the TỔNG row reconciles with the A/B/C
     * blocks. Same core numbers as everything else, on every sheet. */
    const [y = '', mm = ''] = month.split('-');
    const data = await getTruckReportExport(actor, month, region, { includeIdle: true });
    const sheets: SummarySheetSpec[] = [];
    for (const locale of SUMMARY_LOCALES) {
      const t = (await getTranslations({
        locale,
        namespace: 'exportContent.truckMonthlySummary',
      })) as unknown as SummaryTranslator;
      const tRegion = await getTranslations({ locale, namespace: 'region' });
      /* en spells the month out ("June 2026"), vi/ko use the number — the
       * message file picks {mn} or {m}. */
      sheets.push({
        locale,
        bcp47: bcp47(locale),
        monthLabel: t('monthValue', { m: String(Number(mm)), mn: monthName(month, locale), y }),
        regionLabel: region
          ? t('scopeRegion', { name: tRegion(region as Parameters<typeof tRegion>[0]) })
          : t('scopeAll'),
        t,
      });
    }
    return buildTruckMonthlySummaryWorkbook(data, { generatedAt, sheets });
  }

  if (type === 'PNL') {
    /* Comprehensive report (client NEW RULE template): a 3-sheet styled workbook
     * — trip log + per-vehicle P&L + fleet total + glossary. Numbers come from
     * the same core logic (computeTruckPnl + region fuel snapshots) as the
     * finance screen, so the report always matches what the app shows. */
    const data = await getTruckReportExport(actor, month, region);
    return buildTruckReportWorkbook(data, {
      monthLabel: monthLabel(month),
      regionLabel: regionSuffix(region),
      generatedAt,
    });
  }

  if (type === 'TRIP_LOG') {
    const trips = await listTruckFinanceTrips(actor.entId, { month, region });
    const cols: ExcelColumn[] = [
      { header: 'Ngày', key: 'date', width: 12 },
      { header: 'Phương tiện', key: 'plate', width: 14 },
      { header: 'Tài xế', key: 'driver', width: 18 },
      { header: 'Khách hàng', key: 'customer', width: 18 },
      { header: 'Km', key: 'km', width: 8 },
      { header: 'Cầu đường', key: 'toll', width: 12 },
      { header: 'Phát sinh', key: 'extra', width: 12 },
      { header: 'Đơn giá', key: 'unitPrice', width: 12 },
      { header: 'Lít', key: 'liters', width: 8 },
      { header: 'Phí nhiên liệu', key: 'fuel', width: 14 },
      { header: 'Doanh thu', key: 'revenue', width: 14 },
      { header: 'Lợi nhuận', key: 'profit', width: 14 },
      { header: 'Trạng thái', key: 'status', width: 12 },
    ];
    const rows = trips.map((t) => ({
      date: new Date(t.scheduledAt).toISOString().slice(0, 10),
      plate: t.plate ?? '',
      driver: t.driver ?? '',
      customer: t.customer ?? '',
      km: t.km,
      toll: t.toll,
      extra: t.extra,
      unitPrice: t.unitPrice,
      liters: Math.round(t.liters * 10) / 10,
      fuel: t.fuelCost,
      revenue: t.revenue,
      profit: t.profit,
      status: t.finalized ? 'Đã lập BC' : 'Tạm tính',
    }));
    return buildExcel('Nhật ký chuyến', cols, rows);
  }

  // VEHICLE — per-truck month aggregates (scoped to the region when set).
  const allTrucks = await listVehicles(actor.entId, 'active', 'TRUCK');
  const trucks = region ? allTrucks.filter((v) => v.cvhRegion === region) : allTrucks;
  const cols: ExcelColumn[] = [
    { header: 'Biển số', key: 'plate', width: 14 },
    { header: 'Mô tả', key: 'model', width: 22 },
    { header: 'Số chuyến', key: 'trips', width: 10 },
    { header: 'Doanh thu', key: 'revenue', width: 14 },
    { header: 'Phí nhiên liệu', key: 'fuel', width: 14 },
    { header: 'Cầu đường', key: 'toll', width: 12 },
    { header: 'Phát sinh', key: 'extra', width: 12 },
    { header: 'Chi phí cố định', key: 'fixed', width: 14 },
    { header: 'Lợi nhuận ròng', key: 'net', width: 14 },
  ];
  const rows: Record<string, unknown>[] = [];
  for (const v of trucks) {
    const [pnl] = await computeTruckPnl(actor, { vehicleId: v.cvhId, months: [month] });
    rows.push({
      plate: v.cvhPlateNumber,
      model: v.cvhModel ?? '',
      trips: pnl?.tripCount ?? 0,
      revenue: pnl?.revenue ?? 0,
      fuel: pnl?.fuelCost ?? 0,
      toll: pnl?.tollFee ?? 0,
      extra: pnl?.extraTotal ?? 0,
      fixed: pnl?.fixedCost ?? 0,
      net: pnl?.netProfit ?? 0,
    });
  }
  return buildExcel('Phương tiện', cols, rows);
}

/**
 * Generate ONE monthly report (PNL | TRIP_LOG | VEHICLE) → Excel → S3 → row, and
 * freeze the month-end fuel reconciliation onto it. Shared by the single-scope
 * action (review wizard) and the "all regions" one-click on the finance screen.
 *
 * RECOMPUTES the reconciliation (the old chốt-sổ formulas — avg invoice price,
 * consumption = Σ litres ÷ Σ km) for the scope and freezes it onto the report
 * row (PLAN-20260707) — but only when computable (F5); otherwise the snapshot
 * columns stay NULL and screens keep the per-trip provisional numbers. The row
 * is inserted BEFORE the workbook is built so the file — and every screen —
 * reads the fresh snapshot through loadTruckRegionSnapshots. Does NOT
 * revalidate; callers revalidate once (so a batch run revalidates a single time).
 */
async function generateOneTruckReport(
  actor: Awaited<ReturnType<typeof getCurrentUser>>,
  opts: { month: string; type: TruckReportType; region: string | null },
): Promise<{ id: string; hasSnapshot: boolean }> {
  const { month, type, region } = opts;

  /* Month-end reconciliation, recomputed NOW (F1–F4). Only frozen when
   * computable (F5) — otherwise NULL → screens keep provisional numbers. */
  const [stats, vehicleFuel] = await Promise.all([
    getTruckFuelStats(actor.entId, month, region ?? undefined),
    /* Per-vehicle freeze (REQ-20260726): each vehicle's own fuel spend ÷ its own
     * km. Preferred over the region pool below; the region columns stay filled
     * so older screens/reports keep working. */
    getTruckFuelStatsByVehicle(actor.entId, month, region ?? undefined),
  ]);
  /* The region pool is LEGACY. Once any invoice in the scope names its vehicle,
   * writing a region snapshot too would let vehicles WITHOUT an invoice draw
   * from fuel that already belongs to another truck — double-counting the
   * month's spend. So per-vehicle wins outright; trucks with no invoice fall
   * back to their own định mức instead. */
  const hasSnapshot =
    vehicleFuel.length === 0 &&
    stats.totalKm > 0 &&
    stats.invoiceLiters > 0 &&
    stats.avgPrice > 0;

  const id = randomUUID();
  /* Pin the exact generation moment: stamped into the workbook itself AND
   * set explicitly (instead of relying on defaultNow()) as trr_created_at,
   * so the file's stamp and every screen's "Đã lập BC · {date}" badge
   * (which reads trr_created_at) always agree to the second. */
  const generatedAt = new Date();
  const key = `truck-reports/${actor.entId}/${month}/${type}-${region ?? 'all'}-${id}.xlsx`;
  const name = await reportName(await resolveUiLocale(), type, region);
  await db.insert(carTruckReports).values({
    trrId: id,
    entId: actor.entId,
    trrVehicleType: 'TRUCK',
    trrMonth: month,
    trrRegion: region,
    trrType: type,
    trrFormat: 'EXCEL',
    trrS3Key: key,
    trrName: name,
    trrCreatedBy: actor.userId,
    trrCreatedAt: generatedAt,
    trrAvgPrice: hasSnapshot ? String(stats.avgPrice) : null,
    trrConsumption: hasSnapshot ? String(stats.consumption) : null,
    trrTotalLiters: hasSnapshot ? String(stats.invoiceLiters) : null,
    trrTotalKm: hasSnapshot ? String(stats.totalKm) : null,
    trrVehicleFuel: vehicleFuel.length > 0 ? vehicleFuel : null,
  });

  try {
    const buffer = await buildReportWorkbook(actor, month, type, region, generatedAt);
    await putObject(
      key,
      new Uint8Array(buffer),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  } catch (err) {
    /* Workbook/upload failed → retract the row (and its snapshot) so the
     * screens don't claim an official number that has no file behind it. */
    await db
      .update(carTruckReports)
      .set({ trrDeletedAt: new Date() })
      .where(and(eq(carTruckReports.entId, actor.entId), eq(carTruckReports.trrId, id)));
    throw err;
  }

  await logAudit({
    entId: actor.entId,
    userId: actor.userId,
    action: 'TRUCK_REPORT.GENERATED',
    entity: 'TruckReport',
    entityId: id,
    entityRef: name,
    after: hasSnapshot
      ? {
          month,
          type,
          region,
          avgPrice: stats.avgPrice,
          consumption: stats.consumption,
          totalLiters: stats.invoiceLiters,
          totalKm: stats.totalKm,
        }
      : { month, type, region },
  });
  return { id, hasSnapshot };
}

/** Paths that read the fuel snapshot — revalidated after any report change so
 * the recomputed per-trip fuel/profit shows immediately (feedback #1). */
function revalidateTruckReportPaths(): void {
  revalidatePath('/truck/reports');
  revalidatePath('/truck/finance');
  revalidatePath('/truck/pnl');
  revalidatePath('/truck/dashboard');
  revalidatePath('/truck/trips');
}

/**
 * Generate one monthly report for a single scope (one region, or all-regions
 * when region is null). Thin wrapper over generateOneTruckReport + revalidate;
 * the review wizard calls this once per selected region.
 */
export async function generateTruckReportAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const parsed = z
      .object({
        month: z.string().regex(MONTH),
        type: z.enum(TRUCK_REPORT_TYPES),
        /* Operating region scope; null/absent = all regions. */
        region: z.enum(TRUCK_REGIONS).nullable().optional(),
      })
      .parse(input);
    const { id } = await generateOneTruckReport(actor, {
      month: parsed.month,
      type: parsed.type,
      region: parsed.region ?? null,
    });
    /* Numbers just became official everywhere the snapshot is read. */
    revalidateTruckReportPaths();
    return { id };
  });
}

/**
 * Batch report generation from the finance screen (feedback #1), supporting
 * TWO scopes the operator can pick between:
 *   - `regions` omitted/empty → EVERY operating region with completed trips
 *     this month, INCLUDING ones already reported (a full refresh with the
 *     current live data — "Làm mới tất cả khu vực").
 *   - `regions` given → only those regions (the finance banner passes the
 *     still-provisional ones — "Lập báo cáo khu vực còn tạm tính").
 * Either way each region freezes its OWN month-end average (per-region
 * accuracy — regions are never blended together). A region that still lacks
 * fuel invoices can't be reconciled (F5), so it's returned in `pending` — we
 * skip generation there rather than emit a report with no snapshot.
 * `finalized`/`pending` are region codes the caller maps to names.
 */
export async function generateAllRegionsTruckReportsAction(
  input: unknown,
): Promise<ActionResult<{ finalized: string[]; pending: string[] }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const parsed = z
      .object({
        month: z.string().regex(MONTH),
        /* Explicit scope; omitted/empty = every region with trip data. */
        regions: z.array(z.enum(TRUCK_REGIONS)).optional(),
      })
      .parse(input);
    const { month } = parsed;

    const { byRegion } = await getTruckRegionTripCounts(actor.entId, month);
    const scope = parsed.regions?.length ? parsed.regions : Object.keys(byRegion);
    const finalized: string[] = [];
    const pending: string[] = [];
    for (const region of scope) {
      /* No completed trips for this region this month → nothing to report. */
      if (!byRegion[region]) {
        pending.push(region);
        continue;
      }
      /* "Lập báo cáo = chốt luôn" (2026-07-21): report EVERY region with trips,
       * even without fuel invoices. generateOneTruckReport freezes the month-end
       * average only when computable (F5) — otherwise the report still exists
       * and finalizes the region's trips at their entered fuel cost. */
      await generateOneTruckReport(actor, { month, type: 'PNL', region });
      finalized.push(region);
    }
    if (finalized.length > 0) revalidateTruckReportPaths();
    return { finalized, pending };
  });
}

/** Mark the truck-report list as seen for the current user → clears the nav
 * "Mới" badge on the next render. Intentionally does NOT revalidate the current
 * list, so the rows that were new still show their badge on this view. */
export async function markTruckReportsSeenAction(): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    await db
      .update(carUsers)
      .set({ usrTruckReportsSeenAt: new Date() })
      .where(and(eq(carUsers.entId, actor.entId), eq(carUsers.usrId, actor.userId)));
    return { ok: true as const };
  });
}
