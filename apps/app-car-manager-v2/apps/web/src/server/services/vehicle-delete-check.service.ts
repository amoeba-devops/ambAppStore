import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTrips, carExpenses } from '@car-v2/db/schema';

/** Format trip subtitle: "Jun 3 · HCM → Biên Hòa" */
function formatTripSubtitle(
  scheduledAt: Date,
  pickupAddress: string,
  dropoffAddress: string,
): string {
  const dateStr = scheduledAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const pickup = (pickupAddress.split(',')[0] ?? pickupAddress).trim();
  const dropoff = (dropoffAddress.split(',')[0] ?? dropoffAddress).trim();
  return `${dateStr} · ${pickup} → ${dropoff}`;
}

/** Format expense subtitle: "500,000 VND" */
function formatExpenseSubtitle(amount: string, currency: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return currency;
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(num);
  return `${formatted} ${currency}`;
}

export interface VehicleDeleteWarning {
  type: 'active_trips' | 'linked_expenses';
  count: number;
  message: string;
  /** IDs/refs for linking - max 3 shown */
  refs: {
    id: string;
    label: string;
    subtitle?: string;
    /** Full pickup address for map display */
    pickupAddress?: string;
    /** Full dropoff address for map display */
    dropoffAddress?: string;
    /** Trip status */
    status?: string;
    /** Scheduled time */
    scheduledAt?: string;
  }[];
}

export interface VehicleDeleteCheckResult {
  canDelete: true;
  warnings: VehicleDeleteWarning[];
}

/**
 * Check for potential issues before soft-deleting a vehicle.
 * Returns warnings but does NOT block deletion (soft-warning approach).
 *
 * Checks:
 * 1. Active trips (PENDING_DRIVER_CONFIRMATION, CONFIRMED, IN_PROGRESS)
 * 2. Linked expenses (all non-deleted expenses for this vehicle)
 */
export async function checkVehicleDeleteWarnings(
  entId: string,
  vehicleId: string,
): Promise<VehicleDeleteCheckResult> {
  const warnings: VehicleDeleteWarning[] = [];

  // 1. Check active trips using this vehicle
  const activeTrips = await db
    .select({
      trpId: carTrips.trpId,
      trpRef: carTrips.trpRef,
      trpStatus: carTrips.trpStatus,
      trpScheduledAt: carTrips.trpScheduledAt,
      trpPickupAddress: carTrips.trpPickupAddress,
      trpDropoffAddress: carTrips.trpDropoffAddress,
    })
    .from(carTrips)
    .where(
      and(
        eq(carTrips.entId, entId),
        eq(carTrips.trpVehicleId, vehicleId),
        inArray(carTrips.trpStatus, [
          'PENDING_DRIVER_CONFIRMATION',
          'CONFIRMED',
          'IN_PROGRESS',
        ]),
        isNull(carTrips.trpDeletedAt),
      ),
    )
    .limit(4);

  if (activeTrips.length > 0) {
    warnings.push({
      type: 'active_trips',
      count: activeTrips.length,
      message: `${activeTrips.length} active trip(s) using this vehicle`,
      refs: activeTrips.slice(0, 3).map((t) => ({
        id: t.trpId,
        label: t.trpRef,
        subtitle: formatTripSubtitle(t.trpScheduledAt, t.trpPickupAddress, t.trpDropoffAddress),
        pickupAddress: t.trpPickupAddress,
        dropoffAddress: t.trpDropoffAddress,
        status: t.trpStatus,
        scheduledAt: t.trpScheduledAt.toISOString(),
      })),
    });
  }

  // 2. Check linked expenses (informational - won't block)
  const linkedExpenses = await db
    .select({
      expId: carExpenses.expId,
      expType: carExpenses.expType,
      expAmount: carExpenses.expAmount,
      expCurrency: carExpenses.expCurrency,
    })
    .from(carExpenses)
    .where(
      and(
        eq(carExpenses.entId, entId),
        eq(carExpenses.expVehicleId, vehicleId),
        isNull(carExpenses.expDeletedAt),
      ),
    )
    .limit(4);

  if (linkedExpenses.length > 0) {
    warnings.push({
      type: 'linked_expenses',
      count: linkedExpenses.length,
      message: `${linkedExpenses.length} expense(s) linked to this vehicle`,
      refs: linkedExpenses.slice(0, 3).map((e) => ({
        id: e.expId,
        label: e.expType,
        subtitle: formatExpenseSubtitle(e.expAmount, e.expCurrency),
      })),
    });
  }

  return {
    canDelete: true, // Always allow (soft-warning mode)
    warnings,
  };
}
