'use client';

import { useTranslations } from 'next-intl';
import { FormulaConfigClient } from '@/components/formula-config/FormulaConfigClient';
import type { SelectedPeriod } from './Step1Period';

interface Props {
  selectedPeriod?: SelectedPeriod | null;
}

export function Step4Review({ selectedPeriod = null }: Props) {
  const t = useTranslations('uploadWizard.step4');
  return (
    <FormulaConfigClient
      showFilters={false}
      showExport={false}
      showEditableParams={false}
      defaultCollapsed
      header={
        <div className="space-y-2">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">{t('title')}</h2>
            <p className="mt-1 text-sm text-neutral-500">{t('subtitle')}</p>
          </div>
          {selectedPeriod && (
            <div className="rounded-md bg-info-50/40 border border-info-500/30 px-3 py-2 text-xs text-info-500">
              {t('banner')}{' '}
              <span className="font-mono font-semibold">{selectedPeriod.label}</span>{' '}
              <span className="text-neutral-500">({selectedPeriod.rangeLabel})</span>.
            </div>
          )}
        </div>
      }
    />
  );
}
