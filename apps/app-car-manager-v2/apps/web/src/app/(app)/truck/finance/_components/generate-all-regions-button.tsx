'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button, toast, type ButtonProps } from '@car-v2/ui';
import { generateAllRegionsTruckReportsAction } from '@/server/actions/truck-report.actions';
import { formatActionError } from '@/lib/format-action-error';

/**
 * Batch "Lập báo cáo" trigger on the finance banner (feedback #1) — supports
 * TWO scopes the operator can pick between:
 *   - `regions` omitted → every region with completed trips this month,
 *     INCLUDING ones already reported (a full refresh with live data).
 *   - `regions` given → only those regions (the banner passes the
 *     still-provisional ones, so already-reported regions are left alone).
 * Either way each region freezes its own month-end fuel average, so the
 * per-trip fuel cost/profit below recalculates immediately. Regions still
 * missing fuel invoices can't be reconciled → surfaced via the "partial"
 * toast instead of silently doing nothing.
 */
export function GenerateAllRegionsButton({
  month,
  regions,
  label,
  variant = 'primary',
}: {
  month: string;
  /** Restrict generation to these region codes; omit for "all regions with trip data". */
  regions?: string[];
  label: string;
  variant?: ButtonProps['variant'];
}) {
  const t = useTranslations('screens.truckFinance');
  const tRegion = useTranslations('region');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const res = await generateAllRegionsTruckReportsAction({ month, regions });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      const { finalized, pending: waiting } = res.data;
      if (finalized.length === 0) {
        toast.error(t('genAllNone'));
      } else if (waiting.length === 0) {
        toast.success(t('genAllDone', { count: finalized.length }));
      } else {
        toast.success(
          t('genAllPartial', {
            count: finalized.length,
            regions: waiting.map((r) => tRegion(r)).join(', '),
          }),
        );
      }
      /* Re-render the server component so the recomputed rows + badges show. */
      router.refresh();
    });

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={run}
      disabled={pending}
      iconLeft={pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
    >
      {label}
    </Button>
  );
}
