import 'server-only';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
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

export interface EntityExpenseListItem {
  expId: string;
  expType: CarExpense['expType'];
  expStatus: CarExpense['expStatus'];
  expAmount: string;
  expCurrency: string;
  expOccurredAt: string;
  expSubmittedAt: Date;
  expNote: string | null;
  tripRef: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
}

/**
 * All expenses for the entity (admin/manager view). The PRD R3 approval
 * flow was dropped — every row lands AUTO_APPROVED — so there's no longer
 * a pending/approved/rejected filter to honour. `/costs` calls this to
 * render its full ledger.
 *
 * Vehicle resolution prefers the new direct FK (`exp_vehicle_id`) when
 * present, falling back to the trip's vehicle for legacy rows that were
 * submitted before migration 0009 added the column. Either way the SELECT
 * coalesces to a single `vehiclePlate` field so the UI doesn't have to.
 *
 * Driver name is nullable post-migration — Admin/Manager can record
 * expenses without naming a driver, in which case the column is empty.
 *
 * Sort: submitted DESC (newest first).
 */
export async function listEntityExpenses(
  entId: string,
  limit = 100,
): Promise<EntityExpenseListItem[]> {
  /* Two left joins to vehicles: one via the direct expVehicleId, one via
   * the trip's vehicle. Coalesce the plate so the UI gets a single string.
   * Aliases keep the joins distinguishable in SQL. */
  const directVehicle = carVehicles;

  const rows = await db
    .select({
      expense: carExpenses,
      tripRef: carTrips.trpRef,
      directPlate: directVehicle.cvhPlateNumber,
      tripVehiclePlate: sql<string | null>`(SELECT cvh_plate_number FROM car_vehicles WHERE cvh_id = ${carTrips.trpVehicleId})`,
      driverName: carUsers.usrName,
    })
    .from(carExpenses)
    .leftJoin(carTrips, eq(carExpenses.expTripId, carTrips.trpId))
    .leftJoin(directVehicle, eq(carExpenses.expVehicleId, directVehicle.cvhId))
    .leftJoin(carDrivers, eq(carExpenses.expDriverId, carDrivers.drvId))
    .leftJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .where(
      and(
        eq(carExpenses.entId, entId),
        isNull(carExpenses.expDeletedAt),
        /* Filter out rejected rows so the ledger is clean — approval was
         * removed but historical rejected rows may still exist. */
        or(
          eq(carExpenses.expStatus, 'AUTO_APPROVED'),
          eq(carExpenses.expStatus, 'APPROVED'),
          eq(carExpenses.expStatus, 'PENDING'),
        ),
      ),
    )
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
    tripRef: r.tripRef ?? null,
    vehiclePlate: r.directPlate ?? r.tripVehiclePlate ?? null,
    driverName: r.driverName ?? null,
  }));
}
