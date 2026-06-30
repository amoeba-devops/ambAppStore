'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Wand2, AlertOctagon } from 'lucide-react';
import { FormulaConfigClient } from '@/components/formula-config/FormulaConfigClient';
import type { SelectedPeriod } from './Step1Period';
import type { MissingMasterRow } from './MissingMasterPanel';

interface Props {
  selectedPeriod?: SelectedPeriod | null;
  /** Aggregated by source — lifted from Step 2 preview cards via the wizard. */
  unknownSkus?: { shopee: MissingMasterRow[]; tiktok: MissingMasterRow[] };
}

export function Step4Review({
  selectedPeriod = null,
  unknownSkus = { shopee: [], tiktok: [] },
}: Props) {
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
          <UnknownSkusBanner unknownSkus={unknownSkus} />
        </div>
      }
    />
  );
}

function UnknownSkusBanner({
  unknownSkus,
}: {
  unknownSkus: { shopee: MissingMasterRow[]; tiktok: MissingMasterRow[] };
}) {
  const t = useTranslations('uploadWizard.step4');
  // Aggregate across platforms, tagging origin so admin knows which file the
  // SKU came from. Same SKU appearing on both platforms shows as 2 rows
  // (different `source`) — that's deliberate, the partner sometimes reuses an
  // identifier across channels.
  const all = [
    ...unknownSkus.shopee.map((r) => ({ ...r, source: 'Shopee' as const })),
    ...unknownSkus.tiktok.map((r) => ({ ...r, source: 'TikTok' as const })),
  ];
  if (all.length === 0) return null;
  const unknown = all.filter((r) => r.matchType === 'unknown');
  const renames = all.filter((r) => r.matchType === 'name_match');
  const incompletes = all.filter((r) => r.matchType === 'incomplete_master');

  return (
    <div className="space-y-2 rounded-md border border-warning-500/30 bg-warning-500/5 p-3">
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-500" />
        <div>
          <p className="font-semibold text-warning-500">{t('unknownSkusBannerTitle')}</p>
          <p className="mt-1 text-xs text-neutral-600">
            {t('unknownSkusBannerBody', {
              unknownCount: unknown.length,
              renameCount: renames.length,
              incompleteCount: incompletes.length,
            })}
          </p>
        </div>
      </div>

      {unknown.length > 0 && (
        <details open className="rounded-md bg-white px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-warning-500">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {t('unknownSection', { count: unknown.length })}
          </summary>
          <ul className="mt-2 space-y-1 text-neutral-700">
            {unknown.slice(0, 15).map((m) => (
              <li key={`${m.source}-${m.sku}`} className="flex items-baseline gap-2">
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[9px] text-neutral-600">
                  {m.source}
                </span>
                <span className="font-mono text-[10px] text-warning-500">{m.sku}</span>
                <span className="text-[10px] text-neutral-500">({m.units}u)</span>
                <span className="line-clamp-1 flex-1 text-[11px]">{m.productName}</span>
              </li>
            ))}
            {unknown.length > 15 && (
              <li className="text-[10px] text-neutral-500">
                {t('andMore', { count: unknown.length - 15 })}
              </li>
            )}
          </ul>
        </details>
      )}

      {incompletes.length > 0 && (
        <details open className="rounded-md bg-white px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-error-500">
            <AlertOctagon className="mr-1 inline h-3 w-3" />
            {t('incompleteSection', { count: incompletes.length })}
          </summary>
          <ul className="mt-2 space-y-1 text-neutral-700">
            {incompletes.slice(0, 15).map((m) => (
              <li key={`${m.source}-${m.sku}`} className="flex items-baseline gap-2">
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[9px] text-neutral-600">
                  {m.source}
                </span>
                <span className="font-mono text-[10px] text-error-500">{m.sku}</span>
                <span className="rounded bg-error-50 px-1 py-0.5 text-[9px] font-medium text-error-500">
                  {(m.missingFields ?? []).map((f) => t(`field.${f}`)).join(', ')} = 0
                </span>
                <span className="text-[10px] text-neutral-500">({m.units}u)</span>
                <span className="line-clamp-1 flex-1 text-[11px]">{m.productName}</span>
              </li>
            ))}
            {incompletes.length > 15 && (
              <li className="text-[10px] text-neutral-500">
                {t('andMore', { count: incompletes.length - 15 })}
              </li>
            )}
          </ul>
        </details>
      )}

      {renames.length > 0 && (
        <details open className="rounded-md bg-white px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-info-500">
            <Wand2 className="mr-1 inline h-3 w-3" />
            {t('renameSection', { count: renames.length })}
          </summary>
          <ul className="mt-2 space-y-1 text-neutral-700">
            {renames.slice(0, 15).map((m) => (
              <li key={`${m.source}-${m.sku}`} className="flex items-baseline gap-2">
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[9px] text-neutral-600">
                  {m.source}
                </span>
                <span className="font-mono text-[10px] text-info-500">{m.sku}</span>
                <span className="text-[10px] text-neutral-400">→</span>
                <span className="font-mono text-[10px] text-success-500">{m.possibleMasterSku}</span>
                <span className="text-[10px] text-neutral-500">({m.units}u)</span>
                <span className="line-clamp-1 flex-1 text-[11px]">{m.productName}</span>
              </li>
            ))}
            {renames.length > 15 && (
              <li className="text-[10px] text-neutral-500">
                {t('andMore', { count: renames.length - 15 })}
              </li>
            )}
          </ul>
        </details>
      )}
    </div>
  );
}
