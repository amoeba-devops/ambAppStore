/**
 * Client-side overrides for the Raw Archive mock — lets the Manager approve
 * (Draft → Finalized) and unfinalize (Finalized → Draft) periods. Persisted
 * to localStorage and synced across tabs via the native `storage` event +
 * a custom in-tab `raw-archive-state-change` event.
 *
 * Once `sal_archive_periods` ships, replace with proper API mutations.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  getAllArchivePeriods,
  type ActivityEntry,
  type ArchivePeriod,
  type PeriodStatus,
} from './raw-archive-mock';
import { appendActionLog } from './action-log-mock';

const STORAGE_KEY = 'raw-archive-state';
const CHANGE_EVENT = 'raw-archive-state-change';
const MANAGER_USER = 'manager@socialbean.vn';

export interface PeriodOverride {
  status?: PeriodStatus;
  finalizedAt?: string;
  finalizedBy?: string;
  finalizedReason?: string;
  unfinalizedAt?: string;
  unfinalizedBy?: string;
  unfinalizedReason?: string;
  /** When Manager rejects a Draft — kept until Operator resubmits. */
  rejectedAt?: string;
  rejectedBy?: string;
  rejectedReason?: string;
  /** Replaces the ingest-time Manual Input snapshot when set. */
  manualInputs?: Record<string, number>;
  extraActivityLog: ActivityEntry[];
}

type OverrideMap = Record<string, PeriodOverride>;

function readMap(): OverrideMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: OverrideMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // ignore — quota or serialization error
  }
}

/** Carries rejection metadata so the ApprovalCard can render a banner. */
export interface EffectivePeriod extends ArchivePeriod {
  rejection?: {
    rejectedAt: string;
    rejectedBy: string;
    rejectedReason: string;
  };
}

export function applyOverride(period: ArchivePeriod): EffectivePeriod {
  const map = readMap();
  const o = map[period.periodKey];
  if (!o) return period;
  const merged: EffectivePeriod = {
    ...period,
    status: o.status ?? period.status,
    finalizedAt: o.finalizedAt ?? period.finalizedAt,
    finalizedBy: o.finalizedBy ?? period.finalizedBy,
    manualInputs: o.manualInputs ?? period.manualInputs,
  };
  if (o.extraActivityLog && o.extraActivityLog.length > 0) {
    merged.activityLog = [...o.extraActivityLog, ...period.activityLog].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp),
    );
  }
  if (o.rejectedAt && o.rejectedBy && o.rejectedReason) {
    merged.rejection = {
      rejectedAt: o.rejectedAt,
      rejectedBy: o.rejectedBy,
      rejectedReason: o.rejectedReason,
    };
  }
  return merged;
}

export function approvePeriod(periodKey: string, reason: string): void {
  const map = readMap();
  const now = new Date().toISOString();
  const existing = map[periodKey] ?? { extraActivityLog: [] };
  const newEntries: ActivityEntry[] = [
    {
      timestamp: new Date(Date.now() - 60_000).toISOString(),
      category: 'APPROVAL',
      description: reason ? `Approved by Manager: "${reason}"` : 'Approved by Manager',
      user: MANAGER_USER,
    },
    {
      timestamp: now,
      category: 'FINALIZE',
      description: `${periodKey} snapshot finalized`,
      user: MANAGER_USER,
    },
  ];
  map[periodKey] = {
    ...existing,
    status: 'Finalized',
    finalizedAt: now,
    finalizedBy: MANAGER_USER,
    finalizedReason: reason || undefined,
    unfinalizedAt: undefined,
    unfinalizedBy: undefined,
    unfinalizedReason: undefined,
    // Approve clears any prior rejection
    rejectedAt: undefined,
    rejectedBy: undefined,
    rejectedReason: undefined,
    extraActivityLog: [...existing.extraActivityLog, ...newEntries],
  };
  writeMap(map);
  appendActionLog({
    username: MANAGER_USER,
    userRole: 'MANAGER',
    category: 'APPROVAL',
    verb: 'APPROVE',
    targetType: 'period',
    targetLabel: periodKey,
    summary: reason ? `Approved & finalized — "${reason}"` : `Approved & finalized`,
  });
}

/** Manager rejects a Draft — period stays Draft with a rejection banner until Operator resubmits. */
export function rejectPeriod(periodKey: string, reason: string): void {
  const map = readMap();
  const now = new Date().toISOString();
  const existing = map[periodKey] ?? { extraActivityLog: [] };
  const newEntries: ActivityEntry[] = [
    {
      timestamp: now,
      category: 'APPROVAL',
      description: `Rejected by Manager: "${reason}"`,
      user: MANAGER_USER,
    },
  ];
  map[periodKey] = {
    ...existing,
    status: 'Draft',
    rejectedAt: now,
    rejectedBy: MANAGER_USER,
    rejectedReason: reason,
    extraActivityLog: [...existing.extraActivityLog, ...newEntries],
  };
  writeMap(map);
  appendActionLog({
    username: MANAGER_USER,
    userRole: 'MANAGER',
    category: 'APPROVAL',
    verb: 'REJECT',
    targetType: 'period',
    targetLabel: periodKey,
    summary: `Rejected — "${reason}"`,
  });
}

/** Operator resubmits a rejected Draft — clears rejection metadata. */
export function resubmitPeriod(periodKey: string): void {
  const map = readMap();
  const now = new Date().toISOString();
  const existing = map[periodKey];
  if (!existing) return;
  const newEntries: ActivityEntry[] = [
    {
      timestamp: now,
      category: 'UPLOAD',
      description: 'Resubmitted for Manager review',
      user: 'truc@socialbean.vn',
    },
  ];
  map[periodKey] = {
    ...existing,
    rejectedAt: undefined,
    rejectedBy: undefined,
    rejectedReason: undefined,
    extraActivityLog: [...existing.extraActivityLog, ...newEntries],
  };
  writeMap(map);
  appendActionLog({
    username: 'truc@socialbean.vn',
    userRole: 'OPERATOR',
    category: 'UPLOAD',
    verb: 'RESUBMIT',
    targetType: 'period',
    targetLabel: periodKey,
    summary: 'Resubmitted for Manager review after fixing rejection',
  });
}

/**
 * Operator updates Manual Input values for a Draft period. Caller already
 * checked the period is editable. Logs a single MANUAL_INPUT entry summarising
 * which fields changed.
 */
export function updateManualInputs(
  periodKey: string,
  baseInputs: Record<string, number>,
  nextInputs: Record<string, number>,
): { changedFields: string[] } {
  const map = readMap();
  const now = new Date().toISOString();
  const existing = map[periodKey] ?? { extraActivityLog: [] };

  const changedFields = Object.keys(nextInputs).filter(
    (k) => nextInputs[k] !== baseInputs[k],
  );

  const desc =
    changedFields.length === 0
      ? 'Manual Input saved (no changes)'
      : changedFields.length <= 3
        ? `Updated ${changedFields.length} manual input field${changedFields.length !== 1 ? 's' : ''}: ${changedFields.join(', ')}`
        : `Updated ${changedFields.length} manual input fields`;

  const newEntries: ActivityEntry[] = [
    {
      timestamp: now,
      category: 'MANUAL_INPUT',
      description: desc,
      user: 'truc@socialbean.vn',
    },
  ];

  map[periodKey] = {
    ...existing,
    manualInputs: nextInputs,
    extraActivityLog: [...existing.extraActivityLog, ...newEntries],
  };
  writeMap(map);

  if (changedFields.length > 0) {
    appendActionLog({
      username: 'truc@socialbean.vn',
      userRole: 'OPERATOR',
      category: 'MANUAL_INPUT',
      verb: 'UPDATE',
      targetType: 'period',
      targetLabel: periodKey,
      summary: desc,
      metadata: { changedFields, fieldCount: changedFields.length },
    });
  }

  return { changedFields };
}

/** Manager manually locks a Finalized period — closes it for good. */
export function lockPeriod(periodKey: string, reason: string): void {
  const map = readMap();
  const now = new Date().toISOString();
  const existing = map[periodKey] ?? { extraActivityLog: [] };
  const newEntries: ActivityEntry[] = [
    {
      timestamp: now,
      category: 'FINALIZE',
      description: reason ? `Manually locked by Manager: "${reason}"` : 'Manually locked by Manager',
      user: MANAGER_USER,
    },
  ];
  map[periodKey] = {
    ...existing,
    status: 'Locked',
    extraActivityLog: [...existing.extraActivityLog, ...newEntries],
  };
  writeMap(map);
  appendActionLog({
    username: MANAGER_USER,
    userRole: 'MANAGER',
    category: 'APPROVAL',
    verb: 'LOCK',
    targetType: 'period',
    targetLabel: periodKey,
    summary: reason ? `Manually locked — "${reason}"` : 'Manually locked',
  });
}

export function unfinalizePeriod(periodKey: string, reason: string): void {
  const map = readMap();
  const now = new Date().toISOString();
  const existing = map[periodKey] ?? { extraActivityLog: [] };
  const newEntries: ActivityEntry[] = [
    {
      timestamp: now,
      category: 'APPROVAL',
      description: `Unfinalized: "${reason}"`,
      user: MANAGER_USER,
    },
  ];
  map[periodKey] = {
    ...existing,
    status: 'Draft',
    finalizedAt: undefined,
    finalizedBy: undefined,
    finalizedReason: undefined,
    unfinalizedAt: now,
    unfinalizedBy: MANAGER_USER,
    unfinalizedReason: reason,
    extraActivityLog: [...existing.extraActivityLog, ...newEntries],
  };
  writeMap(map);
  appendActionLog({
    username: MANAGER_USER,
    userRole: 'MANAGER',
    category: 'APPROVAL',
    verb: 'UNFINALIZE',
    targetType: 'period',
    targetLabel: periodKey,
    summary: `Unfinalized — "${reason}"`,
  });
}

/**
 * Subscribe to override changes.
 *
 * To avoid SSR/client hydration mismatch, this hook always returns `-1` on the
 * first render (server + client hydration). Only AFTER mount does it start
 * returning the real tick — at which point consumers should also gate their
 * override logic via `mounted` (see `useEffectivePeriods` etc.).
 */
function useMountedTick(): { tick: number; mounted: boolean } {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const bump = () => setTick((t) => t + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) bump();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, bump);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANGE_EVENT, bump);
    };
  }, []);
  return { tick, mounted };
}

export function useStateTick(): number {
  return useMountedTick().tick;
}

/** Apply overrides to a list of periods, reactive to state changes. */
export function useEffectivePeriods(base: ArchivePeriod[]): EffectivePeriod[] {
  const { tick, mounted } = useMountedTick();
  return useMemo(
    () => (mounted ? base.map(applyOverride) : (base as EffectivePeriod[])),
    [base, tick, mounted],
  );
}

/** Apply override to a single period, reactive to state changes. */
export function useEffectivePeriod(base: ArchivePeriod): EffectivePeriod {
  const { tick, mounted } = useMountedTick();
  return useMemo(
    () => (mounted ? applyOverride(base) : (base as EffectivePeriod)),
    [base, tick, mounted],
  );
}

/**
 * Map from `periodLabel` (e.g. "W19", "Apr 2026") → effective PeriodStatus.
 * Used by Upload Step 1 + Week/Month pickers and Raw Archive list.
 *
 * Only returns entries for periods that have a localStorage override (set by
 * approvePeriod/unfinalizePeriod/lockPeriod). Mock seeds are NOT iterated, so
 * weeks/months with neither a DB snapshot nor an override show as "Open" in
 * the pickers (default). Real DB-backed periods that haven't been finalized
 * yet also show "Open" until a Manager finalizes them.
 */
export function useArchiveStatusByLabel(
  validPeriodKeys?: string[],
): Map<string, PeriodStatus> {
  const { tick, mounted } = useMountedTick();
  const keyFilter = validPeriodKeys?.join(',');
  return useMemo(() => {
    const m = new Map<string, PeriodStatus>();
    if (!mounted) return m;
    const overrides = readMap();
    // When a valid-key list is given (real DB-backed periods), every real key
    // gets an entry: explicit override if present, else 'Draft' (the "Active"
    // badge). Keys NOT in the list don't get an entry at all → picker shows
    // "Open" by default. This gives 3 distinct UI states across the pickers:
    //   - In list, no override  → "Active"  (data exists, not finalized)
    //   - In list, override     → that status (Finalized / Locked / etc.)
    //   - Not in list           → "Open"   (no data yet)
    if (validPeriodKeys) {
      for (const key of validPeriodKeys) {
        const ov = overrides[key];
        m.set(key, ov?.status ?? 'Draft');
      }
    } else {
      for (const [periodKey, ov] of Object.entries(overrides)) {
        if (ov?.status) m.set(periodKey, ov.status);
      }
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, mounted, keyFilter]);
}

/**
 * Number of real-archive periods currently pending Manager approval — i.e.
 * not yet Finalized or Locked. Server-rendered period keys are passed in
 * (Sidebar receives them from the dashboard layout). For each, we apply any
 * localStorage override:
 *   - override.status === 'Finalized' / 'Locked' → excluded from pending
 *   - any other override OR no override → still pending (Draft/Active)
 */
export function usePendingApprovalCount(realPeriodKeys: string[]): number {
  const { tick, mounted } = useMountedTick();
  return useMemo(() => {
    if (!mounted || realPeriodKeys.length === 0) return 0;
    const overrides = readMap();
    let n = 0;
    for (const key of realPeriodKeys) {
      const ov = overrides[key];
      if (ov?.status === 'Finalized' || ov?.status === 'Locked') continue;
      n++;
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, mounted, realPeriodKeys.join(',')]);
}

/** @deprecated Use `usePendingApprovalCount(realPeriodKeys)` instead. */
export function useDraftCount(): number {
  const { tick, mounted } = useMountedTick();
  return useMemo(() => {
    if (!mounted) return 0;
    const overrides = readMap();
    let n = 0;
    for (const ov of Object.values(overrides)) {
      if (ov?.status === 'Draft') n++;
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, mounted]);
}
