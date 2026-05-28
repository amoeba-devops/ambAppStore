'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2 } from 'lucide-react';
import { Input, toast } from '@car-v2/ui';
import { useTenantDisplay } from '@/components/layout/tenant-display-context';
import { updateAppNameAction } from '@/server/actions/settings/tenant-settings.actions';
import { formatActionError } from '@/lib/format-action-error';

interface AppNameInputProps {
  defaultValue: string | null;
  /* Read-only mode for Manager/Driver — input disabled, no save side effect. */
  disabled?: boolean;
}

const DEBOUNCE_MS = 500;

/* Mirrors TenantNameInput's debounced-auto-save UX for the app-name field.
 * Every keystroke updates the shared brand-display context so the sidebar
 * top line reflects edits in real time; the server save still waits for a
 * 500 ms idle window before firing. On failure we roll the context back to
 * the last persisted value so it never drifts from the DB. */
export function AppNameInput({ defaultValue, disabled }: AppNameInputProps) {
  const tStatus = useTranslations('settings.saveStatus');
  const tErr = useTranslations();
  const { setAppName: setDisplayAppName } = useTenantDisplay();
  const [value, setValue] = useState(defaultValue ?? '');
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
      if (next === persistedRef.current) return;
      startTransition(async () => {
        const result = await updateAppNameAction({
          app_name: next === '' ? null : next,
        });
        if (result.success) {
          persistedRef.current = next;
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 1500);
        } else {
          setDisplayAppName(persistedRef.current === '' ? null : persistedRef.current);
          toast.error(tStatus('error', { message: formatActionError(result.error, tErr) }));
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
        const next = e.target.value;
        setValue(next);
        setDisplayAppName(next);
        scheduleSave(next);
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
