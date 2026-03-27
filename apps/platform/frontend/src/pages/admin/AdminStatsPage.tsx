import { useTranslation } from 'react-i18next';
import { useSubscriptionStats } from '@/hooks/admin/useAdminSubscriptions';

export function AdminStatsPage() {
  const { t } = useTranslation('admin');
  const { data: stats, isLoading } = useSubscriptionStats();

  if (isLoading || !stats) return <p className="py-8 text-center text-gray-400">Loading...</p>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t('stats.title')}</h1>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label={t('stats.totalSubscriptions')} value={stats.total} color="bg-blue-50 text-blue-700" />
        <SummaryCard label={t('stats.pendingApprovals')} value={stats.pending} color="bg-amber-50 text-amber-700" />
        <SummaryCard label={t('stats.activeSubscriptions')} value={stats.active} color="bg-green-50 text-green-700" />
      </div>

      {/* By App Table */}
      <h2 className="mb-3 text-lg font-semibold">{t('stats.byApp')}</h2>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">{t('subscription.colApp')}</th>
              <th className="px-4 py-3">{t('stats.activeSubscriptions')}</th>
              <th className="px-4 py-3">{t('stats.pendingApprovals')}</th>
              <th className="px-4 py-3">{t('stats.totalSubscriptions')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.byApp.map((row) => (
              <tr key={row.appSlug} className="border-b">
                <td className="px-4 py-3 font-medium">{row.appName}</td>
                <td className="px-4 py-3 text-green-700">{row.active}</td>
                <td className="px-4 py-3 text-amber-700">{row.pending}</td>
                <td className="px-4 py-3">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-5 ${color}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-1 text-sm font-medium opacity-80">{label}</div>
    </div>
  );
}
