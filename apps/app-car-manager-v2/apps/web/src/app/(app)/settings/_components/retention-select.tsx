'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@car-v2/ui';
import { updateRetentionAction } from '@/server/actions/settings/tenant-settings.actions';
import { formatActionError } from '@/lib/format-action-error';

interface RetentionSelectProps {
  field: 'trip' | 'audit';
  /* For audit, NULL = indefinite. For trip, always a number. */
  defaultValue: number | null;
  /* Pre-resolved {value, label} pairs from server using i18n.
   * Encoded value: stringified number, or empty string for indefinite. */
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
}

const VALUE_INDEFINITE = '__indefinite__';

function encode(years: number | null): string {
  return years === null ? VALUE_INDEFINITE : String(years);
}

function decode(s: string): number | null {
  return s === VALUE_INDEFINITE ? null : Number(s);
}

export function RetentionSelect({ field, defaultValue, options, disabled }: RetentionSelectProps) {
  const tStatus = useTranslations('settings.saveStatus');
  const tErr = useTranslations();
  const [value, setValue] = useState<string>(encode(defaultValue));
  const [pending, startTransition] = useTransition();

  const handle = (next: string) => {
    if (next === value) return;
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await updateRetentionAction({ field, years: decode(next) });
      if (result.success) {
        toast.success(tStatus('saved'));
      } else {
        setValue(previous);
        toast.error(tStatus('error', { message: formatActionError(result.error, tErr) }));
      }
    });
  };

  return (
    <Select value={value} onValueChange={handle} disabled={disabled || pending}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
