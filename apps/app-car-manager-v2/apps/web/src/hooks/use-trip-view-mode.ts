'use client';

import { useEffect, useState } from 'react';

/** Session-scoped (not localStorage) so a fresh browser session re-defaults to
 * Kanban — the product's chosen primary view. Shared across all trip surfaces
 * (`/trips`, driver detail, vehicle detail) so a user's pick feels consistent. */
export const TRIP_VIEW_KEY = 'ccms.tripView';

export type TripViewMode = 'kanban' | 'list';

function readStored(): TripViewMode | null {
  try {
    const v = sessionStorage.getItem(TRIP_VIEW_KEY);
    return v === 'kanban' || v === 'list' ? v : null;
  } catch {
    return null;
  }
}

export function storeTripViewMode(mode: TripViewMode): void {
  try {
    sessionStorage.setItem(TRIP_VIEW_KEY, mode);
  } catch {
    /* private mode / disabled storage — ignore, falls back to default */
  }
}

/**
 * Client-only view-mode toggle backed by sessionStorage. Defaults to `'kanban'`.
 *
 * Used by the driver/vehicle detail pages where both renderings share an
 * already-loaded trip array (no server refetch needed). The main `/trips` page
 * uses a URL param instead (server has to fetch different shapes) but writes the
 * same session key so the preference carries across.
 */
export function useTripViewMode(): [TripViewMode, (m: TripViewMode) => void] {
  const [mode, setMode] = useState<TripViewMode>('kanban');

  useEffect(() => {
    const stored = readStored();
    if (stored) setMode(stored);
  }, []);

  const update = (m: TripViewMode) => {
    setMode(m);
    storeTripViewMode(m);
  };

  return [mode, update];
}
