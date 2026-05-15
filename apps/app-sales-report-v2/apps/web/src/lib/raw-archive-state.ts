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
 * Map from `periodLabel` (e.g. "W13", "Apr 2026") → effective PeriodStatus.
 * Used by Upload Step 1 to flag/disable Locked or Finalized periods.
 */
export function useArchiveStatusByLabel(): Map<string, PeriodStatus> {
  const { tick, mounted } = useMountedTick();
  return useMemo(() => {
    const m = new Map<string, PeriodStatus>();
    if (!mounted) return m;
    for (const base of getAllArchivePeriods()) {
      const eff = applyOverride(base);
      m.set(eff.label, eff.status);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, mounted]);
}

/** Count of periods currently in Draft status (pending Manager approval). */
export function useDraftCount(): number {
  const { tick, mounted } = useMountedTick();
  return useMemo(() => {
    if (!mounted) return 0;
    const periods = getAllArchivePeriods().map(applyOverride);
    return periods.filter((p) => p.status === 'Draft').length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, mounted]);
}
