import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
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
import { ReportReviewStep } from '../_components/report-review-step';

/**
 * Lập báo cáo — 3-step flow:
 *   - no `?month`                    → Bước 1: month grid (ReportMonthStep).
 *   - `?month=…` (no regions)        → Bước 2: region multi-picker (ReportRegionStep).
 *   - `?month=…&regions=A,B`         → Bước 3: one review section per selected
 *                                       region + confirm (ReportReviewStep). On
 *                                       confirm it fans out one report per region.
 */
export default async function NewTruckReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; regions?: string; region?: string }>;
}) {
  const user = await getCurrentUser(); // truck layout already gates DRIVER + fleet access
  const sp = await searchParams;
  const rawMonth = sp.month ?? '';
  const month = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : null;
  /* Multi-select regions via `?regions=A,B`; `?region=` kept for legacy single
   * links. Filter to valid codes and re-order to the canonical TRUCK_REGIONS
   * order so sections render consistently regardless of click order. */
  const regionCodes: readonly string[] = TRUCK_REGIONS;
  const picked = new Set(
    (sp.regions ?? sp.region ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => regionCodes.includes(s)),
  );
  const regions = regionCodes.filter((r) => picked.has(r));

  const t = await getTranslations('screens.truckReports');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');

  /* Bước 3 — one review section per selected region + confirm. */
  if (month && regions.length > 0) {
    const reviews = await Promise.all(regions.map((r) => getTruckReportReview(user, month, r)));
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
          <ReportReviewStep reviews={reviews} />
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
          <ReportRegionStep month={month} regionCounts={regionCounts} />
        </div>
      </>
    );
  }

  /* Bước 1 — pick the month. */
  const seenAt = await getTruckReportsSeenAt(user.entId, user.userId);
  const [reports, monthCounts, exportedRegions] = await Promise.all([
    listTruckReports(user.entId, seenAt),
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
          regionTotal={TRUCK_REGIONS.length}
          monthCounts={monthCounts}
        />
      </div>
    </>
  );
}
