import { getTranslations } from 'next-intl/server';
import { ShieldAlert } from 'lucide-react';
import { Card } from '@car-v2/ui';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';

/**
 * Shown when a user asked for a region they have no access to (REQ-20260813).
 * `resolveRegionFilter` redirects such a request back to the same screen with
 * `?region_denied=<code>` instead of throwing, so the screen keeps working and
 * explains why the filter snapped back to their own regions.
 */
export async function RegionDeniedNotice({ code }: { code?: string }) {
  if (!code || !(TRUCK_REGIONS as readonly string[]).includes(code)) return null;

  const t = await getTranslations('screens.regionAccess');
  const tRegion = await getTranslations('region');

  return (
    <Card variant="outline" className="flex flex-wrap items-center gap-3 border-warning/40 bg-warning/5 p-3">
      <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
      <span className="flex-1 text-sm text-text">
        {t('deniedNotice', { region: tRegion(code as Parameters<typeof tRegion>[0]) })}
      </span>
    </Card>
  );
}
