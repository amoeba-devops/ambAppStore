'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TripViewSwitch } from './trip-view-switch';
import { storeTripViewMode, TRIP_VIEW_KEY, type TripViewMode } from '@/hooks/use-trip-view-mode';

/**
 * View switch for the main `/trips` page. Unlike the detail pages (which toggle
 * a single client-held array), the list page must refetch a different shape per
 * view, so the choice lives in the URL (`?view=list`; Kanban is the no-param
 * default). We still mirror it into sessionStorage so the preference carries to
 * the driver/vehicle detail boards — and, on a fresh landing with no `?view`,
 * re-apply a remembered `list` preference.
 */
export function TripsViewControl({ current }: { current: TripViewMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    if (sp.has('view')) return;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(TRIP_VIEW_KEY);
    } catch {
      /* ignore */
    }
    if (stored === 'list') {
      const next = new URLSearchParams(sp.toString());
      next.set('view', 'list');
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
    // run once on mount — subsequent changes go through onChange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (mode: TripViewMode) => {
    storeTripViewMode(mode);
    const next = new URLSearchParams(sp.toString());
    if (mode === 'kanban') {
      next.delete('view');
      /* Kanban renders every status as its own column, so the list's
       * status-bucket filter is meaningless here — drop it to keep the URL
       * honest and the export aligned with what the board shows. */
      next.delete('status');
    } else {
      next.set('view', mode);
    }
    /* Pagination is a list-only concept; drop it so switching back to Kanban
     * (or to a fresh list) doesn't carry a stale page offset. */
    next.delete('page');
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return <TripViewSwitch value={current} onChange={onChange} />;
}
