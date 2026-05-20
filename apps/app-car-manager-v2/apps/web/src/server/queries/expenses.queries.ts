import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carExpenses,
  carTrips,
  type CarExpense,
} from '@car-v2/db/schema';

export interface DriverExpenseListItem extends CarExpense {
  /* Joined trip ref (the short "TR-1041" string) so the list card can show
   * "Linked to TR-1041" without an N+1 lookup. */
  tripRef: string | null;
}

interface ListExpensesForDriverOpts {
  entId: string;
  driverId: string;
  limit?: number;
}

/* Recent expenses submitted by ONE driver, newest first.
 *
 * Soft-deleted rows are filtered out. Soft-deleted trips still resolve their
 * ref since we don't filter on the join side — that's intentional so a
 * deleted trip's history doesn't disappear from the driver's expense list. */
export async function listExpensesForDriver(
  opts: ListExpensesForDriverOpts,
): Promise<DriverExpenseListItem[]> {
  const { entId, driverId, limit = 50 } = opts;
  const rows = await db
    .select({
      expense: carExpenses,
      tripRef: carTrips.trpRef,
    })
    .from(carExpenses)
    .leftJoin(carTrips, eq(carExpenses.expTripId, carTrips.trpId))
    .where(
      and(
        eq(carExpenses.entId, entId),
        eq(carExpenses.expDriverId, driverId),
        isNull(carExpenses.expDeletedAt),
      ),
    )
    .orderBy(desc(carExpenses.expSubmittedAt))
    .limit(limit);

  return rows.map((r) => ({ ...r.expense, tripRef: r.tripRef ?? null }));
}
