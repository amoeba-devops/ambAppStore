'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

/** Plate + status dropdowns for the trip log (design filter bar). URL-driven
 * (`?vehicle=`, `?status=`) so the server re-queries; preserves other params. */
export function TripFilters({
  plates,
  vehicle,
  status,
}: {
  plates: { id: string; label: string }[];
  vehicle?: string;
  status?: string;
}) {
  const t = useTranslations('screens.truckTrips');
  const router = useRouter();
  const pathname = usePathname() ?? '/truck/trips';
  const sp = useSearchParams();

  const setParam = (key: string, val: string) => {
    const params = new URLSearchParams(sp?.toString());
    if (val) params.set(key, val);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  const cls =
    'h-11 md:h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text focus-visible:outline-none focus-visible:border-accent';

  return (
    <>
      <select
        className={cls}
        value={vehicle ?? 'all'}
        onChange={(e) => setParam('vehicle', e.target.value === 'all' ? '' : e.target.value)}
      >
        <option value="all">{t('allVehicles')}</option>
        {plates.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <select
        className={cls}
        value={status ?? 'all'}
        onChange={(e) => setParam('status', e.target.value === 'all' ? '' : e.target.value)}
      >
        <option value="all">{t('allStatus')}</option>
        <option value="ongoing">{t('statusOpen')}</option>
        <option value="complete">{t('statusDone')}</option>
      </select>
    </>
  );
}
