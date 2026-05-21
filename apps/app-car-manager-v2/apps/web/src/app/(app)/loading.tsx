import { Skeleton } from '@car-v2/ui';

/**
 * Loading fallback for the (app) route group. Renders ONLY the content area
 * skeleton — the sidebar + header chrome are provided by (app)/layout.tsx
 * and are preserved across navigations by Next.js's segment caching.
 *
 * Tabular regions mirror common page templates (KPI row, card grid, table
 * row stack) so the perceived loading shape resembles the destination page.
 */
export default function ContentLoading() {
  return (
    <>
      {/* PageHeader skeleton — sticky top band that matches PageHeader's height
        * and density (mobile h-14, desktop ~80px). */}
      <div className="sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-border">
        {/* Mobile bar */}
        <div className="md:hidden flex items-center gap-2 h-14 px-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="w-10" />
        </div>
        {/* Desktop chrome */}
        <div className="hidden md:block px-7 pt-5 pb-4">
          <Skeleton className="h-3 w-40 mb-2" />
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-3.5 w-72" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24 rounded" />
              <Skeleton className="h-9 w-28 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Content area — common layouts: KPI row + 2 panels. */}
      <div className="flex-1 px-4 md:px-7 py-4 md:py-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[112px] rounded-md" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-md" />
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
          <Skeleton className="h-64 rounded-md" />
          <Skeleton className="h-64 rounded-md" />
        </div>
      </div>
    </>
  );
}
