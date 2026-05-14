import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { classificationService } from '@/services/classification.service';
import {
  verificationService,
  CreateVerificationDto,
} from '@/services/verification.service';
import type {
  VerificationEventType,
  VerificationResult,
} from '@/types/verification.types';

const TYPES: VerificationEventType[] = [
  'SAMPLE_ANALYSIS',
  'CUSTOMS_SEIZURE',
  'CUSTOMS_DOUBLE_CHECK',
];

export function VerificationRegisterPage() {
  const { t } = useTranslation('verification');
  const navigate = useNavigate();
  const location = useLocation() as { state?: { classificationId?: string } };
  const params = useParams<{ classificationId?: string }>();
  const initialClsId =
    params.classificationId ?? location.state?.classificationId ?? '';

  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [form, setForm] = useState<CreateVerificationDto>({
    classification_id: initialClsId,
    event_type: 'SAMPLE_ANALYSIS',
    event_date: new Date().toISOString().slice(0, 10),
  });

  const { data: classification } = useQuery({
    queryKey: ['classification', form.classification_id],
    queryFn: () => classificationService.get(form.classification_id),
    enabled: !!form.classification_id,
  });

  const mut = useMutation({
    mutationFn: () => verificationService.create(form),
    onSuccess: (res) => {
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success'),
        message:
          t('modal.success') +
          (res.followUpCount > 0
            ? `\n${t('modal.with_actions', { count: res.followUpCount })}`
            : ''),
      });
      setTimeout(
        () => navigate(`/classifications/${form.classification_id}`),
        1200,
      );
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

  const needResult = form.event_type === 'SAMPLE_ANALYSIS';
  const isSeizure = form.event_type === 'CUSTOMS_SEIZURE';

  return (
    <div className="p-6">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        onClick={() => navigate(-1)}
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <h1 className="mb-4 text-xl font-bold text-gray-900">
        {t('register.title')}
      </h1>

      <div className="card max-w-2xl space-y-4">
        <label className="block text-sm">
          <span className="text-gray-600">{t('register.classification')}</span>
          <input
            className="input mt-1 font-mono"
            placeholder="Classification UUID"
            value={form.classification_id}
            onChange={(e) =>
              setForm({ ...form, classification_id: e.target.value })
            }
          />
          {classification && (
            <p className="mt-1 text-xs text-gray-500">
              <span className="font-mono">{classification.hsCode}</span> ·{' '}
              {classification.status} · {classification.item?.nameRaw ?? '—'}
            </p>
          )}
        </label>

        <div>
          <span className="text-sm text-gray-600">{t('register.event_type')}</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {TYPES.map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    event_type: tp,
                    result:
                      tp === 'CUSTOMS_DOUBLE_CHECK' ? 'CONFIRMED' : undefined,
                  })
                }
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  tp === form.event_type
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t(`event_type.${tp}`)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-amber-700">
            {t(`event_type_hint.${form.event_type}`)}
          </p>
        </div>

        {needResult && (
          <div>
            <span className="text-sm text-gray-600">{t('register.result')}</span>
            <div className="mt-1 flex gap-2">
              {(['MATCH', 'MISMATCH'] as VerificationResult[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm({ ...form, result: r })}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    r === form.result
                      ? r === 'MISMATCH'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t(`result.${r}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block text-sm">
          <span className="text-gray-600">{t('register.event_date')}</span>
          <input
            type="date"
            className="input mt-1"
            value={form.event_date}
            onChange={(e) => setForm({ ...form, event_date: e.target.value })}
          />
        </label>

        {isSeizure && (
          <label className="block text-sm">
            <span className="text-gray-600">{t('register.amount_usd')}</span>
            <input
              type="number"
              className="input mt-1"
              placeholder="50000"
              value={form.amount_usd ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  amount_usd:
                    e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        )}

        <label className="block text-sm">
          <span className="text-gray-600">{t('register.notes')}</span>
          <textarea
            className="input mt-1"
            rows={3}
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn-primary"
            disabled={
              mut.isPending ||
              !form.classification_id ||
              (needResult && !form.result)
            }
            onClick={() => mut.mutate()}
          >
            {t('register.submit')}
          </button>
        </div>
      </div>

      <AlertModal state={modal} onClose={() => setModal(initialModalState)} />
    </div>
  );
}
