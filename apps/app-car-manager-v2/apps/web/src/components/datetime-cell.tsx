import { DEFAULT_TIME_ZONE, formatDateTimeParts } from '@/lib/format-day';

/**
 * Two-line "last updated" cell — time on top (HH:MM:SS), date below
 * (DD/MM/YYYY). Shared by the truck roster/log/finance tables so every
 * "Cập nhật" column renders the same way (Sheet-2: T8, DR7, F7, P7).
 * Pure/formatting only — safe to use inside Server Components.
 *
 * `timeZone` MUST be the tenant's zone (`getTenantTimeZone`) — this renders on
 * the server, whose clock is UTC on Render / Docker, so without it every
 * timestamp was 7 hours early for a Vietnamese viewer (BUG-260930 case 1).
 */
export function DateTimeCell({
  value,
  locale,
  timeZone = DEFAULT_TIME_ZONE,
}: {
  value: Date | string | null | undefined;
  locale: string;
  timeZone?: string;
}) {
  if (!value) return <span className="text-text-faint">—</span>;
  const { time, date } = formatDateTimeParts(value, locale, timeZone);
  return (
    <div className="leading-tight tabular whitespace-nowrap">
      <div className="text-text">{time}</div>
      <div className="text-xs text-text-faint">{date}</div>
    </div>
  );
}
