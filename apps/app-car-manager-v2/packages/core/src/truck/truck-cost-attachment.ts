import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTripCostAttachments, type CarTripCostAttachment } from '@car-v2/db/schema';

/**
 * Trip-cost receipt attachments (REQ-20260709). Pure domain: ent-scoped DB ops
 * only — the caller (server action) owns audit / revalidate.
 *
 * Attachments are trip-scoped and tagged by cost bucket (FUEL / TOLL / EXTRA).
 * See car_trip_cost_attachments schema for why there's no per-extra-row FK.
 */

export type TripCostKind = 'FUEL' | 'TOLL' | 'EXTRA';

export interface TripCostAttachmentInput {
  costKind: TripCostKind;
  /** S3 object key the client already PUT the file to (presigned upload). */
  s3Key: string;
  mime: string;
  sizeBytes: number;
}

/** Live (non-deleted) attachments for a trip, oldest first. */
export async function getTripCostAttachments(
  entId: string,
  tripId: string,
): Promise<CarTripCostAttachment[]> {
  return db
    .select()
    .from(carTripCostAttachments)
    .where(
      and(
        eq(carTripCostAttachments.entId, entId),
        eq(carTripCostAttachments.trpId, tripId),
        isNull(carTripCostAttachments.tcaDeletedAt),
      ),
    )
    .orderBy(carTripCostAttachments.tcaUploadedAt);
}

/**
 * Reconcile a trip's attachments to `desired` (the full set the form kept +
 * newly uploaded). Diff by S3 key:
 *   - key in desired but not in DB (live) → INSERT
 *   - key in DB (live) but not in desired → soft-delete (set tca_deleted_at,
 *     keep row + S3 object for audit)
 *   - key in both → leave untouched
 *
 * Idempotent + sequential (neon-http has no interactive transaction). When
 * `desired` is empty, all live attachments for the trip are soft-deleted.
 */
export async function syncTripCostAttachments(
  entId: string,
  tripId: string,
  desired: TripCostAttachmentInput[],
): Promise<void> {
  const live = await getTripCostAttachments(entId, tripId);
  const liveByKey = new Map(live.map((a) => [a.tcaS3Key, a]));
  const desiredKeys = new Set(desired.map((d) => d.s3Key));

  /* Soft-delete rows the form dropped. */
  const toDelete = live.filter((a) => !desiredKeys.has(a.tcaS3Key)).map((a) => a.tcaId);
  if (toDelete.length > 0) {
    await db
      .update(carTripCostAttachments)
      .set({ tcaDeletedAt: new Date() })
      .where(
        and(
          eq(carTripCostAttachments.entId, entId),
          inArray(carTripCostAttachments.tcaId, toDelete),
        ),
      );
  }

  /* Insert keys not already persisted (live). A key that matches a soft-deleted
   * row is treated as new — we insert a fresh row rather than resurrect, so the
   * audit trail of the prior delete stays intact. */
  const toInsert = desired.filter((d) => !liveByKey.has(d.s3Key));
  if (toInsert.length > 0) {
    await db.insert(carTripCostAttachments).values(
      toInsert.map((d) => ({
        tcaId: randomUUID(),
        entId,
        trpId: tripId,
        tcaCostKind: d.costKind,
        tcaS3Key: d.s3Key,
        tcaMime: d.mime,
        tcaSizeBytes: d.sizeBytes,
      })),
    );
  }
}
