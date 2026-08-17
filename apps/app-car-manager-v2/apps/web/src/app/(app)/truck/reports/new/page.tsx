import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { allowedRegions, requireRegion, resolveReportVehicleScope } from '@/lib/auth/region-access';
import { CarError } from '@car-v2/shared/errors';
import {
  getTruckExportedRegionsByMonth,
  getTruckReportsSeenAt,
  listTruckReports,
} from '@/server/queries/truck-report.queries';
import {
  getTruckReportReview,
  getTruckMonthTripCounts,
  getTruckRegionTripCounts,
} from '@/server/queries/truck-finance.queries';
import { ReportMonthStep } from '../_components/report-month-step';
import { ReportRegionStep } from '../_components/report-region-step';
import { ReportVehicleStep } from '../_components/report-vehicle-step';
import { ReportReviewStep } from '../_components/report-review-step';

/**
 * Parse the `vf` query param — `"HCM:ALL;DONG_NAI:<id1>,<id2>"` — into a map
 * of region → chosen vehicle ids, or `'ALL'` when that region wasn't narrowed
 * (REQ-20260817, wizard step 3 "Chọn xe"). A region absent from the map has
 * not gone through step 3 yet.
 */
function parseVehicleScope(raw: string): Map<string, string[] | 'ALL'> {
  const out = new Map<string, string[] | 'ALL'>();
  for (const pair of raw.split(';')) {
    const [region, ids] = pair.split(':');
    if (!region) continue;
    out.set(region, !ids || ids === 'ALL' ? 'ALL' : ids.split(',').filter(Boolean));
  }
  return out;
}

/**
 * Lập báo cáo — 3-step flow:
 *   - no `?month`                    → Bước 1: month grid (ReportMonthStep).
 *   - `?month=…` (no regions)        → Bước 2: region multi-picker (ReportRegionStep).
 *   - `?month=…&regions=ALL`         → Bước 3: ONE consolidated review over every
 *                                       region → a single combined report.
 *   - `?month=…&regions=A,B`         → Bước 3: one review section per selected
 *                                       region + confirm (ReportReviewStep). On
 *                                       confirm it fans out one report per region.
 */
export default async function NewTruckReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; regions?: string; region?: string; vf?: string }>;
}) {
  const user = await getCurrentUser(); // truck layout already gates DRIVER + fleet access
  const sp = await searchParams;
  const rawMonth = sp.month ?? '';
  const month = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : null;
  /* Multi-select regions via `?regions=A,B`; `?region=` kept for legacy single
   * links. Filter to valid codes and re-order to the canonical TRUCK_REGIONS
   * order so sections render consistently regardless of click order. */
  const regionCodes: readonly string[] = TRUCK_REGIONS;
  const tokens = (sp.regions ?? sp.region ?? '').split(',').map((s) => s.trim());
  /* `ALL` sentinel = ONE consolidated report over every region (region=null),
   * distinct from listing each region code (one report per region). */
  const allScope = tokens.includes('ALL');
  const picked = new Set(tokens.filter((s) => regionCodes.includes(s)));
  const regions = regionCodes.filter((r) => picked.has(r));
  /* Bước 3 "Chọn xe" (REQ-20260817) — never for the consolidated ALL scope
   * (a subset only ever narrows ONE concrete region). */
  const vfRaw = sp.vf ?? '';
  const vehicleScope = parseVehicleScope(vfRaw);
  const pendingVehicleRegion = !allScope ? regions.find((r) => !vehicleScope.has(r)) : undefined;

  /* Region ACL (REQ-20260813): a narrowed user may only report on their own
   * regions, and can't produce the consolidated all-regions report (it spans
   * every region by definition). */
  const permittedRegions = await allowedRegions(user);
  const restricted = permittedRegions.length < TRUCK_REGIONS.length;
  if (allScope && restricted) {
    throw new CarError('CAR-E0403', 403, 'Forbidden: consolidated report spans all regions');
  }
  for (const r of regions) await requireRegion(user, r);

  const t = await getTranslations('screens.truckReports');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');

  /* Bước 4 — review + confirm. `ALL` → one consolidated review over every region
   * (region=null → one combined report); else one section (and one report) per
   * selected region, ONLY once every selected region has been through Bước 3
   * "Chọn xe" (`pendingVehicleRegion === undefined`). */
  if (month && (allScope || (regions.length > 0 && pendingVehicleRegion === undefined))) {
    /* 'ALL' (not narrowed) → undefined = no vehicle filter, same as AS-IS. */
    const vehicleIdsFor = (r: string): string[] | undefined => {
      const v = vehicleScope.get(r);
      return v && v !== 'ALL' ? v : undefined;
    };
    const reviews = allScope
      ? [await getTruckReportReview(user, month, null)]
      : await Promise.all(regions.map((r) => getTruckReportReview(user, month, r, vehicleIdsFor(r))));
    const vehicleIdsByRegion: Record<string, string[] | undefined> = {};
    for (const r of regions) vehicleIdsByRegion[r] = vehicleIdsFor(r);
    const backToRegion = `/truck/reports/new?month=${month}`;
    return (
      <>
        <PageHeader
          title={t('createTitle')}
          subtitle={t('createSubtitle')}
          breadcrumbs={[
            { label: tCo('tenant') },
            { label: tNav('truckReports'), href: '/truck/reports' },
            { label: t('createBtn'), href: '/truck/reports/new' },
            { label: t('stepNameRegion'), href: backToRegion },
            { label: t('step2Title') },
          ]}
          back={backToRegion}
          actions={
            <Button variant="ghost" size="md" asChild>
              <Link href={backToRegion}>
                <ChevronLeft />
                {tA('back')}
              </Link>
            </Button>
          }
        />
        <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
          <ReportReviewStep reviews={reviews} vehicleIdsByRegion={vehicleIdsByRegion} />
        </div>
      </>
    );
  }

  /* Bước 3 — "Chọn xe" for ONE region at a time (REQ-20260817). Only reachable
   * for a non-consolidated scope with ≥1 region still lacking a vehicle pick;
   * the consolidated `ALL` scope skips straight from Bước 2 to Bước 4 review
   * (GĐ-1 of that REQ: a vehicle subset only ever narrows one concrete region). */
  if (month && !allScope && regions.length > 0 && pendingVehicleRegion) {
    const tRegion = await getTranslations('region');
    const scope = await resolveReportVehicleScope(user, pendingVehicleRegion, undefined);
    const remaining = regions.filter((r) => r !== pendingVehicleRegion && !vehicleScope.has(r)).length;
    const backToRegion = `/truck/reports/new?month=${month}`;
    return (
      <>
        <PageHeader
          title={t('createTitle')}
          subtitle={t('createSubtitle')}
          breadcrumbs={[
            { label: tCo('tenant') },
            { label: tNav('truckReports'), href: '/truck/reports' },
            { label: t('createBtn'), href: '/truck/reports/new' },
            { label: t('stepNameRegion'), href: backToRegion },
            { label: t('stepNameVehicle') },
          ]}
          back={backToRegion}
          actions={
            <Button variant="ghost" size="md" asChild>
              <Link href={backToRegion}>
                <ChevronLeft />
                {tA('back')}
              </Link>
            </Button>
          }
        />
        <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
          <ReportVehicleStep
            month={month}
            regionsCsv={regions.join(',')}
            vfDone={vfRaw}
            region={pendingVehicleRegion}
            regionLabel={tRegion(pendingVehicleRegion as Parameters<typeof tRegion>[0])}
            vehicles={scope.vehicles.map((v) => ({ id: v.cvhId, plate: v.cvhPlateNumber }))}
            remaining={remaining}
          />
        </div>
      </>
    );
  }

  /* Bước 2 — pick the operating region (or all regions). Per-region trip
   * counts guard the step so an empty region can't advance to the review. */
  if (month) {
    const regionCounts = await getTruckRegionTripCounts(user.entId, month);
    return (
      <>
        <PageHeader
          title={t('createTitle')}
          subtitle={t('createSubtitle')}
          breadcrumbs={[
            { label: tCo('tenant') },
            { label: tNav('truckReports'), href: '/truck/reports' },
            { label: t('createBtn'), href: '/truck/reports/new' },
            { label: t('stepNameRegion') },
          ]}
          back="/truck/reports/new"
          actions={
            <Button variant="ghost" size="md" asChild>
              <Link href="/truck/reports/new">
                <ChevronLeft />
                {tA('back')}
              </Link>
            </Button>
          }
        />
        <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
          <ReportRegionStep
            month={month}
            regionCounts={regionCounts}
            regionOptions={permittedRegions}
            allowAllScope={!restricted}
          />
        </div>
      </>
    );
  }

  /* Bước 1 — pick the month. */
  const seenAt = await getTruckReportsSeenAt(user.entId, user.userId);
  const [reports, monthCounts, exportedRegions] = await Promise.all([
    listTruckReports(user.entId, seenAt, restricted ? permittedRegions : undefined),
    getTruckMonthTripCounts(user.entId),
    getTruckExportedRegionsByMonth(user.entId),
  ]);
  const exportedMonths = [...new Set(reports.map((r) => r.month))];

  return (
    <>
      <PageHeader
        title={t('createTitle')}
        subtitle={t('createSubtitle')}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('truckReports'), href: '/truck/reports' },
          { label: t('createBtn') },
        ]}
        back="/truck/reports"
        actions={
          <Button variant="ghost" size="md" asChild>
            <Link href="/truck/reports">
              <ChevronLeft />
              {tA('back')}
            </Link>
          </Button>
        }
      />
      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        <ReportMonthStep
          exportedMonths={exportedMonths}
          exportedRegions={exportedRegions}
          regionTotal={permittedRegions.length}
          monthCounts={monthCounts}
        />
      </div>
    </>
  );
}
