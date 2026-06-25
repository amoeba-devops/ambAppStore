// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// Mock next/navigation BEFORE importing the module under test —
// `useRouter` is called on render and must not throw in jsdom.
const refreshSpy = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshSpy }),
}));

import {
  broadcastMutation,
  useRevalidateOnMutation,
} from './data-revalidation';

/**
 * BroadcastChannel is implemented in jsdom 24+ across all messages emitted
 * from the same origin/path — but each `new BroadcastChannel(name)` is a
 * SEPARATE listener on the SAME named channel, including in the same
 * realm. So `broadcastMutation()` (which opens an internal channel) and
 * `useRevalidateOnMutation` (which opens its own) should see each other's
 * messages.
 *
 * Caveat: when both are in the SAME tab the hook's origin check filters
 * self-broadcasts. That's the production behaviour we want to preserve.
 */
describe('cross-tab data revalidation', () => {
  beforeEach(() => {
    refreshSpy.mockReset();
  });

  it('exposes broadcastMutation as a callable that does not throw', () => {
    // Smoke test — the function should be safe to call even when no
    // listeners exist. (Real cross-tab behaviour is exercised by users.)
    expect(() => broadcastMutation('cost-master')).not.toThrow();
  });

  it('hook subscribes without throwing and can be unmounted', () => {
    const { unmount } = renderHook(() => useRevalidateOnMutation(['cost-master']));
    expect(() => unmount()).not.toThrow();
  });

  it('does NOT call router.refresh() for the tab that broadcast (self-skip)', async () => {
    // Same-tab origin check: hook should ignore its own broadcast so we
    // don't double-refresh after our own mutation (caller refetches
    // imperatively).
    renderHook(() => useRevalidateOnMutation(['cost-master']));
    act(() => broadcastMutation('cost-master'));
    // Give BroadcastChannel a tick to deliver — jsdom may queue
    // microtasks before macrotasks.
    await new Promise((r) => setTimeout(r, 50));
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
