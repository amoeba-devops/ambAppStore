import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { TruckSheetColumn } from '@car-v2/shared/zod';
import type { TruckCostBreakdown } from '@car-v2/core/truck';

/**
 * Header row for the truck trip-log sheet in `locale`, built from the shared
 * layout (TRUCK_TRIP_SHEET_COLUMNS) — the export and the import template both
 * call this, so a column has the same label + unit in both files (BUG-261015).
 *
 * Every label comes from the `columns.truck` glossary — the same words the
 * trip-list headers use, so a column is named identically on screen, in the
 * export and in the template (total cost / profit included; the "actual fuel"
 * meaning of REQ-20260822 is explained by the list's tooltip).
 */
export async function truckTripSheetHeader(
  locale: string,
  columns: readonly TruckSheetColumn[],
): Promise<string[]> {
  const tCol = await getTranslations({ locale, namespace: 'columns.truck' });
  return columns.map((c) => {
    const label = tCol(c.key);
    return 'unit' in c && c.unit ? `${label} (${tCol(c.unit)})` : label;
  });
}

/**
 * "Tổng chi phí" of one trip as the trip-log screens show it: the trip's OWN
 * fuel spend (litres × price, REQ-20260822 — not the pooled allocation in
 * `breakdown.totalCost`) + toll + the 4 fixed fees + the extra-cost total.
 * Shared by the list table and the export so the two can't disagree.
 */
export function truckTripActualTotalCost(t: { fuelActualCost: number; breakdown: TruckCostBreakdown }): number {
  const b = t.breakdown;
  return t.fuelActualCost + b.tollFee + b.cleaningFee + b.repairFee + b.ferryFee + b.loadingFee + b.extraTotal;
}
