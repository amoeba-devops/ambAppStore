// Audit CAR ↔ TRUCK data integrity. READ-ONLY — runs SELECTs and nothing else.
//
// The two fleet departments share car_vehicles, car_drivers, car_trips and
// car_users, discriminated by `cvh_type`, `trp_kind` and rows in
// car_user_fleet_access. Nothing in the schema enforces that they stay
// consistent, so this script asserts the invariants the app relies on. Every
// one expects ZERO violating rows; violations are printed with their rows.
//
// Usage:
//   node scripts/audit-fleet-integrity.mjs              # DATABASE_URL (local)
//   node scripts/audit-fleet-integrity.mjs dev          # DATABASE_URL_DEV
//   node scripts/audit-fleet-integrity.mjs staging      # DATABASE_URL_STAGING
//   DATABASE_URL=postgres://… node scripts/audit-fleet-integrity.mjs
//
// ⚠️ Confirm the host it prints. `.env`'s DATABASE_URL_STAGING has pointed at a
// DIFFERENT Neon branch than the deployed staging service before now, so an
// explicit DATABASE_URL is the unambiguous way to audit a specific branch.
//
// Exit code 0 = all invariants hold, 1 = at least one violation (usable as a
// post-deploy gate). This covers DATA only; to confirm what each SCREEN renders,
// sign in per role and compare the counts printed in the summary below.

import { neon } from '@neondatabase/serverless';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../.env') });

const target = process.argv[2];
const url =
  process.env.DATABASE_URL_OVERRIDE ??
  (target === 'dev'
    ? process.env.DATABASE_URL_DEV
    : target === 'staging'
      ? process.env.DATABASE_URL_STAGING
      : process.env.DATABASE_URL);

if (!url) {
  console.error('No connection string. Set DATABASE_URL, or pass dev|staging.');
  process.exit(1);
}
console.log(`\n→ Fleet integrity audit (read-only)`);
console.log(`  host: ${url.match(/@([^/]+)/)?.[1] ?? '(unparsed)'}\n`);

const sql = neon(url);
const q = (text) => sql(Object.assign([text], { raw: [text] }));

/* A driver "belongs to" TRUCK when a live membership row says so. The CAR
 * roster is the complement (NOT EXISTS TRUCK) rather than EXISTS CAR, because
 * createDriverAction only grants a membership when the caller names a
 * department — drivers created from /drivers/new carry no CAR row. Both roster
 * queries in the app use exactly these predicates. */
const IS_TRUCK = `exists (select 1 from car_user_fleet_access f
  where f.usr_id = d.drv_user_id and f.ent_id = d.ent_id
    and f.ufa_vehicle_type = 'TRUCK' and f.ufa_deleted_at is null)`;

const CHECKS = [
  ['VEHICLE', 'plate is unique among live vehicles per tenant', `
    select ent_id, cvh_plate_number, count(*) as n from car_vehicles
    where cvh_deleted_at is null group by ent_id, cvh_plate_number having count(*) > 1`],
  ['VEHICLE', 'no CAR carries truck-only attributes', `
    select cvh_plate_number from car_vehicles
    where cvh_deleted_at is null and cvh_type = 'CAR'
      and (cvh_tonnage is not null or cvh_fuel_quota is not null or cvh_region is not null
           or cvh_depreciation is not null or cvh_default_driver_id is not null)`],
  ['VEHICLE', 'no truck points at a deleted default driver', `
    select v.cvh_plate_number from car_vehicles v
    join car_drivers d on d.drv_id = v.cvh_default_driver_id
    where v.cvh_type = 'TRUCK' and v.cvh_deleted_at is null and d.drv_deleted_at is not null`],
  ['VEHICLE', "a truck's default driver has TRUCK access", `
    select v.cvh_plate_number, u.usr_name from car_vehicles v
    join car_drivers d on d.drv_id = v.cvh_default_driver_id
    join car_users u on u.usr_id = d.drv_user_id
    where v.cvh_type = 'TRUCK' and v.cvh_deleted_at is null and d.drv_deleted_at is null
      and not ${IS_TRUCK}`],
  ['VEHICLE', 'no dangling default-driver reference', `
    select cvh_plate_number from car_vehicles v
    where v.cvh_default_driver_id is not null and v.cvh_deleted_at is null
      and not exists (select 1 from car_drivers d where d.drv_id = v.cvh_default_driver_id)`],

  ['DRIVER', 'no DRIVER holds two departments', `
    select u.usr_name, count(*) as depts from car_user_fleet_access f
    join car_users u on u.usr_id = f.usr_id
    where f.ufa_deleted_at is null and u.usr_local_role = 'DRIVER'
    group by u.usr_id, u.usr_name having count(*) > 1`],
  ['DRIVER', 'every DRIVER-role driver has exactly one department', `
    select u.usr_name from car_drivers d join car_users u on u.usr_id = d.drv_user_id
    where d.drv_deleted_at is null and u.usr_local_role = 'DRIVER'
      and (select count(*) from car_user_fleet_access f
           where f.usr_id = d.drv_user_id and f.ent_id = d.ent_id
             and f.ufa_deleted_at is null) <> 1`],
  ['DRIVER', 'no membership outlives its driver record', `
    select u.usr_name, f.ufa_vehicle_type from car_user_fleet_access f
    join car_users u on u.usr_id = f.usr_id
    where f.ufa_deleted_at is null and u.usr_local_role = 'DRIVER'
      and exists (select 1 from car_drivers d where d.drv_user_id = f.usr_id and d.ent_id = f.ent_id)
      and not exists (select 1 from car_drivers d where d.drv_user_id = f.usr_id
        and d.ent_id = f.ent_id and d.drv_deleted_at is null)`],
  ['DRIVER', 'at most one live driver record per user', `
    select ent_id, drv_user_id, count(*) as n from car_drivers
    where drv_deleted_at is null group by ent_id, drv_user_id having count(*) > 1`],
  ['DRIVER', 'every driver record points at a real user', `
    select d.drv_id from car_drivers d
    where not exists (select 1 from car_users u where u.usr_id = d.drv_user_id)`],
  /* Delete-then-recreate used to mint a NEW drv_id, stranding every trip on the
   * row it just retired: the driver opened /today to an empty screen while
   * /truck/trips still printed their name (getDriverNamesByIds ignores
   * soft-delete), so nothing looked broken. createDriverAction now revives the
   * retired row instead — this check catches any split that predates that fix,
   * or one made by hand in SQL. A retired row keeping its trips is FINE on its
   * own (that is a former driver's history); the defect is history sitting on a
   * retired row while the SAME user has a live row to sit on. */
  ['DRIVER', "no user's trips are split across a retired and a live driver row", `
    select u.usr_name, count(*) as stranded_trips
    from car_trips t
    join car_drivers dead on dead.drv_id = t.trp_driver_id
    join car_users u on u.usr_id = dead.drv_user_id
    where t.trp_deleted_at is null and dead.drv_deleted_at is not null
      and exists (select 1 from car_drivers live where live.drv_user_id = dead.drv_user_id
        and live.ent_id = dead.ent_id and live.drv_deleted_at is null)
    group by u.usr_id, u.usr_name`],

  ['TRIP', 'no DISPATCH trip on a TRUCK', `
    select t.trp_ref, v.cvh_plate_number from car_trips t
    join car_vehicles v on v.cvh_id = t.trp_vehicle_id
    where t.trp_deleted_at is null and t.trp_kind = 'DISPATCH' and v.cvh_type = 'TRUCK'`],
  ['TRIP', 'no LOG trip on a CAR', `
    select t.trp_ref, v.cvh_plate_number from car_trips t
    join car_vehicles v on v.cvh_id = t.trp_vehicle_id
    where t.trp_deleted_at is null and t.trp_kind = 'LOG' and v.cvh_type = 'CAR'`],
  ['TRIP', 'no DISPATCH trip assigned to a truck driver', `
    select t.trp_ref, u.usr_name from car_trips t
    join car_drivers d on d.drv_id = t.trp_driver_id
    join car_users u on u.usr_id = d.drv_user_id
    where t.trp_deleted_at is null and t.trp_kind = 'DISPATCH' and ${IS_TRUCK}`],
  ['TRIP', 'every LOG trip driver has TRUCK access', `
    select t.trp_ref, u.usr_name from car_trips t
    join car_drivers d on d.drv_id = t.trp_driver_id
    join car_users u on u.usr_id = d.drv_user_id
    where t.trp_deleted_at is null and t.trp_kind = 'LOG' and not ${IS_TRUCK}`],
  ['TRIP', 'trip vehicle and trip driver are in the same department', `
    select t.trp_ref, v.cvh_type from car_trips t
    join car_vehicles v on v.cvh_id = t.trp_vehicle_id
    join car_drivers d on d.drv_id = t.trp_driver_id
    where t.trp_deleted_at is null and (v.cvh_type = 'TRUCK') <> (${IS_TRUCK})`],
  /* An in-flight trip whose driver no longer exists can never move: nobody can
   * accept, start or finish it, and it keeps occupying the calendar. Deleting a
   * driver is deliberately soft-warning-only (PRD: the admin is warned and may
   * proceed), so this is not unreachable by design — it is the signal to go
   * reassign. Completed / cancelled trips on a retired driver are history and
   * are NOT flagged. */
  ['TRIP', 'no in-flight trip is assigned to a deleted driver', `
    select t.trp_ref, t.trp_status, u.usr_name from car_trips t
    join car_drivers d on d.drv_id = t.trp_driver_id
    join car_users u on u.usr_id = d.drv_user_id
    where t.trp_deleted_at is null and d.drv_deleted_at is not null
      and t.trp_status in ('PENDING_DRIVER_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS')`],
  ['TRIP', 'no cross-tenant vehicle reference', `
    select t.trp_ref from car_trips t join car_vehicles v on v.cvh_id = t.trp_vehicle_id
    where t.ent_id <> v.ent_id`],
  ['TRIP', 'no cross-tenant driver reference', `
    select t.trp_ref from car_trips t join car_drivers d on d.drv_id = t.trp_driver_id
    where t.ent_id <> d.ent_id`],

  ['USER', 'no duplicate AMA user within a tenant', `
    select ent_id, usr_ama_user_id, count(*) as n from car_users
    where usr_deleted_at is null group by ent_id, usr_ama_user_id having count(*) > 1`],
  ['USER', 'no live membership on a deleted user', `
    select u.usr_name from car_user_fleet_access f join car_users u on u.usr_id = f.usr_id
    where f.ufa_deleted_at is null and u.usr_deleted_at is not null`],
  ['USER', 'no duplicate live membership row', `
    select ent_id, usr_id, ufa_vehicle_type, count(*) as n from car_user_fleet_access
    where ufa_deleted_at is null group by ent_id, usr_id, ufa_vehicle_type having count(*) > 1`],

  ['MODULE', 'no car-module expense attached to a truck', `
    select e.exp_id, v.cvh_plate_number from car_expenses e
    join car_vehicles v on v.cvh_id = e.exp_vehicle_id
    where e.exp_deleted_at is null and v.cvh_type = 'TRUCK'`],
  ['MODULE', 'no maintenance alert raised against a truck', `
    select a.mal_id, v.cvh_plate_number from car_maintenance_alerts a
    join car_vehicles v on v.cvh_id = a.mal_vehicle_id where v.cvh_type = 'TRUCK'`],
  /* Same split as the DRIVER check above, on the expense side — a claim the
   * driver filed but can no longer see in their own list. */
  ['MODULE', "no user's expenses are split across a retired and a live driver row", `
    select u.usr_name, count(*) as stranded_expenses
    from car_expenses e
    join car_drivers dead on dead.drv_id = e.exp_driver_id
    join car_users u on u.usr_id = dead.drv_user_id
    where e.exp_deleted_at is null and dead.drv_deleted_at is not null
      and exists (select 1 from car_drivers live where live.drv_user_id = dead.drv_user_id
        and live.ent_id = dead.ent_id and live.drv_deleted_at is null)
    group by u.usr_id, u.usr_name`],
];

const results = [];
for (const [group, name, text] of CHECKS) {
  let rows;
  try {
    rows = await q(text);
  } catch (e) {
    results.push({ group, invariant: name, violations: '?', ok: `ERROR ${e.message.slice(0, 40)}` });
    continue;
  }
  results.push({ group, invariant: name, violations: rows.length, ok: rows.length === 0 ? 'PASS' : 'FAIL' });
  if (rows.length) {
    console.log(`\nFAIL — ${group}: ${name}`);
    console.table(rows.slice(0, 10));
    if (rows.length > 10) console.log(`  …and ${rows.length - 10} more`);
  }
}

console.table(results);

/* Context, not assertions — the numbers each screen should show. The two
 * driver rosters must partition the live drivers with no overlap. */
const [counts] = await q(`select
  (select count(*) from car_vehicles where cvh_deleted_at is null and cvh_type='CAR') as car_vehicles,
  (select count(*) from car_vehicles where cvh_deleted_at is null and cvh_type='TRUCK') as truck_vehicles,
  (select count(*) from car_drivers d where d.drv_deleted_at is null and not ${IS_TRUCK}) as car_drivers,
  (select count(*) from car_drivers d where d.drv_deleted_at is null and ${IS_TRUCK}) as truck_drivers,
  (select count(*) from car_drivers where drv_deleted_at is null) as live_drivers,
  (select count(*) from car_trips where trp_deleted_at is null and trp_kind='DISPATCH') as dispatch_trips,
  (select count(*) from car_trips where trp_deleted_at is null and trp_kind='LOG') as log_trips`);
console.log('\nRow counts (all tenants) — what the screens should show:');
console.table([counts]);
const partitioned = Number(counts.car_drivers) + Number(counts.truck_drivers) === Number(counts.live_drivers);
console.log(`  driver rosters partition cleanly: ${partitioned ? 'yes' : 'NO — overlap or gap'}`);

const failed = results.filter((r) => r.ok !== 'PASS');
console.log(
  failed.length === 0
    ? `\nAll ${results.length} invariants hold.\n`
    : `\n${failed.length} of ${results.length} invariants FAILED.\n`,
);
process.exit(failed.length === 0 && partitioned ? 0 : 1);
