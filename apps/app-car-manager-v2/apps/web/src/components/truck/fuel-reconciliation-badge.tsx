import { getTranslations } from 'next-intl/server';
import { Badge } from '@car-v2/ui';

export type FuelReconciliationState = 'full' | 'partial' | 'none';

/** Derive the 3-state from how many of a scope's trips had their fuel cost
 * reconciled to the month-end average vs the scope's total trip count. */
export function fuelReconciliationState(reconciledCount: number, totalCount: number): FuelReconciliationState {
  if (totalCount === 0 || reconciledCount === 0) return 'none';
  return reconciledCount === totalCount ? 'full' : 'partial';
}

/**
 * "Is this fuel figure the reconciled month-end average, or still the trip's
 * own entered litres × price" — shared indicator for every screen showing a
 * truck fuel cost (Chi phí & LN theo chuyến, chi tiết chuyến, P&L). Independent
 * of `ReportStatusBadge` ("has a report been generated"): a report can exist
 * with NO fuel snapshot when its region has no invoices yet ("Lập báo cáo =
 * chốt luôn", 2026-07-21) — this badge is what actually tells the two apart.
 */
export async function FuelReconciliationBadge({
  state,
  size = 'sm',
}: {
  state: FuelReconciliationState;
  size?: 'sm' | 'md';
}) {
  const t = await getTranslations('screens.truckFinance');
  if (state === 'full') {
    return (
      <Badge tone="success" size={size} title={t('fuelReconciledTooltip')}>
        {t('fuelReconciledLabel')}
      </Badge>
    );
  }
  if (state === 'partial') {
    return (
      <Badge tone="warning" size={size} title={t('fuelPartialReconciledTooltip')}>
        {t('fuelPartialReconciledLabel')}
      </Badge>
    );
  }
  return (
    <Badge tone="warning" size={size} title={t('fuelNotReconciledTooltip')}>
      {t('fuelNotReconciledLabel')}
    </Badge>
  );
}
