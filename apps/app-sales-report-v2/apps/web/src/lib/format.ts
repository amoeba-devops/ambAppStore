/**
 * Unified date/time format across the app: `DD/MM/YYYY HH:MM:SS` (24h, local timezone).
 * Pass `iso` as ISO 8601 string (e.g. from `Date.toISOString()` server-side) or null/undefined.
 */
export function fmtDateTime(iso: string | Date | null | undefined): string {
  if (iso == null) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Date-only form `DD/MM/YYYY` — for columns where time isn't relevant. */
export function fmtDate(iso: string | Date | null | undefined): string {
  if (iso == null) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Time-only form `HH:MM:SS` (24h, local timezone). Pairs with `fmtDate` when
 *  a cell wants date + time on separate lines. */
export function fmtTime(iso: string | Date | null | undefined): string {
  if (iso == null) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtVND(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';
}

export function fmtKRW(n: number | null | undefined): string {
  if (n == null) return '—';
  return '₩' + new Intl.NumberFormat('ko-KR').format(Math.round(n));
}

export function fmtPct(ratio: number | null | undefined, decimals = 2): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  return (ratio * 100).toFixed(decimals) + '%';
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}

/** Compact form: 1.23B / 456M / 7.8K / 123. Sign-preserving. */
export function fmtCompact(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(decimals).replace(/\.?0+$/, '') + 'B';
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(decimals).replace(/\.?0+$/, '') + 'M';
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(decimals).replace(/\.?0+$/, '') + 'K';
  return sign + abs.toFixed(0);
}

/**
 * Default VND-per-KRW exchange rate. Used as a fallback when no live rate
 * has been fetched from `sal_fx_rates`. Override at the call-site by
 * passing the second arg (e.g. live rate from server prop, or a frozen
 * snapshot rate from a finalized report).
 *
 * Per SRD §5.5: 1 KRW ≈ 17.543 VND (verified from FINAL REPORT.csv:
 * 1,682,035,200 VND / 95,876,006 KRW = 17.544).
 */
export const DEFAULT_VND_PER_KRW = 17.543;

export function vndToKrw(vnd: number, vndPerKrw = DEFAULT_VND_PER_KRW): number {
  return vnd / vndPerKrw;
}

export function wowDisplay(current: number, previous: number | null | undefined): {
  display: string;
  variant: 'positive' | 'negative' | 'neutral' | 'na' | 'first';
} {
  if (previous == null) return { display: '----', variant: 'first' };
  if (previous === 0) return { display: 'N/A', variant: 'na' };
  const pct = (current - previous) / Math.abs(previous);
  if (pct === 0) return { display: '0.00%', variant: 'neutral' };
  const sign = pct > 0 ? '+' : '';
  return {
    display: `${sign}${(pct * 100).toFixed(2)}%`,
    variant: pct > 0 ? 'positive' : 'negative',
  };
}
