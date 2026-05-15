/**
 * Browser-local action log — every mock feature (formula save, raw-archive
 * approve/reject, …) writes here so the Activity Log page shows real entries
 * during demo mode. Once `sal_action_logs` ships server-side, swap this for
 * a proper Server Action mutation and `appendActionLog` becomes a no-op.
 */

import type { ActionLogRow } from '@/server/actions/action-log.actions';

const STORAGE_KEY = 'mock-action-log';
const CHANGE_EVENT = 'mock-action-log-change';

export type ActionCategory = ActionLogRow['category'];

export interface NewActionLogInput {
  username: string;
  userRole: string;
  category: ActionCategory;
  verb: string;
  targetType?: string | null;
  targetLabel: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
}

function readLog(): ActionLogRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActionLogRow[]) : [];
  } catch {
    return [];
  }
}

function writeLog(rows: ActionLogRow[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // quota / serialization — silently drop
  }
}

/** Newest first. */
export function getMockActionLogs(): ActionLogRow[] {
  return readLog();
}

export function appendActionLog(input: NewActionLogInput): void {
  const rows = readLog();
  const row: ActionLogRow = {
    actId: `MAL-${Date.now()}-${Math.floor(Math.random() * 1_000)}`,
    username: input.username,
    userRole: input.userRole,
    category: input.category,
    verb: input.verb,
    targetType: input.targetType ?? null,
    targetLabel: input.targetLabel,
    summary: input.summary ?? null,
    metadata: input.metadata ?? null,
    createdAt: new Date().toISOString(),
  };
  // Newest first, cap to last 500 entries to avoid quota issues
  const next = [row, ...rows].slice(0, 500);
  writeLog(next);
}

/** Cross-tab + in-tab subscription helper. Returns a teardown fn. */
export function subscribeMockLog(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
