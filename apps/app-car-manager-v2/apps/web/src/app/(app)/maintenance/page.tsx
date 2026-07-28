import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ParamSelect } from '@/components/inputs/param-select';
import { MaintenanceAlertList } from '@/components/maintenance/maintenance-alert-list';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listMaintenanceAlerts } from '@/server/queries/maintenance-alerts.queries';

/**
 * Cảnh báo bảo dưỡng — Module 2 (REQ-20260519 §3.7).
 *
 * The evaluator, actions, queries and list component all shipped in May; this
 * page is the wiring that was deferred with the Render cron (D9), which left
 * alerts firing notifications with nowhere to review or acknowledge them.
 *
 * STAFF only. Drivers are already deflected by middleware `isDriverAllowed`;
 * the redirect below is a belt-and-suspenders guard matching /drivers/new.
 * The department gate (CAR) lives in middleware `requiredFleet`.
 */
const STATUSES = ['UNRESOLVED', 'RESOLVED', 'ALL'] as const;
type Status = (typeof STATUSES)[number];

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') redirect('/today');

  const sp = await searchParams;
  const t = await getTranslations('maintenance');
  const tPage = await getTranslations('screens.maintenance');
  const tCo = await getTranslations('company');

  const status: Status = STATUSES.includes(sp.status as Status)
    ? (sp.status as Status)
    : 'UNRESOLVED';

  /* limit 100 = the schema max; the alert table is small (one row per vehicle
   * per condition per day) and the screen is a triage list, not a ledger. */
  const alerts = await listMaintenanceAlerts(user.entId, { status, limit: 100 });
  const unresolved = alerts.filter((a) => a.alert.malResolvedAt === null).length;

  return (
    <>
      <PageHeader
        title={t('sidebarTitle')}
        subtitle={tPage('subtitle', { count: alerts.length, unresolved })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: t('sidebarTitle') }]}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <ParamSelect
          param="status"
          value={status === 'UNRESOLVED' ? undefined : status}
          allLabel={tPage('status_UNRESOLVED')}
          options={[
            { value: 'RESOLVED', label: tPage('status_RESOLVED') },
            { value: 'ALL', label: tPage('status_ALL') },
          ]}
        />
        <MaintenanceAlertList alerts={alerts} />
      </div>
    </>
  );
}
