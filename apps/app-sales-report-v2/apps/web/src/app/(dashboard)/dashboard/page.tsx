import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listAllPeriodSnapshots } from '@/server/services/period-snapshot.service';
import { listActionLogsAction } from '@/server/actions/action-log.actions';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { snapshotsToWeekPoints } from '@/lib/snapshot-to-trends';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('dashboard');

  // Fetch all weekly snapshots — DashboardClient uses the latest as the hero
  // KPI source + the prior 7 entries for the sparkline. Empty array triggers
  // the empty-state CTA.
  const [snapshotRows, logsRes] = await Promise.all([
    listAllPeriodSnapshots(user.entId, 'WEEKLY'),
    listActionLogsAction({ limit: 8 }),
  ]);
  const weekPoints = snapshotsToWeekPoints(snapshotRows);
  const recentLogs = logsRes.success ? logsRes.data.rows : [];

  const title = t('title');
  const subtitle = user.name
    ? t('subtitle', { name: user.name })
    : t('subtitleNoName');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
      </div>
      <DashboardClient
        role={user.role}
        weekPoints={weekPoints}
        recentLogs={recentLogs}
      />
    </div>
  );
}
