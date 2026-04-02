import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  LayoutDashboard,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  BarChart3,
  Upload,
  RefreshCw,
  Package,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DashboardData {
  kpi: {
    totalOrders: number;
    completedOrders: number;
    totalGmv: number;
    estimatedCm: number;
    cmPct: number;
  };
  channelBreakdown: { channel: string; orders: number; gmv: number }[];
  dailyTrend: { date: string; gmv: number; orders: number }[];
  skuMatchRate: { totalItems: number; matchedItems: number; rate: number };
  recentUploads: { channel: string; batchId: string; orderCount: number; uploadedAt: string }[];
  dateRange: { start: string; end: string };
}

const CHANNEL_COLORS: Record<string, string> = {
  SHOPEE: '#ee4d2d',
  TIKTOK: '#010101',
  OTHER: '#6b7280',
  INFLUENCER: '#8b5cf6',
  B2B: '#3b82f6',
};

function formatVnd(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

export function DashboardPage() {
  const { t } = useTranslation('sales');

  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await apiClient.get('/v1/raw-orders/dashboard-summary');
      return res.data.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">{t('nav.dashboard')}</h1>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          {t('daily.refresh')}
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">{t('common.loading')}</div>
      ) : !data ? (
        <div className="py-16 text-center text-sm text-gray-400">{t('common.noData')}</div>
      ) : (
        <>
          {/* Date range */}
          <p className="text-xs text-gray-400">
            {t('dashboard.period')}: {data.dateRange.start} ~ {data.dateRange.end}
          </p>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2.5">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('dashboard.totalOrders')}</p>
                  <p className="text-xl font-bold text-gray-900">{data.kpi.totalOrders.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">{t('dashboard.completed')}: {data.kpi.completedOrders.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2.5">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('dashboard.totalGmv')}</p>
                  <p className="text-xl font-bold text-gray-900">{formatVnd(data.kpi.totalGmv)}₫</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2.5 ${data.kpi.estimatedCm >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <TrendingUp className={`h-5 w-5 ${data.kpi.estimatedCm >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('dashboard.estimatedCm')}</p>
                  <p className={`text-xl font-bold ${data.kpi.estimatedCm >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatVnd(data.kpi.estimatedCm)}₫
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-50 p-2.5">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('dashboard.cmPct')}</p>
                  <p className={`text-xl font-bold ${data.kpi.cmPct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {data.kpi.cmPct.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* GMV Trend (line chart) */}
            <div className="col-span-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('dashboard.gmvTrend')}</h3>
              {data.dailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatVnd(v)} />
                    <Tooltip
                      formatter={(v: number) => [`${new Intl.NumberFormat('vi-VN').format(v)}₫`, 'GMV']}
                      labelFormatter={(l) => `Date: ${l}`}
                    />
                    <Line type="monotone" dataKey="gmv" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">{t('common.noData')}</div>
              )}
            </div>

            {/* Channel Breakdown (pie chart) */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('dashboard.channelBreakdown')}</h3>
              {data.channelBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.channelBreakdown}
                      dataKey="gmv"
                      nameKey="channel"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                      paddingAngle={2}
                      label={({ channel, percent }) => `${channel} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.channelBreakdown.map((entry) => (
                        <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel] || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${formatVnd(v)}₫`} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">{t('common.noData')}</div>
              )}
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* SKU Match Rate */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700">{t('dashboard.skuMatchRate')}</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {data.skuMatchRate.matchedItems.toLocaleString()} / {data.skuMatchRate.totalItems.toLocaleString()} items
                  </span>
                  <span className={`font-bold ${data.skuMatchRate.rate >= 80 ? 'text-green-600' : data.skuMatchRate.rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {data.skuMatchRate.rate}%
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${data.skuMatchRate.rate >= 80 ? 'bg-green-500' : data.skuMatchRate.rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${data.skuMatchRate.rate}%` }}
                  />
                </div>
                {data.skuMatchRate.rate < 80 && (
                  <div className="flex items-start gap-1.5 rounded bg-yellow-50 p-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-600" />
                    <p className="text-[11px] text-yellow-700">{t('dashboard.skuWarning')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Uploads */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700">{t('dashboard.recentUploads')}</h3>
              </div>
              {data.recentUploads.length > 0 ? (
                <div className="space-y-2">
                  {data.recentUploads.map((u, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          u.channel === 'SHOPEE' ? 'bg-orange-100 text-orange-700' : 'bg-gray-900 text-white'
                        }`}>{u.channel}</span>
                        <span className="text-gray-600">{u.orderCount} orders</span>
                      </div>
                      <span className="text-gray-400">{new Date(u.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-gray-400">{t('common.noData')}</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
