// @vitest-environment jsdom

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFxRateOverride } from './fx-rate-override';

const STORAGE_KEY = 'firgi-fx-rate-override';
const DEFAULT_RATE = 17.543;

describe('useFxRateOverride', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns the DB-default rate when no override is stored', () => {
    const { result } = renderHook(() => useFxRateOverride(DEFAULT_RATE));
    expect(result.current.rate).toBe(DEFAULT_RATE);
    expect(result.current.override).toBeNull();
  });

  it('returns a previously-stored override on first render', () => {
    window.localStorage.setItem(STORAGE_KEY, '20.0');
    const { result } = renderHook(() => useFxRateOverride(DEFAULT_RATE));
    expect(result.current.rate).toBe(20);
    expect(result.current.override).toBe(20);
  });

  it('setOverride updates rate + persists to localStorage', () => {
    const { result } = renderHook(() => useFxRateOverride(DEFAULT_RATE));
    act(() => result.current.setOverride(18.0));
    expect(result.current.rate).toBe(18);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('18');
  });

  it('reset() clears the override and reverts to DB default', () => {
    window.localStorage.setItem(STORAGE_KEY, '20.0');
    const { result } = renderHook(() => useFxRateOverride(DEFAULT_RATE));
    expect(result.current.rate).toBe(20);
    act(() => result.current.reset());
    expect(result.current.override).toBeNull();
    expect(result.current.rate).toBe(DEFAULT_RATE);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('rejects non-positive override values silently (stays at default)', () => {
    window.localStorage.setItem(STORAGE_KEY, '0');
    const { result } = renderHook(() => useFxRateOverride(DEFAULT_RATE));
    // 0 is invalid per `readOverride` (`> 0` check) → falls through to default.
    expect(result.current.rate).toBe(DEFAULT_RATE);
  });

  it('rejects garbage localStorage values silently', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-a-number');
    const { result } = renderHook(() => useFxRateOverride(DEFAULT_RATE));
    expect(result.current.rate).toBe(DEFAULT_RATE);
  });

  it('syncs across two consumer instances in same tab via custom event', () => {
    // Two components on the same page both subscribe — when one changes
    // the rate, the other re-renders with the new value.
    const a = renderHook(() => useFxRateOverride(DEFAULT_RATE));
    const b = renderHook(() => useFxRateOverride(DEFAULT_RATE));
    expect(a.result.current.rate).toBe(DEFAULT_RATE);
    expect(b.result.current.rate).toBe(DEFAULT_RATE);
    act(() => a.result.current.setOverride(19.0));
    expect(a.result.current.rate).toBe(19);
    expect(b.result.current.rate).toBe(19);
  });
});
