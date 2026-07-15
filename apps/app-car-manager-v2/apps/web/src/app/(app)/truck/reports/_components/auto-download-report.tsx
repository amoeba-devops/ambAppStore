'use client';

import { useEffect, useRef } from 'react';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * After the "Lập báo cáo" wizard lands on the report list with `?dl=<reportId>`,
 * download that just-generated file once, then strip the param so a manual
 * refresh doesn't re-trigger it. Uses the same `/download` href as the manual
 * buttons (302 → presigned S3 attachment), so it downloads without navigating
 * away from the list. Renders nothing — mirrors MarkReportsSeen.
 */
export function AutoDownloadReport({ reportId }: { reportId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const a = document.createElement('a');
    a.href = `${BASE_PATH}/truck/reports/${reportId}/download`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    /* Drop ?dl (keep any ?month) so refreshing the list won't download again. */
    const url = new URL(window.location.href);
    url.searchParams.delete('dl');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [reportId]);

  return null;
}
