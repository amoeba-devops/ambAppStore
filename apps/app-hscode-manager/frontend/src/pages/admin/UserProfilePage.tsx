import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { meService } from '@/services/me.service';
import { StatusBadge } from '@/components/ui/StatusBadge';

export function UserProfilePage() {
  const { t } = useTranslation('admin');

  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: meService.get,
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-400">…</div>;
  }
  if (!data) {
    return <div className="p-6 text-sm text-red-600">{t('modal.error_title')}</div>;
  }

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: t('user.user_id'), value: <span className="font-mono">{data.userId}</span> },
    { label: t('user.entity_id'), value: <span className="font-mono">{data.entityId}</span> },
    { label: t('user.entity_code'), value: <span className="font-mono">{data.entityCode}</span> },
    { label: t('user.email'), value: data.email || '—' },
    { label: t('user.name'), value: data.name || '—' },
    {
      label: t('user.roles'),
      value: data.roles.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {data.roles.map((r) => (
            <StatusBadge key={r} variant="info">{r}</StatusBadge>
          ))}
        </div>
      ) : '—',
    },
  ];

  return (
    <div className="p-6">
      <h2 className="mb-4 text-xl font-bold text-gray-900">{t('user.title')}</h2>
      <div className="card">
        <dl className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-4 py-3">
              <dt className="w-40 flex-shrink-0 text-sm text-gray-500">{row.label}</dt>
              <dd className="flex-1 text-sm text-gray-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
