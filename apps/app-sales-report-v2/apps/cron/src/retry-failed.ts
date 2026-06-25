import { db } from '@v2/db';
import { sql } from 'drizzle-orm';

async function main(): Promise<void> {
  console.log('[cron retry-failed] starting');
  const result = await db.execute(sql`
    UPDATE sal_upload_sessions
    SET ups_status = 'PENDING', ups_next_retry_at = NULL, ups_updated_at = NOW()
    WHERE ups_status = 'FAILED'
      AND ups_retry_count < ups_max_retries
      AND (ups_next_retry_at IS NULL OR ups_next_retry_at <= NOW())
    RETURNING ups_id
  `);
  console.log(`[cron retry-failed] requeued ${result.rows.length} job(s)`);
}

main()
  .catch((err) => {
    console.error('[cron retry-failed] fatal:', err);
    process.exit(1);
  })
  .then(() => process.exit(0));
