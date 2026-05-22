'use client';

import { useCallback, useEffect, useState } from 'react';
import { DRAFTS_CHANGED_EVENT, STORAGE_PREFIX, type DraftLabel } from './use-form-draft';

/**
 * Enumerate every draft currently in localStorage. Sidebar uses this to surface
 * unfinished work so users can resume a session with one click.
 *
 * Stays in sync with:
 *   - native `storage` event (other tabs writing to localStorage)
 *   - custom `ccms-drafts-changed` (same tab — useFormDraft fires on save/clear)
 *
 * Items expire by the same 7-day rule as useFormDraft — we just don't surface
 * stale ones. Active cleanup happens lazily when those keys are next accessed.
 */

export interface DraftEntry {
  /** Storage key WITHOUT the `ccms-draft:` prefix — useful as React key. */
  key: string;
  /** "trip:edit:abc-123" → ("trip", "edit", "abc-123"). Best-effort parse. */
  entity: 'trip' | 'vehicle' | 'driver' | 'expense' | 'unknown';
  mode: 'new' | 'edit' | 'unknown';
  /** Entity ID for edit mode, null otherwise. */
  entityId: string | null;
  /** Structured label from the form: action + content snippet. */
  label: DraftLabel | null;
  /** Target URL to navigate to on click. */
  href: string | null;
  /** Unix ms when the draft was last saved. */
  savedAt: number;
}

const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readAllDrafts(maxAgeMs: number): DraftEntry[] {
  if (typeof window === 'undefined') return [];
  const out: DraftEntry[] = [];
  const now = Date.now();
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const fullKey = window.localStorage.key(i);
      if (!fullKey || !fullKey.startsWith(STORAGE_PREFIX)) continue;
      const key = fullKey.slice(STORAGE_PREFIX.length);
      const raw = window.localStorage.getItem(fullKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as {
          savedAt?: number;
          label?: DraftLabel;
          href?: string;
          entity?: 'trip' | 'vehicle' | 'driver' | 'expense';
        };
        if (!parsed.savedAt || now - parsed.savedAt > maxAgeMs) continue;
        const [, modeRaw, idRaw] = key.split(':');
        const mode: DraftEntry['mode'] =
          modeRaw === 'new' || modeRaw === 'edit' ? modeRaw : 'unknown';
        out.push({
          key,
          entity: parsed.entity ?? inferEntityFromKey(key),
          mode,
          entityId: mode === 'edit' && idRaw ? idRaw : null,
          label: parsed.label ?? null,
          href: parsed.href ?? null,
          savedAt: parsed.savedAt,
        });
      } catch {
        /* Corrupt JSON — skip. */
      }
    }
  } catch {
    /* localStorage access blocked (private mode, no quota) — return what we have. */
  }
  /* Newest first. */
  out.sort((a, b) => b.savedAt - a.savedAt);
  return out;
}

function inferEntityFromKey(key: string): DraftEntry['entity'] {
  const head = key.split(':')[0];
  if (head === 'trip' || head === 'vehicle' || head === 'driver' || head === 'expense') return head;
  return 'unknown';
}

export function useAllDrafts(maxAgeMs: number = DEFAULT_MAX_AGE_MS): {
  drafts: DraftEntry[];
  /** Drop a single draft by storage key (without the prefix). */
  removeDraft: (key: string) => void;
} {
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);

  const refresh = useCallback(() => {
    setDrafts(readAllDrafts(maxAgeMs));
  }, [maxAgeMs]);

  useEffect(() => {
    refresh();
    if (typeof window === 'undefined') return;
    /* Cross-tab via native event. */
    const onStorage = (e: StorageEvent) => {
      if (e.key && !e.key.startsWith(STORAGE_PREFIX)) return;
      refresh();
    };
    /* Same-tab via custom event. */
    const onCustom = () => refresh();
    window.addEventListener('storage', onStorage);
    window.addEventListener(DRAFTS_CHANGED_EVENT, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(DRAFTS_CHANGED_EVENT, onCustom);
    };
  }, [refresh]);

  const removeDraft = useCallback(
    (key: string) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.removeItem(STORAGE_PREFIX + key);
        window.dispatchEvent(new CustomEvent(DRAFTS_CHANGED_EVENT));
      } catch {
        /* swallow */
      }
      refresh();
    },
    [refresh],
  );

  return { drafts, removeDraft };
}
