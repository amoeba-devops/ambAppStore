import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import clsx from 'clsx';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { expertService } from '@/services/expert.service';

type Verdict = 'APPROVE' | 'REVISE' | 'REJECT';

export function ExpertReplyPage() {
  const { t } = useTranslation('expert');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [verdict, setVerdict] = useState<Verdict>('APPROVE');
  const [notes, setNotes] = useState('');

  const { data: review, isLoading } = useQuery({
    queryKey: ['expert-review', id],
    queryFn: () => expertService.get(id!),
    enabled: !!id,
  });

  const respondMut = useMutation({
    mutationFn: () =>
      expertService.respond(id!, { verdict, notes: notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expert-reviews'] });
      setModal({
        isOpen: true,
        type: 'success',
        title: t('common:common.confirm'),
        message: t('detail.modal.responded'),
      });
      setTimeout(() => navigate('/expert-reviews'), 1000);
    },
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

  if (isLoading || !review) {
    return <div className="p-6 text-sm text-gray-400">…</div>;
  }

  const alreadyResolved = review.verdict !== 'PENDING';

  return (
    <div className="p-6">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        onClick={() => navigate('/expert-reviews')}
      >
        <ChevronLeft className="h-4 w-4" />
        {t('detail.back')}
      </button>

      <h1 className="mb-4 text-xl font-bold text-gray-900">{t('detail.title')}</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            {t('detail.context.title')}
          </h3>
          <dl className="divide-y divide-gray-100 text-sm">
            <div className="flex gap-3 py-2">
              <dt className="w-24 text-xs text-gray-500">{t('detail.context.hs')}</dt>
              <dd className="flex-1 font-mono text-gray-900">
                {review.context?.hsCode ?? '—'}
              </dd>
            </div>
            <div className="flex gap-3 py-2">
              <dt className="w-24 text-xs text-gray-500">{t('detail.context.item')}</dt>
              <dd className="flex-1 text-gray-700">{review.context?.itemName ?? '—'}</dd>
            </div>
            <div className="flex gap-3 py-2">
              <dt className="w-24 text-xs text-gray-500">{t('detail.context.category')}</dt>
              <dd className="flex-1 text-gray-700">{review.context?.category ?? '—'}</dd>
            </div>
            <div className="flex gap-3 py-2">
              <dt className="w-24 text-xs text-gray-500">{t('detail.context.import')}</dt>
              <dd className="flex-1 font-mono text-gray-700">
                {review.context?.importCountryCode ?? '—'}
              </dd>
            </div>
            <div className="flex gap-3 py-2">
              <dt className="w-24 text-xs text-gray-500">{t('detail.context.export')}</dt>
              <dd className="flex-1 font-mono text-gray-700">
                {review.context?.exportCountryCode ?? '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            {t('detail.triggers_title')}
          </h3>
          <div className="mb-2 flex flex-wrap gap-1">
            {review.triggerReasonList.map((tr) => (
              <StatusBadge key={tr} variant="warning">
                {t(`queue.trigger.${tr}`, { defaultValue: tr })}
              </StatusBadge>
            ))}
          </div>
          {review.notes && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-gray-500">
                {t('detail.trigger_notes')}
              </summary>
              <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2">
                {review.notes}
              </pre>
            </details>
          )}
        </section>
      </div>

      <section className="card mt-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          {t('detail.respond.title')}
        </h3>
        {alreadyResolved && (
          <div className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-700">
            {t('detail.modal.already_resolved')} —{' '}
            <StatusBadge variant="info">{review.verdict}</StatusBadge>
          </div>
        )}
        <div className="mb-3">
          <span className="text-sm text-gray-600">{t('detail.respond.verdict')}</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {(['APPROVE', 'REVISE', 'REJECT'] as Verdict[]).map((v) => (
              <button
                key={v}
                type="button"
                disabled={alreadyResolved}
                onClick={() => setVerdict(v)}
                className={clsx(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  verdict === v && !alreadyResolved
                    ? v === 'APPROVE'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : v === 'REVISE'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50',
                  alreadyResolved && 'cursor-not-allowed opacity-50',
                )}
              >
                {t(`detail.respond.verdict_options.${v}`)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {t(`detail.respond.verdict_hint.${verdict}`)}
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-gray-600">{t('detail.respond.notes')}</span>
          <textarea
            className="input mt-1"
            rows={4}
            disabled={alreadyResolved}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="btn-primary"
            disabled={alreadyResolved || respondMut.isPending}
            onClick={() => respondMut.mutate()}
          >
            {t('detail.respond.submit')}
          </button>
        </div>
      </section>

      <AlertModal state={modal} onClose={() => setModal(initialModalState)} />
    </div>
  );
}
