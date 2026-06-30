import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getTruckReportsSeenAt, listTruckReports } from '@/server/queries/truck-report.queries';
import { NewReportForm } from '../_components/new-report-form';

export default async function NewTruckReportPage() {
  const user = await getCurrentUser(); // truck layout already gates DRIVER + fleet access
  const seenAt = await getTruckReportsSeenAt(user.entId, user.userId);
  const reports = await listTruckReports(user.entId, seenAt);
  const exportedMonths = [...new Set(reports.map((r) => r.month))];
  const t = await getTranslations('screens.truckReports');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');

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
        <NewReportForm exportedMonths={exportedMonths} />
      </div>
    </>
  );
}
