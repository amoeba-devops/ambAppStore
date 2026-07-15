'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * URL-param-driven native <select> for SSR list filters (QA P2 — Khu vực /
 * Phương tiện / Trạng thái dropdowns on the truck rosters). Picking an option
 * sets `?{param}=value` (empty/all clears it) and preserves the other params so
 * the server re-queries. Same visual style as TripFilters' selects.
 */
export function ParamSelect({
  param,
  value,
  options,
  allLabel,
}: {
  param: string;
  value?: string;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const sp = useSearchParams();

  const onChange = (val: string) => {
    const params = new URLSearchParams(sp?.toString());
    if (val && val !== 'all') params.set(param, val);
    else params.delete(param);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <select
      className="h-11 md:h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text focus-visible:outline-none focus-visible:border-accent"
      value={value ?? 'all'}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="all">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
