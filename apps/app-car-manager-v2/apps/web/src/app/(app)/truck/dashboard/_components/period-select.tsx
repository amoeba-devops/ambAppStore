'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@car-v2/ui';
import { PERIOD_PRESETS, type PeriodPreset } from './period-presets';

/** Segmented control that drives the dashboard period via the `?period=` query
 * param (server reads it + re-aggregates). */
export function PeriodSelect({ current }: { current: PeriodPreset }) {
  const t = useTranslations('screens.truckDashboard.period');
  const router = useRouter();
  const pathname = usePathname() ?? '/truck/dashboard';
  const sp = useSearchParams();

  const go = (p: PeriodPreset) => {
    const params = new URLSearchParams(sp?.toString());
    params.set('period', p);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="inline-flex rounded-md bg-surface-2 p-0.5">
      {PERIOD_PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => go(p)}
          aria-current={current === p ? 'true' : undefined}
          className={cn(
            'px-2.5 py-1 text-xs font-semibold rounded transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            current === p ? 'bg-accent text-accent-fg shadow-sm' : 'text-text-muted hover:text-text',
          )}
        >
          {t(p)}
        </button>
      ))}
    </div>
  );
}
