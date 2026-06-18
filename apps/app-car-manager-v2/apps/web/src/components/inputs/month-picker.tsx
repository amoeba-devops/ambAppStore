'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@car-v2/ui';

/** Month (`<input type="month">`) that reflects its value into a URL search
 * param so server pages can read the selected month from searchParams. */
export function MonthPicker({ value, paramName = 'month' }: { value: string; paramName?: string }) {
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

  return <Input type="month" value={value} onChange={onChange} className="w-44" />;
}
