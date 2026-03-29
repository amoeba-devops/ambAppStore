import { useTranslation } from 'react-i18next';
import { Package, AlertTriangle, PackagePlus, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useDashboardSummary, useStockRisk, useTrend } from '@/hooks/useDashboard';

export function DashboardPage() {
  const { t } = useTranslation('stock');
  const { data: summaryData, isLoading } = useDashboardSummary();
  const { data: riskData } = useStockRisk();
  const { data: trendData } = useTrend();
  const summary = summaryData?.data;
  const risks: Record<string, unknown>[] = riskData?.data || [];
  const trends: Record<string, unknown>[] = trendData?.data || [];

  // Pivot trends by date: { date, inbound, outbound }
  const chartData = Object.values(
    trends.reduce<Record<string, { date: string; inbound: number; outbound: number }>>((acc, row) => {
      const date = String(row.date);
      if (!acc[date]) acc[date] = { date, inbound: 0, outbound: 0 };
      const qty = Number(row.totalQty) || 0;
      if (String(row.type) === 'IN') acc[date].inbound += qty;
      else acc[date].outbound += qty;
      return acc;
    }, {}),
  );

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">{t('common.loading')}</div>;

  return (
    <div>
      <PageHeader title={t('dashboard.title')} breadcrumb={['stock-management']} />
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard color="blue" label={t('dashboard.totalSkus')} value={summary?.totalSkus || 0} icon={Package} />
          <StatCard color="red" label={t('dashboard.stockRisk')} value={summary?.stockRiskCount || 0} icon={AlertTriangle} />
          <StatCard color="yellow" label={t('dashboard.orderNeeded')} value={summary?.orderNeededCount || 0} icon={PackagePlus} />
          <StatCard color="green" label={t('dashboard.pendingOrders')} value={summary?.pendingOrders || 0} icon={ShoppingCart} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-[14px] font-semibold text-gray-900">{t('dashboard.riskItems')}</h2>
            <div className="overflow-hidden rounded-[10px] border border-[#e2e5eb] bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e5eb] bg-[#f0f2f5]">
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">SKU</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">ATS</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">SS</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.length === 0 ? (
                    <tr><td colSpan={4} className="px-3.5 py-8 text-center text-[13px] text-gray-400">{t('common.noData')}</td></tr>
                  ) : risks.map((r, i) => (
                    <tr key={i} className="border-b border-[#e2e5eb] last:border-b-0">
                      <td className="px-3.5 py-2 text-[13px] text-gray-700">{String(r.skuId).slice(0, 8)}</td>
                      <td className="px-3.5 py-2 text-[13px] text-gray-700">{String(r.ats)}</td>
                      <td className="px-3.5 py-2 text-[13px] text-gray-700">{String(r.safetyQty)}</td>
                      <td className="px-3.5 py-2"><StatusBadge status={String(r.riskLevel)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-[14px] font-semibold text-gray-900">{t('dashboard.trendTitle')}</h2>
            <div className="overflow-hidden rounded-[10px] border border-[#e2e5eb] bg-white p-4">
              {trends.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-gray-400">{t('common.noData')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e5eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="inbound" name={t('transaction.typeIn')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outbound" name={t('transaction.typeOut')} fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
