import 'server-only';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckReports, carUsers, type TruckReportType } from '@car-v2/db/schema';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { getTruckFixedCostsLastUpdated, getTruckTripsMaxUpdatedAt } from './truck-finance.queries';

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

/**
 * Per month (YYYY-MM), the distinct operating regions covered by ≥1 live report.
 * Drives the month picker's "Đã xuất X/3 khu vực" badge. A consolidated
 * "Tất cả khu vực" report (trr_region NULL) covers EVERY region, so it counts
 * toward all of them (BUG-260721: a month reported only via a consolidated
 * report showed the wrong "X/3" — it undercounted the covered regions).
 */
export async function getTruckExportedRegionsByMonth(
  entId: string,
): Promise<Record<string, string[]>> {
  const rows = await db
    .select({ month: carTruckReports.trrMonth, region: carTruckReports.trrRegion })
    .from(carTruckReports)
    .where(
      and(
        eq(carTruckReports.entId, entId),
        isNull(carTruckReports.trrDeletedAt),
      ),
    );
  const sets: Record<string, Set<string>> = {};
  for (const r of rows) {
    const set = (sets[r.month] ??= new Set());
    if (r.region) set.add(r.region);
    /* Consolidated report → covers all operating regions. */
    else for (const code of TRUCK_REGIONS) set.add(code);
  }
  const out: Record<string, string[]> = {};
  for (const [m, set] of Object.entries(sets)) out[m] = [...set];
  return out;
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

/** Latest report for a (month, region) — drives the finance/P&L status badge.
 * Returns the newest report's creation timestamp regardless of report type.
 *
 * A region is "reported" when EITHER a report scoped to that region OR a
 * consolidated "Tất cả khu vực" report (trr_region NULL) exists for the month —
 * the consolidated report covers every region, so without the NULL match the
 * dashboard's per-region status showed "Chưa lập báo cáo" for regions only
 * covered by an all-regions report (BUG-260721). */
export async function getLatestTruckReportForMonth(
  entId: string,
  month: string,
  region?: string | null,
): Promise<{ createdAt: Date; name: string } | null> {
  const conds = [
    eq(carTruckReports.entId, entId),
    eq(carTruckReports.trrMonth, month),
    isNull(carTruckReports.trrDeletedAt),
  ];
  if (region) {
    const regionCond = or(
      eq(carTruckReports.trrRegion, region),
      isNull(carTruckReports.trrRegion),
    );
    if (regionCond) conds.push(regionCond);
  }
  const [row] = await db
    .select({ createdAt: carTruckReports.trrCreatedAt, name: carTruckReports.trrName })
    .from(carTruckReports)
    .where(and(...conds))
    .orderBy(desc(carTruckReports.trrCreatedAt))
    .limit(1);
  return row ?? null;
}

export interface TruckReportStatus {
  /** When the latest live report for this (month, region) was generated;
   * null = never reported. */
  reportedAt: Date | null;
  /** true when a trip or fixed cost in this scope changed AFTER reportedAt —
   * the on-screen numbers may no longer match the last generated report
   * (PLAN-20260707: no lock, so this is the only staleness signal). Always
   * false when reportedAt is null. */
  stale: boolean;
}

/**
 * One combined "when was this generated, and is it still fresh" status per
 * (month, region) — the single source every screen showing snapshot-derived
 * truck numbers (Chi phí & LN, P&L, Dashboard, chi tiết chuyến) reads from, so
 * the answer is identical no matter which screen the user is looking at.
 */
export async function getTruckReportStatus(
  entId: string,
  month: string,
  region: string | null = null,
): Promise<TruckReportStatus> {
  const latest = await getLatestTruckReportForMonth(entId, month, region);
  if (!latest) return { reportedAt: null, stale: false };
  const [tripsUpdatedAt, fixedUpdatedAt] = await Promise.all([
    getTruckTripsMaxUpdatedAt(entId, month, region),
    getTruckFixedCostsLastUpdated(entId, month),
  ]);
  const stale =
    (tripsUpdatedAt != null && tripsUpdatedAt > latest.createdAt) ||
    (fixedUpdatedAt != null && fixedUpdatedAt > latest.createdAt);
  return { reportedAt: latest.createdAt, stale };
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
