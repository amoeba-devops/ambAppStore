'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@car-v2/ui';
import { setLocaleAction } from '@/server/actions/locale/locale.actions';

const OPTIONS = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
  { value: 'ko', label: '한국어' },
] as const;

export function LocaleSelect() {
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleChange = (next: string) => {
    if (next === current) return;
    startTransition(async () => {
      const res = await setLocaleAction(next);
      if (res.success) router.refresh();
    });
  };

  return (
    <Select value={current} onValueChange={handleChange} disabled={pending}>
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
