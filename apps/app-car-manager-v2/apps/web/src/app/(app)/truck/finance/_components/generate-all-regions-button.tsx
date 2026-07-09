'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button, toast } from '@car-v2/ui';
import { generateAllRegionsTruckReportsAction } from '@/server/actions/truck-report.actions';
import { formatActionError } from '@/lib/format-action-error';

/**
 * "Lập báo cáo tất cả khu vực" — one click on the finance banner generates a
 * Chi-phí-&-lợi-nhuận (PNL) report for every region that has completed trips
 * this month, freezing each region's own month-end fuel average so the per-trip
 * fuel cost/profit below recalculates immediately (feedback #1). Regions still
 * missing fuel invoices can't be reconciled → surfaced back to the operator via
 * the "partial" toast instead of silently doing nothing.
 */
export function GenerateAllRegionsButton({ month }: { month: string }) {
  const t = useTranslations('screens.truckFinance');
  const tRegion = useTranslations('region');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const res = await generateAllRegionsTruckReportsAction({ month });
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
      variant="primary"
      size="sm"
      onClick={run}
      disabled={pending}
      iconLeft={pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
    >
      {t('genAllBtn')}
    </Button>
  );
}
