'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2 } from 'lucide-react';
import { Input, toast } from '@car-v2/ui';
import { updateTenantNameAction } from '@/server/actions/settings/tenant-settings.actions';

interface TenantNameInputProps {
  defaultValue: string | null;
  /* Read-only mode for Manager/Driver — input disabled, no save side effect. */
  disabled?: boolean;
}

const DEBOUNCE_MS = 500;

/* Text input that auto-saves after 500ms of typing pause.
 *
 * Lifecycle:
 *   - onChange updates local state immediately (responsive feel)
 *   - clears any pending save timer, schedules a new one at +500ms
 *   - timer fires → server action → toast `Saved` (or revert on error)
 *
 * If the user types again before the timer fires, we just reset it — no
 * action is sent for intermediate keystrokes. This keeps audit log volume
 * sane while still giving "save on pause" UX.
 */
export function TenantNameInput({ defaultValue, disabled }: TenantNameInputProps) {
  const tStatus = useTranslations('settings.saveStatus');
  const [value, setValue] = useState(defaultValue ?? '');
  /* Last value successfully persisted to the server. We compare against this
   * inside the timer to skip no-op saves (e.g. user types then backspaces
   * back to the original). */
  const persistedRef = useRef(defaultValue ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const scheduleSave = (next: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (next === persistedRef.current) return; // no-op
      startTransition(async () => {
        const result = await updateTenantNameAction({
          tenant_name: next === '' ? null : next,
        });
        if (result.success) {
          persistedRef.current = next;
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 1500);
        } else {
          toast.error(tStatus('error', { message: result.error.message }));
        }
      });
    }, DEBOUNCE_MS);
  };

  return (
    <Input
      value={value}
      disabled={disabled}
      maxLength={120}
      onChange={(e) => {
        setValue(e.target.value);
        scheduleSave(e.target.value);
      }}
      iconRight={
        pending ? (
          <Loader2 className="animate-spin" aria-label={tStatus('saving')} />
        ) : savedFlash ? (
          <Check className="text-success" aria-label={tStatus('saved')} />
        ) : undefined
      }
    />
  );
}
