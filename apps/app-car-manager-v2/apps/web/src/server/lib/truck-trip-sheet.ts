import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { TruckSheetColumn } from '@car-v2/shared/zod';

/**
 * Header row for the truck trip-log sheet in `locale`, built from the shared
 * layout (TRUCK_TRIP_SHEET_COLUMNS) — the export and the import template both
 * call this, so a column has the same label + unit in both files (BUG-261015).
 *
 * Labels come from the `columns.truck` glossary; total cost / profit keep the
 * export's "actual" wording (REQ-20260822), which already carries its unit.
 */
export async function truckTripSheetHeader(
  locale: string,
  columns: readonly TruckSheetColumn[],
): Promise<string[]> {
  const tCol = await getTranslations({ locale, namespace: 'columns.truck' });
  const tExp = await getTranslations({ locale, namespace: 'exportContent.truckTrips' });
  return columns.map((c) => {
    if (c.key === 'totalCost') return tExp('colTotalCost');
    if (c.key === 'profit') return tExp('colProfit');
    const label = tCol(c.key);
    return 'unit' in c && c.unit ? `${label} (${tCol(c.unit)})` : label;
  });
}
