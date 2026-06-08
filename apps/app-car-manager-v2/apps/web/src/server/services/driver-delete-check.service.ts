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
  // Truncate long addresses to city/district level (take first part before comma)
  const pickup = (pickupAddress.split(',')[0] ?? pickupAddress).trim();
  const dropoff = (dropoffAddress.split(',')[0] ?? dropoffAddress).trim();
  return `${dateStr} · ${pickup} → ${dropoff}`;
}

/** Format expense subtitle: "500,000 VND" */
function formatExpenseSubtitle(amount: string, currency: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return currency;
  // Format with thousand separators
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(num);
  return `${formatted} ${currency}`;
}

export interface DriverDeleteWarning {
  type: 'active_trips' | 'pending_expenses';
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

export interface DriverDeleteCheckResult {
  canDelete: true;
  warnings: DriverDeleteWarning[];
}

/**
 * Check for potential issues before soft-deleting a driver.
 * Returns warnings but does NOT block deletion (soft-warning approach).
 *
 * Checks:
 * 1. Active trips (PENDING_DRIVER_CONFIRMATION, CONFIRMED, IN_PROGRESS)
 * 2. Pending expenses awaiting approval
 */
export async function checkDriverDeleteWarnings(
  entId: string,
  driverId: string,
): Promise<DriverDeleteCheckResult> {
  const warnings: DriverDeleteWarning[] = [];

  // 1. Check active trips (get refs for display)
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
        eq(carTrips.trpDriverId, driverId),
        inArray(carTrips.trpStatus, [
          'PENDING_DRIVER_CONFIRMATION',
          'CONFIRMED',
          'IN_PROGRESS',
        ]),
        isNull(carTrips.trpDeletedAt),
      ),
    )
    .limit(4); // Get up to 4 to show "and X more"

  if (activeTrips.length > 0) {
    warnings.push({
      type: 'active_trips',
      count: activeTrips.length,
      message: `${activeTrips.length} active trip(s) assigned`,
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

  // 2. Check pending expenses (get IDs for display)
  const pendingExpenses = await db
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
        eq(carExpenses.expDriverId, driverId),
        eq(carExpenses.expStatus, 'PENDING'),
        isNull(carExpenses.expDeletedAt),
      ),
    )
    .limit(4);

  if (pendingExpenses.length > 0) {
    warnings.push({
      type: 'pending_expenses',
      count: pendingExpenses.length,
      message: `${pendingExpenses.length} pending expense(s) awaiting approval`,
      refs: pendingExpenses.slice(0, 3).map((e) => ({
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
