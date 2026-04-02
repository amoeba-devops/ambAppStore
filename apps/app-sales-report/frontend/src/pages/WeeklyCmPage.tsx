import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import {
  Calendar,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

interface ProductCmRow {
  productName: string;
  variantSku: string;
  channel: string;
  itemsSold: number;
  gmv: number;
  sellerDiscount: number;
  nmv: number;
  primeCost: number;
  primeCostTotal: number;
  fulfillmentFee: number;
  platformFee: number;
  cm: number;
  cmPct: number;
  cmStatus: string;
}

interface WeekData {
  year: number;
  weekNo: number;
  startDate: string;
  endDate: string;
  channel: string;
  orders: number;
  itemsSold: number;
  gmv: number;
  sellerDiscount: number;
  nmv: number;
  primeCostTotal: number;
  fulfillmentFee: number;
  platformFee: number;
  commissionFee: number;
  serviceFee: number;
  shippingFee: number;
  cm: number;
  cmPct: number;
  products: ProductCmRow[];
}

interface WeeklyResponse {
  weeks: WeekData[];
}

const CHANNELS = ['ALL', 'SHOPEE', 'TIKTOK'] as const;

function formatVnd(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function formatFullVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function formatPct(value: number): string {
  return value.toFixed(1) + '%';
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function CmStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    NORMAL: { bg: 'bg-green-100', text: 'text-green-700', label: 'Normal' },
    NEGATIVE: { bg: 'bg-red-100', text: 'text-red-700', label: 'Negative' },
    SKU_UNMAPPED: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Unmapped' },
    PRIME_COST_MISSING: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'No Cost' },
    INCOMPLETE: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Incomplete' },
  };
  const c = config[status] || config.INCOMPLETE;
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === 'SHOPEE') {
    return <span className="inline-flex items-center rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">Shopee</span>;
  }
  if (channel === 'TIKTOK') {
    return <span className="inline-flex items-center rounded bg-gray-900 px-1.5 py-0.5 text-xs font-medium text-white">TikTok</span>;
  }
  return <span className="text-xs text-gray-500">{channel}</span>;
}

function CostBreakdownBar({ data }: { data: WeekData }) {
  const gmv = data.gmv || 1;
  const items = [
    { label: 'Prime Cost', value: data.primeCostTotal, color: 'bg-blue-500' },
    { label: 'Platform Fee', value: data.platformFee, color: 'bg-purple-500' },
    { label: 'Fulfillment', value: data.fulfillmentFee, color: 'bg-cyan-500' },
    { label: 'Commission', value: data.commissionFee, color: 'bg-indigo-500' },
    { label: 'Discount', value: data.sellerDiscount, color: 'bg-pink-500' },
    { label: 'Service Fee', value: data.serviceFee, color: 'bg-teal-500' },
  ];
  const totalCost = items.reduce((s, i) => s + i.value, 0);
  const cmValue = gmv - totalCost;

  return (
    <div className="space-y-2">
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-gray-100">
        {items.map((item) => {
          const pct = (item.value / gmv) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={item.label}
              className={`${item.color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${item.label}: ${formatFullVnd(item.value)}₫ (${formatPct(pct)})`}
            />
          );
        })}
        <div
          className={cmValue >= 0 ? 'bg-green-500' : 'bg-red-500'}
          style={{ width: `${Math.max((Math.abs(cmValue) / gmv) * 100, 0.5)}%` }}
          title={`CM: ${formatFullVnd(cmValue)}₫ (${formatPct((cmValue / gmv) * 100)})`}
        />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        {items.map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${item.color}`} />
            {item.label} {formatPct((item.value / gmv) * 100)}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm ${cmValue >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
          CM {formatPct((cmValue / gmv) * 100)}
        </span>
      </div>
    </div>
  );
}

export function WeeklyCmPage() {
  const { t } = useTranslation('sales');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [channel, setChannel] = useState<string>('ALL');
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<WeeklyResponse>({
    queryKey: ['weekly-cm', year, channel],
    queryFn: async () => {
      const params: Record<string, string> = { year: year.toString() };
      if (channel !== 'ALL') params.channel = channel;
      const res = await apiClient.get('/v1/cm-report/weekly', { params });
      return res.data.data;
    },
  });

  // Merge channels if ALL selected
  const mergedWeeks = useMemo(() => {
    if (!data?.weeks) return [];
    if (channel !== 'ALL') return data.weeks;

    const map = new Map<string, WeekData & { channels: string[] }>();
    for (const w of data.weeks) {
      const key = `${w.year}-${w.weekNo}`;
      const existing = map.get(key);
      if (existing) {
        existing.orders += w.orders;
        existing.itemsSold += w.itemsSold;
        existing.gmv += w.gmv;
        existing.sellerDiscount += w.sellerDiscount;
        existing.nmv += w.nmv;
        existing.primeCostTotal += w.primeCostTotal;
        existing.fulfillmentFee += w.fulfillmentFee;
        existing.platformFee += w.platformFee;
        existing.commissionFee += w.commissionFee;
        existing.serviceFee += w.serviceFee;
        existing.shippingFee += w.shippingFee;
        existing.cm += w.cm;
        existing.products.push(...w.products);
        if (!existing.channels.includes(w.channel)) existing.channels.push(w.channel);
        // Recalculate cmPct
        existing.cmPct = existing.gmv > 0 ? (existing.cm / existing.gmv) * 100 : 0;
        // Use wider date range
        if (w.startDate < existing.startDate) existing.startDate = w.startDate;
        if (w.endDate > existing.endDate) existing.endDate = w.endDate;
      } else {
        map.set(key, { ...w, channels: [w.channel] });
      }
    }
    return Array.from(map.values());
  }, [data?.weeks, channel]);

  // Overall summary across all weeks
  const overallSummary = useMemo(() => {
    if (!mergedWeeks.length) return null;
    return {
      totalWeeks: mergedWeeks.length,
      totalOrders: mergedWeeks.reduce((s, w) => s + w.orders, 0),
      totalItems: mergedWeeks.reduce((s, w) => s + w.itemsSold, 0),
      totalGmv: mergedWeeks.reduce((s, w) => s + w.gmv, 0),
      totalCm: mergedWeeks.reduce((s, w) => s + w.cm, 0),
      avgCmPct: (() => {
        const totalGmv = mergedWeeks.reduce((s, w) => s + w.gmv, 0);
        const totalCm = mergedWeeks.reduce((s, w) => s + w.cm, 0);
        return totalGmv > 0 ? (totalCm / totalGmv) * 100 : 0;
      })(),
    };
  }, [mergedWeeks]);

  const toggleWeek = (key: string) => {
    setExpandedWeek(expandedWeek === key ? null : key);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('weekly.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('weekly.description')}</p>
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
          <label className="mb-1 block text-xs text-gray-500">{t('weekly.year')}</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setYear(year - 1)}
              className="rounded border border-gray-300 p-1.5 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="w-16 text-center text-sm font-medium">{year}</span>
            <button
              onClick={() => setYear(year + 1)}
              className="rounded border border-gray-300 p-1.5 hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
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
      {overallSummary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-2"><Calendar className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500">{t('weekly.totalWeeks')}</p>
                <p className="text-lg font-bold text-gray-900">{overallSummary.totalWeeks}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-green-50 p-2"><Package className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-gray-500">{t('weekly.totalOrders')}</p>
                <p className="text-lg font-bold text-gray-900">{overallSummary.totalOrders.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-50 p-2"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-gray-500">{t('weekly.totalGmv')}</p>
                <p className="text-lg font-bold text-gray-900">{formatVnd(overallSummary.totalGmv)}₫</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className={`rounded-lg p-2 ${overallSummary.totalCm >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                {overallSummary.totalCm >= 0
                  ? <TrendingUp className="h-5 w-5 text-green-600" />
                  : <TrendingDown className="h-5 w-5 text-red-600" />}
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('weekly.totalCm')}</p>
                <p className={`text-lg font-bold ${overallSummary.totalCm >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatVnd(overallSummary.totalCm)}₫
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-purple-50 p-2"><BarChart3 className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-xs text-gray-500">{t('weekly.avgCmPct')}</p>
                <p className={`text-lg font-bold ${overallSummary.avgCmPct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatPct(overallSummary.avgCmPct)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Accordion */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">{t('common.loading')}</div>
        ) : !mergedWeeks.length ? (
          <div className="py-12 text-center text-sm text-gray-400">{t('common.noData')}</div>
        ) : (
          mergedWeeks.map((week) => {
            const key = `${week.year}-W${week.weekNo}`;
            const isExpanded = expandedWeek === key;
            return (
              <div key={key} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                {/* Week header */}
                <button
                  onClick={() => toggleWeek(key)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-sm font-bold text-gray-900">
                        W{week.weekNo}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {week.startDate} ~ {week.endDate}
                      </span>
                    </div>
                    {'channels' in week && (
                      <div className="flex gap-1">
                        {(week as WeekData & { channels: string[] }).channels.map((ch) => (
                          <ChannelBadge key={ch} channel={ch} />
                        ))}
                      </div>
                    )}
                    {!('channels' in week) && <ChannelBadge channel={week.channel} />}
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <span className="text-xs text-gray-500">{t('weekly.orders')}</span>
                      <p className="font-medium">{week.orders.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">GMV</span>
                      <p className="font-medium">{formatVnd(week.gmv)}₫</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">CM</span>
                      <p className={`font-bold ${week.cm >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatVnd(week.cm)}₫
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">CM%</span>
                      <p className={`font-bold ${week.cmPct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatPct(week.cmPct)}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-200 px-5 py-4 space-y-4">
                    {/* Cost breakdown bar */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">{t('weekly.costBreakdown')}</h4>
                      <CostBreakdownBar data={week} />
                    </div>

                    {/* Summary row */}
                    <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 text-xs lg:grid-cols-6">
                      <div><span className="text-gray-500">Prime Cost</span><p className="font-medium">{formatFullVnd(week.primeCostTotal)}₫</p></div>
                      <div><span className="text-gray-500">Platform Fee</span><p className="font-medium">{formatFullVnd(week.platformFee)}₫</p></div>
                      <div><span className="text-gray-500">Fulfillment</span><p className="font-medium">{formatFullVnd(week.fulfillmentFee)}₫</p></div>
                      <div><span className="text-gray-500">Commission</span><p className="font-medium">{formatFullVnd(week.commissionFee)}₫</p></div>
                      <div><span className="text-gray-500">Discount</span><p className="font-medium">{formatFullVnd(week.sellerDiscount)}₫</p></div>
                      <div><span className="text-gray-500">Service Fee</span><p className="font-medium">{formatFullVnd(week.serviceFee)}₫</p></div>
                    </div>

                    {/* Product table */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">{t('weekly.productDetail')}</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-gray-500">{t('weekly.product')}</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-500">SKU</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500">{t('weekly.qty')}</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500">GMV</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500">NMV</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500">Prime Cost</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500">Platform Fee</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500">CM</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500">CM%</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-500">{t('weekly.status')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {week.products
                              .sort((a, b) => b.gmv - a.gmv)
                              .slice(0, 30)
                              .map((p, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="max-w-[200px] truncate px-3 py-2 text-gray-900" title={p.productName}>{p.productName}</td>
                                  <td className="px-3 py-2 text-gray-500 font-mono">{p.variantSku || '-'}</td>
                                  <td className="px-3 py-2 text-right">{p.itemsSold}</td>
                                  <td className="px-3 py-2 text-right">{formatVnd(p.gmv)}₫</td>
                                  <td className="px-3 py-2 text-right">{formatVnd(p.nmv)}₫</td>
                                  <td className="px-3 py-2 text-right">{formatVnd(p.primeCostTotal)}₫</td>
                                  <td className="px-3 py-2 text-right">{formatVnd(p.platformFee)}₫</td>
                                  <td className={`px-3 py-2 text-right font-medium ${p.cm >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    {formatVnd(p.cm)}₫
                                  </td>
                                  <td className={`px-3 py-2 text-right font-medium ${p.cmPct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    {formatPct(p.cmPct)}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <CmStatusBadge status={p.cmStatus} />
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {week.products.length > 30 && (
                          <p className="mt-2 text-center text-xs text-gray-400">
                            +{week.products.length - 30} {t('weekly.moreProducts')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Warning for unmapped SKUs */}
                    {week.products.some((p) => p.cmStatus !== 'NORMAL') && (
                      <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
                        <p className="text-xs text-yellow-700">{t('weekly.cmWarning')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
