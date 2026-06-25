'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Switch, toast } from '@car-v2/ui';
import { updateNotifPrefAction } from '@/server/actions/settings/tenant-settings.actions';
import { formatActionError } from '@/lib/format-action-error';

type NotifField = 'inapp' | 'email' | 'digest';

interface NotifPrefToggleProps {
  field: NotifField;
  title: string;
  description: string;
  defaultChecked: boolean;
  disabled?: boolean;
}

/* Single-row Switch wrapper with optimistic update + revert-on-error.
 *
 * One action call per toggle — no batching. That keeps the audit log entry
 * per-field which is what an admin reviewing the log later actually wants.
 */
export function NotifPrefToggle({
  field,
  title,
  description,
  defaultChecked,
  disabled,
}: NotifPrefToggleProps) {
  const tStatus = useTranslations('settings.saveStatus');
  const tErr = useTranslations();
  const [checked, setChecked] = useState(defaultChecked);
  const [pending, startTransition] = useTransition();

  const handle = (next: boolean) => {
    const previous = checked;
    setChecked(next);
    startTransition(async () => {
      const result = await updateNotifPrefAction({ field, value: next });
      if (result.success) {
        toast.success(tStatus('saved'));
      } else {
        setChecked(previous);
        toast.error(tStatus('error', { message: formatActionError(result.error, tErr) }));
      }
    });
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{title}</div>
        <div className="text-xs text-text-muted mt-0.5">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={handle} disabled={disabled || pending} />
    </div>
  );
}
