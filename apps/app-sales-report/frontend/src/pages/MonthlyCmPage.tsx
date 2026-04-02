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
  ArrowUp,
  ArrowDown,
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

interface MonthData {
  year: number;
  month: number;
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
  prevGmv: number | null;
  prevCm: number | null;
  prevCmPct: number | null;
  gmvMomRate: number | null;
  cmMomRate: number | null;
  products: ProductCmRow[];
}

interface MonthlyResponse {
  months: MonthData[];
}

const CHANNELS = ['ALL', 'SHOPEE', 'TIKTOK'] as const;
const MONTH_NAMES = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatVnd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function formatFullVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function formatPct(value: number): string {
  return value.toFixed(1) + '%';
}

function MomBadge({ rate }: { rate: number | null }) {
  if (rate == null) return <span className="text-xs text-gray-400">-</span>;
  const isPositive = rate > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {formatPct(Math.abs(rate))}
    </span>
  );
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

function CostBreakdownBar({ gmv, costs }: { gmv: number; costs: { label: string; value: number; color: string }[] }) {
  if (gmv === 0) return null;
  const totalCost = costs.reduce((s, i) => s + i.value, 0);
  const cmValue = gmv - totalCost;

  return (
    <div className="space-y-2">
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-gray-100">
        {costs.map((item) => {
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
        {costs.map((item) => (
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

export function MonthlyCmPage() {
  const { t } = useTranslation('sales');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [channel, setChannel] = useState<string>('ALL');
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<MonthlyResponse>({
    queryKey: ['monthly-cm', year, channel],
    queryFn: async () => {
      const params: Record<string, string> = { year: year.toString() };
      if (channel !== 'ALL') params.channel = channel;
      const res = await apiClient.get('/v1/cm-report/monthly', { params });
      return res.data.data;
    },
  });

  // Merge channels if ALL selected
  const mergedMonths = useMemo(() => {
    if (!data?.months) return [];
    if (channel !== 'ALL') return data.months;

    const map = new Map<string, MonthData & { channels: string[] }>();
    for (const m of data.months) {
      const key = `${m.year}-${m.month}`;
      const existing = map.get(key);
      if (existing) {
        existing.orders += m.orders;
        existing.itemsSold += m.itemsSold;
        existing.gmv += m.gmv;
        existing.sellerDiscount += m.sellerDiscount;
        existing.nmv += m.nmv;
        existing.primeCostTotal += m.primeCostTotal;
        existing.fulfillmentFee += m.fulfillmentFee;
        existing.platformFee += m.platformFee;
        existing.commissionFee += m.commissionFee;
        existing.serviceFee += m.serviceFee;
        existing.shippingFee += m.shippingFee;
        existing.cm += m.cm;
        existing.products.push(...m.products);
        if (!existing.channels.includes(m.channel)) existing.channels.push(m.channel);
        existing.cmPct = existing.gmv > 0 ? (existing.cm / existing.gmv) * 100 : 0;
        // Aggregate MoM
        if (m.prevGmv != null) {
          existing.prevGmv = (existing.prevGmv || 0) + m.prevGmv;
        }
        if (existing.prevGmv != null && existing.prevGmv > 0) {
          existing.gmvMomRate = ((existing.gmv - existing.prevGmv) / existing.prevGmv) * 100;
        }
      } else {
        map.set(key, { ...m, channels: [m.channel] });
      }
    }
    return Array.from(map.values());
  }, [data?.months, channel]);

  // Overall YTD summary
  const ytdSummary = useMemo(() => {
    if (!mergedMonths.length) return null;
    const totalGmv = mergedMonths.reduce((s, m) => s + m.gmv, 0);
    const totalCm = mergedMonths.reduce((s, m) => s + m.cm, 0);
    return {
      totalMonths: mergedMonths.length,
      totalOrders: mergedMonths.reduce((s, m) => s + m.orders, 0),
      totalItems: mergedMonths.reduce((s, m) => s + m.itemsSold, 0),
      totalGmv,
      totalCm,
      avgCmPct: totalGmv > 0 ? (totalCm / totalGmv) * 100 : 0,
    };
  }, [mergedMonths]);

  const toggleMonth = (key: string) => {
    setExpandedMonth(expandedMonth === key ? null : key);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('monthly.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('monthly.description')}</p>
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
            <button onClick={() => setYear(year - 1)} className="rounded border border-gray-300 p-1.5 hover:bg-gray-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="w-16 text-center text-sm font-medium">{year}</span>
            <button onClick={() => setYear(year + 1)} className="rounded border border-gray-300 p-1.5 hover:bg-gray-50">
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
                  channel === ch ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {ch === 'ALL' ? t('daily.allChannels') : ch}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* YTD Summary Cards */}
      {ytdSummary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-2"><Calendar className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500">{t('monthly.ytdMonths')}</p>
                <p className="text-lg font-bold text-gray-900">{ytdSummary.totalMonths}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-green-50 p-2"><Package className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-gray-500">{t('monthly.ytdOrders')}</p>
                <p className="text-lg font-bold text-gray-900">{ytdSummary.totalOrders.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-50 p-2"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-gray-500">{t('monthly.ytdGmv')}</p>
                <p className="text-lg font-bold text-gray-900">{formatVnd(ytdSummary.totalGmv)}₫</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className={`rounded-lg p-2 ${ytdSummary.totalCm >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                {ytdSummary.totalCm >= 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('monthly.ytdCm')}</p>
                <p className={`text-lg font-bold ${ytdSummary.totalCm >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatVnd(ytdSummary.totalCm)}₫
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-purple-50 p-2"><BarChart3 className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-xs text-gray-500">{t('monthly.ytdCmPct')}</p>
                <p className={`text-lg font-bold ${ytdSummary.avgCmPct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatPct(ytdSummary.avgCmPct)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Cards */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">{t('common.loading')}</div>
        ) : !mergedMonths.length ? (
          <div className="py-12 text-center text-sm text-gray-400">{t('common.noData')}</div>
        ) : (
          mergedMonths.map((mo) => {
            const key = `${mo.year}-${mo.month}`;
            const isExpanded = expandedMonth === key;
            const costs = [
              { label: 'Prime Cost', value: mo.primeCostTotal, color: 'bg-blue-500' },
              { label: 'Platform Fee', value: mo.platformFee, color: 'bg-purple-500' },
              { label: 'Fulfillment', value: mo.fulfillmentFee, color: 'bg-cyan-500' },
              { label: 'Commission', value: mo.commissionFee, color: 'bg-indigo-500' },
              { label: 'Discount', value: mo.sellerDiscount, color: 'bg-pink-500' },
              { label: 'Service Fee', value: mo.serviceFee, color: 'bg-teal-500' },
            ];

            return (
              <div key={key} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                {/* Month header */}
                <button
                  onClick={() => toggleMonth(key)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-sm font-bold text-gray-900">
                        {MONTH_NAMES[mo.month]} {mo.year}
                      </span>
                    </div>
                    {'channels' in mo && (
                      <div className="flex gap-1">
                        {(mo as MonthData & { channels: string[] }).channels.map((ch) => (
                          <ChannelBadge key={ch} channel={ch} />
                        ))}
                      </div>
                    )}
                    {!('channels' in mo) && <ChannelBadge channel={mo.channel} />}
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <span className="text-xs text-gray-500">{t('monthly.orders')}</span>
                      <p className="font-medium">{mo.orders.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">GMV</span>
                      <p className="font-medium">{formatVnd(mo.gmv)}₫</p>
                      <MomBadge rate={mo.gmvMomRate} />
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">CM</span>
                      <p className={`font-bold ${mo.cm >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatVnd(mo.cm)}₫
                      </p>
                      <MomBadge rate={mo.cmMomRate} />
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">CM%</span>
                      <p className={`font-bold ${mo.cmPct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatPct(mo.cmPct)}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-200 px-5 py-4 space-y-4">
                    {/* Cost breakdown */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">{t('weekly.costBreakdown')}</h4>
                      <CostBreakdownBar gmv={mo.gmv} costs={costs} />
                    </div>

                    {/* MoM comparison */}
                    {mo.prevGmv != null && (
                      <div className="rounded-lg bg-blue-50 p-3">
                        <h4 className="mb-2 text-xs font-semibold uppercase text-blue-700">{t('monthly.momComparison')}</h4>
                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-blue-600">{t('monthly.prevGmv')}</span>
                            <p className="font-medium text-gray-900">{formatFullVnd(mo.prevGmv)}₫</p>
                          </div>
                          <div>
                            <span className="text-blue-600">{t('monthly.currentGmv')}</span>
                            <p className="font-medium text-gray-900">{formatFullVnd(mo.gmv)}₫</p>
                          </div>
                          <div>
                            <span className="text-blue-600">{t('monthly.gmvChange')}</span>
                            <p className="font-medium"><MomBadge rate={mo.gmvMomRate} /></p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cost summary grid */}
                    <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 text-xs lg:grid-cols-6">
                      <div><span className="text-gray-500">Prime Cost</span><p className="font-medium">{formatFullVnd(mo.primeCostTotal)}₫</p></div>
                      <div><span className="text-gray-500">Platform Fee</span><p className="font-medium">{formatFullVnd(mo.platformFee)}₫</p></div>
                      <div><span className="text-gray-500">Fulfillment</span><p className="font-medium">{formatFullVnd(mo.fulfillmentFee)}₫</p></div>
                      <div><span className="text-gray-500">Commission</span><p className="font-medium">{formatFullVnd(mo.commissionFee)}₫</p></div>
                      <div><span className="text-gray-500">Discount</span><p className="font-medium">{formatFullVnd(mo.sellerDiscount)}₫</p></div>
                      <div><span className="text-gray-500">Service Fee</span><p className="font-medium">{formatFullVnd(mo.serviceFee)}₫</p></div>
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
                            {mo.products
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
                        {mo.products.length > 30 && (
                          <p className="mt-2 text-center text-xs text-gray-400">
                            +{mo.products.length - 30} {t('weekly.moreProducts')}
                          </p>
                        )}
                      </div>
                    </div>

                    {mo.products.some((p) => p.cmStatus !== 'NORMAL') && (
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
