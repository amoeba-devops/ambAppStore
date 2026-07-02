import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { expertService } from '@/services/expert.service';
import { useAuthStore } from '@/stores/auth.store';
import type { ExpertRole, ReviewVerdict } from '@/types/expert.types';

function verdictVariant(v: ReviewVerdict) {
  switch (v) {
    case 'PENDING':
      return 'warning' as const;
    case 'APPROVE':
      return 'success' as const;
    case 'REVISE':
      return 'info' as const;
    case 'REJECT':
      return 'error' as const;
  }
}

export function EscalationQueuePage() {
  const { t } = useTranslation('expert');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  // 사용자 역할에서 expert role 자동 추출
  let role: ExpertRole | undefined;
  if (user?.roles?.includes('EXPERT_LOCAL')) role = 'EXPERT_LOCAL';
  else if (user?.roles?.includes('EXPERT_INTERNAL')) role = 'EXPERT_INTERNAL';

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['expert-reviews', role],
    queryFn: () => expertService.list({ role }),
  });

  return (
    <div className="p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">{t('queue.title')}</h1>
        <p className="mt-1 text-xs text-gray-500">
          {t('queue.subtitle', {
            role: role ? t(`queue.role.${role}`) : '—',
          })}
        </p>
      </header>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('queue.columns.requested_at')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('queue.columns.route')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('queue.columns.hs')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('queue.columns.item')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('queue.columns.triggers')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('queue.columns.verdict')}
              </th>
              <th className="px-3 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td className="px-3 py-4 text-center text-gray-400" colSpan={7}>
                  …
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-gray-400" colSpan={7}>
                  {t('queue.empty')}
                </td>
              </tr>
            )}
            {items.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/expert-reviews/${r.id}`)}
              >
                <td className="px-3 py-2 text-gray-600">
                  {r.requestedAt
                    ? r.requestedAt.slice(0, 16).replace('T', ' ')
                    : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-gray-700">
                  {r.context?.exportCountryCode ?? '—'} →{' '}
                  {r.context?.importCountryCode ?? '—'}
                </td>
                <td className="px-3 py-2 font-mono text-gray-900">
                  {r.context?.hsCode ?? '—'}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {r.context?.itemName ?? '—'}
                  {r.context?.category && (
                    <span className="ml-1 text-xs text-gray-500">
                      ({r.context.category})
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.triggerReasonList.map((tr) => (
                      <StatusBadge key={tr} variant="warning">
                        {t(`queue.trigger.${tr}`, { defaultValue: tr })}
                      </StatusBadge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge variant={verdictVariant(r.verdict)}>
                    {t(`queue.verdict.${r.verdict}`)}
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
