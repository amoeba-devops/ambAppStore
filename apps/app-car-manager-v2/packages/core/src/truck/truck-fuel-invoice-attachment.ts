import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carTruckFuelInvoiceAttachments,
  type CarTruckFuelInvoiceAttachment,
} from '@car-v2/db/schema';

/**
 * Fuel-invoice scan/photo attachments (REQ-20260921). Pure domain: ent-scoped
 * DB ops only — the caller (server action) owns audit / revalidate.
 *
 * OPTIONAL — car_truck_fuel_invoices is a numeric ledger that has always
 * worked with zero attachments; this table only exists so a ledger row CAN
 * carry 0..n files when the user chooses to attach the real invoice scan.
 *
 * Deliberately the same contract as `truck-maintenance-attachment.ts` (same
 * diff-by-S3-key reconcile) so all attachment surfaces behave identically.
 */

export interface FuelInvoiceAttachmentInput {
  /** S3 object key the client already PUT the file to (presigned upload). */
  s3Key: string;
  mime: string;
  sizeBytes: number;
  /** Original device filename (REQ-20260915 contract) — shown in the UI. */
  fileName?: string | null;
  /** Uploader (REQ-20260921) — the actor performing THIS save. Only stamped
   * on newly inserted rows; untouched existing rows keep their original
   * uploader. */
  uploadedBy?: string | null;
}

/** Live (non-deleted) files of a fuel-invoice ledger row, oldest first. */
export async function getFuelInvoiceAttachments(
  entId: string,
  tfiId: string,
): Promise<CarTruckFuelInvoiceAttachment[]> {
  return db
    .select()
    .from(carTruckFuelInvoiceAttachments)
    .where(
      and(
        eq(carTruckFuelInvoiceAttachments.entId, entId),
        eq(carTruckFuelInvoiceAttachments.tfiId, tfiId),
        isNull(carTruckFuelInvoiceAttachments.tfaDeletedAt),
      ),
    )
    .orderBy(carTruckFuelInvoiceAttachments.tfaUploadedAt);
}

/**
 * Reconcile a fuel-invoice row's files to `desired`. Diff by S3 key:
 *   - key in desired but not live → INSERT
 *   - key live but not in desired → soft-delete
 *   - key in both → untouched
 *
 * Idempotent + sequential (neon-http has no interactive transaction). Passing
 * an empty array soft-deletes every live file of the row — acceptable here
 * since attachments are optional (R4).
 */
export async function syncFuelInvoiceAttachments(
  entId: string,
  tfiId: string,
  desired: FuelInvoiceAttachmentInput[],
): Promise<void> {
  const live = await getFuelInvoiceAttachments(entId, tfiId);
  const liveKeys = new Set(live.map((a) => a.tfaS3Key));
  const desiredKeys = new Set(desired.map((d) => d.s3Key));

  const toDelete = live.filter((a) => !desiredKeys.has(a.tfaS3Key)).map((a) => a.tfaId);
  if (toDelete.length > 0) {
    await db
      .update(carTruckFuelInvoiceAttachments)
      .set({ tfaDeletedAt: new Date() })
      .where(
        and(
          eq(carTruckFuelInvoiceAttachments.entId, entId),
          inArray(carTruckFuelInvoiceAttachments.tfaId, toDelete),
        ),
      );
  }

  const toInsert = desired.filter((d) => !liveKeys.has(d.s3Key));
  if (toInsert.length > 0) {
    await db.insert(carTruckFuelInvoiceAttachments).values(
      toInsert.map((d) => ({
        tfaId: randomUUID(),
        entId,
        tfiId,
        tfaS3Key: d.s3Key,
        tfaMime: d.mime,
        tfaSizeBytes: d.sizeBytes,
        tfaFileName: d.fileName ?? null,
        tfaUploadedBy: d.uploadedBy ?? null,
      })),
    );
  }
}
