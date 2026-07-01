import { useTranslation } from 'react-i18next';

/** Phase 0 자리표시자 — 화면 구현은 Phase 2~5에서 채운다. */
export default function Placeholder({ phase }: { phase: string }) {
  const { t } = useTranslation('hscode');
  return (
    <div className="mt-4 rounded-xl border border-dashed border-line2 bg-white p-8 text-center text-muted">
      <p className="text-[15px] font-semibold text-ink">{t('qa.conv')} · UI</p>
      <p className="mt-1 text-[13px]">구현 예정 — {phase}</p>
    </div>
  );
}
