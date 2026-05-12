import { db, schema } from '@v2/db';
import { sql } from 'drizzle-orm';

const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2000);
const WORKER_ID = process.env.RENDER_INSTANCE_ID ?? `local-${process.pid}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimNextJob(): Promise<schema.SalUploadSession | null> {
  const result = await db.execute(sql`
    UPDATE sal_upload_sessions
    SET ups_status = 'PROCESSING',
        ups_started_at = NOW(),
        ups_worker_id = ${WORKER_ID}
    WHERE ups_id = (
      SELECT ups_id FROM sal_upload_sessions
      WHERE ups_status = 'PENDING'
        AND (ups_next_retry_at IS NULL OR ups_next_retry_at <= NOW())
      ORDER BY ups_created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  const rows = result.rows as unknown as schema.SalUploadSession[];
  return rows[0] ?? null;
}

async function processJob(job: schema.SalUploadSession): Promise<void> {
  console.log(`[worker] processing ${job.upsId} period=${job.upsPeriodStart}..${job.upsPeriodEnd}`);
  // TODO: section split + parse + CM calc — see docs/system-design/background-jobs.md
  await db.execute(sql`
    UPDATE sal_upload_sessions
    SET ups_status = 'READY', ups_updated_at = NOW()
    WHERE ups_id = ${job.upsId}
  `);
}

async function markFailed(jobId: string, errorMessage: string): Promise<void> {
  await db.execute(sql`
    UPDATE sal_upload_sessions
    SET ups_status = 'FAILED',
        ups_error_log = ${errorMessage},
        ups_retry_count = ups_retry_count + 1,
        ups_next_retry_at = NOW() + INTERVAL '1 minute' * POWER(5, ups_retry_count),
        ups_updated_at = NOW()
    WHERE ups_id = ${jobId}
  `);
}

async function main(): Promise<void> {
  console.log(`[worker] starting workerId=${WORKER_ID} pollMs=${POLL_MS}`);
  while (true) {
    try {
      const job = await claimNextJob();
      if (job) {
        try {
          await processJob(job);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[worker] job ${job.upsId} failed:`, message);
          await markFailed(job.upsId, message);
        }
      } else {
        await sleep(POLL_MS);
      }
    } catch (err) {
      console.error('[worker] poll error:', err);
      await sleep(POLL_MS * 5);
    }
  }
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
