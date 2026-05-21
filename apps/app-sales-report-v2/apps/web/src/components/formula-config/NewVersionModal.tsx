'use client';

import { useEffect, useState } from 'react';
import { X, ChevronDown, ChevronUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { getImpactAnalysis } from '@/lib/formula-impact-mock';

interface Props {
  metric: string;
  oldFormula: string;
  newFormula: string;
  onCancel: () => void;
  onConfirm: (payload: {
    reason: string;
    effectiveDate: string;
    retroactive: boolean;
  }) => void;
}

export function NewVersionModal({ metric, oldFormula, newFormula, onCancel, onConfirm }: Props) {
  const t = useTranslations('formulaConfig.newVersion');
  const tCommon = useTranslations('common');
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [retroactive, setRetroactive] = useState(false);
  const [reason, setReason] = useState('');
  const [impactOpen, setImpactOpen] = useState(true);

  const impact = getImpactAnalysis(metric);
  const totalAffected = impact.reports.length + impact.sections.length + impact.charts.length;
  const canSubmit = reason.trim().length > 0 && effectiveDate.length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm px-4 py-6 text-left"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '460px' }}
        className="max-w-full max-h-full rounded-xl bg-white shadow-2xl overflow-hidden flex flex-col text-left"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-neutral-900 leading-tight">
            {t('title')} — <span className="font-mono">{renderMetricName(metric)}</span>
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label={tCommon('close')}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 transition-colors shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {/* Before / After diff */}
          <div className="rounded-md border border-neutral-200 bg-neutral-50/50 divide-y divide-neutral-200">
            <DiffRow label={t('diff.before')} emptyLabel={t('diff.empty')} formula={oldFormula} variant="removed" />
            <DiffRow label={t('diff.after')} emptyLabel={t('diff.empty')} formula={newFormula} variant="added" />
          </div>

          {/* Impact Analysis */}
          <div className="rounded-md border border-neutral-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setImpactOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 bg-neutral-50/60 px-3 py-2.5 text-left hover:bg-neutral-50"
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-neutral-500" />
                <span className="text-sm font-semibold text-neutral-900">{t('impact.title')}</span>
                <span className="text-xs font-medium text-warning-500">
                  {t('impact.affected', { count: totalAffected })}
                </span>
              </span>
              {impactOpen ? (
                <ChevronUp className="h-4 w-4 text-neutral-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-400" />
              )}
            </button>
            {impactOpen && (
              <div className="px-3 py-3 space-y-3">
                <ChipGroup label={t('impact.reports')} items={impact.reports} color="info" />
                <ChipGroup label={t('impact.sections')} items={impact.sections} color="success" />
                <ChipGroup label={t('impact.charts')} items={impact.charts} color="accent" />
              </div>
            )}
          </div>

          {/* Effective From */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
              {t('effectiveFrom')} <span className="text-error-500">*</span>
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              min={today}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-info-500"
            />
          </div>

          {/* Retroactive checkbox */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={retroactive}
              onChange={(e) => setRetroactive(e.target.checked)}
              className="mt-0.5 accent-info-500"
            />
            <span className="text-sm text-neutral-700">
              {t('retroactive')}{' '}
              <span className="text-neutral-400">{t('retroactiveHint')}</span>
            </span>
          </label>

          {retroactive && (
            <div className="rounded-md border border-warning-500/30 bg-warning-500/10 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning-500" />
                <div className="text-xs text-warning-500 leading-relaxed">
                  <p className="font-semibold">{t('retroactiveWarningTitle')}</p>
                  <p className="mt-1">{t('retroactiveWarningBody')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Change Reason */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
              {t('changeReason')} <span className="text-error-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              rows={3}
              className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-info-500"
            />
            {reason.trim().length === 0 && (
              <p className="mt-1 text-[11px] text-neutral-400">{t('reasonRequired')}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/40 px-5 py-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onConfirm({ reason: reason.trim(), effectiveDate, retroactive })
            }
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors',
              canSubmit
                ? 'bg-info-500 hover:bg-info-500/90'
                : 'bg-neutral-300 cursor-not-allowed',
            )}
          >
            {t('submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

function DiffRow({
  label,
  emptyLabel,
  formula,
  variant,
}: {
  label: string;
  emptyLabel: string;
  formula: string;
  variant: 'removed' | 'added';
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 pt-0.5">
        {label}
      </span>
      <span
        className={cn(
          'flex-1 font-mono text-xs leading-5 break-words',
          variant === 'removed' && 'text-error-500 line-through',
          variant === 'added' && 'text-success-500',
        )}
      >
        {formula || <span className="italic text-neutral-300">{emptyLabel}</span>}
      </span>
    </div>
  );
}

function ChipGroup({
  label,
  items,
  color,
}: {
  label: string;
  items: string[];
  color: 'info' | 'success' | 'accent';
}) {
  if (items.length === 0) return null;
  const colorClass =
    color === 'info'
      ? 'bg-info-50 text-info-500'
      : color === 'success'
        ? 'bg-success-500/10 text-success-500'
        : 'bg-accent-50 text-accent-700';
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', colorClass)}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function renderMetricName(name: string): React.ReactNode {
  const m = name.match(/^(.*?)(\s—\s(?:Shopee|TikTok))$/);
  if (!m) return name;
  return (
    <>
      {m[1]}
      <span className="text-neutral-400 font-normal">{m[2]}</span>
    </>
  );
}
