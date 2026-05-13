import { Skeleton } from '@car-v2/ui';
import { AppShell } from '@/components/layout/app-shell';

/* Global loading fallback. Renders the chrome instantly so the user doesn't
 * see a full-page flash on initial route resolution. Individual segments may
 * override with a more specific loading.tsx (e.g. table skeletons). */
export default function Loading() {
  return (
    <AppShell>
      <div className="border-b border-border px-4 md:px-7 pt-4 md:pt-5 pb-3 md:pb-4 bg-bg/85">
        <Skeleton className="h-3.5 w-40 mb-2" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-3.5 w-48 mt-1" />
      </div>
      <div className="flex-1 px-4 md:px-7 py-4 md:py-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[112px]" />
          ))}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-48" />
      </div>
    </AppShell>
  );
}
