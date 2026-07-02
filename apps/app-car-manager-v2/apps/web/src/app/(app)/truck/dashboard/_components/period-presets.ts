/** Shared period-preset constants — no 'use client' so the server component
 * can call isPeriodPreset() without violating RSC/client boundaries. */
export const PERIOD_PRESETS = ['thisMonth', 'last3', 'last6', 'ytd', 'all'] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export function isPeriodPreset(v: string | undefined): v is PeriodPreset {
  return !!v && (PERIOD_PRESETS as readonly string[]).includes(v);
}
