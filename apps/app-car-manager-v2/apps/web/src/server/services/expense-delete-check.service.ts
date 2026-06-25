import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carExpenses, carExpenseAttachments, carTrips } from '@car-v2/db/schema';

export interface ExpenseDeleteWarning {
  type: 'has_attachments' | 'linked_trip';
  count: number;
  message: string;
  /** IDs/refs for linking - max 3 shown */
  refs: { id: string; label: string; subtitle?: string }[];
}

export interface ExpenseDeleteCheckResult {
  canDelete: true;
  warnings: ExpenseDeleteWarning[];
}

/**
 * Check for potential issues before soft-deleting an expense.
 * Returns warnings but does NOT block deletion (soft-warning approach).
 *
 * Checks:
 * 1. Has attachments (will be orphaned - informational)
 * 2. Linked to a trip (informational)
 */
export async function checkExpenseDeleteWarnings(
  entId: string,
  expenseId: string,
): Promise<ExpenseDeleteCheckResult> {
  const warnings: ExpenseDeleteWarning[] = [];

  // Get the expense first to check linked trip
  const expense = await db
    .select({
      expTripId: carExpenses.expTripId,
      expVehicleId: carExpenses.expVehicleId,
    })
    .from(carExpenses)
    .where(
      and(
        eq(carExpenses.expId, expenseId),
        eq(carExpenses.entId, entId),
        isNull(carExpenses.expDeletedAt),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!expense) {
    return { canDelete: true, warnings: [] };
  }

  // 1. Check attachments
  const attachments = await db
    .select({
      eatId: carExpenseAttachments.eatId,
      eatMime: carExpenseAttachments.eatMime,
      eatSizeBytes: carExpenseAttachments.eatSizeBytes,
    })
    .from(carExpenseAttachments)
    .where(
      and(
        eq(carExpenseAttachments.eatExpenseId, expenseId),
        eq(carExpenseAttachments.entId, entId),
      ),
    )
    .limit(4);

  if (attachments.length > 0) {
    warnings.push({
      type: 'has_attachments',
      count: attachments.length,
      message: `${attachments.length} attachment(s) will be orphaned`,
      refs: attachments.slice(0, 3).map((a) => ({
        id: a.eatId,
        label: a.eatMime.split('/')[1]?.toUpperCase() || 'FILE',
        subtitle: formatFileSize(a.eatSizeBytes),
      })),
    });
  }

  // 2. Check linked trip
  if (expense.expTripId) {
    const trip = await db
      .select({
        trpId: carTrips.trpId,
        trpRef: carTrips.trpRef,
        trpScheduledAt: carTrips.trpScheduledAt,
        trpPickupAddress: carTrips.trpPickupAddress,
        trpDropoffAddress: carTrips.trpDropoffAddress,
      })
      .from(carTrips)
      .where(
        and(
          eq(carTrips.trpId, expense.expTripId),
          eq(carTrips.entId, entId),
          isNull(carTrips.trpDeletedAt),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (trip) {
      const dateStr = trip.trpScheduledAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const pickup = (trip.trpPickupAddress.split(',')[0] ?? trip.trpPickupAddress).trim();
      const dropoff = (trip.trpDropoffAddress.split(',')[0] ?? trip.trpDropoffAddress).trim();

      warnings.push({
        type: 'linked_trip',
        count: 1,
        message: 'This expense is linked to a trip',
        refs: [
          {
            id: trip.trpId,
            label: trip.trpRef,
            subtitle: `${dateStr} · ${pickup} → ${dropoff}`,
          },
        ],
      });
    }
  }

  return {
    canDelete: true, // Always allow (soft-warning mode)
    warnings,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
