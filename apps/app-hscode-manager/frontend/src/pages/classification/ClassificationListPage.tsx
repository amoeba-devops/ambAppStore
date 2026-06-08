import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  classificationService,
  ListClassificationsQuery,
} from '@/services/classification.service';
import type { ClassificationStatus } from '@/types/classification.types';

function statusVariant(s: ClassificationStatus) {
  if (s === 'ADOPTED' || s === 'SEALED') return 'success' as const;
  if (s === 'SUPERSEDED') return 'inactive' as const;
  if (s === 'DISPUTED') return 'error' as const;
  return 'info' as const;
}

export function ClassificationListPage() {
  const { t } = useTranslation('classification');
  const navigate = useNavigate();

  const [filter, setFilter] = useState<ListClassificationsQuery>({
    page: 1,
    page_size: 50,
  });
  const [applied, setApplied] = useState<ListClassificationsQuery>(filter);

  const { data, isLoading } = useQuery({
    queryKey: ['classifications', applied],
    queryFn: () => classificationService.list(applied),
  });

  const { data: kpi } = useQuery({
    queryKey: ['rank1-hit-rate', 90],
    queryFn: () => classificationService.rank1HitRate(90),
  });

  const items = data?.items ?? [];

  return (
    <div className="p-6">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('list.title')}</h1>
          {kpi && (
            <p className="mt-1 text-xs text-blue-700">
              {t('list.kpi.rank1_hit', {
                rate: (kpi.rank1HitRate * 100).toFixed(1),
              })}
            </p>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {t('list.count', { count: data?.total ?? 0 })}
        </span>
      </header>

      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-gray-600">{t('list.filter.import_country')}</span>
          <input
            className="input mt-1 w-20"
            maxLength={2}
            value={filter.import_country ?? ''}
            onChange={(e) =>
              setFilter({ ...filter, import_country: e.target.value.toUpperCase() })
            }
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-600">{t('list.filter.export_country')}</span>
          <input
            className="input mt-1 w-20"
            maxLength={2}
            value={filter.export_country ?? ''}
            onChange={(e) =>
              setFilter({ ...filter, export_country: e.target.value.toUpperCase() })
            }
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-600">{t('list.filter.hs_code')}</span>
          <input
            className="input mt-1"
            placeholder="7220.20.10"
            value={filter.hs_code ?? ''}
            onChange={(e) => setFilter({ ...filter, hs_code: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-600">{t('list.filter.status')}</span>
          <select
            className="input mt-1"
            value={filter.status ?? ''}
            onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
          >
            <option value="">—</option>
            <option value="ADOPTED">{t('list.status.ADOPTED')}</option>
            <option value="SEALED">{t('list.status.SEALED')}</option>
            <option value="SUPERSEDED">{t('list.status.SUPERSEDED')}</option>
            <option value="DISPUTED">{t('list.status.DISPUTED')}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-gray-600">{t('list.filter.from')}</span>
          <input
            type="date"
            className="input mt-1"
            value={filter.from ?? ''}
            onChange={(e) => setFilter({ ...filter, from: e.target.value || undefined })}
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-600">{t('list.filter.to')}</span>
          <input
            type="date"
            className="input mt-1"
            value={filter.to ?? ''}
            onChange={(e) => setFilter({ ...filter, to: e.target.value || undefined })}
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-600">{t('list.filter.q')}</span>
          <input
            className="input mt-1"
            value={filter.q ?? ''}
            onChange={(e) => setFilter({ ...filter, q: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && setApplied(filter)}
          />
        </label>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setApplied(filter)}
        >
          <Search className="mr-1 inline-block h-4 w-4" />
          {t('common:common.confirm')}
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('list.columns.date')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('list.columns.route')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('list.columns.hs')}
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">
                {t('list.columns.confidence')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('list.columns.status')}
              </th>
              <th className="px-3 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td className="px-3 py-4 text-center text-gray-400" colSpan={6}>
                  …
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-gray-400" colSpan={6}>
                  {t('list.kpi.empty')}
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/classifications/${c.id}`)}
              >
                <td className="px-3 py-2 text-gray-600">
                  {(c.adoptedAt ?? c.createdAt).slice(0, 10)}
                </td>
                <td className="px-3 py-2 font-mono text-gray-700">
                  {c.inquiry?.exportCountryCode ?? '—'} →{' '}
                  {c.inquiry?.importCountryCode ?? '—'}
                </td>
                <td className="px-3 py-2 font-mono font-medium text-gray-900">
                  {c.hsCode}
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-700">
                  {c.confidenceScore !== null
                    ? c.confidenceScore.toFixed(2)
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge variant={statusVariant(c.status)}>
                    {t(`list.status.${c.status}`)}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2 text-right text-xs text-blue-600">→</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
