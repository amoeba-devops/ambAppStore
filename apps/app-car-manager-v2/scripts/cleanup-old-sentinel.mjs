// One-shot cleanup: remove orphan rows in old sentinel ent_id created by
// seed-user-guide.mjs BEFORE the UUID migration to RFC 4122 v4 (commit 7de1a0c).
// Safe to run once; after this, the old ent_id is empty and the new seed
// re-creates everything under '00000000-0000-4000-8000-000000000010'.

import { neon } from '@neondatabase/serverless';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../.env') });

const url = process.env.DATABASE_URL_DEV ?? process.env.DATABASE_URL;
if (!url) { console.error('No DB URL'); process.exit(1); }

const sql = neon(url);
const OLD = '00000000-0000-0000-0000-000000000010';

// Delete in FK-safe order (children → parents).
const tables = [
  'car_expense_attachments',
  'car_audit_logs',
  'car_notifications',
  'car_push_subscriptions',
  'car_trip_stopovers',
  'car_expenses',
  'car_trips',
  'car_drivers',
  'car_vehicles',
  'car_approval_rules',
  'car_users',
  'car_tenant_settings',
];
for (const t of tables) {
  try {
    await sql(`DELETE FROM ${t} WHERE ent_id = $1`, [OLD]);
    console.log(`  ✓ ${t}`);
  } catch (e) {
    console.log(`  ⚠ ${t}: ${e.message.slice(0, 100)}`);
  }
}
console.log(`Done — cleaned ent_id ${OLD}`);
