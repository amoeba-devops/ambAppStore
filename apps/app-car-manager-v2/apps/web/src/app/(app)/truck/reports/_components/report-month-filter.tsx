'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

/** "Lọc theo tháng" dropdown for the reports list (URL-driven `?month=`). */
export function ReportMonthFilter({
  months,
  value,
}: {
  months: { value: string; label: string }[];
  value?: string;
}) {
  const t = useTranslations('screens.truckReports');
  const router = useRouter();
  const pathname = usePathname() ?? '/truck/reports';
  const sp = useSearchParams();

  const onChange = (v: string) => {
    const params = new URLSearchParams(sp?.toString());
    if (v === 'all') params.delete('month');
    else params.set('month', v);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-text-muted">{t('filterByMonth')}</span>
      <select
        value={value ?? 'all'}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 md:h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text focus-visible:outline-none focus-visible:border-accent"
      >
        <option value="all">{t('allMonths')}</option>
        {months.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
    </label>
  );
}
