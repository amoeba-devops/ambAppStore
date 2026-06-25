import 'server-only';
import { and, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carAuditLogs, carUsers, type CarAuditLog } from '@car-v2/db/schema';
import type { AuditEntity } from '../services/audit-log.service';

export interface AuditRow extends CarAuditLog {
  actorName: string | null;
}

export interface ListAuditOptions {
  entity?: AuditEntity;
  /** Per-page size. Default 50. */
  pageSize?: number;
  /** 1-based page. Default 1. */
  page?: number;
  /** Free-text search trên action / entity / ref / actor name. ILIKE %q%. */
  q?: string;
  /** Filter theo người thực hiện (car_users.usr_id). MUST be ent-scoped — caller
   *  truyền value đã verify hoặc validateActorId() ở dưới. */
  actorId?: string;
}

export interface ListAuditResult {
  items: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
}

/* Internal builder dùng cho cả list (limited + paginated) lẫn export (no limit).
 * Trả về mảng filter SQL[] để đưa vào WHERE. Ent_id LUÔN là filter [0]. */
function buildAuditFilters(entId: string, options: ListAuditOptions): SQL[] {
  const filters: SQL[] = [eq(carAuditLogs.entId, entId)];
  if (options.entity) filters.push(eq(carAuditLogs.audEntity, options.entity));
  if (options.actorId) filters.push(eq(carAuditLogs.audUserId, options.actorId));

  const term = options.q?.trim();
  if (term) {
    const like = `%${term}%`;
    const searchFilter = or(
      ilike(carAuditLogs.audAction, like),
      ilike(carAuditLogs.audEntity, like),
      ilike(carAuditLogs.audEntityRef, like),
      ilike(carUsers.usrName, like),
    );
    if (searchFilter) filters.push(searchFilter);
  }
  return filters;
}

/** Paginated audit list. Trả về cả total để render Prev/Next + counter. */
export async function listAudit(
  entId: string,
  options: ListAuditOptions = {},
): Promise<ListAuditResult> {
  const pageSize = options.pageSize ?? 50;
  const page = Math.max(1, options.page ?? 1);
  const filters = buildAuditFilters(entId, options);

  const rowsPromise = db
    .select({ log: carAuditLogs, actorName: carUsers.usrName })
    .from(carAuditLogs)
    .leftJoin(carUsers, eq(carAuditLogs.audUserId, carUsers.usrId))
    .where(and(...filters))
    .orderBy(desc(carAuditLogs.audCreatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  /* Count cần cùng join (search dùng carUsers.usrName). LEFT JOIN trên FK nullable
   * 1:0..1, count(*) không inflate. */
  const countPromise = db
    .select({ count: sql<number>`count(*)::int` })
    .from(carAuditLogs)
    .leftJoin(carUsers, eq(carAuditLogs.audUserId, carUsers.usrId))
    .where(and(...filters));

  const [rows, countRows] = await Promise.all([rowsPromise, countPromise]);

  return {
    items: rows.map((r) => ({ ...r.log, actorName: r.actorName ?? null })),
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

/** Export-friendly variant: no pagination, hard-cap để tránh blow memory.
 *  Dùng cho /api/v1/audit/export route handler. */
export async function listAuditForExport(
  entId: string,
  options: Omit<ListAuditOptions, 'page' | 'pageSize'> & { maxRows?: number } = {},
): Promise<AuditRow[]> {
  const filters = buildAuditFilters(entId, options);
  const rows = await db
    .select({ log: carAuditLogs, actorName: carUsers.usrName })
    .from(carAuditLogs)
    .leftJoin(carUsers, eq(carAuditLogs.audUserId, carUsers.usrId))
    .where(and(...filters))
    .orderBy(desc(carAuditLogs.audCreatedAt))
    .limit(options.maxRows ?? 5000);
  return rows.map((r) => ({ ...r.log, actorName: r.actorName ?? null }));
}

/** Danh sách actor distinct cho dropdown filter — chỉ user trong tenant có
 *  audit row ít nhất 1 lần. Dùng cho audit page filter. */
export async function listAuditActors(
  entId: string,
): Promise<Array<{ id: string; name: string | null; email: string | null }>> {
  const rows = await db
    .selectDistinct({
      id: carUsers.usrId,
      name: carUsers.usrName,
      email: carUsers.usrEmail,
    })
    .from(carUsers)
    .innerJoin(carAuditLogs, eq(carAuditLogs.audUserId, carUsers.usrId))
    .where(
      and(
        eq(carUsers.entId, entId),
        eq(carAuditLogs.entId, entId), // double-scope: cả 2 phải cùng tenant
        isNull(carUsers.usrDeletedAt),
      ),
    );
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email }));
}

export async function listAuditForEntity(
  entId: string,
  entity: AuditEntity,
  entityId: string,
): Promise<AuditRow[]> {
  const rows = await db
    .select({
      log: carAuditLogs,
      actorName: carUsers.usrName,
    })
    .from(carAuditLogs)
    .leftJoin(carUsers, eq(carAuditLogs.audUserId, carUsers.usrId))
    .where(
      and(
        eq(carAuditLogs.entId, entId),
        eq(carAuditLogs.audEntity, entity),
        eq(carAuditLogs.audEntityId, entityId),
      ),
    )
    .orderBy(desc(carAuditLogs.audCreatedAt));

  return rows.map((r) => ({ ...r.log, actorName: r.actorName ?? null }));
}
