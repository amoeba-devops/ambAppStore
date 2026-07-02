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
    /* Only undo what we added — avoids a flash in React Strict Mode's
     * double-invoke where cleanup fires before the re-mount effect. */
    return () => {
      if (dept === 'TRUCK') delete root.dataset.dept;
    };
  }, [dept]);
  return null;
}
