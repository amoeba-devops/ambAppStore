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
