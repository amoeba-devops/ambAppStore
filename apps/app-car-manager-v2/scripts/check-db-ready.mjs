// Check if the target Neon DB has the seed data needed by the app:
//   - tenant_settings row (so middleware onboarding gate passes)
//   - 4 car_users (Admin + 3 drivers) under the sentinel ent_id
//   - 3 car_drivers, 3 car_vehicles, ≥5 car_trips
//   - 6 car_notifications (user-guide seed)
//   - extra trips for driver Tú (TR-2001 PENDING_DRIVER_CONFIRMATION, TR-2002 CONFIRMED)
//
// Usage:
//   node scripts/check-db-ready.mjs dev      # uses DATABASE_URL_DEV from .env
//   node scripts/check-db-ready.mjs staging  # uses DATABASE_URL_STAGING from .env

import { neon } from '@neondatabase/serverless';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../.env') });

const target = process.argv[2];
if (!target || !['dev', 'staging'].includes(target)) {
  console.error('Usage: node scripts/check-db-ready.mjs <dev|staging>');
  process.exit(1);
}

const url = target === 'dev' ? process.env.DATABASE_URL_DEV : process.env.DATABASE_URL_STAGING;
if (!url) {
  console.error(`Missing DATABASE_URL_${target.toUpperCase()} in .env`);
  process.exit(1);
}

console.log(`\n→ Checking ${target.toUpperCase()} DB readiness`);
console.log(`  ${url.replace(/:[^:@]+@/, ':****@')}\n`);

const sql = neon(url);
const ENT_ID = '00000000-0000-4000-8000-000000000010';

const checks = [];
function check(label, ok, detail = '') {
  checks.push({ label, ok, detail });
  const icon = ok ? '✓' : '✗';
  console.log(`  ${icon} ${label}${detail ? ' — ' + detail : ''}`);
}

// 1. Tenant settings (needed for onboarding gate to pass)
const tns = await sql`SELECT tns_users_synced_at, tns_tenant_name FROM car_tenant_settings WHERE ent_id = ${ENT_ID}`;
check(
  'tenant_settings',
  tns.length > 0 && tns[0].tns_users_synced_at !== null,
  tns.length > 0 ? `tenant=${tns[0].tns_tenant_name}, synced_at=${tns[0].tns_users_synced_at?.toISOString().slice(0, 10) ?? 'NULL'}` : 'no row',
);

// 2. Users
const users = await sql`SELECT usr_name, usr_local_role FROM car_users WHERE ent_id = ${ENT_ID} ORDER BY usr_name`;
const adminNamed = users.some((u) => u.usr_name === 'Nguyễn Thanh An');
check('car_users count', users.length >= 4, `${users.length} users`);
check('Admin renamed to Nguyễn Thanh An', adminNamed, adminNamed ? '' : `current admin name: ${users.find(u=>u.usr_local_role==='ADMIN')?.usr_name ?? 'n/a'}`);

// 3. Drivers
const drivers = await sql`SELECT drv_status FROM car_drivers WHERE ent_id = ${ENT_ID}`;
check('car_drivers', drivers.length >= 3, `${drivers.length} drivers`);

// 4. Vehicles
const vehicles = await sql`SELECT cvh_status FROM car_vehicles WHERE ent_id = ${ENT_ID}`;
check('car_vehicles', vehicles.length >= 3, `${vehicles.length} vehicles`);

// 5. Trips (base seed: 5 trips + user-guide: 5 more = 10 expected)
const trips = await sql`SELECT trp_ref, trp_status FROM car_trips WHERE ent_id = ${ENT_ID} ORDER BY trp_ref`;
check('car_trips', trips.length >= 5, `${trips.length} trips (refs: ${trips.map(t=>t.trp_ref).join(', ')})`);

// 6. Critical trip IDs the driver-guide screenshots depend on
const tr2001 = await sql`SELECT trp_status FROM car_trips WHERE trp_id = '88888888-8888-8888-8888-888888888801'`;
const tr2002 = await sql`SELECT trp_status FROM car_trips WHERE trp_id = '88888888-8888-8888-8888-888888888802'`;
check('TR-2001 (PENDING_DRIVER_CONFIRMATION)', tr2001.length > 0 && tr2001[0].trp_status === 'PENDING_DRIVER_CONFIRMATION', tr2001.length > 0 ? `status=${tr2001[0].trp_status}` : 'missing');
check('TR-2002 (CONFIRMED)', tr2002.length > 0 && tr2002[0].trp_status === 'CONFIRMED', tr2002.length > 0 ? `status=${tr2002[0].trp_status}` : 'missing');

// 7. Notifications for inbox screenshot
const ntfs = await sql`SELECT COUNT(*)::int AS c FROM car_notifications WHERE ent_id = ${ENT_ID}`;
check('car_notifications', ntfs[0].c >= 6, `${ntfs[0].c} notifications`);

// 8. AMA app role mapping (no DB check — informational)
console.log(`\nUsers found in ent_id=${ENT_ID}:`);
users.forEach((u) => console.log(`  - ${u.usr_local_role.padEnd(7)} ${u.usr_name}`));

const failed = checks.filter((c) => !c.ok);
console.log('');
if (failed.length === 0) {
  console.log(`✅ ${target.toUpperCase()} DB ready (${checks.length}/${checks.length} checks passed)`);
} else {
  console.log(`⚠ ${target.toUpperCase()} DB NOT ready — ${failed.length}/${checks.length} checks failed:`);
  failed.forEach((c) => console.log(`    ✗ ${c.label}`));
  console.log(`\nFix: run \`node scripts/db-seed.mjs ${target}\` then \`node scripts/seed-user-guide.mjs ${target}\``);
  process.exit(2);
}
