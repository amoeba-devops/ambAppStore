import 'server-only';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carDrivers,
  carExpenses,
  carTrips,
  carUsers,
  carVehicles,
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
  /** Per-page size. Default 20. */
  pageSize?: number;
  /** 1-based page. Default 1. */
  page?: number;
}

export interface ListExpensesForDriverResult {
  items: DriverExpenseListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/* Paginated expenses for ONE driver, newest first.
 *
 * Soft-deleted rows are filtered out. Soft-deleted trips still resolve their
 * ref since we don't filter on the join side — that's intentional so a
 * deleted trip's history doesn't disappear from the driver's expense list. */
export async function listExpensesForDriver(
  opts: ListExpensesForDriverOpts,
): Promise<ListExpensesForDriverResult> {
  const { entId, driverId } = opts;
  const pageSize = opts.pageSize ?? 20;
  const page = Math.max(1, opts.page ?? 1);

  const whereClause = and(
    eq(carExpenses.entId, entId),
    eq(carExpenses.expDriverId, driverId),
    isNull(carExpenses.expDeletedAt),
  );

  const rowsPromise = db
    .select({ expense: carExpenses, tripRef: carTrips.trpRef })
    .from(carExpenses)
    .leftJoin(carTrips, eq(carExpenses.expTripId, carTrips.trpId))
    .where(whereClause)
    .orderBy(desc(carExpenses.expSubmittedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countPromise = db
    .select({ count: sql<number>`count(*)::int` })
    .from(carExpenses)
    .where(whereClause);

  const [rows, countRows] = await Promise.all([rowsPromise, countPromise]);

  return {
    items: rows.map((r) => ({ ...r.expense, tripRef: r.tripRef ?? null })),
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export interface PendingExpenseListItem {
  expId: string;
  expType: CarExpense['expType'];
  expStatus: CarExpense['expStatus'];
  expAmount: string;
  expCurrency: string;
  expOccurredAt: string;
  expSubmittedAt: Date;
  expNote: string | null;
  expReviewNote: string | null;
  expReviewedAt: Date | null;
  tripRef: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
}

export type ExpenseStatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

/**
 * Expenses cho admin approval queue (costs page).
 * Filter theo status, exclude soft-deleted, scope theo entId.
 * Joins: driver→user (name), trip→vehicle (plate).
 *
 * Sort: submitted DESC (newest first).
 *
 * @param status pending = PENDING; approved = APPROVED + AUTO_APPROVED; rejected = REJECTED; all = mọi status
 */
export async function listPendingExpenses(
  entId: string,
  status: ExpenseStatusFilter = 'pending',
  limit = 50,
): Promise<PendingExpenseListItem[]> {
  const statusFilter =
    status === 'pending' ? eq(carExpenses.expStatus, 'PENDING') :
    status === 'approved' ? inArray(carExpenses.expStatus, ['APPROVED', 'AUTO_APPROVED']) :
    status === 'rejected' ? eq(carExpenses.expStatus, 'REJECTED') :
    /* 'all' */ null;

  const filters = [
    eq(carExpenses.entId, entId),
    isNull(carExpenses.expDeletedAt),
  ];
  if (statusFilter) filters.push(statusFilter);

  const rows = await db
    .select({
      expense: carExpenses,
      tripRef: carTrips.trpRef,
      vehiclePlate: carVehicles.cvhPlateNumber,
      driverName: carUsers.usrName,
    })
    .from(carExpenses)
    .leftJoin(carTrips, eq(carExpenses.expTripId, carTrips.trpId))
    .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
    .leftJoin(carDrivers, eq(carExpenses.expDriverId, carDrivers.drvId))
    .leftJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .where(and(...filters))
    .orderBy(desc(carExpenses.expSubmittedAt))
    .limit(limit);

  return rows.map((r) => ({
    expId: r.expense.expId,
    expType: r.expense.expType,
    expStatus: r.expense.expStatus,
    expAmount: r.expense.expAmount,
    expCurrency: r.expense.expCurrency,
    expOccurredAt: r.expense.expOccurredAt,
    expSubmittedAt: r.expense.expSubmittedAt,
    expNote: r.expense.expNote,
    expReviewNote: r.expense.expReviewNote,
    expReviewedAt: r.expense.expReviewedAt,
    tripRef: r.tripRef ?? null,
    vehiclePlate: r.vehiclePlate ?? null,
    driverName: r.driverName ?? null,
  }));
}
