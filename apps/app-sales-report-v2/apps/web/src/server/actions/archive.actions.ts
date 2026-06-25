'use server';

import 'server-only';
import { SalError, type ActionResult } from '@v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
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

