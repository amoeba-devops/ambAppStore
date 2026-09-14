/**
 * The ONE calendar-day format of the TRUCK workspace (REQ-20260907, QA
 * 2026-09-07): `dd/mm/yyyy` in the locale's field order — the same shape
 * `DateTimeCell` prints under a timestamp, so a "Ngày" column, a maintenance
 * badge ("đến 09/09/2026") and a form hint all read alike. Before this, list
 * columns used the bare `toLocaleDateString(loc)` ("5/9/2026") while badges
 * and timestamps were zero-padded.
 *
 * Pure — safe in Server and Client Components.
 */
export const DAY_FORMAT: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };

/** An instant (Date / ISO string) → its calendar day in the viewer's timezone. */
export function formatDay(d: Date | string, loc: string): string {
  return new Date(d).toLocaleDateString(loc, DAY_FORMAT);
}

/**
 * A 'YYYY-MM-DD' day KEY (maintenance dates, trip day keys) → same format,
 * rendered in UTC so the day never shifts under a VN (UTC+7) clock.
 */
export function formatDayKey(iso: string, loc: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(loc, { ...DAY_FORMAT, timeZone: 'UTC' });
}
