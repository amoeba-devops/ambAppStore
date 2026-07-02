import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { inquiryService } from '@/services/inquiry.service';
import type { InquiryStatus } from '@/types/inquiry.types';

function statusVariant(s: InquiryStatus) {
  switch (s) {
    case 'RESPONDED':
    case 'VERIFIED':
      return 'success' as const;
    case 'DISPUTED':
      return 'error' as const;
    case 'REVIEWING':
      return 'warning' as const;
    case 'DRAFT':
      return 'inactive' as const;
    default:
      return 'info' as const;
  }
}

export function DashboardPage() {
  const { t } = useTranslation('common');
  const { t: ti } = useTranslation('inquiry');

  const { data } = useQuery({
    queryKey: ['inquiries', 'dashboard'],
    queryFn: () => inquiryService.list({ page: 1, page_size: 10 }),
  });
  const items = data?.items ?? [];

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('app.subtitle')}</p>
        </div>
        <Link to="/new-work" className="btn-primary inline-flex items-center gap-1">
          <Plus className="h-4 w-4" />
          {t('nav.new_work')}
        </Link>
      </header>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          {t('dashboard.in_progress')}
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">{t('dashboard.empty_state')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    {ti('list.created_at')}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    {ti('list.route')}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    {ti('list.completeness')}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    {ti('list.status')}
                  </th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((inq) => (
                  <tr key={inq.id}>
                    <td className="px-3 py-2 text-gray-600">
                      {inq.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700">
                      {inq.exportCountryCode} → {inq.importCountryCode}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700">
                      {inq.completenessScore !== null
                        ? inq.completenessScore.toFixed(2)
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge variant={statusVariant(inq.status)}>
                        {ti(`status.${inq.status}`)}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/new-work/${inq.id}/channel`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
