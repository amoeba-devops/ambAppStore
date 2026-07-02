import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { ProgressStepper, Step, StepStatus } from '@/components/matching/ProgressStepper';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { intakeService } from '@/services/intake.service';
import { matchingService } from '@/services/matching.service';
import type { MatchingRunResult } from '@/types/matching.types';

export function MatchingProgressPage() {
  const { t } = useTranslation('matching');
  const navigate = useNavigate();
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const [modal, setModal] = useState<ModalState>(initialModalState);

  const { data: items = [] } = useQuery({
    queryKey: ['items', inquiryId],
    queryFn: () => intakeService.listItemsByInquiry(inquiryId!),
    enabled: !!inquiryId,
  });

  // 본 단계는 *첫 Item* 만 매칭한다 (Phase 4에서 다건 처리)
  const targetItem = items[0];

  const mut = useMutation({
    mutationFn: () =>
      matchingService.run({
        inquiry_id: inquiryId!,
        item_id: targetItem.id,
      }),
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

  useEffect(() => {
    if (!targetItem || mut.isPending || mut.data) return;
    mut.mutate();
  }, [targetItem, mut]);

  const result: MatchingRunResult | undefined = mut.data;
  const steps = useMemo<Step[]>(() => {
    if (!result) {
      const running: StepStatus = mut.isPending ? 'running' : 'wait';
      return [
        { key: 'normalize', label: t('progress.steps.normalize'), status: running },
        { key: 'internal', label: t('progress.steps.internal'), status: 'wait' },
        { key: 'external', label: t('progress.steps.external'), status: 'wait' },
        { key: 'ai', label: t('progress.steps.ai'), status: 'wait' },
        { key: 'rank', label: t('progress.steps.rank'), status: 'wait' },
      ];
    }
    const md = result.metadata;
    return [
      { key: 'normalize', label: t('progress.steps.normalize'), status: 'done' },
      {
        key: 'internal',
        label: t('progress.steps.internal'),
        status: 'done',
        hint: `${md.internalCount} candidate(s) · ${md.durationMs.internal} ms`,
      },
      {
        key: 'external',
        label: t('progress.steps.external'),
        status: md.internalSkipExternal
          ? 'skipped'
          : md.externalDegraded
            ? 'error'
            : md.externalCalled
              ? 'done'
              : 'skipped',
        hint: `${md.durationMs.external} ms`,
      },
      {
        key: 'ai',
        label: t('progress.steps.ai'),
        status:
          md.internalSkipExternal
            ? 'skipped'
            : md.aiStatus === 'API_ERROR' || md.aiStatus === 'PARSE_FAIL'
              ? 'error'
              : md.aiCalled
                ? 'done'
                : 'skipped',
        hint: `${md.aiStatus ?? 'n/a'} · ${md.durationMs.ai} ms`,
      },
      {
        key: 'rank',
        label: t('progress.steps.rank'),
        status: 'done',
        hint: `${result.candidates.length} ranked · ${md.durationMs.rank} ms`,
      },
    ];
  }, [result, mut.isPending, t]);

  if (!targetItem && items.length === 0) {
    return (
      <div className="p-6">
        <div className="card max-w-2xl text-center text-sm text-gray-500">
          {t('modal.no_items')}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        onClick={() => navigate(`/new-work/${inquiryId}/channel`)}
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <h1 className="mb-4 text-xl font-bold text-gray-900">{t('progress.title')}</h1>

      <div className="card max-w-2xl space-y-4">
        {targetItem && (
          <div className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">Target Item:</span>{' '}
            {targetItem.nameRaw}{' '}
            <span className="font-mono text-gray-400">
              ({targetItem.category} · hash: {targetItem.compositionHash})
            </span>
          </div>
        )}
        <ProgressStepper steps={steps} />

        {result && result.warnings.length > 0 && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="mb-1 font-semibold">Warnings</div>
            <ul className="list-disc pl-4">
              {result.warnings.map((w) => (
                <li key={w}>
                  {w === 'external_adapter_degraded'
                    ? t('progress.warning.external_degraded')
                    : w === 'ai_recommendation_disabled'
                      ? t('progress.warning.ai_disabled')
                      : w === 'no_adapter_for_country'
                        ? t('progress.warning.no_adapter')
                        : w === 'skipped_external_high_internal_confidence'
                          ? t('progress.warning.skipped_external')
                          : w.startsWith('ai_hallucinated_count=')
                            ? t('progress.warning.ai_hallucinated', {
                                count: Number(w.split('=')[1]) || 0,
                              })
                            : w}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          {result && (
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                navigate(`/new-work/${inquiryId}/candidates`, {
                  state: { result },
                })
              }
            >
              {t('progress.view_candidates')}
            </button>
          )}
        </div>
      </div>

      <AlertModal state={modal} onClose={() => setModal(initialModalState)} />
    </div>
  );
}
