import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRawOrderList } from '@/hooks/useRawOrders';

const CHANNELS = ['ALL', 'SHOPEE', 'TIKTOK'] as const;
const STATUSES = ['ALL', 'COMPLETED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PENDING'] as const;

export function RawOrderListPage() {
  const { t } = useTranslation('sales');
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [channel, setChannel] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(() => {
    const p: Record<string, string | number | undefined> = { page, size: 20 };
    if (startDate) p.start_date = startDate;
    if (endDate) p.end_date = endDate;
    if (channel !== 'ALL') p.channel = channel;
    if (status !== 'ALL') p.status = status;
    if (search) p.search = search;
    return p;
  }, [startDate, endDate, channel, status, search, page]);

  const { data: result, isLoading } = useRawOrderList(params);
  const orders = result?.data ?? [];
  const pagination = result?.pagination;

  const formatVnd = (n: number) =>
    new Intl.NumberFormat('vi-VN').format(n);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">{t('order.title')}</h1>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <span className="text-gray-400">~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={channel}
          onChange={(e) => { setChannel(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {CHANNELS.map((c) => (
            <option key={c} value={c}>{c === 'ALL' ? t('daily.allChannels') : c}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === 'ALL' ? t('order.allStatuses') : s}</option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('order.searchPlaceholder')}
            className="rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('order.orderId')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('order.date')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('order.channel')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('order.status')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">{t('order.items')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">{t('order.totalAmount')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">{t('order.skuMatch')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('common.loading')}</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('common.noData')}</td></tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.ordId}
                    className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                    onClick={() => navigate(`/orders/${order.ordId}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{order.channelOrderId}</td>
                    <td className="px-4 py-3 text-xs">{new Date(order.orderDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        order.channel === 'SHOPEE' ? 'bg-orange-100 text-orange-700' : 'bg-black text-white'
                      }`}>
                        {order.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{order.itemCount} ({order.totalQty})</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{formatVnd(order.totalVnd)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono text-xs ${
                        order.skuMatchRate >= 80 ? 'text-green-600' :
                        order.skuMatchRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {order.skuMatchRate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {t('order.showing')} {(pagination.page - 1) * pagination.size + 1}–
            {Math.min(pagination.page * pagination.size, pagination.totalCount)} / {pagination.totalCount}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm text-gray-700">{page} / {pagination.totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
