'use server';

import 'server-only';
import { eq, and } from 'drizzle-orm';
import { SalError, type ActionResult } from '@v2/shared/errors';
import { db, schema, withEnt } from '@v2/db';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { presignDownload } from '@/server/services/s3.service';
import {
  listArchiveFilesForPeriod,
  type ArchivedFile,
} from '@/server/services/archive-files.service';

/**
 * Fetch current (non-replaced) archived files for a period — used by the
 * Upload wizard to preload "Previously uploaded files" when re-ingesting an
 * Active period.
 */
export async function listArchiveFilesForPeriodAction(input: {
  granularity: 'WEEKLY' | 'MONTHLY';
  weekNum?: number;
  monthIdx?: number;
  year: number;
}): Promise<ActionResult<{ files: ArchivedFile[] }>> {
  try {
    const user = await getCurrentUser();
    const files = await listArchiveFilesForPeriod({
      entId: user.entId,
      granularity: input.granularity,
      weekNum: input.weekNum,
      monthIdx: input.monthIdx,
      year: input.year,
    });
    return { success: true, data: { files } };
  } catch (err) {
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    console.error('[listArchiveFilesForPeriod]', err);
    return {
      success: false,
      error: { code: 'SAL-E0500', message: err instanceof Error ? err.message : 'Unknown error' },
    };
  }
}

/**
 * Generate a short-lived S3 download URL for an archived file. Returns
 * `{ url: null }` when the file has no S3 key (S3 wasn't configured at
 * ingest time) so the UI can disable the download button.
 */
export async function presignArchiveDownloadAction(
  arfId: string,
): Promise<ActionResult<{ url: string | null; filename: string | null }>> {
  try {
    const user = await getCurrentUser();
    const rows = await db
      .select({
        s3Key: schema.salArchiveFiles.arfS3Key,
        filename: schema.salArchiveFiles.arfFilename,
      })
      .from(schema.salArchiveFiles)
      .where(
        and(
          eq(schema.salArchiveFiles.arfId, arfId),
          withEnt(schema.salArchiveFiles.entId, user.entId),
        ),
      )
      .limit(1);
    if (!rows[0]) {
      return { success: false, error: { code: 'SAL-E0404', message: 'Archive file not found' } };
    }
    if (!rows[0].s3Key) {
      return { success: true, data: { url: null, filename: rows[0].filename } };
    }
    const url = await presignDownload(rows[0].s3Key, 300);
    return { success: true, data: { url, filename: rows[0].filename } };
  } catch (err) {
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    console.error('[presignArchiveDownload]', err);
    return {
      success: false,
      error: { code: 'SAL-E0500', message: err instanceof Error ? err.message : 'Unknown error' },
    };
  }
}
