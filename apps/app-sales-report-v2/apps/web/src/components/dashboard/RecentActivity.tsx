'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import type { ActionLogRow } from '@/server/actions/action-log.actions';

interface Props {
  rows: ActionLogRow[];
}

type Category = ActionLogRow['category'];

const CATEGORY_DOT: Record<Category, string> = {
  UPLOAD: 'bg-info-500',
  APPROVAL: 'bg-success-500',
  MANUAL_INPUT: 'bg-neutral-700',
  MASTER_DATA: 'bg-accent-500',
  FORMULA: 'bg-warning-500',
  REPORT: 'bg-info-500',
  EXPORT: 'bg-neutral-500',
  OTHER: 'bg-neutral-400',
};

const CATEGORY_PILL: Record<Category, string> = {
  UPLOAD: 'bg-info-50 text-info-500',
  APPROVAL: 'bg-success-500/10 text-success-500',
  MANUAL_INPUT: 'bg-neutral-100 text-neutral-700',
  MASTER_DATA: 'bg-accent-50 text-accent-700',
  FORMULA: 'bg-warning-500/10 text-warning-500',
  REPORT: 'bg-info-50 text-info-500',
  EXPORT: 'bg-neutral-100 text-neutral-700',
  OTHER: 'bg-neutral-100 text-neutral-500',
};

export function RecentActivity({ rows }: Props) {
  const t = useTranslations('dashboard.activity');
  const tCategory = useTranslations('activityLog.category');
  const locale = useLocale();
  const intlLocale = locale === 'ko' ? 'ko-KR' : 'en-US';

  const fmtRelative = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(intlLocale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">{t('sectionTitle')}</h2>
        <Link
          href="/activity-log/action"
          className="inline-flex items-center gap-1 text-xs font-medium text-info-500 hover:underline"
        >
          {t('viewAll')}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-500">
          {t('empty')}
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {rows.map((row) => {
            const cat = row.category as Category;
            return (
              <li key={row.actId} className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50/60">
                <span className={cn('mt-1.5 inline-block h-2 w-2 rounded-full shrink-0', CATEGORY_DOT[cat])} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        CATEGORY_PILL[cat],
                      )}
                    >
                      {tCategory(cat)}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-neutral-900 truncate">
                      {row.verb}
                    </span>
                    <span className="text-[11px] text-neutral-500 truncate">{row.targetLabel}</span>
                  </div>
                  {row.summary && (
                    <p className="mt-0.5 text-xs text-neutral-600 line-clamp-1">{row.summary}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xs text-info-500 truncate max-w-[180px]">
                    {row.username}
                  </div>
                  <div className="font-mono text-[10px] text-neutral-400 tabular-nums whitespace-nowrap">
                    {fmtRelative(row.createdAt)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
