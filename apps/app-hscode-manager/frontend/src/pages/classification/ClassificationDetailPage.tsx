import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronLeft, Copy, Download } from 'lucide-react';
import clsx from 'clsx';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { classificationService } from '@/services/classification.service';
import type { ResponseFormResult } from '@/types/classification.types';

const CHANNELS: Array<'email' | 'kakao' | 'messenger' | 'plain'> = [
  'email',
  'kakao',
  'messenger',
  'plain',
];
const LANGS: Array<'ko' | 'en' | 'vi'> = ['ko', 'en', 'vi'];
const TABS = ['overview', 'candidates', 'history', 'response'] as const;
type TabKey = (typeof TABS)[number];

export function ClassificationDetailPage() {
  const { t } = useTranslation('classification');
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'overview';
  const [tab, setTab] = useState<TabKey>(
    TABS.includes(initialTab) ? initialTab : 'overview',
  );
  const [channel, setChannel] = useState<'email' | 'kakao' | 'messenger' | 'plain'>(
    'email',
  );
  const [lang, setLang] = useState<'ko' | 'en' | 'vi'>('ko');
  const [modal, setModal] = useState<ModalState>(initialModalState);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['classification', id],
    queryFn: () => classificationService.get(id!),
    enabled: !!id,
  });

  const formMut = useMutation({
    mutationFn: () =>
      classificationService.responseForm(id!, channel, lang),
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      setModal({
        isOpen: true,
        type: 'error',
        title: t('common:common.error'),
        message: msg,
        autoCloseMs: 0,
      });
    },
  });
  const form: ResponseFormResult | undefined = formMut.data;

  const switchTab = (k: TabKey) => {
    setTab(k);
    const next = new URLSearchParams(searchParams);
    next.set('tab', k);
    setSearchParams(next, { replace: true });
    if (k === 'response' && !formMut.data) formMut.mutate();
  };

  const copyToClipboard = (text: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setModal({
        isOpen: true,
        type: 'success',
        title: t('common:common.confirm'),
        message: t('response.copied'),
      });
    });
  };

  const downloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const header = useMemo(() => {
    if (!detail) return '';
    const product = detail.item?.nameRaw ?? '—';
    return t('detail.header', { hsCode: detail.hsCode, product });
  }, [detail, t]);

  if (isLoading || !detail) {
    return <div className="p-6 text-sm text-gray-400">…</div>;
  }

  return (
    <div className="p-6">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        onClick={() => navigate('/classifications')}
      >
        <ChevronLeft className="h-4 w-4" />
        {t('detail.back')}
      </button>

      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{header}</h1>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <StatusBadge
              variant={
                detail.status === 'ADOPTED' || detail.status === 'SEALED'
                  ? 'success'
                  : detail.status === 'SUPERSEDED'
                    ? 'inactive'
                    : detail.status === 'DISPUTED'
                      ? 'error'
                      : 'info'
              }
            >
              {t(`list.status.${detail.status}`)}
            </StatusBadge>
            {detail.supersededById && (
              <span className="text-amber-700">{t('detail.supersede.by')}</span>
            )}
          </div>
        </div>
      </header>

      <div className="mb-4 border-b border-gray-200">
        <nav className="flex gap-1">
          {TABS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => switchTab(k)}
              className={clsx(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                tab === k
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800',
              )}
            >
              {t(`detail.tab_${k}`)}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="card">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              {t('detail.tab_overview')}
            </h3>
            <dl className="divide-y divide-gray-100 text-sm">
              {[
                ['exporter', detail.inquiry?.exporterName ?? '—'],
                [
                  'route',
                  `${detail.inquiry?.exportCountryCode ?? '—'} → ${
                    detail.inquiry?.importCountryCode ?? '—'
                  }`,
                ],
                ['category', detail.item?.category ?? '—'],
                ['hash', detail.item?.compositionHash ?? '—'],
                ['submitted_at', detail.inquiry?.submittedAt?.slice(0, 10) ?? '—'],
                ['adopted_at', detail.adoptedAt?.slice(0, 10) ?? '—'],
                ['ai_model_version', detail.aiModelVersion ?? '—'],
                [
                  'confidence',
                  detail.confidenceScore !== null
                    ? detail.confidenceScore.toFixed(2)
                    : '—',
                ],
                ['selection_rationale', detail.selectionRationale ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 py-2">
                  <dt className="w-32 flex-shrink-0 text-xs text-gray-500">
                    {t(`detail.info.${k}`)}
                  </dt>
                  <dd className="flex-1 break-words font-mono text-xs text-gray-800">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              {t('detail.tariff.title')}
            </h3>
            <dl className="divide-y divide-gray-100 text-sm">
              <div className="flex justify-between py-2">
                <dt className="text-xs text-gray-500">{t('detail.tariff.basic')}</dt>
                <dd className="font-mono text-gray-800">
                  {detail.basicTariffRate !== null
                    ? `${detail.basicTariffRate}%`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-xs text-gray-500">{t('detail.tariff.fta')}</dt>
                <dd className="font-mono text-gray-800">
                  {detail.ftaTariffRate !== null
                    ? `${detail.ftaTariffRate}%`
                    : '—'}
                </dd>
              </div>
              {detail.ftaAgreementCode && (
                <div className="flex justify-between py-2">
                  <dt className="text-xs text-gray-500">
                    {t('detail.tariff.agreement')}
                  </dt>
                  <dd className="font-medium text-gray-800">
                    {detail.ftaAgreementCode}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      )}

      {tab === 'candidates' && (
        <div className="space-y-2">
          {(detail.candidates ?? []).map((c) => (
            <div key={c.id} className="card flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-bold text-gray-700">
                {c.ranking}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-gray-900">
                    {c.hsCode}
                  </span>
                  <StatusBadge variant="info">{c.source}</StatusBadge>
                  <span className="text-xs text-gray-500">
                    conf {c.confidence?.toFixed(2)}
                  </span>
                </div>
                {c.reasoning && (
                  <p className="mt-1 text-xs text-gray-600">{c.reasoning}</p>
                )}
                {c.sourceCitations.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-xs text-gray-500">
                    {c.sourceCitations.map((s, i) => (
                      <li key={i} className="font-mono">
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          {(detail.historyIds ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">{t('list.kpi.empty')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {(detail.historyIds ?? []).map((h) => (
                <li key={h}>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => navigate(`/classifications/${h}`)}
                  >
                    {h === detail.id ? '(current) ' : ''}
                    {h}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'response' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-1">
              {CHANNELS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setChannel(c);
                    formMut.mutate();
                  }}
                  className={clsx(
                    'rounded-md border px-3 py-1 text-xs',
                    c === channel
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {t(`response.channel.${c}`)}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setLang(l);
                    formMut.mutate();
                  }}
                  className={clsx(
                    'rounded-md border px-2 py-1 text-xs uppercase',
                    l === lang
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            {form && (
              <>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => copyToClipboard(`${form.subject}\n\n${form.body}`)}
                >
                  <Copy className="mr-1 inline-block h-3.5 w-3.5" />
                  {t('response.copy')}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() =>
                    downloadText(
                      `hs-${detail.hsCode}-${channel}-${lang}.txt`,
                      `${form.subject}\n\n${form.body}`,
                    )
                  }
                >
                  <Download className="mr-1 inline-block h-3.5 w-3.5" />
                  {t('response.download')}
                </button>
              </>
            )}
          </div>

          {form ? (
            <div className="card space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-gray-500">
                  {t('response.subject')}
                </div>
                <div className="rounded bg-gray-50 p-2 font-mono text-sm">
                  {form.subject}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-gray-500">
                  {t('response.body')}
                </div>
                <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 font-mono text-sm">
                  {form.body}
                </pre>
              </div>
            </div>
          ) : (
            <div className="card text-sm text-gray-400">…</div>
          )}
        </div>
      )}

      <AlertModal state={modal} onClose={() => setModal(initialModalState)} />
    </div>
  );
}
