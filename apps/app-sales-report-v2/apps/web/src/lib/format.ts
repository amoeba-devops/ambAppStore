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

export function vndToKrw(vnd: number, vndPerKrw = 17.543): number {
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
