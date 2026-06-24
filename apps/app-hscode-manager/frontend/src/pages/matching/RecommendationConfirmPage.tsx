import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ChevronLeft, Sparkles, ExternalLink, Award } from 'lucide-react';
import { AxiosError } from 'axios';
import clsx from 'clsx';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  classificationService,
  CandidateSnapshotDto,
} from '@/services/classification.service';
import type { MatchingRunResult, RankedCandidate } from '@/types/matching.types';

function CandidateCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: RankedCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('matching');
  const top = candidate.ranking === 1;
  return (
    <div
      className={clsx(
        'card relative space-y-3 border-2 transition-all',
        selected
          ? 'border-blue-500 bg-blue-50/30'
          : top
            ? 'border-amber-200'
            : 'border-gray-200',
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'inline-flex h-6 min-w-[2rem] items-center justify-center rounded text-xs font-bold',
                top ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600',
              )}
            >
              {t('candidates.rank_label', { rank: candidate.ranking })}
            </span>
            <span className="text-xl font-bold tracking-wider text-gray-900">
              {candidate.hsCode}
            </span>
            <StatusBadge variant={candidate.source === 'MIXED' ? 'success' : 'info'}>
              {t(`candidates.source_label.${candidate.source}`)}
            </StatusBadge>
          </div>
          {candidate.description && (
            <p className="mt-1 text-sm text-gray-600">{candidate.description}</p>
          )}
        </div>
        <button
          type="button"
          className={clsx(
            'rounded-md border px-3 py-1 text-sm font-medium transition-colors',
            selected
              ? 'border-blue-500 bg-blue-600 text-white'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50',
          )}
          onClick={onSelect}
        >
          {selected ? t('candidates.selected') : t('candidates.select')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <div>
          <div className="text-gray-500">{t('candidates.confidence')}</div>
          <div className="font-mono text-base font-semibold text-gray-900">
            {candidate.confidence.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-gray-500">{t('candidates.basic_tariff')}</div>
          <div className="font-mono text-gray-900">
            {candidate.basicTariffRate !== null
              ? `${candidate.basicTariffRate}%`
              : '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-500">{t('candidates.fta_tariff')}</div>
          <div className="font-mono text-gray-900">
            {candidate.ftaTariffRate !== null ? `${candidate.ftaTariffRate}%` : '—'}
            {candidate.ftaAgreementCode && (
              <span className="ml-1 text-xs text-gray-500">
                ({candidate.ftaAgreementCode})
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-gray-500">
            {candidate.pastAdoptionCount > 0
              ? t('candidates.past_adoption', { count: candidate.pastAdoptionCount })
              : t('candidates.no_past_adoption')}
          </div>
        </div>
      </div>

      {candidate.pastAdoptionCount > 0 && (
        <div className="flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
          <Award className="h-3.5 w-3.5" />
          <span>
            {t('candidates.past_adoption', { count: candidate.pastAdoptionCount })}
          </span>
        </div>
      )}

      {candidate.reasoning && (
        <div className="rounded bg-gray-50 p-2 text-xs text-gray-700">
          <div className="mb-1 flex items-center gap-1 font-medium text-gray-500">
            <Sparkles className="h-3 w-3 text-purple-500" />
            {t('candidates.ai_reasoning')}
          </div>
          <p className="whitespace-pre-line">{candidate.reasoning}</p>
        </div>
      )}

      {candidate.sourceCitations.length > 0 && (
        <div className="text-xs text-gray-500">
          <div className="mb-1 flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            {t('candidates.citations')}
          </div>
          <ul className="space-y-0.5 pl-4">
            {candidate.sourceCitations.map((c, i) => (
              <li key={i} className="font-mono">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {candidate.flags.requiresSampleAnalysis && (
          <StatusBadge variant="error">{t('candidates.flag.sample_required')}</StatusBadge>
        )}
        {candidate.flags.sampleAnalysisRecommended && (
          <StatusBadge variant="warning">
            {t('candidates.flag.sample_recommended')}
          </StatusBadge>
        )}
        {candidate.flags.conservativeTariffApplied && (
          <StatusBadge variant="info">{t('candidates.flag.conservative')}</StatusBadge>
        )}
        {candidate.flags.disputedHistory && (
          <StatusBadge variant="error">{t('candidates.flag.disputed_history')}</StatusBadge>
        )}
      </div>
    </div>
  );
}

function toCandidateDto(c: RankedCandidate): CandidateSnapshotDto {
  return {
    hs_code: c.hsCode,
    description: c.description ?? undefined,
    basic_tariff_rate: c.basicTariffRate ?? undefined,
    fta_tariff_rate: c.ftaTariffRate ?? undefined,
    fta_agreement_code: c.ftaAgreementCode ?? undefined,
    source: c.source,
    ranking: c.ranking,
    confidence: c.confidence,
    reasoning: c.reasoning ?? undefined,
    source_citations: c.sourceCitations,
    external_adapter_keys: c.externalAdapterKeys,
    flags: c.flags as Record<string, boolean>,
    past_adoption_count: c.pastAdoptionCount,
  };
}

interface DuplicateInfo {
  existing_id: string;
  existing_hs_code: string;
}

export function RecommendationConfirmPage() {
  const { t } = useTranslation('matching');
  const { t: tc } = useTranslation('classification');
  const navigate = useNavigate();
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const location = useLocation() as { state?: { result?: MatchingRunResult } };
  const result = location.state?.result;
  const [selectedHs, setSelectedHs] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [duplicateExisting, setDuplicateExisting] = useState<DuplicateInfo | null>(
    null,
  );
  const [modal, setModal] = useState<ModalState>(initialModalState);

  const candidates = result?.candidates ?? [];
  const selectedCandidate = candidates.find((c) => c.hsCode === selectedHs);
  const top = candidates[0];
  const differentFromTop =
    !!selectedCandidate &&
    !!top &&
    selectedCandidate.hsCode !== top.hsCode &&
    top.pastAdoptionCount > 0;

  const confirmMut = useMutation({
    mutationFn: (overwriteExisting: boolean) => {
      if (!result || !selectedCandidate || !inquiryId) {
        throw new Error('invalid state');
      }
      return classificationService.confirm({
        inquiry_id: inquiryId,
        item_id: result.itemId,
        selected_hs_code: selectedCandidate.hsCode,
        selection_rationale: rationale || undefined,
        overwrite_existing: overwriteExisting,
        candidates: candidates.map(toCandidateDto),
      });
    },
    onSuccess: (res) => {
      const supersedeNote = res.supersededId
        ? `\n${tc('confirm.success_with_supersede')}`
        : '';
      setModal({
        isOpen: true,
        type: 'success',
        title: tc('confirm.success_title'),
        message:
          tc('confirm.success_message', { hsCode: res.classification.hsCode }) +
          supersedeNote,
      });
      setTimeout(
        () => navigate(`/classifications/${res.classification.id}?tab=response`),
        800,
      );
    },
    onError: (err: unknown) => {
      const axErr = err as AxiosError<{
        error?: { code?: string; message?: string; details?: DuplicateInfo };
      }>;
      const data = axErr?.response?.data;
      if (data?.error?.code === 'HSC-E0420' && data.error.details) {
        setDuplicateExisting(data.error.details);
        return;
      }
      const message =
        data?.error?.message ?? (err instanceof Error ? err.message : String(err));
      setModal({
        isOpen: true,
        type: 'error',
        title: tc('confirm.title'),
        message,
        autoCloseMs: 0,
      });
    },
  });

  if (!result) {
    return (
      <div className="p-6">
        <button
          type="button"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          onClick={() => navigate(`/new-work/${inquiryId}/matching`)}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to matching
        </button>
        <div className="card max-w-2xl text-sm text-gray-500">{t('candidates.empty')}</div>
      </div>
    );
  }

  const handleConfirm = () => {
    if (!selectedCandidate) return;
    if (differentFromTop && !rationale.trim()) {
      setModal({
        isOpen: true,
        type: 'warning',
        title: tc('confirm.title'),
        message: tc('confirm.rationale_required'),
        autoCloseMs: 0,
      });
      return;
    }
    confirmMut.mutate(false);
  };

  return (
    <div className="p-6">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        onClick={() => navigate(`/new-work/${inquiryId}/matching`)}
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('candidates.title')}</h1>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!selectedCandidate || confirmMut.isPending}
          onClick={handleConfirm}
        >
          {tc('confirm.button')}
        </button>
      </header>

      {candidates.length === 0 ? (
        <div className="card max-w-3xl text-sm text-gray-500">
          {t('candidates.empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => (
            <CandidateCard
              key={c.hsCode}
              candidate={c}
              selected={c.hsCode === selectedHs}
              onSelect={() => setSelectedHs(c.hsCode)}
            />
          ))}
        </div>
      )}

      {differentFromTop && (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-medium text-amber-800">
            {tc('confirm.rationale_required')}
          </p>
          <textarea
            className="input w-full"
            rows={3}
            placeholder={tc('confirm.rationale_placeholder')}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
          />
        </div>
      )}

      {duplicateExisting && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-30"
          onClick={() => setDuplicateExisting(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold text-gray-900">
              {tc('confirm.duplicate_title')}
            </h3>
            <p className="mb-1 text-sm text-gray-600">{tc('confirm.duplicate_message')}</p>
            <p className="mb-4 font-mono text-xs text-gray-500">
              {tc('confirm.duplicate_existing_hs', {
                hsCode: duplicateExisting.existing_hs_code,
              })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDuplicateExisting(null)}
              >
                {t('common:common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setDuplicateExisting(null);
                  confirmMut.mutate(true);
                }}
              >
                {tc('confirm.overwrite')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal state={modal} onClose={() => setModal(initialModalState)} />
    </div>
  );
}
