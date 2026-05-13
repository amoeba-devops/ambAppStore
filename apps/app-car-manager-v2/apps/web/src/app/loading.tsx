import { Skeleton } from '@car-v2/ui';

/**
 * Root loading fallback — shown only at cold-start, before the (app) layout
 * has rendered (or for public routes like /session-expired while compiling).
 *
 * Includes the full shell skeleton (sidebar + header + content) so the page
 * never flashes white. Once the (app) layout mounts, navigation between
 * pages uses (app)/loading.tsx which preserves the real sidebar + header.
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-dvh bg-bg">
      {/* Sidebar skeleton (desktop only — mobile hides it) */}
      <aside className="hidden md:flex shrink-0 w-[240px] h-screen sticky top-0 border-r border-border bg-surface flex-col">
        {/* Brand */}
        <div className="h-14 px-3 flex items-center gap-2.5 border-b border-border">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        {/* Nav items */}
        <nav className="flex-1 px-2 py-3 space-y-1.5">
          <Skeleton className="h-3 w-20 mx-2 mb-2" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 h-9 px-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
          <Skeleton className="h-3 w-16 mx-2 mt-4 mb-2" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={`a-${i}`} className="flex items-center gap-2.5 h-9 px-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </nav>
        {/* Footer user card */}
        <div className="border-t border-border p-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main area: header + content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Header skeleton */}
        <div className="sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-border">
          <div className="md:hidden flex items-center gap-2 h-14 px-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="w-10" />
          </div>
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

        {/* Content skeleton */}
        <div className="flex-1 px-4 md:px-7 py-4 md:py-6 space-y-4 pb-[80px] md:pb-6">
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
      </main>

      {/* Bottom tab skeleton (mobile only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-surface/95 backdrop-blur border-t border-border grid grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center justify-center gap-1">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-2 w-10" />
          </div>
        ))}
      </nav>
    </div>
  );
}
