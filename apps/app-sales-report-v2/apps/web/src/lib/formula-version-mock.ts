/**
 * Persists formula version history per metric in localStorage.
 * Once `sal_formula_versions` ships, swap for DB queries.
 */

export interface FormulaVersion {
  formula: string;
  reason?: string;
  effectivePeriod: string;
  changedBy: string;
  changedAt: string;
  status: 'Active' | 'Closed';
}

export interface NewVersionPayload {
  newFormula: string;
  reason: string;
  effectiveDate: string; // YYYY-MM-DD
  retroactive: boolean;
}

import { appendActionLog } from './action-log-mock';

const STORAGE_KEY = 'formula-config-history';
const SEED_USER = 'admin@socialbean.vn';
const CURRENT_USER = 'dev@amoeba.group';
const SEED_DATE = '2026-01-01';

function seedDefault(): FormulaVersion[] {
  return [
    {
      formula: '(default)',
      effectivePeriod: '— → present',
      changedBy: SEED_USER,
      changedAt: SEED_DATE,
      status: 'Active',
    },
  ];
}

function readAll(): Record<string, FormulaVersion[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, FormulaVersion[]>;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, FormulaVersion[]>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore — quota / serialization errors
  }
}

/** Returns the full history for a metric (newest first). Seeds with `(default)` if empty. */
export function getVersionHistory(metric: string): FormulaVersion[] {
  const all = readAll();
  const list = all[metric];
  if (list && list.length > 0) return list;
  return seedDefault();
}

/** Number of versions recorded for a metric (≥ 1 — always includes seed default). */
export function getVersionCount(metric: string): number {
  return getVersionHistory(metric).length;
}

/**
 * Resolve the currently-Active formula text. If history's Active entry is the
 * placeholder `(default)`, fall back to the catalog seed value (since the
 * seed entry doesn't carry the actual formula text).
 */
export function getActiveFormula(metric: string, fallback: string): string {
  const history = getVersionHistory(metric);
  const active = history.find((v) => v.status === 'Active');
  if (!active) return fallback;
  if (active.formula === '(default)') return fallback;
  return active.formula;
}

/**
 * Append a new version. Marks all previously-Active entries as Closed and
 * truncates their effective period to end on the new entry's effective date.
 */
export function appendVersion(metric: string, payload: NewVersionPayload): FormulaVersion[] {
  const all = readAll();
  const existing = all[metric] ?? seedDefault();

  const closed: FormulaVersion[] = existing.map((v) =>
    v.status === 'Active'
      ? {
          ...v,
          status: 'Closed',
          effectivePeriod: replacePeriodEnd(v.effectivePeriod, payload.effectiveDate),
        }
      : v,
  );

  const newEntry: FormulaVersion = {
    formula: payload.newFormula,
    reason: payload.reason,
    effectivePeriod: `${payload.effectiveDate} → present`,
    changedBy: CURRENT_USER,
    changedAt: formatDateTime(new Date()),
    status: 'Active',
  };

  const next = [newEntry, ...closed];
  all[metric] = next;
  writeAll(all);

  appendActionLog({
    username: CURRENT_USER,
    userRole: 'ADMIN',
    category: 'FORMULA',
    verb: 'UPDATE',
    targetType: 'formula',
    targetLabel: metric,
    summary: payload.reason
      ? `New version saved — "${payload.reason}"${payload.retroactive ? ' · applies retroactively' : ''}`
      : `New version saved${payload.retroactive ? ' · applies retroactively' : ''}`,
    metadata: { effectiveDate: payload.effectiveDate, retroactive: payload.retroactive },
  });

  return next;
}

function replacePeriodEnd(period: string, newEnd: string): string {
  // Replace whatever is after the arrow with `newEnd`
  const m = period.match(/^(.*?\s*→\s*).+$/);
  if (m) return `${m[1]}${newEnd}`;
  return `${period} → ${newEnd}`;
}

function formatDateTime(d: Date): string {
  // Unified app-wide format: DD/MM/YYYY HH:MM:SS (24h, local timezone).
  // Matches `@/lib/format.fmtDateTime`. Kept local here because this is a
  // mock module imported in places that can't depend on the format lib.
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
