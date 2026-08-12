import type { CompleteSectionInitial } from '@/components/truck/truck-complete-section';

/** Drizzle `numeric` columns come back as strings — '' and null both mean
 * "not recorded", and NaN would render as a broken input value. */
function num(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Trip row fields the completion form seeds from. Structural on purpose so
 * every caller can pass its own trip shape (TripDetail, CarTrip, …). */
export interface CompletableTripRow {
  trpStartedAt: Date | null;
  trpEndedAt: Date | null;
  trpEndOdometer: number | null;
  trpFuelLiters: string | number | null;
  trpFuelPrice: string | number | null;
  trpTollFee: string | number | null;
}

/**
 * Seed values for `TruckCompleteSection` (scalars only — `extras` is loaded
 * separately by each page). Keeps the completion form showing what is already
 * on the trip, so completing after an edit doesn't look like a blank slate.
 */
export function completeInitialOf(
  trip: CompletableTripRow,
): Omit<CompleteSectionInitial, 'extras'> {
  return {
    startedAt: trip.trpStartedAt,
    endedAt: trip.trpEndedAt,
    endOdometer: trip.trpEndOdometer,
    fuelLiters: num(trip.trpFuelLiters),
    fuelPrice: num(trip.trpFuelPrice),
    tollFee: num(trip.trpTollFee),
  };
}
