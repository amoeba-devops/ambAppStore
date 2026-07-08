import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ScreenHeader from '@/components/common/ScreenHeader';
import ConfidenceBadge from '@/components/common/ConfidenceBadge';
import LegalNotice from '@/components/common/LegalNotice';
import { useResultDetail } from '@/hooks/useQa';

export default function ResultDetailPage() {
  const { t } = useTranslation('hscode');
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useResultDetail(id);

  return (
    <section>
      <ScreenHeader id="SCR-004" title={t('rd.title')} sub={t('rd.sub')} />

      {!id && <p className="mt-4 text-[13px] text-muted">{t('rd.sub')}</p>}
      {id && isLoading && <p className="mt-4 text-[13px] text-muted">{t('common.loading')}</p>}
      {id && isError && <p className="mt-4 text-[13px] text-bad">{t('qa.error')}</p>}

      {data && (
        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.15fr_0.85fr]">
          {/* 결과 본문 */}
          <div className="mt-4 rounded-xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line pb-4">
              <span className="text-[30px] font-extrabold tabular-nums tracking-wide">
                {data.hsCode}
              </span>
              <div>
                <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-dark">
                  HS6 {data.hs6}
                </span>
                {data.description && (
                  <div className="mt-1 text-xs text-muted2">{data.description}</div>
                )}
              </div>
              {data.confidence != null && (
                <span className="ml-auto">
                  <ConfidenceBadge score={data.confidence} />
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-[130px_1fr] gap-y-2 text-[13px]">
              {data.description && (
                <>
                  <span className="font-semibold text-muted">{t('rd.k.name')}</span>
                  <span className="font-semibold">{data.description}</span>
                </>
              )}
              {data.origin && (
                <>
                  <span className="font-semibold text-muted">{t('rd.k.origin')}</span>
                  <span className="font-semibold">{data.origin}</span>
                </>
              )}
              {data.unit && (
                <>
                  <span className="font-semibold text-muted">{t('rd.k.unit')}</span>
                  <span className="font-semibold">{data.unit}</span>
                </>
              )}
              {data.tradeType && (
                <>
                  <span className="font-semibold text-muted">{t('rd.k.trade')}</span>
                  <span className="font-semibold">{data.tradeType}</span>
                </>
              )}
            </div>

            <LegalNotice />
          </div>

          {/* 근거 출처 + 메타 */}
          <div className="mt-4 rounded-xl border border-line bg-white p-5">
            <h3 className="mb-3.5 text-[14.5px] font-semibold">{t('rd.cite')}</h3>
            {data.citations.length === 0 && (
              <p className="text-[12.5px] text-muted">—</p>
            )}
            {data.citations.map((c, i) => (
              <div
                key={i}
                className="mt-2 rounded-[9px] border border-line bg-[#fcfcfe] px-3.5 py-2.5 text-[12.5px]"
              >
                <b>{c.company ?? '—'}</b>
                <div className="mt-1 text-muted">
                  “{c.description}” · HS {c.hsCode} · {c.count}
                </div>
              </div>
            ))}

            <h3 className="mb-2 mt-5 text-[14.5px] font-semibold">{t('rd.meta')}</h3>
            <div className="grid grid-cols-[130px_1fr] gap-y-2 text-[13px]">
              <span className="font-semibold text-muted">{t('k.source')}</span>
              <span className="font-semibold">{data.source}</span>
              <span className="font-semibold text-muted">{t('rd.verifier')}</span>
              <span className="font-semibold">{data.verifier ?? '—'}</span>
              <span className="font-semibold text-muted">{t('rd.time')}</span>
              <span className="font-semibold tabular-nums">
                {new Date(data.recordedAt).toLocaleString()}
              </span>
              <span className="font-semibold text-muted">{t('rd.logid')}</span>
              <span className="font-semibold tabular-nums">{data.logId}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
