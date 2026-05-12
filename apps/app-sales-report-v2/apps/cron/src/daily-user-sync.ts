import { db } from '@v2/db';
import { sql } from 'drizzle-orm';

async function main(): Promise<void> {
  console.log('[cron daily-user-sync] starting');
  // TODO: fetch AMA users + upsert sal_users + mark deleted
  const result = await db.execute(sql`SELECT NOW() AS now`);
  console.log('[cron daily-user-sync] db ok:', result.rows[0]);
  console.log('[cron daily-user-sync] done');
}

main()
  .catch((err) => {
    console.error('[cron daily-user-sync] fatal:', err);
    process.exit(1);
  })
  .then(() => process.exit(0));
