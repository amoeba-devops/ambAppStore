import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getTruckReportsSeenAt, listTruckReports } from '@/server/queries/truck-report.queries';
import { getTruckReportReview } from '@/server/queries/truck-finance.queries';
import { ReportMonthStep } from '../_components/report-month-step';
import { ReportReviewStep } from '../_components/report-review-step';

/**
 * Lập báo cáo — 2-step flow (design alignment):
 *   - no `?month`  → Bước 1: month grid (ReportMonthStep) → navigates to ?month=.
 *   - `?month=…`   → Bước 2: per-vehicle review + confirm (ReportReviewStep),
 *                    server-fetched so the cost figures are always live.
 */
export default async function NewTruckReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser(); // truck layout already gates DRIVER + fleet access
  const sp = await searchParams;
  const raw = sp.month ?? '';
  const month = /^\d{4}-\d{2}$/.test(raw) ? raw : null;

  const t = await getTranslations('screens.truckReports');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');

  if (month) {
    const review = await getTruckReportReview(user, month);
    return (
      <>
        <PageHeader
          title={t('createTitle')}
          subtitle={t('createSubtitle')}
          breadcrumbs={[
            { label: tCo('tenant') },
            { label: tNav('truckReports'), href: '/truck/reports' },
            { label: t('createBtn'), href: '/truck/reports/new' },
            { label: t('step2Title') },
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
          <ReportReviewStep review={review} />
        </div>
      </>
    );
  }

  const seenAt = await getTruckReportsSeenAt(user.entId, user.userId);
  const reports = await listTruckReports(user.entId, seenAt);
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
        <ReportMonthStep exportedMonths={exportedMonths} />
      </div>
    </>
  );
}
