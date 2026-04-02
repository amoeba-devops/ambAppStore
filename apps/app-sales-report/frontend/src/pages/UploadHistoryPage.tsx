import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { History, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface UploadRecord {
  uphId: string;
  entId: string;
  uphType: string;
  uphChannel: string;
  uphFileName: string;
  uphFileSize: number;
  uphRowCount: number | null;
  uphSuccessCount: number | null;
  uphSkipCount: number | null;
  uphErrorCount: number | null;
  uphStatus: string;
  uphErrorDetail: string | null;
  uphBatchId: string | null;
  uphCreatedBy: string | null;
  uphCreatedAt: string;
}

interface ListResponse {
  data: UploadRecord[];
  pagination: { page: number; size: number; totalCount: number; totalPages: number };
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; key: string }> = {
    COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', key: 'statusCompleted' },
    PARTIAL: { bg: 'bg-yellow-100', text: 'text-yellow-700', key: 'statusPartial' },
    FAILED: { bg: 'bg-red-100', text: 'text-red-700', key: 'statusFailed' },
    PROCESSING: { bg: 'bg-blue-100', text: 'text-blue-700', key: 'statusProcessing' },
  };
  const c = config[status] || config.PROCESSING;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { t } = useTranslation('sales');
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {t(`uploadHistory.${c.key}`)}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === 'SHOPEE') return <span className="inline-flex rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">Shopee</span>;
  if (channel === 'TIKTOK') return <span className="inline-flex rounded bg-gray-900 px-1.5 py-0.5 text-xs font-medium text-white">TikTok</span>;
  return <span className="text-xs text-gray-500">{channel}</span>;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function UploadHistoryPage() {
  const { t } = useTranslation('sales');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, refetch } = useQuery<ListResponse>({
    queryKey: ['upload-histories', page],
    queryFn: async () => {
      const res = await apiClient.get('/v1/upload-histories', {
        params: { page, size: pageSize },
      });
      return res.data;
    },
  });

  const records = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">{t('uploadHistory.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">{t('uploadHistory.description')}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          {t('daily.refresh')}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">{t('common.loading')}</div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">{t('uploadHistory.noHistory')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500">{t('uploadHistory.date')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500">{t('uploadHistory.type')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500">{t('uploadHistory.channel')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500">{t('uploadHistory.fileName')}</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-500">{t('uploadHistory.fileSize')}</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-500">{t('uploadHistory.rows')}</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-500">{t('uploadHistory.success')}</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-500">{t('uploadHistory.errors')}</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-500">{t('uploadHistory.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => (
                  <tr key={r.uphId} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {new Date(r.uphCreatedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.uphType.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3"><ChannelBadge channel={r.uphChannel} /></td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-gray-900" title={r.uphFileName}>
                      {r.uphFileName}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatSize(r.uphFileSize)}</td>
                    <td className="px-4 py-3 text-right">{r.uphRowCount ?? '-'}</td>
                    <td className="px-4 py-3 text-right text-green-600">{r.uphSuccessCount ?? '-'}</td>
                    <td className="px-4 py-3 text-right text-red-600">{r.uphErrorCount ?? '-'}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={r.uphStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <span className="text-xs text-gray-500">
              {pagination.totalCount} items · Page {pagination.page} / {pagination.totalPages}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
