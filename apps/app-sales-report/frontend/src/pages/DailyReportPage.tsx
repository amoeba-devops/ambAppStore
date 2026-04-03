import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import {
  ShoppingCart,
  DollarSign,
  Package,
  TrendingUp,
  XCircle,
  Filter,
  RefreshCw,
} from 'lucide-react';

interface DailyRow {
  date: string;
  channel: string;
  orderCount: number;
  completedCount: number;
  cancelledCount: number;
  totalGmv: number;
  totalBuyerPayment: number;
  totalCommission: number;
  totalServiceFee: number;
  totalShippingFee: number;
  totalQuantity: number;
  uniqueSkuCount: number;
}

interface DailySummary {
  totalOrders: number;
  totalCompleted: number;
  totalCancelled: number;
  totalGmv: number;
  totalQuantity: number;
}

interface DailyResponse {
  rows: DailyRow[];
  summary: DailySummary;
  dateRange: { start: string; end: string };
}

const CHANNELS = ['ALL', 'SHOPEE', 'TIKTOK'] as const;

function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' });
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function DailyReportPage() {
  const { t } = useTranslation('sales');
  const navigate = useNavigate();
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [channel, setChannel] = useState<string>('ALL');

  const { data, isLoading, refetch } = useQuery<DailyResponse>({
    queryKey: ['daily-summary', startDate, endDate, channel],
    queryFn: async () => {
      const params: Record<string, string> = {
        start_date: startDate,
        end_date: endDate,
      };
      if (channel !== 'ALL') params.channel = channel;
      const res = await apiClient.get('/v1/raw-orders/daily-summary', { params });
      return res.data.data;
    },
  });

  // Aggregate rows by date (merge channels for table)
  const aggregatedByDate = useMemo(() => {
    if (!data?.rows) return [];
    const map = new Map<string, DailyRow & { channels: string[] }>();
    for (const row of data.rows) {
      const existing = map.get(row.date);
      if (existing) {
        existing.orderCount += row.orderCount;
        existing.completedCount += row.completedCount;
        existing.cancelledCount += row.cancelledCount;
        existing.totalGmv += row.totalGmv;
        existing.totalBuyerPayment += row.totalBuyerPayment;
        existing.totalCommission += row.totalCommission;
        existing.totalServiceFee += row.totalServiceFee;
        existing.totalShippingFee += row.totalShippingFee;
        existing.totalQuantity += row.totalQuantity;
        existing.uniqueSkuCount += row.uniqueSkuCount;
        if (!existing.channels.includes(row.channel)) existing.channels.push(row.channel);
      } else {
        map.set(row.date, { ...row, channels: [row.channel] });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [data?.rows]);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('daily.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('daily.description')}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          {t('daily.refresh')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{t('daily.filter')}</span>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t('daily.startDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t('daily.endDate')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t('daily.channel')}</label>
          <div className="flex gap-1">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  channel === ch
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {ch === 'ALL' ? t('daily.allChannels') : ch}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <SummaryCard
            icon={<ShoppingCart className="h-5 w-5 text-blue-600" />}
            label={t('daily.totalOrders')}
            value={summary.totalOrders.toLocaleString()}
            bgColor="bg-blue-50"
          />
          <SummaryCard
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            label={t('daily.completed')}
            value={summary.totalCompleted.toLocaleString()}
            bgColor="bg-green-50"
          />
          <SummaryCard
            icon={<XCircle className="h-5 w-5 text-red-600" />}
            label={t('daily.cancelled')}
            value={summary.totalCancelled.toLocaleString()}
            bgColor="bg-red-50"
          />
          <SummaryCard
            icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
            label={t('daily.totalGmv')}
            value={`${formatVnd(summary.totalGmv)} ₫`}
            bgColor="bg-emerald-50"
          />
          <SummaryCard
            icon={<Package className="h-5 w-5 text-purple-600" />}
            label={t('daily.totalQuantity')}
            value={summary.totalQuantity.toLocaleString()}
            bgColor="bg-purple-50"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{t('daily.date')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{t('daily.channel')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">{t('daily.orders')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">{t('daily.completed')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">{t('daily.cancelled')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">{t('daily.qty')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">{t('daily.gmv')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">{t('daily.buyerPayment')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">{t('daily.commission')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">{t('daily.skuCount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-gray-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : !data?.rows?.length ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-gray-400">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : channel === 'ALL' ? (
                aggregatedByDate.map((row) => (
                  <tr key={row.date} className="cursor-pointer hover:bg-blue-50/50" onClick={() => navigate(`/daily-report/detail?date=${row.date}`)}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-blue-600 underline decoration-blue-300 underline-offset-2">{formatDate(row.date)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {row.channels.map((ch) => (
                          <ChannelBadge key={ch} channel={ch} />
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-700">{row.orderCount}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-green-700">{row.completedCount}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-red-600">{row.cancelledCount}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-700">{row.totalQuantity}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium text-gray-900">{formatVnd(row.totalGmv)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-700">{formatVnd(row.totalBuyerPayment)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-500">{formatVnd(row.totalCommission)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-500">{row.uniqueSkuCount}</td>
                  </tr>
                ))
              ) : (
                data.rows.map((row) => (
                  <tr key={`${row.date}-${row.channel}`} className="cursor-pointer hover:bg-blue-50/50" onClick={() => navigate(`/daily-report/detail?date=${row.date}&channel=${row.channel}`)}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-blue-600 underline decoration-blue-300 underline-offset-2">{formatDate(row.date)}</td>
                    <td className="px-4 py-2.5"><ChannelBadge channel={row.channel} /></td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-700">{row.orderCount}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-green-700">{row.completedCount}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-red-600">{row.cancelledCount}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-700">{row.totalQuantity}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium text-gray-900">{formatVnd(row.totalGmv)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-700">{formatVnd(row.totalBuyerPayment)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-500">{formatVnd(row.totalCommission)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-500">{row.uniqueSkuCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bgColor: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgColor}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const colors: Record<string, string> = {
    SHOPEE: 'bg-orange-100 text-orange-700',
    TIKTOK: 'bg-slate-100 text-slate-700',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[channel] || 'bg-gray-100 text-gray-600'}`}>
      {channel}
    </span>
  );
}
