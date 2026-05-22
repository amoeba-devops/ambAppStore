'use client';

/**
 * Window-level event used to broadcast push-subscription state changes
 * across the multiple consumers that all hold their own local state
 * (PushPromptStrip, PushToggle, MePushCard).
 *
 * Whenever any surface flips the user from idle→subscribed or back, fire
 * `dispatchPushStateChanged()` so listeners (mounted hook instances) can
 * re-detect the browser's PushSubscription and update their state. This
 * fixes the bug where the header banner kept advertising "Enable" forever
 * after the user enabled push elsewhere — AppShellClient never unmounts in
 * App Router so the hook's mount-time check ran only once at first load.
 *
 * Single-process scope is sufficient (no BroadcastChannel) because every
 * surface lives inside the same browser tab; cross-tab sync would only
 * matter for unusual workflows (open Settings in tab B, expect strip in
 * tab A to update) and adds enough complexity to defer.
 */
export const PUSH_STATE_EVENT = 'fleet:push-state-changed';

export function dispatchPushStateChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PUSH_STATE_EVENT));
}
