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
import { updateTimezoneAction } from '@/server/actions/settings/tenant-settings.actions';

interface TimezoneSelectProps {
  defaultValue: string;
  disabled?: boolean;
}

/* Allowlist must match the service-layer TIMEZONE_ALLOWLIST. */
const OPTIONS = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul' },
] as const;

export function TimezoneSelect({ defaultValue, disabled }: TimezoneSelectProps) {
  const tStatus = useTranslations('settings.saveStatus');
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();

  const handle = (next: string) => {
    if (next === value) return;
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await updateTimezoneAction({ timezone: next });
      if (result.success) {
        toast.success(tStatus('saved'));
      } else {
        setValue(previous);
        toast.error(tStatus('error', { message: result.error.message }));
      }
    });
  };

  return (
    <Select value={value} onValueChange={handle} disabled={disabled || pending}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
