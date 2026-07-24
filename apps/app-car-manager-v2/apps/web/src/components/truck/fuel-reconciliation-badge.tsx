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
  vehicleRate: number;
  unset: number;
}): FuelBadgeMode {
  const present = (['AVERAGED', 'VEHICLE_RATE', 'UNSET'] as const).filter((m) =>
    m === 'AVERAGED' ? counts.averaged > 0 : m === 'VEHICLE_RATE' ? counts.vehicleRate > 0 : counts.unset > 0,
  );
  if (present.length === 0) return 'UNSET';
  if (present.length === 1) return present[0]!;
  return 'MIXED';
}

/**
 * How a truck trip's fuel cost was derived — shared indicator for every screen
 * showing a truck fuel figure (Chi phí & LN theo chuyến, chi tiết chuyến, P&L):
 *  - AVERAGED     🟢 "Bình quân"        — frozen month-end reconciliation (invoices)
 *  - VEHICLE_RATE 🔵 "Theo định mức"    — km × (định mức/100) × giá của xe (mặc định)
 *  - UNSET        🟡 "Chưa đặt định mức" — xe thiếu định mức/giá → phí 0
 *  - MIXED        🟡 "Hỗn hợp"          — aggregate blends modes
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
  if (mode === 'VEHICLE_RATE') {
    return (
      <Badge tone="info" size={size} title={t('fuelVehicleRateTooltip')}>
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
