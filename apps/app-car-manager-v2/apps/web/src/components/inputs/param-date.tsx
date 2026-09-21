'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@car-v2/ui';

/** Day (`<input type="date">`) that reflects its value into a URL search
 * param — sibling of `MonthPicker` for screens that filter by an arbitrary
 * date range rather than a whole month (REQ-20260921). */
export function ParamDate({ value, paramName }: { value?: string; paramName: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const sp = useSearchParams();

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (e.target.value) params.set(paramName, e.target.value);
    else params.delete(paramName);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return <Input type="date" value={value ?? ''} onChange={onChange} className="w-40 rounded-md" />;
}
