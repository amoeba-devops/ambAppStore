'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { db } from '@car-v2/db/client';
import { carTruckReports, carUsers, TRUCK_REPORT_TYPES, type TruckReportType } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { allowedRegions, requireRegion, resolveReportVehicleScope } from '@/lib/auth/region-access';
import { computeTruckFixedAllocRows } from '@car-v2/core/truck';
import {
  getTruckFuelStats,
  getTruckFuelStatsByVehicle,
} from '@/server/queries/truck-finance.queries';
import { getTruckReportExport } from '@/server/queries/truck-report-export.queries';
import {
  buildTruckMonthlySummaryWorkbook,
  type SummarySheetSpec,
  type SummaryTranslator,
} from '@/server/lib/truck-monthly-summary-workbook';
import { bcp47, monthName, resolveUiLocale } from '@/i18n/ui-locale';
import { putObject } from '@/lib/s3-client';
import { logAudit } from '@/server/services/audit-log.service';
import { runAction } from './_helpers';

const MONTH = /^\d{4}-\d{2}$/;

/* MONTHLY_SUMMARY is trilingual — one file with a `tiếng việt`, an `English`
 * and a `Korean` sheet, exactly like the client template "Báo Cáo form (R1)"
 * (i18n, exportContent.truckMonthlySummary — vi reproduces it verbatim). No
 * longer tied to the generator's UI locale: every download carries all three.
 * The legacy PNL file stays Vietnamese inside (operational document for the
 * VN company) — but its NAME follows the exporter, see reportName() below.
 * TRIP_LOG/VEHICLE were separate report types with no generator left calling
 * them (removed 2026-08-18); `type_TRIP_LOG`/`type_VEHICLE` etc. i18n keys and
 * this function's generic `type: string` stay, so any pre-existing historical
 * row of those types still lists/downloads with a proper name. */

/** Stored list name (`trr_name`), written in the language the user was in when
 * they pressed "Lập báo cáo" — same source as the download filename. Scoped to
 * the chosen operating region ("· Khu vực HCM" / "· Tất cả khu vực") so the list
 * makes the scope obvious; the list still groups by month. Rows generated before
 * 2026-07-31 keep their Vietnamese name (stored value, not re-rendered). */
async function reportName(
  locale: string,
  type: string,
  region: string | null,
  /** Vehicle-subset scope (REQ-20260817) — appends "· n/m xe" when the report
   * covers fewer than every truck in the region. Undefined = whole region. */
  vehicleScope?: { selected: number; total: number },
): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'screens.truckReports' });
  const tRegion = await getTranslations({ locale, namespace: 'region' });
  /* Dynamic i18n keys — cast as elsewhere in this file. */
  const typeName = t(`type_${type}` as Parameters<typeof t>[0]);
  const scope = region
    ? t('nameScopeRegion', { name: tRegion(region as Parameters<typeof tRegion>[0]) })
    : t('regionAll');
  const vehiclesSuffix = vehicleScope
    ? ` · ${t('nameScopeVehicles', { n: vehicleScope.selected, m: vehicleScope.total })}`
    : '';
  return `${typeName} · ${scope}${vehiclesSuffix}`;
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
  /** Vehicle-subset scope (REQ-20260817). Already validated against the
   * region/ACL by the caller (`resolveReportVehicleScope`). Applies to every
   * report type, including MONTHLY_SUMMARY (user decision 2026-08-17). */
  vehicleIds: string[] | undefined,
): Promise<Buffer> {
  if (type === 'MONTHLY_SUMMARY') {
    /* Client "Báo cáo xe truck hàng tháng" template (REQ-20260713, R1 revision):
     * ONE file with three same-layout sheets — vi / en / ko. includeIdle=true so
     * maintenance/idle trucks appear and the TỔNG row reconciles with the A/B/C
     * blocks. Same core numbers as everything else, on every sheet. */
    const [y = '', mm = ''] = month.split('-');
    const data = await getTruckReportExport(actor, month, region, { includeIdle: true, vehicleIds });
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

  /* PNL (3-sheet "Chi phí & lợi nhuận" workbook) was retired 2026-08-18 along
   * with its builder — the batch buttons that generated it were removed and
   * MONTHLY_SUMMARY is the only format the wizard offers. Rows of the retired
   * types already in the DB are untouched: the list shows their stored
   * `trr_name` and downloads just redirect to the file already in S3. */
  throw new CarError('CAR-E0001', 400, `Unsupported truck report type: ${type}`);
}

/**
 * Generate ONE monthly report (PNL | MONTHLY_SUMMARY) → Excel → S3 → row, and
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
  opts: {
    month: string;
    type: TruckReportType;
    region: string | null;
    /** Vehicle-subset scope (REQ-20260817) — already validated against the
     * region/ACL by the caller via `resolveReportVehicleScope`. */
    vehicleIds?: string[];
    /** Total live trucks in `region` — only used to render the "n/m xe" name
     * suffix when `vehicleIds` narrows the scope. */
    vehicleTotal?: number;
  },
): Promise<{ id: string; hasSnapshot: boolean }> {
  const { month, type, region } = opts;
  /* Vehicle-subset scope (REQ-20260817) applies to every report type,
   * including MONTHLY_SUMMARY — user decision 2026-08-17 superseded the
   * original GĐ-A whole-region-only default for that format. */
  const vehicleIds = opts.vehicleIds;

  /* Month-end reconciliation, recomputed NOW (F1–F4). Only frozen when
   * computable (F5) — otherwise NULL → screens keep provisional numbers. */
  const [stats, vehicleFuel, fixedAllocRows] = await Promise.all([
    getTruckFuelStats(actor.entId, month, region ?? undefined),
    /* Per-vehicle freeze (REQ-20260726): each vehicle's own fuel spend ÷ its own
     * km. Preferred over the region pool below; the region columns stay filled
     * so older screens/reports keep working. */
    getTruckFuelStatsByVehicle(actor.entId, month, region ?? undefined, vehicleIds),
    /* Fixed-cost allocation basis, frozen alongside fuel (REQ-20260821):
     * generating a report is THE moment per-trip lương/khấu hao shares are
     * (re)computed — trip CRUD afterwards must not move the shares this report
     * showed, so screens read them back from this row until the next one. */
    computeTruckFixedAllocRows(actor.entId, month, { region, vehicleIds }),
  ]);
  /* The region pool is LEGACY. Once any invoice in the scope names its vehicle,
   * writing a region snapshot too would let vehicles WITHOUT an invoice draw
   * from fuel that already belongs to another truck — double-counting the
   * month's spend. So per-vehicle wins outright; trucks with no invoice fall
   * back to their own định mức instead. A vehicle-SUBSET report (REQ-20260817)
   * never claims the region pool at all — that concept only applies to a
   * WHOLE-region report, and the fold in loadTruckRegionSnapshots ignores
   * these columns on a subset row regardless, so this just keeps the stored
   * row honest about what it actually represents. */
  const hasSnapshot =
    !vehicleIds &&
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
  const name = await reportName(
    await resolveUiLocale(),
    type,
    region,
    vehicleIds && vehicleIds.length > 0
      ? { selected: vehicleIds.length, total: opts.vehicleTotal ?? vehicleIds.length }
      : undefined,
  );
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
    trrVehicleIds: vehicleIds && vehicleIds.length > 0 ? vehicleIds : null,
    trrFixedAlloc: fixedAllocRows.length > 0 ? fixedAllocRows : null,
  });

  try {
    const buffer = await buildReportWorkbook(actor, month, type, region, generatedAt, vehicleIds);
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
        /* Vehicle-subset scope (REQ-20260817) — only meaningful with a single
         * concrete `region`; see the check below. */
        vehicle_ids: z.array(z.string().uuid()).optional(),
      })
      .parse(input);
    /* Region ACL (REQ-20260813): a narrowed user may only report on their own
     * regions, and never the consolidated all-regions scope (region null). */
    const region = parsed.region ?? null;
    if (region) await requireRegion(actor, region);
    else if ((await allowedRegions(actor)).length < TRUCK_REGIONS.length) {
      throw new CarError('CAR-E0403', 403, 'Forbidden: consolidated report spans all regions');
    }
    if (parsed.vehicle_ids?.length && !region) {
      throw new CarError(
        'CAR-E0001',
        400,
        'A vehicle subset requires a single region — the consolidated all-regions report always covers every truck',
      );
    }

    /* Phase A0 (REQ-20260817): re-derive the vehicle scope from the DB RIGHT
     * NOW, from `region` + the actor's own ACL — never trust a vehicle list
     * the client rendered when the wizard was first opened. A vehicle deleted,
     * moved to another region, or outside the actor's ACL since then is
     * dropped; if the whole request becomes empty this throws rather than
     * silently falling back to "every truck" (see resolveReportVehicleScope). */
    let vehicleIds: string[] | undefined;
    let vehicleTotal: number | undefined;
    if (region && parsed.vehicle_ids?.length) {
      const scope = await resolveReportVehicleScope(actor, region, parsed.vehicle_ids);
      vehicleIds = scope.vehicleIds;
      vehicleTotal = scope.vehicles.length;
    }

    const { id } = await generateOneTruckReport(actor, {
      month: parsed.month,
      type: parsed.type,
      region,
      vehicleIds,
      vehicleTotal,
    });
    /* Numbers just became official everywhere the snapshot is read. */
    revalidateTruckReportPaths();
    return { id };
  });
}

/* `generateAllRegionsTruckReportsAction` (batch per-region PNL generation) was
 * removed 2026-08-18 together with the two buttons on the finance screen that
 * were its only callers. Reports are now created exclusively through the wizard
 * at /truck/reports/new, which calls `generateTruckReportAction` above. That
 * action still accepts `type: 'PNL'`, so the PNL workbook remains producible —
 * there is just no longer a UI that generates one in batch. */

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
