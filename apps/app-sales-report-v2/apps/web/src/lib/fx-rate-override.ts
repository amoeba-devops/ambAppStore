'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'firgi-fx-rate-override';
const SAME_TAB_EVENT = 'firgi:fx-rate-override-change';

function readOverride(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeOverride(value: number | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value == null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, value.toString());
    }
    // localStorage `storage` event only fires on OTHER tabs — dispatch a
    // custom event so other components in THIS tab also re-read.
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT));
  } catch {
    /* ignore quota / privacy errors */
  }
}

/**
 * Client-side, cross-page FX rate override. Lets the user temporarily
 * override the DB-backed VND-per-KRW rate on any RFR Data page for
 * what-if exploration ("tham khảo thôi"). Changes sync across all open
 * RFR pages via:
 *   - localStorage  (persists across reloads, syncs across tabs)
 *   - custom event  (syncs within the same tab)
 *
 * Returns the EFFECTIVE rate (override if set, else `dbRate` from the
 * server prop) plus setters to override or reset.
 */
export function useFxRateOverride(dbRate: number): {
  rate: number;
  override: number | null;
  setOverride: (value: number | null) => void;
  reset: () => void;
} {
  const [override, setOverrideState] = useState<number | null>(() => readOverride());

  useEffect(() => {
    // Initial sync — readOverride() may have been '0' on first render in
    // SSR-streamed page where localStorage wasn't available yet.
    setOverrideState(readOverride());

    const onChange = () => setOverrideState(readOverride());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) onChange();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(SAME_TAB_EVENT, onChange as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SAME_TAB_EVENT, onChange as EventListener);
    };
  }, []);

  const setOverride = useCallback((value: number | null) => {
    writeOverride(value);
    setOverrideState(value);
  }, []);

  const reset = useCallback(() => setOverride(null), [setOverride]);

  return {
    rate: override ?? dbRate,
    override,
    setOverride,
    reset,
  };
}
