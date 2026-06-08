'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Persist arbitrary form state to localStorage so users can resume an
 * unfinished form across navigation, reloads, or tab switches.
 *
 * Design:
 *   - Hook is decoupled from form library — caller provides `values` and we
 *     auto-save on change (debounced 500ms to skip the keystroke storm).
 *   - On mount we read once and expose `draft` (the previously-saved snapshot
 *     plus its age). Caller decides whether to show a "restore?" banner.
 *   - Caller may pass `label` (human-friendly title like "Sửa TR-1042") which
 *     is saved alongside values so the sidebar enumerator can render it.
 *   - Drafts expire after 7 days to avoid hoarding stale data.
 *   - Saves dispatch a `ccms-drafts-changed` window event so the sidebar
 *     enumerator updates in the same tab too (storage event only fires for
 *     OTHER tabs). Cross-tab sync still works via the native storage event.
 *   - Storage failures (quota, private mode) are swallowed silently.
 */

interface UseFormDraftOptions<T> {
  /** Stable storage key — typically `entity:mode` or `entity:edit:id`. */
  key: string;
  /** Current values to auto-save. Pass the same object every render. */
  values: T;
  /**
   * Two-part label for the sidebar:
   *   - `primary`: action verb ("Đang đặt chuyến", "Đang sửa TR-1042")
   *   - `secondary`: content snippet ("Quận 1 → Sân bay TSN")
   * Re-evaluated each save so it reflects whatever the user has typed.
   */
  label?: DraftLabel;
  /** Optional URL to navigate to when the user clicks this draft in the sidebar. */
  href?: string;
  /** Entity category — drives the sidebar icon + grouping. */
  entity?: 'trip' | 'vehicle' | 'driver' | 'expense';
  /**
   * Disable save on first mount until caller has hydrated initial state.
   * Otherwise the empty initial state would overwrite a real draft.
   */
  enabled?: boolean;
  /**
   * Only save the draft when the form is "dirty" (user has made at least one change).
   * Default `false` — caller must explicitly set `true` after detecting user input.
   * This prevents drafts from being created just by opening a form without editing.
   */
  isDirty?: boolean;
  /** Max age before a draft is considered stale. Default 7 days. */
  maxAgeMs?: number;
}

export interface DraftLabel {
  /** Action-oriented headline. Required when label is present. */
  primary: string;
  /** Content snippet — user's own input. Helps them remember which one this was. */
  secondary?: string;
}

export interface DraftMetadata {
  label?: DraftLabel;
  href?: string;
  entity?: 'trip' | 'vehicle' | 'driver' | 'expense';
}

interface DraftSnapshot<T> {
  values: T;
  /** ms since the draft was last saved. */
  ageMs: number;
  /** Wall-clock save time (Unix ms). */
  savedAt: number;
}

interface UseFormDraftResult<T> {
  /** The previously-saved snapshot, or null if none / expired. Read once on mount. */
  draft: DraftSnapshot<T> | null;
  /** Manually clear the stored draft (call after successful submit). */
  clearDraft: () => void;
  /**
   * Acknowledge that the user has decided what to do with the draft. Call
   * this after applying or discarding it so the banner doesn't reappear.
   */
  dismissDraft: () => void;
}

export const DRAFTS_CHANGED_EVENT = 'ccms-drafts-changed';
export const STORAGE_PREFIX = 'ccms-draft:';
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 500;

function notifyDraftsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DRAFTS_CHANGED_EVENT));
}

export function useFormDraft<T>({
  key,
  values,
  label,
  href,
  entity,
  enabled = true,
  isDirty = false,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
}: UseFormDraftOptions<T>): UseFormDraftResult<T> {
  const storageKey = STORAGE_PREFIX + key;

  /* Load draft once on mount. Subsequent changes to `values` don't trigger
   * re-read — we want a stable "draft from before this session" snapshot. */
  const [draft, setDraft] = useState<DraftSnapshot<T> | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { values: T; savedAt: number };
      const age = Date.now() - parsed.savedAt;
      if (age > maxAgeMs) {
        window.localStorage.removeItem(storageKey);
        notifyDraftsChanged();
        return null;
      }
      return { values: parsed.values, ageMs: age, savedAt: parsed.savedAt };
    } catch {
      return null;
    }
  });

  /* Track the latest values + metadata via refs so the save effect doesn't
   * fire on every label/href change — only on actual value changes. */
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const labelRef = useRef(label);
  labelRef.current = label;
  const hrefRef = useRef(href);
  hrefRef.current = href;
  const entityRef = useRef(entity);
  entityRef.current = entity;

  useEffect(() => {
    /* Only save if:
     *   - enabled (form is ready)
     *   - isDirty (user has actually changed at least one field)
     * This prevents drafts from being created just by opening a form. */
    if (!enabled || !isDirty || typeof window === 'undefined') return;
    const timer = setTimeout(() => {
      try {
        const payload = JSON.stringify({
          values: valuesRef.current,
          savedAt: Date.now(),
          label: labelRef.current,
          href: hrefRef.current,
          entity: entityRef.current,
        });
        window.localStorage.setItem(storageKey, payload);
        notifyDraftsChanged();
      } catch {
        /* Quota exceeded / private mode — silently ignore. */
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    /* Re-run save whenever the serialized value changes or dirty state changes.
     * JSON.stringify gives a cheap stable shallow signature for object inputs. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, enabled, isDirty, JSON.stringify(values)]);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(storageKey);
      notifyDraftsChanged();
    } catch {
      /* swallow */
    }
    setDraft(null);
  }, [storageKey]);

  const dismissDraft = useCallback(() => {
    /* Don't remove from storage — just hide the banner. If user keeps typing,
     * the auto-save replaces it anyway. */
    setDraft(null);
  }, []);

  return { draft, clearDraft, dismissDraft };
}
