import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import {
  ArrowLeft,
  ShoppingCart,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface ChannelBreakdown {
  channel: string;
  orders: number;
  gmv: number;
  commissionFee: number;
  serviceFee: number;
  shippingFee: number;
}

interface ProductCmRow {
  productName: string;
  variantSku: string;
  skuWmsCode: string | null;
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

interface DailyDetail {
  date: string;
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
  channels: ChannelBreakdown[];
  products: ProductCmRow[];
}

function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

export function DailyDetailPage() {
  const { t } = useTranslation('sales');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date') || '';
  const channelFilter = searchParams.get('channel') || '';

  const { data, isLoading, error } = useQuery<DailyDetail>({
    queryKey: ['daily-detail', date, channelFilter],
    queryFn: async () => {
      const params: Record<string, string> = { date };
      if (channelFilter) params.channel = channelFilter;
      const res = await apiClient.get('/v1/cm-report/daily', { params });
      return res.data.data;
    },
    enabled: !!date,
  });

  const sortedProducts = useMemo(() => {
    if (!data?.products) return [];
    return [...data.products].sort((a, b) => b.gmv - a.gmv);
  }, [data?.products]);

  if (!date) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-gray-500">{t('dailyDetail.noDateSelected')}</p>
        <button onClick={() => navigate('/daily-report')} className="mt-2 text-sm text-blue-600 hover:underline">
          {t('dailyDetail.backToDaily')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/daily-report')}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('dailyDetail.backToDaily')}
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{formatDateDisplay(date)}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{t('dailyDetail.description')}</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
          <span className="text-sm text-gray-500">{t('common.loading')}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t('common.error')}
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KpiCard
              icon={<ShoppingCart className="h-5 w-5 text-blue-600" />}
              label={t('dailyDetail.orders')}
              value={data.orders.toLocaleString()}
              bg="bg-blue-50"
            />
            <KpiCard
              icon={<Package className="h-5 w-5 text-purple-600" />}
              label={t('dailyDetail.itemsSold')}
              value={data.itemsSold.toLocaleString()}
              bg="bg-purple-50"
            />
            <KpiCard
              icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
              label="GMV"
              value={`${formatVnd(data.gmv)} ₫`}
              bg="bg-emerald-50"
            />
            <KpiCard
              icon={data.cm >= 0
                ? <TrendingUp className="h-5 w-5 text-green-600" />
                : <TrendingDown className="h-5 w-5 text-red-600" />}
              label="CM"
              value={`${formatVnd(data.cm)} ₫`}
              bg={data.cm >= 0 ? 'bg-green-50' : 'bg-red-50'}
            />
            <KpiCard
              icon={data.cmPct >= 0
                ? <TrendingUp className="h-5 w-5 text-green-600" />
                : <TrendingDown className="h-5 w-5 text-red-600" />}
              label="CM%"
              value={`${data.cmPct.toFixed(1)}%`}
              bg={data.cmPct >= 0 ? 'bg-green-50' : 'bg-red-50'}
            />
          </div>

          {/* Channel Breakdown */}
          {data.channels.length > 1 && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-800">{t('dailyDetail.channelBreakdown')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.channels.map((ch) => (
                  <div key={ch.channel} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ChannelBadge channel={ch.channel} />
                      <span className="text-sm font-medium text-gray-700">{ch.orders} {t('dailyDetail.ordersUnit')}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{formatVnd(ch.gmv)} ₫</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-800">{t('dailyDetail.costBreakdown')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <CostItem label={t('dailyDetail.primeCost')} value={data.primeCostTotal} />
              <CostItem label={t('dailyDetail.fulfillment')} value={data.fulfillmentFee} />
              <CostItem label={t('dailyDetail.platformFee')} value={data.platformFee} />
              <CostItem label={t('dailyDetail.sellerDiscount')} value={data.sellerDiscount} />
              <CostItem label={t('dailyDetail.commission')} value={data.commissionFee} />
              <CostItem label={t('dailyDetail.serviceFee')} value={data.serviceFee} />
              <CostItem label={t('dailyDetail.shippingFee')} value={data.shippingFee} />
              <CostItem label="NMV" value={data.nmv} highlight />
            </div>
          </div>

          {/* Product Table */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-800">
                {t('dailyDetail.productDetail')} ({sortedProducts.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{t('dailyDetail.product')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{t('dailyDetail.sku')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{t('daily.channel')}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">{t('daily.qty')}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">GMV</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">{t('dailyDetail.primeCost')}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">CM</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">CM%</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">{t('daily.channel')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-sm text-gray-400">{t('common.noData')}</td>
                    </tr>
                  ) : (
                    sortedProducts.map((p, idx) => (
                      <tr key={`${p.variantSku}-${p.channel}-${idx}`} className="hover:bg-gray-50">
                        <td className="max-w-[200px] truncate px-4 py-2.5 text-sm text-gray-900" title={p.productName}>
                          {p.productName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-gray-600">
                          {p.variantSku || '-'}
                        </td>
                        <td className="px-4 py-2.5"><ChannelBadge channel={p.channel} /></td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-700">{p.itemsSold}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium text-gray-900">{formatVnd(p.gmv)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-600">{formatVnd(p.primeCostTotal)}</td>
                        <td className={`whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium ${p.cm >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {formatVnd(p.cm)}
                        </td>
                        <td className={`whitespace-nowrap px-4 py-2.5 text-right text-sm ${p.cmPct >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {p.cmPct.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {p.cmStatus !== 'NORMAL' && (
                            <span title={p.cmStatus}>
                              <AlertTriangle className="mx-auto h-4 w-4 text-amber-500" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>{icon}</div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function CostItem({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>{formatVnd(value)} ₫</p>
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
