'use client';

import { useEffect, useRef } from 'react';
import { markTruckReportsSeenAction } from '@/server/actions/truck-report.actions';

/** Fire-and-forget: stamp the viewer's "reports seen" mark once on mount so the
 * nav "Mới" badge clears on the next render. Renders nothing. */
export function MarkReportsSeen() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markTruckReportsSeenAction();
  }, []);
  return null;
}
