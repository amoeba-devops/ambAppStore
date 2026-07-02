'use client';

import { AlertTriangle, Wand2, AlertOctagon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type MissingPriceField = 'primeCost' | 'sellingPrice' | 'listingPrice';

export interface MissingMasterRow {
  sku: string;
  productName: string;
  units: number;
  /** GMV contribution in VND. Pass 0 to omit the currency line (TikTok preview). */
  gmvContribution: number;
  matchType: 'unknown' | 'name_match' | 'incomplete_master';
  possibleMasterSku?: string;
  /** Only set when matchType = 'incomplete_master'. Lists the fields ≤ 0. */
  missingFields?: MissingPriceField[];
}

interface Props {
  rows: MissingMasterRow[];
  /** Number formatter — re-used so this component stays presentation-only. */
  fmt: (n: number) => string;
  /** Show the GMV contribution column. Shopee preview = true, TikTok = false. */
  showGmv?: boolean;
}

/**
 * Two-section panel:
 *   - "Unknown products" (red AlertTriangle) — fully new SKUs.
 *   - "Possible SKU rename" (yellow Wand) — SKU not in master, but product
 *     name matches an existing master row.
 * Both sections share the slice-to-10 + "and more" pattern. The panel renders
 * nothing when both lists are empty.
 */
export function MissingMasterPanel({ rows, fmt, showGmv = true }: Props) {
  const t = useTranslations('uploadWizard.preview');
  const unknown = rows.filter((r) => r.matchType === 'unknown');
  const renames = rows.filter((r) => r.matchType === 'name_match');
  const incompletes = rows.filter((r) => r.matchType === 'incomplete_master');
  if (unknown.length === 0 && renames.length === 0 && incompletes.length === 0) return null;

  return (
    <div className="space-y-2">
      {unknown.length > 0 && (
        <details open className="rounded-md border border-warning-500/30 bg-warning-500/5 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-warning-500">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {unknown.length === 1
              ? t('missingUnknownSingular')
              : t('missingUnknown', { count: unknown.length })}
          </summary>
          <ul className="mt-2 space-y-1 text-neutral-700">
            {unknown.slice(0, 10).map((m) => (
              <li key={m.sku} className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-warning-500">{m.sku}</span>
                <span className="text-[10px] text-neutral-500">
                  ({m.units}u{showGmv && m.gmvContribution > 0 ? ` · ${fmt(m.gmvContribution)} VND` : ''})
                </span>
                <span className="line-clamp-1 flex-1 text-[11px]">{m.productName}</span>
              </li>
            ))}
            {unknown.length > 10 && (
              <li className="text-[10px] text-neutral-500">
                {t('andMore', { count: unknown.length - 10 })}
              </li>
            )}
          </ul>
        </details>
      )}

      {incompletes.length > 0 && (
        <details open className="rounded-md border border-error-500/30 bg-error-50/40 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-error-500">
            <AlertOctagon className="mr-1 inline h-3 w-3" />
            {incompletes.length === 1
              ? t('missingIncompleteSingular')
              : t('missingIncomplete', { count: incompletes.length })}
          </summary>
          <ul className="mt-2 space-y-1 text-neutral-700">
            {incompletes.slice(0, 10).map((m) => (
              <li key={m.sku} className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-error-500">{m.sku}</span>
                <span className="rounded bg-error-50 px-1 py-0.5 text-[9px] font-medium text-error-500">
                  {(m.missingFields ?? []).map((f) => t(`field.${f}`)).join(', ')} = 0
                </span>
                <span className="text-[10px] text-neutral-500">
                  ({m.units}u{showGmv && m.gmvContribution > 0 ? ` · ${fmt(m.gmvContribution)} VND` : ''})
                </span>
                <span className="line-clamp-1 flex-1 text-[11px]">{m.productName}</span>
              </li>
            ))}
            {incompletes.length > 10 && (
              <li className="text-[10px] text-neutral-500">
                {t('andMore', { count: incompletes.length - 10 })}
              </li>
            )}
          </ul>
        </details>
      )}

      {renames.length > 0 && (
        <details open className="rounded-md border border-info-500/30 bg-info-50/40 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-info-500">
            <Wand2 className="mr-1 inline h-3 w-3" />
            {renames.length === 1
              ? t('missingRenameSingular')
              : t('missingRename', { count: renames.length })}
          </summary>
          <ul className="mt-2 space-y-1 text-neutral-700">
            {renames.slice(0, 10).map((m) => (
              <li key={m.sku} className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-info-500">{m.sku}</span>
                <span className="text-[10px] text-neutral-400">→</span>
                <span className="font-mono text-[10px] text-success-500">{m.possibleMasterSku}</span>
                <span className="text-[10px] text-neutral-500">
                  ({m.units}u{showGmv && m.gmvContribution > 0 ? ` · ${fmt(m.gmvContribution)} VND` : ''})
                </span>
                <span className="line-clamp-1 flex-1 text-[11px]">{m.productName}</span>
              </li>
            ))}
            {renames.length > 10 && (
              <li className="text-[10px] text-neutral-500">
                {t('andMore', { count: renames.length - 10 })}
              </li>
            )}
          </ul>
        </details>
      )}
    </div>
  );
}
