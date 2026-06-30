import { useTranslation } from 'react-i18next';

/** FR-022 / POL-002 — 모든 결과에 노출되는 법적 고지. */
export default function LegalNotice() {
  const { t } = useTranslation('hscode');
  return (
    <div className="mt-3.5 flex items-start gap-2.5 rounded-[9px] border border-[#FCD9A3] bg-warn-soft px-3.5 py-3 text-[12.5px] text-[#92520B]">
      <span className="leading-none">⚠️</span>
      <div>
        <b>{t('bc.legaltitle')}</b> — {t('bc.legalbody')}
      </div>
    </div>
  );
}
