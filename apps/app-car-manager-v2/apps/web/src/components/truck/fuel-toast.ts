import type { TruckFuelMode } from '@car-v2/core/truck';

/**
 * Save-toast description for how a trip's fuel cost was derived (REQ-20260724),
 * keyed under `screens.truckFinance`. `null` (open/non-completed trip) → no
 * description. Shared by the trip form + completion sheet so the copy matches.
 */
export function fuelToastDescription(
  mode: TruckFuelMode | null,
  t: (key: string) => string,
): string | undefined {
  switch (mode) {
    case 'AVERAGED':
      return t('fuelRecalcedToast');
    case 'VEHICLE_RATE':
      return t('fuelVehicleRateToast');
    case 'UNSET':
      return t('fuelUnsetToast');
    default:
      return undefined;
  }
}
