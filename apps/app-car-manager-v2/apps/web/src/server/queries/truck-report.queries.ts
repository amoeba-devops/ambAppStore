import 'server-only';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckReports, carUsers, type TruckReportType } from '@car-v2/db/schema';

export interface TruckReportRow {
  id: string;
  month: string;
  type: TruckReportType;
  format: string;
  name: string;
  createdAt: Date;
  createdByName: string | null;
  /** Created after the viewer's last "seen" mark → show "Mới" badge. */
  isNew: boolean;
}

/** All live truck reports (newest first), each flagged new relative to `seenAt`. */
export async function listTruckReports(
  entId: string,
  seenAt: Date | null,
): Promise<TruckReportRow[]> {
  const rows = await db
    .select({
      id: carTruckReports.trrId,
      month: carTruckReports.trrMonth,
      type: carTruckReports.trrType,
      format: carTruckReports.trrFormat,
      name: carTruckReports.trrName,
      createdAt: carTruckReports.trrCreatedAt,
      createdByName: carUsers.usrName,
    })
    .from(carTruckReports)
    .leftJoin(carUsers, eq(carTruckReports.trrCreatedBy, carUsers.usrId))
    .where(and(eq(carTruckReports.entId, entId), isNull(carTruckReports.trrDeletedAt)))
    .orderBy(desc(carTruckReports.trrCreatedAt));
  return rows.map((r) => ({
    ...r,
    type: r.type as TruckReportType,
    isNew: seenAt == null ? true : r.createdAt > seenAt,
  }));
}

/** One report (ent-scoped) for the download handler. */
export async function getTruckReport(entId: string, id: string) {
  const [row] = await db
    .select()
    .from(carTruckReports)
    .where(
      and(
        eq(carTruckReports.entId, entId),
        eq(carTruckReports.trrId, id),
        isNull(carTruckReports.trrDeletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** The current user's "reports seen" mark (null = never opened the list). */
export async function getTruckReportsSeenAt(entId: string, userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ seenAt: carUsers.usrTruckReportsSeenAt })
    .from(carUsers)
    .where(and(eq(carUsers.entId, entId), eq(carUsers.usrId, userId)))
    .limit(1);
  return row?.seenAt ?? null;
}

/** Count of reports newer than the user's seen mark — drives the nav "Mới" badge. */
export async function countNewTruckReports(entId: string, userId: string): Promise<number> {
  const seenAt = await getTruckReportsSeenAt(entId, userId);
  const conds = [eq(carTruckReports.entId, entId), isNull(carTruckReports.trrDeletedAt)];
  if (seenAt) conds.push(gt(carTruckReports.trrCreatedAt, seenAt));
  const rows = await db.select({ id: carTruckReports.trrId }).from(carTruckReports).where(and(...conds));
  return rows.length;
}
