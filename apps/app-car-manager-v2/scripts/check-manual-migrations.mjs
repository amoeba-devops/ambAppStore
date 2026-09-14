// Verify the MANUAL migrations — the ones deliberately NOT in the drizzle
// journal (packages/db/migrations/meta/_journal.json) and therefore never
// applied by `drizzle-kit migrate`.
//
// Why this exists: FIX-260914. Production reported 26/26 journal migrations
// applied ("nothing pending") while 0026 and 0030 had never been run, so the
// app 500'd with `relation "car_truck_maintenances" does not exist` as soon as
// a build that reads those tables was deployed. Journal state says nothing
// about these files — they have to be probed against the live schema.
//
// Run this BEFORE deploying a build that reads a newly added table.
//
// Usage:
//   node scripts/check-manual-migrations.mjs dev|staging|prod
//   DATABASE_URL=postgresql://... node scripts/check-manual-migrations.mjs
//
// Exit codes: 0 = all applied, 2 = one or more missing.

import { neon } from '@neondatabase/serverless';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../.env') });

const target = process.argv[2];
const url = target
  ? process.env[`DATABASE_URL_${target.toUpperCase()}`]
  : process.env.DATABASE_URL;

if (!url) {
  console.error(
    target
      ? `Missing DATABASE_URL_${target.toUpperCase()} in .env`
      : 'Usage: node scripts/check-manual-migrations.mjs <dev|staging|prod>  (or set DATABASE_URL)',
  );
  process.exit(1);
}

const sql = neon(url);
console.log(`\n→ Checking manual (non-journal) migrations on ${target ? target.toUpperCase() : 'DATABASE_URL'}`);
console.log(`  ${url.replace(/:[^:@/]+@/, ':****@').replace(/\?.*$/, '')}\n`);

const hasTable = async (t) =>
  (await sql`SELECT to_regclass(${'public.' + t}) AS r`)[0].r !== null;
const hasColumn = async (t, c) =>
  (await sql`SELECT 1 FROM information_schema.columns WHERE table_name=${t} AND column_name=${c}`).length > 0;

// Each entry mirrors one manual .sql file in packages/db/migrations/.
// When you add a new manual migration, add its probe here too.
const MIGRATIONS = [
  {
    file: '0026_truck_region_access.sql',
    probe: async () => await hasTable('car_user_region_access'),
    detail: 'table car_user_region_access',
  },
  {
    file: '0028_remove_vehicle_fuel_rate.sql',
    // Reverse sense: applied means the columns are GONE.
    probe: async () =>
      !(await hasColumn('car_vehicles', 'cvh_fuel_quota')) &&
      !(await hasColumn('car_vehicles', 'cvh_fuel_price')),
    detail: 'car_vehicles.cvh_fuel_quota/cvh_fuel_price dropped',
  },
  {
    file: '0029_truck_report_fixed_alloc.sql',
    probe: async () => await hasColumn('car_truck_reports', 'trr_fixed_alloc'),
    detail: 'column car_truck_reports.trr_fixed_alloc',
  },
  {
    file: '0030_truck_maintenance.sql',
    probe: async () => await hasTable('car_truck_maintenances'),
    detail: 'table car_truck_maintenances',
  },
  {
    file: '0031_truck_vehicle_status_normalize.sql',
    // Data migration: applied means no TRUCK still carries a hand-set status.
    probe: async () =>
      (
        await sql`SELECT count(*)::int AS n FROM car_vehicles
                   WHERE cvh_type='TRUCK'
                     AND cvh_status IN ('MAINTENANCE','IN_USE')
                     AND cvh_deleted_at IS NULL`
      )[0].n === 0,
    detail: 'no TRUCK rows left with hand-set MAINTENANCE/IN_USE',
  },
  {
    file: '0032_truck_maintenance_note_attachments.sql',
    probe: async () =>
      (await hasColumn('car_truck_maintenances', 'tmn_note')) &&
      (await hasTable('car_truck_maintenance_attachments')),
    detail: 'car_truck_maintenances.tmn_note + table car_truck_maintenance_attachments',
  },
];

const missing = [];
for (const m of MIGRATIONS) {
  let ok = false;
  try {
    ok = await m.probe();
  } catch (e) {
    console.log(`  ✗ ${m.file} — probe error: ${e.message}`);
    missing.push(m);
    continue;
  }
  console.log(`  ${ok ? '✓' : '✗'} ${m.file} — ${m.detail}`);
  if (!ok) missing.push(m);
}

console.log('');
if (missing.length === 0) {
  console.log(`✅ All ${MIGRATIONS.length} manual migrations applied.`);
} else {
  console.log(`⚠ ${missing.length}/${MIGRATIONS.length} manual migration(s) NOT applied:`);
  missing.forEach((m) => console.log(`    ✗ ${m.file}`));
  console.log('\nApply each missing file against this DB before deploying, e.g.:');
  missing.forEach((m) =>
    console.log(`    psql "$DATABASE_URL" -f packages/db/migrations/${m.file}`),
  );
  console.log('\n(All manual migrations are idempotent — safe to re-run.)');
  process.exit(2);
}
