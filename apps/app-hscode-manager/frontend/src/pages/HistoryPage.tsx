import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useMatchRequests } from '@/hooks/useMatching';

/** SCR-5 — 요청건 이력. 업로드 매칭 요청 목록 → 다시 열기. */
export default function HistoryPage() {
  const { t } = useTranslation('hscode');
  const navigate = useNavigate();
  const { data, isLoading } = useMatchRequests(1, 30);

  return (
    <div className="py-6">
      <h1 className="mb-4 text-xl font-extrabold text-ink">{t('h.title')}</h1>

      {isLoading ? (
        <div className="py-10 text-center text-muted">{t('common.loading')}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-line/20 text-left text-xs text-muted">
                <th className="px-4 py-2 font-semibold">{t('h.colFile')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('h.colItems')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('h.colConfirmed')}</th>
                <th className="px-3 py-2 font-semibold">{t('h.colStatus')}</th>
                <th className="px-3 py-2 font-semibold">{t('h.colDate')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(data?.items ?? []).map((r) => (
                <tr key={r.mrqId} className="hover:bg-brand-soft/30">
                  <td className="px-4 py-2.5 font-semibold text-ink">{r.fileName ?? r.mrqId}</td>
                  <td className="px-3 py-2.5 text-right text-muted">{r.itemCount}</td>
                  <td className="px-3 py-2.5 text-right text-muted">
                    {r.confirmedCount}
                    {r.reviewCount > 0 && (
                      <span className="ml-1 text-bad">({t('h.reviewN', { n: r.reviewCount })})</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={clsx(
                        'rounded px-1.5 py-0.5 text-[11px] font-bold',
                        r.status === 'CONFIRMED'
                          ? 'bg-ok-soft text-ok'
                          : 'bg-info-soft text-info',
                      )}
                    >
                      {t(`m.status.${r.status}`) || r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => navigate(`/match/${r.mrqId}`)}
                      className="text-xs font-bold text-brand hover:underline"
                    >
                      {t('h.open')} →
                    </button>
                  </td>
                </tr>
              ))}
              {(!data || data.items.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    {t('h.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
