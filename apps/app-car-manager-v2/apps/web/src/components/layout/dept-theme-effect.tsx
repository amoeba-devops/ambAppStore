'use client';

import { useEffect } from 'react';
import type { FleetDept } from './nav-items';

/**
 * Toggles `data-dept` on <html> for the duration that a truck-workspace page is
 * mounted, so the scoped `:root[data-dept='truck']` accent override in
 * tokens.css applies app-wide (sidebar + content) while in the truck workspace.
 * Cleans up on unmount → car workspace reverts to the default blue accent.
 */
export function DeptThemeEffect({ dept }: { dept: FleetDept }) {
  useEffect(() => {
    const root = document.documentElement;
    if (dept === 'TRUCK') {
      root.dataset.dept = 'truck';
    } else {
      delete root.dataset.dept;
    }
    return () => {
      delete root.dataset.dept;
    };
  }, [dept]);
  return null;
}
