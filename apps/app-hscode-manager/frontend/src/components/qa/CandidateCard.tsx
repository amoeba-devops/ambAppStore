import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import ConfidenceBadge from '@/components/common/ConfidenceBadge';
import type { Candidate } from '@/types/hscode.types';

interface Props {
  candidate: Candidate;
  best?: boolean;
  selected?: boolean;
  onSelect: (c: Candidate) => void;
}

export default function CandidateCard({ candidate, best, selected, onSelect }: Props) {
  const { t } = useTranslation('hscode');
  return (
    <button
      type="button"
      onClick={() => onSelect(candidate)}
      className={clsx(
        'w-full rounded-[10px] border bg-white p-3.5 text-left transition hover:border-brand-light',
        selected ? 'border-brand shadow-[0_2px_10px_rgba(99,102,241,0.12)]' : 'border-line',
        best && !selected && 'border-brand-light',
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[15px] font-extrabold tabular-nums tracking-wide">
          {candidate.hsCode}
        </span>
        <span className="min-w-[130px] flex-1 font-semibold">{candidate.description}</span>
        <ConfidenceBadge score={candidate.score} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-3.5 text-xs text-muted">
        {candidate.origin && <span>{t('k.origin')}: {candidate.origin}</span>}
        {candidate.unit && <span>{t('k.unit')}: {candidate.unit}</span>}
        <span className="rounded-md border border-line bg-[#f3f4f6] px-2 py-0.5 font-bold text-muted">
          HS6 {candidate.hs6}
        </span>
      </div>
      {candidate.rationale && (
        <div className="mt-1.5 text-[12px] text-muted">
          <span className="font-semibold">{t('k.reason')}:</span> {candidate.rationale}
        </div>
      )}
      {candidate.sourceCompany && (
        <div className="mt-2 border-t border-dashed border-line pt-1.5 text-[11.5px] text-muted2">
          {candidate.sourceCompany} · {t('k.basis')} {candidate.refCount}
        </div>
      )}
    </button>
  );
}
