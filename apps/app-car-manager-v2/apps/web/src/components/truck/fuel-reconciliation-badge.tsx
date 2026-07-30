import { getTranslations } from 'next-intl/server';
import { Badge } from '@car-v2/ui';
import type { TruckFuelMode } from '@car-v2/core/truck';

/** Badge mode for a fuel figure. Per-trip screens pass the trip's own
 * `TruckFuelMode`; aggregate screens (P&L) may pass 'MIXED' when a row blends
 * trips of different modes. */
export type FuelBadgeMode = TruckFuelMode | 'MIXED';

/**
 * Collapse a scope's per-trip fuel modes into ONE badge mode (REQ-20260724):
 * all-same → that mode; any blend → 'MIXED'. Empty scope → 'UNSET'.
 */
export function aggregateFuelMode(counts: {
  averaged: number;
  live: number;
  unset: number;
}): FuelBadgeMode {
  const present = (['AVERAGED', 'LIVE', 'UNSET'] as const).filter((m) =>
    m === 'AVERAGED' ? counts.averaged > 0 : m === 'LIVE' ? counts.live > 0 : counts.unset > 0,
  );
  if (present.length === 0) return 'UNSET';
  if (present.length === 1) return present[0]!;
  return 'MIXED';
}

/**
 * How a truck trip's fuel cost was derived — shared indicator for every screen
 * showing a truck fuel figure (Chi phí & LN theo chuyến, chi tiết chuyến, P&L):
 *  - AVERAGED 🟢 "Theo hoá đơn"   — frozen month-end allocation of the vehicle's spend
 *  - LIVE     ⚪ "Tạm tính"       — same allocation from what is recorded so far
 *  - UNSET    🟡 "Chưa tính được" — no fuel recorded for the vehicle's month → phí 0
 *  - MIXED    🟡 "Hỗn hợp"        — aggregate blends modes
 * Independent of `ReportStatusBadge` ("has a report been generated").
 */
export async function FuelReconciliationBadge({
  mode,
  size = 'sm',
}: {
  mode: FuelBadgeMode;
  size?: 'sm' | 'md';
}) {
  const t = await getTranslations('screens.truckFinance');
  if (mode === 'AVERAGED') {
    return (
      <Badge tone="success" size={size} title={t('fuelReconciledTooltip')}>
        {t('fuelReconciledLabel')}
      </Badge>
    );
  }
  if (mode === 'LIVE') {
    /* Neutral, not a confident colour: real money, but still provisional —
     * more fuel can be recorded before the month is reported. */
    return (
      <Badge tone="neutral" size={size} title={t('fuelVehicleRateTooltip')}>
        {t('fuelVehicleRateLabel')}
      </Badge>
    );
  }
  if (mode === 'MIXED') {
    return (
      <Badge tone="warning" size={size} title={t('fuelPartialReconciledTooltip')}>
        {t('fuelPartialReconciledLabel')}
      </Badge>
    );
  }
  return (
    <Badge tone="warning" size={size} title={t('fuelUnsetTooltip')}>
      {t('fuelUnsetLabel')}
    </Badge>
  );
}
