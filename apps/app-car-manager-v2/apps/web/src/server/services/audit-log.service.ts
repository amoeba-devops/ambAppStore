import 'server-only';
import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { db } from '@car-v2/db/client';
import { carAuditLogs } from '@car-v2/db/schema';

export type AuditEntity = 'Trip' | 'Vehicle' | 'Driver' | 'Expense' | 'User' | 'System';

interface LogAuditInput {
  entId: string;
  /** Null when the action is performed by the system (e.g. cron). */
  userId: string | null;
  /** Verb in upper-snake: TRIP.CREATE, TRIP.ACCEPT, VEHICLE.STATUS_CHANGE, ... */
  action: string;
  entity: AuditEntity;
  entityId?: string;
  /** Human-readable label — TR-1042 for trips, plate for vehicles, name for drivers. */
  entityRef?: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Append-only audit log writer (NFR-9 — PRD §7).
 * Captures IP + UA from the current request headers.
 *
 * Never throws on the caller's behalf — audit failures must not bring down
 * the parent mutation. Errors are swallowed with a console.error.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
    const userAgent = h.get('user-agent') ?? null;

    await db.insert(carAuditLogs).values({
      audId: randomUUID(),
      entId: input.entId,
      audUserId: input.userId,
      audAction: input.action,
      audEntity: input.entity,
      audEntityId: input.entityId ?? null,
      audEntityRef: input.entityRef ?? null,
      audBefore: input.before == null ? null : (input.before as object),
      audAfter: input.after == null ? null : (input.after as object),
      audIp: ip,
      audUserAgent: userAgent,
    });
  } catch (err) {
    /* eslint-disable-next-line no-console */
    console.error('[audit-log] failed to record action', input.action, err);
  }
}
