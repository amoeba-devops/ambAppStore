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

/**
 * Zone every server-rendered wall-clock timestamp falls back to. Server
 * Components format on the server, whose clock is UTC on Render / in Docker,
 * so a bare `toLocale*String(loc)` printed UTC to a Vietnamese viewer
 * (BUG-260930 case 1). Pages pass the tenant's zone (`getTenantTimeZone`);
 * this default only guards call sites that have no tenant at hand.
 */
export const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * An instant (Date / ISO string) → its calendar day. `timeZone` decides which
 * day a late-evening instant belongs to; pass the tenant zone for created /
 * updated timestamps. Day KEYS stored as UTC midnight (trip dates) go through
 * `formatDayKey` instead.
 */
export function formatDay(d: Date | string, loc: string, timeZone?: string): string {
  return new Date(d).toLocaleDateString(loc, timeZone ? { ...DAY_FORMAT, timeZone } : DAY_FORMAT);
}

/**
 * A 'YYYY-MM-DD' day KEY (maintenance dates, trip day keys) → same format,
 * rendered in UTC so the day never shifts under a VN (UTC+7) clock.
 */
export function formatDayKey(iso: string, loc: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(loc, { ...DAY_FORMAT, timeZone: 'UTC' });
}

/**
 * An instant → `{ time: 'HH:MM:SS', date: 'dd/mm/yyyy' }` in `timeZone`. The
 * pieces `DateTimeCell` stacks; also joinable as one line ("HH:MM:SS dd/mm/yyyy").
 */
export function formatDateTimeParts(
  d: Date | string,
  loc: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): { time: string; date: string } {
  const x = new Date(d);
  return {
    time: x.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone }),
    date: x.toLocaleDateString(loc, { ...DAY_FORMAT, timeZone }),
  };
}

/** One-line `HH:MM:SS dd/mm/yyyy` in `timeZone` — list cells that can't stack. */
export function formatDateTime(d: Date | string, loc: string, timeZone: string = DEFAULT_TIME_ZONE): string {
  const p = formatDateTimeParts(d, loc, timeZone);
  return `${p.time} ${p.date}`;
}
