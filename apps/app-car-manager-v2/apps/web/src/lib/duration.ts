/**
 * Convert between display value+unit (used by trip form) and the integer
 * minutes column (`trp_duration_minutes`) stored in DB.
 */

export type DurationUnit = 'minutes' | 'hours' | 'days';

const MULTIPLIER: Record<DurationUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

/** Form value+unit → total minutes (or undefined if empty/invalid). */
export function toMinutes(value: string, unit: DurationUnit): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * MULTIPLIER[unit]);
}

/** Total minutes → best-fit value+unit for the form (prefers larger unit when even). */
export function fromMinutes(minutes: number | null | undefined): { value: string; unit: DurationUnit } {
  if (!minutes || minutes <= 0) return { value: '', unit: 'hours' };
  if (minutes % 1440 === 0) return { value: String(minutes / 1440), unit: 'days' };
  if (minutes % 60   === 0) return { value: String(minutes / 60),   unit: 'hours' };
  return { value: String(minutes), unit: 'minutes' };
}
