'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { METRICS, getMetricDef, type Metric, type MetricDef } from '@/lib/trends-mock';

const GROUP_ORDER: MetricDef['group'][] = ['volume', 'margin', 'discount', 'promo', 'traffic'];

interface Props {
  value: Metric[];
  onChange: (next: Metric[]) => void;
  max?: number;
}

export function MultiMetricSelect({ value, onChange, max = 5 }: Props) {
  const t = useTranslations('trendingReport.select');
  const groupLabel = (g: MetricDef['group']) =>
    t(`group.${g}` as `group.${MetricDef['group']}`);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (m: Metric) => {
    if (value.includes(m)) {
      // Don't allow deselecting the last metric — must keep at least 1
      if (value.length <= 1) return;
      onChange(value.filter((v) => v !== m));
      return;
    }
    if (value.length >= max) return;
    onChange([...value, m]);
  };

  const remove = (m: Metric) => {
    if (value.length <= 1) return;
    onChange(value.filter((v) => v !== m));
  };

  const atMax = value.length >= max;
  const canRemove = value.length > 1;

  return (
    <div
      ref={ref}
      className="relative flex flex-1 flex-wrap items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2 py-1.5 min-h-[40px]"
    >
      {value.map((m) => {
        const def = getMetricDef(m);
        return (
          <span
            key={m}
            className="inline-flex items-center gap-1 rounded-full bg-info-50 px-2.5 py-1 text-xs font-medium text-info-500"
          >
            <span>{def.label}</span>
            <button
              type="button"
              onClick={() => remove(m)}
              disabled={!canRemove}
              title={
                canRemove
                  ? t('removeTitle', { label: def.label })
                  : t('removeDisabledTitle')
              }
              className={cn(
                'rounded-full p-0.5 hover:bg-info-500/20',
                !canRemove && 'cursor-not-allowed opacity-40',
              )}
              aria-label={t('removeAria', { label: def.label })}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={atMax}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
          atMax
            ? 'cursor-not-allowed text-neutral-300'
            : 'text-info-500 hover:bg-neutral-100',
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        {atMax ? t('maxLabel', { max }) : t('addMetric')}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-md border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              {t('selectedOfMax', { count: value.length, max })}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-neutral-500 hover:underline"
            >
              {t('close')}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto py-1">
            {GROUP_ORDER.map((group) => {
              const items = METRICS.filter((m) => m.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="py-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    {groupLabel(group)}
                  </div>
                  {items.map((m) => {
                    const selected = value.includes(m.key);
                    const disabled = !selected && atMax;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => toggle(m.key)}
                        disabled={disabled}
                        className={cn(
                          'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm',
                          selected
                            ? 'text-neutral-900 bg-info-50/60'
                            : 'text-neutral-700 hover:bg-neutral-50',
                          disabled && 'cursor-not-allowed opacity-40',
                        )}
                      >
                        <span>{m.label}</span>
                        {selected && <Check className="h-4 w-4 text-info-500" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {atMax && (
            <div className="border-t border-neutral-100 bg-warning-50 px-3 py-1.5 text-[11px] text-warning-500">
              {t('limitReached')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
