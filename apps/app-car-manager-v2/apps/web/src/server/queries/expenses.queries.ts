import 'server-only';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carDrivers,
  carExpenseAttachments,
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
  /** Local role of the user who submitted this row. Drives the source
   * badge in /costs ("Tài xế gửi" vs "Hoá đơn fleet") so Admin can tell
   * at a glance whether a row came from a driver field-submit or a
   * back-office invoice entry. NULL only if the submitter user was
   * soft-deleted after submission. */
  submitterRole: 'ADMIN' | 'MANAGER' | 'DRIVER' | null;
  submitterName: string | null;
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
      /* Pull submitter role + display name via correlated subqueries so we
       * don't have to alias `car_users` twice (joined once for the driver
       * name path above). One row per expense — the subquery only fires
       * when we want a row's source badge, and it's a single PK lookup. */
      submitterRole: sql<'ADMIN' | 'MANAGER' | 'DRIVER' | null>`(SELECT usr_local_role FROM car_users WHERE usr_id = ${carExpenses.expSubmittedBy})`,
      submitterName: sql<string | null>`(SELECT usr_name FROM car_users WHERE usr_id = ${carExpenses.expSubmittedBy})`,
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
    submitterRole: r.submitterRole ?? null,
    submitterName: r.submitterName ?? null,
  }));
}

export interface ExpenseDetail extends EntityExpenseListItem {
  /* Raw expense row fields not surfaced in the list (the list intentionally
   * stays narrow — the detail page wants the full record). */
  expLockedUntil: Date;
  /** S3 attachment metadata. Keys only — the page generates signed URLs
   * lazily if/when it actually needs to render the image. */
  attachments: Array<{
    eatId: string;
    eatS3Key: string;
    eatMime: string;
    eatSizeBytes: number;
    eatUploadedAt: Date;
  }>;
}

/**
 * Full expense record for the dedicated detail page (`/expenses/[id]`).
 * Returns null when the row is missing / soft-deleted / belongs to a
 * different tenant — caller `notFound()`s. Same vehicle + driver +
 * submitter resolution as `listEntityExpenses` for visual consistency.
 */
export async function getExpenseDetail(
  entId: string,
  expId: string,
): Promise<ExpenseDetail | null> {
  const directVehicle = carVehicles;

  const row = await db
    .select({
      expense: carExpenses,
      tripRef: carTrips.trpRef,
      directPlate: directVehicle.cvhPlateNumber,
      tripVehiclePlate: sql<string | null>`(SELECT cvh_plate_number FROM car_vehicles WHERE cvh_id = ${carTrips.trpVehicleId})`,
      driverName: carUsers.usrName,
      submitterRole: sql<'ADMIN' | 'MANAGER' | 'DRIVER' | null>`(SELECT usr_local_role FROM car_users WHERE usr_id = ${carExpenses.expSubmittedBy})`,
      submitterName: sql<string | null>`(SELECT usr_name FROM car_users WHERE usr_id = ${carExpenses.expSubmittedBy})`,
    })
    .from(carExpenses)
    .leftJoin(carTrips, eq(carExpenses.expTripId, carTrips.trpId))
    .leftJoin(directVehicle, eq(carExpenses.expVehicleId, directVehicle.cvhId))
    .leftJoin(carDrivers, eq(carExpenses.expDriverId, carDrivers.drvId))
    .leftJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .where(
      and(
        eq(carExpenses.expId, expId),
        eq(carExpenses.entId, entId),
        isNull(carExpenses.expDeletedAt),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) return null;

  /* Separate query for attachments — kept out of the main SELECT so the
   * GROUP_CONCAT / json_agg machinery doesn't bloat the detail join. With
   * the `idx_car_expense_attachments_expense` index this is a sub-ms lookup. */
  const attachments = await db
    .select()
    .from(carExpenseAttachments)
    .where(
      and(
        eq(carExpenseAttachments.eatExpenseId, expId),
        eq(carExpenseAttachments.entId, entId),
      ),
    )
    .orderBy(carExpenseAttachments.eatUploadedAt);

  return {
    expId: row.expense.expId,
    expType: row.expense.expType,
    expStatus: row.expense.expStatus,
    expAmount: row.expense.expAmount,
    expCurrency: row.expense.expCurrency,
    expOccurredAt: row.expense.expOccurredAt,
    expSubmittedAt: row.expense.expSubmittedAt,
    expNote: row.expense.expNote,
    expLockedUntil: row.expense.expLockedUntil,
    tripRef: row.tripRef ?? null,
    vehiclePlate: row.directPlate ?? row.tripVehiclePlate ?? null,
    driverName: row.driverName ?? null,
    submitterRole: row.submitterRole ?? null,
    submitterName: row.submitterName ?? null,
    attachments: attachments.map((a) => ({
      eatId: a.eatId,
      eatS3Key: a.eatS3Key,
      eatMime: a.eatMime,
      eatSizeBytes: a.eatSizeBytes,
      eatUploadedAt: a.eatUploadedAt,
    })),
  };
}

/**
 * Count expenses submitted today (Asia/Ho_Chi_Minh midnight cutoff).
 *
 * The Render host runs in Singapore (UTC+8), the dev DB at Neon ap-southeast-1
 * (UTC+8), and the user base is in Vietnam (UTC+7). Computing the day boundary
 * locally on the Node host would shift by an hour on most days. Push the
 * truncation into Postgres via `now() AT TIME ZONE 'Asia/Ho_Chi_Minh'` so the
 * answer is correct regardless of where the app code runs.
 *
 * Counts both driver-submitted AND admin/manager-recorded rows (no source
 * filter). Soft-deleted rows excluded. Returns 0 for empty tenants. */
export async function countTodayExpenses(entId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(carExpenses)
    .where(
      and(
        eq(carExpenses.entId, entId),
        isNull(carExpenses.expDeletedAt),
        sql`${carExpenses.expSubmittedAt} >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh'`,
      ),
    );
  return rows[0]?.n ?? 0;
}
