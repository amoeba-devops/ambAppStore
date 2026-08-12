import { getTranslations } from 'next-intl/server';
import { Badge } from '@car-v2/ui';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

/**
 * "When was this generated, and is it still fresh" — one shared indicator for
 * every screen that shows numbers derived from a truck report snapshot (Chi
 * phí & LN, P&L, Dashboard, chi tiết chuyến). Fed by `getTruckReportStatus`
 * (PLAN-20260707 follow-up) so the answer is identical everywhere: never
 * reported (neutral) · not in the existing report (neutral) · reported and
 * fresh (success) · reported but data changed since (warning — regenerate).
 */
export async function ReportStatusBadge({
  reportedAt,
  stale,
  covered = true,
  locale,
  size = 'sm',
}: {
  reportedAt: Date | null;
  stale: boolean;
  /** false = this record post-dates the report, so it isn't in it. */
  covered?: boolean;
  locale: string;
  size?: 'sm' | 'md';
}) {
  const t = await getTranslations('screens.truckReportStatus');
  if (!reportedAt) {
    return (
      <Badge tone="neutral" size={size}>
        {t('noReport')}
      </Badge>
    );
  }
  /* A report exists for the month, but this record was logged afterwards —
   * saying "Đã lập BC" here is what made a brand-new trip look finalised. */
  if (!covered) {
    return (
      <Badge tone="neutral" size={size}>
        {t('notCovered')}
      </Badge>
    );
  }
  const date = reportedAt.toLocaleDateString(bcp47(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <Badge tone={stale ? 'warning' : 'success'} size={size}>
      {t(stale ? 'staleBadge' : 'reportAt', { date })}
    </Badge>
  );
}
