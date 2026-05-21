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
import type { CarCurrency } from '@car-v2/db/schema';
import { updateCurrencyAction } from '@/server/actions/settings/tenant-settings.actions';

interface CurrencySelectProps {
  defaultValue: CarCurrency;
  disabled?: boolean;
}

const OPTIONS: ReadonlyArray<{ value: CarCurrency; label: string }> = [
  { value: 'VND', label: 'VND · ₫' },
  { value: 'KRW', label: 'KRW · ₩' },
  { value: 'USD', label: 'USD · $' },
];

export function CurrencySelect({ defaultValue, disabled }: CurrencySelectProps) {
  const tStatus = useTranslations('settings.saveStatus');
  const [value, setValue] = useState<CarCurrency>(defaultValue);
  const [pending, startTransition] = useTransition();

  const handle = (next: string) => {
    const nextCurrency = next as CarCurrency;
    if (nextCurrency === value) return;
    const previous = value;
    setValue(nextCurrency); // optimistic
    startTransition(async () => {
      const result = await updateCurrencyAction({ currency: nextCurrency });
      if (result.success) {
        toast.success(tStatus('saved'));
      } else {
        setValue(previous); // revert
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
