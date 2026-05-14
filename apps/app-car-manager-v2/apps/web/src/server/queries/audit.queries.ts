import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carAuditLogs, carUsers, type CarAuditLog } from '@car-v2/db/schema';
import type { AuditEntity } from '../services/audit-log.service';

export interface AuditRow extends CarAuditLog {
  actorName: string | null;
}

export async function listAudit(
  entId: string,
  options: { entity?: AuditEntity; limit?: number } = {},
): Promise<AuditRow[]> {
  const { entity, limit = 50 } = options;
  const filters = entity
    ? and(eq(carAuditLogs.entId, entId), eq(carAuditLogs.audEntity, entity))
    : eq(carAuditLogs.entId, entId);

  const rows = await db
    .select({
      log: carAuditLogs,
      actorName: carUsers.usrName,
    })
    .from(carAuditLogs)
    .leftJoin(carUsers, eq(carAuditLogs.audUserId, carUsers.usrId))
    .where(filters)
    .orderBy(desc(carAuditLogs.audCreatedAt))
    .limit(limit);

  return rows.map((r) => ({ ...r.log, actorName: r.actorName ?? null }));
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
