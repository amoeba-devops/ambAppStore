'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { cn } from '@car-v2/ui';

/** Horizontal 3-step indicator for the "Lập báo cáo" flow: ① Chọn tháng —— ②
 * Chọn khu vực —— ③ Xác nhận & Lập báo cáo. Done steps go green (✓), the current
 * step is the filled dark circle, upcoming steps are muted. */
export function ReportStepper({ step }: { step: 1 | 2 | 3 }) {
  const t = useTranslations('screens.truckReports');
  const items = [
    { n: 1 as const, label: t('stepName1') },
    { n: 2 as const, label: t('stepNameRegion') },
    { n: 3 as const, label: t('stepName2') },
  ];
  return (
    <div className="flex items-center gap-3 overflow-x-auto">
      {items.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} className="flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                  done
                    ? 'bg-success text-white'
                    : active
                      ? 'bg-text text-bg'
                      : 'border border-border bg-surface-2 text-text-faint',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : s.n}
              </span>
              <span className={cn('whitespace-nowrap text-sm', active || done ? 'font-semibold text-text' : 'text-text-faint')}>
                {s.label}
              </span>
            </div>
            {i < items.length - 1 && (
              <div className={cn('h-px w-8 sm:w-16', step > s.n ? 'bg-success' : 'bg-border')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
