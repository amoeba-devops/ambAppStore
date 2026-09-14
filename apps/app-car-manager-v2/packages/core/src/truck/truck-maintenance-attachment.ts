import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carTruckMaintenanceAttachments,
  type CarTruckMaintenanceAttachment,
} from '@car-v2/db/schema';

/**
 * Maintenance invoice attachments (REQ-20260914). Pure domain: ent-scoped DB
 * ops only — the caller (server action) owns audit / revalidate.
 *
 * Deliberately the same contract as `truck-cost-attachment.ts` (trip receipts)
 * so both screens behave identically: the form posts the FULL desired set and
 * the server diffs it by S3 key. Dropped files are soft-deleted (row + S3
 * object kept for audit), never hard-deleted.
 */

export interface MaintenanceAttachmentInput {
  /** S3 object key the client already PUT the file to (presigned upload). */
  s3Key: string;
  mime: string;
  sizeBytes: number;
}

/** Live (non-deleted) invoice files of a job, oldest first. */
export async function getMaintenanceAttachments(
  entId: string,
  maintenanceId: string,
): Promise<CarTruckMaintenanceAttachment[]> {
  return db
    .select()
    .from(carTruckMaintenanceAttachments)
    .where(
      and(
        eq(carTruckMaintenanceAttachments.entId, entId),
        eq(carTruckMaintenanceAttachments.tmnId, maintenanceId),
        isNull(carTruckMaintenanceAttachments.tmaDeletedAt),
      ),
    )
    .orderBy(carTruckMaintenanceAttachments.tmaUploadedAt);
}

/**
 * Reconcile a job's invoices to `desired`. Diff by S3 key:
 *   - key in desired but not live → INSERT
 *   - key live but not in desired → soft-delete
 *   - key in both → untouched
 *
 * Idempotent + sequential (neon-http has no interactive transaction). Passing
 * an empty array soft-deletes every live invoice of the job.
 *
 * `undefined` must NOT reach here as an empty array: an update that doesn't
 * carry the attachment field should leave files alone — the caller decides.
 */
export async function syncMaintenanceAttachments(
  entId: string,
  maintenanceId: string,
  desired: MaintenanceAttachmentInput[],
): Promise<void> {
  const live = await getMaintenanceAttachments(entId, maintenanceId);
  const liveKeys = new Set(live.map((a) => a.tmaS3Key));
  const desiredKeys = new Set(desired.map((d) => d.s3Key));

  const toDelete = live.filter((a) => !desiredKeys.has(a.tmaS3Key)).map((a) => a.tmaId);
  if (toDelete.length > 0) {
    await db
      .update(carTruckMaintenanceAttachments)
      .set({ tmaDeletedAt: new Date() })
      .where(
        and(
          eq(carTruckMaintenanceAttachments.entId, entId),
          inArray(carTruckMaintenanceAttachments.tmaId, toDelete),
        ),
      );
  }

  /* A key matching a soft-deleted row is treated as new — insert a fresh row
   * rather than resurrect, so the earlier delete stays in the audit trail. */
  const toInsert = desired.filter((d) => !liveKeys.has(d.s3Key));
  if (toInsert.length > 0) {
    await db.insert(carTruckMaintenanceAttachments).values(
      toInsert.map((d) => ({
        tmaId: randomUUID(),
        entId,
        tmnId: maintenanceId,
        tmaS3Key: d.s3Key,
        tmaMime: d.mime,
        tmaSizeBytes: d.sizeBytes,
      })),
    );
  }
}

/** Live invoice COUNT per job — the list screen shows a paperclip badge. */
export async function countMaintenanceAttachments(
  entId: string,
  maintenanceIds: readonly string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (maintenanceIds.length === 0) return out;
  const rows = await db
    .select({ tmnId: carTruckMaintenanceAttachments.tmnId })
    .from(carTruckMaintenanceAttachments)
    .where(
      and(
        eq(carTruckMaintenanceAttachments.entId, entId),
        inArray(carTruckMaintenanceAttachments.tmnId, [...maintenanceIds]),
        isNull(carTruckMaintenanceAttachments.tmaDeletedAt),
      ),
    );
  for (const r of rows) out.set(r.tmnId, (out.get(r.tmnId) ?? 0) + 1);
  return out;
}
