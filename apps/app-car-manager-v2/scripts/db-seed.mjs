#!/usr/bin/env node
/**
 * Seed sample data into a Neon branch.
 *
 *   node scripts/db-seed.mjs dev       # uses DATABASE_URL_DEV
 *   node scripts/db-seed.mjs staging   # uses DATABASE_URL_STAGING
 *
 * Idempotent — uses INSERT ... ON CONFLICT DO NOTHING for the deterministic
 * seed IDs below. Safe to re-run.
 *
 * Seed:
 *   • 1 tenant (HanaTech VN)
 *   • 4 users: 1 Admin (Park Joon-ho) + 3 Drivers (Tú, Hùng, Đức)
 *   • 3 drivers (rows in car_drivers, FK to user)
 *   • 3 vehicles (51K-238.91, 30A-556.07, 51F-712.34)
 *   • 5 trips covering 5 of 7 states
 *   • Audit log entries for each trip
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');

const VALID_TARGETS = ['dev', 'staging'];
const target = process.argv[2];
if (!target || !VALID_TARGETS.includes(target)) {
  console.error(`Usage: node scripts/db-seed.mjs <${VALID_TARGETS.join(' | ')}>`);
  process.exit(1);
}

// Parse .env (same logic as db-migrate.mjs)
const vars = {};
for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m) vars[m[1]] = m[2];
}
const url = vars[`DATABASE_URL_${target.toUpperCase()}`];
if (!url) {
  console.error(`✗ Missing DATABASE_URL_${target.toUpperCase()} in .env`);
  process.exit(1);
}

const sql = neon(url);

// ─── Deterministic IDs ───────────────────────────────────────────────────
// Same ent_id as /dev-login JWT payload — see apps/web/src/app/dev-login/route.ts
// RFC4122 v4 format (position 13='4', position 17='8') required by AMA uuidValidate.
const ENT_ID = '00000000-0000-4000-8000-000000000010';

// Users — UUID v4 fixed for seed reproducibility.
// The Admin user_id matches the JWT.sub in dev-login (so /dev-login session sees this seed).
const U_ADMIN = '00000000-0000-4000-8000-000000000001';
const U_TU    = '11111111-1111-1111-1111-111111111101';
const U_HUNG  = '11111111-1111-1111-1111-111111111102';
const U_DUC   = '11111111-1111-1111-1111-111111111103';

const D_TU   = '22222222-2222-2222-2222-222222222201';
const D_HUNG = '22222222-2222-2222-2222-222222222202';
const D_DUC  = '22222222-2222-2222-2222-222222222203';

const V_STARIA  = '33333333-3333-3333-3333-333333333301';
const V_CARNIVAL = '33333333-3333-3333-3333-333333333302';
const V_CAMRY   = '33333333-3333-3333-3333-333333333303';

const T1 = '44444444-4444-4444-4444-444444444401';
const T2 = '44444444-4444-4444-4444-444444444402';
const T3 = '44444444-4444-4444-4444-444444444403';
const T4 = '44444444-4444-4444-4444-444444444404';
const T5 = '44444444-4444-4444-4444-444444444405';

// ─── Seed ────────────────────────────────────────────────────────────────
const masked = url.replace(/:[^:@/]+@/, ':****@');
console.log(`→ Seeding ${target.toUpperCase()} branch`);
console.log(`  ${masked}`);
console.log();

try {
  // Users
  await sql`
    INSERT INTO car_users (usr_id, ent_id, usr_ama_user_id, usr_email, usr_name, usr_local_role, usr_ama_role_snapshot)
    VALUES
      (${U_ADMIN}, ${ENT_ID}, ${U_ADMIN}, 'park.joonho@hanatech.vn',  'Park Joon-ho',   'ADMIN',  'OWNER'),
      (${U_TU},    ${ENT_ID}, ${U_TU},    'tu.nguyen@hanatech.vn',    'Nguyễn Văn Tú',  'DRIVER', 'MEMBER'),
      (${U_HUNG},  ${ENT_ID}, ${U_HUNG},  'hung.tran@hanatech.vn',    'Trần Quốc Hùng', 'DRIVER', 'MEMBER'),
      (${U_DUC},   ${ENT_ID}, ${U_DUC},   'duc.le@hanatech.vn',       'Lê Minh Đức',    'DRIVER', 'MEMBER')
    ON CONFLICT (usr_id) DO NOTHING
  `;
  console.log('  ✓ 4 users');

  // Drivers
  await sql`
    INSERT INTO car_drivers (drv_id, ent_id, drv_user_id, drv_license_number, drv_license_class, drv_license_expiry, drv_phone, drv_status)
    VALUES
      (${D_TU},   ${ENT_ID}, ${U_TU},   'B2-1234567', 'B2', '2028-08-12', '+84 90 555 8819', 'ON_TRIP'),
      (${D_HUNG}, ${ENT_ID}, ${U_HUNG}, 'B2-1108800', 'B2', '2027-02-04', '+84 91 444 7720', 'AVAILABLE'),
      (${D_DUC},  ${ENT_ID}, ${U_DUC},  'B2-1090012', 'B2', '2026-05-22', '+84 90 778 1132', 'OFF_DUTY')
    ON CONFLICT (drv_id) DO NOTHING
  `;
  console.log('  ✓ 3 drivers');

  // Vehicles
  await sql`
    INSERT INTO car_vehicles (cvh_id, ent_id, cvh_plate_number, cvh_model, cvh_make, cvh_year, cvh_color, cvh_status, cvh_odometer_km, cvh_last_oil_change_km, cvh_last_oil_change_at, cvh_home_base)
    VALUES
      (${V_STARIA},   ${ENT_ID}, '51K-238.91', 'Hyundai Staria 11',   'Hyundai', 2023, 'Pearl White',  'IN_USE',       18420, 15000, '2026-03-15', 'HCMC HQ'),
      (${V_CARNIVAL}, ${ENT_ID}, '30A-556.07', 'Kia Carnival SX',      'Kia',     2022, 'Aurora Black', 'AVAILABLE',    42118, 35000, '2025-12-20', 'HCMC HQ'),
      (${V_CAMRY},    ${ENT_ID}, '51F-712.34', 'Toyota Camry 2.5Q',    'Toyota',  2021, 'Silver',       'MAINTENANCE',  67830, 65000, '2026-04-22', 'HCMC HQ')
    ON CONFLICT (cvh_id) DO NOTHING
  `;
  console.log('  ✓ 3 vehicles');

  // Trips — 5 trips covering 5 of 7 states
  //   T1 IN_PROGRESS  (Tú/Staria)
  //   T2 CONFIRMED    (Hùng/Carnival)
  //   T3 PENDING_ASSIGNMENT (no driver/vehicle yet)
  //   T4 PENDING_DRIVER_CONFIRMATION (Đức/Camry pre-confirm)
  //   T5 COMPLETED    (Tú/Staria — historical)
  await sql`
    INSERT INTO car_trips (
      trp_id, ent_id, trp_ref, trp_creator_id, trp_passenger_id, trp_driver_id, trp_vehicle_id,
      trp_status, trp_pickup_address, trp_dropoff_address, trp_scheduled_at, trp_duration_minutes,
      trp_purpose, trp_started_at, trp_ended_at, trp_start_odometer, trp_end_odometer
    ) VALUES
      (${T1}, ${ENT_ID}, 'TR-1042', ${U_ADMIN}, ${U_ADMIN}, ${D_TU},   ${V_STARIA},
       'IN_PROGRESS', '225 Lê Thánh Tôn, D1, HCMC', 'Tan Son Nhat Intl. T2', NOW() - INTERVAL '8 minutes', 75,
       'Airport pickup for Seoul HQ delegation', NOW() - INTERVAL '8 minutes', NULL, 18420, NULL),

      (${T2}, ${ENT_ID}, 'TR-1041', ${U_ADMIN}, ${U_ADMIN}, ${D_HUNG}, ${V_CARNIVAL},
       'CONFIRMED', 'D7 Phú Mỹ Hưng', 'Long Hậu IZ', NOW() + INTERVAL '2 hours', 60,
       'Site visit — Q2 review', NULL, NULL, NULL, NULL),

      (${T3}, ${ENT_ID}, 'TR-1040', ${U_ADMIN}, ${U_ADMIN}, NULL, NULL,
       'PENDING_ASSIGNMENT', 'D3 HCMC', 'Diamond Plaza', NOW() + INTERVAL '4 hours', 45,
       'Client meeting', NULL, NULL, NULL, NULL),

      (${T4}, ${ENT_ID}, 'TR-1039', ${U_ADMIN}, ${U_ADMIN}, ${D_DUC}, ${V_CAMRY},
       'PENDING_DRIVER_CONFIRMATION', 'Bitexco', 'D2 The Manor', NOW() + INTERVAL '20 hours', 30,
       'Director transfer', NULL, NULL, NULL, NULL),

      (${T5}, ${ENT_ID}, 'TR-1037', ${U_ADMIN}, ${U_ADMIN}, ${D_TU}, ${V_STARIA},
       'COMPLETED', 'SGN T1', 'D1 Park Hyatt', NOW() - INTERVAL '2 days', 30,
       'CEO arrival pickup', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 23 hours', 18380, 18400)
    ON CONFLICT (trp_id) DO NOTHING
  `;
  console.log('  ✓ 5 trips (IN_PROGRESS, CONFIRMED, PENDING_ASSIGNMENT, PENDING_DRIVER_CONFIRMATION, COMPLETED)');

  // Audit log — pass JSON as a stringified parameter (NOT embedded inside the
  // SQL string template, otherwise neon's tagged-template interpolation places
  // parameter placeholders inside the literal and Postgres can't infer their
  // types).
  const auditId = (n) => `55555555-5555-5555-5555-55555555550${n}`;
  const rows = [
    [auditId(1), U_ADMIN, 'TRIP.CREATE',           'Trip',    T1,      'TR-1042',    { status: 'PENDING_ASSIGNMENT' },                                              '2 hours'],
    [auditId(2), U_ADMIN, 'TRIP.ASSIGN',           'Trip',    T1,      'TR-1042',    { status: 'PENDING_DRIVER_CONFIRMATION', driver_id: D_TU, vehicle_id: V_STARIA }, '1 hour 50 minutes'],
    [auditId(3), U_TU,    'TRIP.ACCEPT',           'Trip',    T1,      'TR-1042',    { status: 'CONFIRMED' },                                                         '1 hour 30 minutes'],
    [auditId(4), U_TU,    'TRIP.START',            'Trip',    T1,      'TR-1042',    { status: 'IN_PROGRESS' },                                                       '8 minutes'],
    [auditId(5), U_ADMIN, 'TRIP.CREATE',           'Trip',    T2,      'TR-1041',    { status: 'PENDING_DRIVER_CONFIRMATION' },                                       '3 hours'],
    [auditId(6), U_HUNG,  'TRIP.ACCEPT',           'Trip',    T2,      'TR-1041',    { status: 'CONFIRMED' },                                                         '2 hours 30 minutes'],
    [auditId(7), U_ADMIN, 'TRIP.CREATE',           'Trip',    T5,      'TR-1037',    { status: 'COMPLETED' },                                                         '2 days 2 hours'],
    [auditId(8), U_ADMIN, 'VEHICLE.STATUS_CHANGE', 'Vehicle', V_CAMRY, '51F-712.34', { status: 'MAINTENANCE', note: 'Periodic service' },                             '1 day'],
  ];
  for (const [id, userId, action, entity, entityId, ref, after, interval] of rows) {
    await sql`
      INSERT INTO car_audit_logs (aud_id, ent_id, aud_user_id, aud_action, aud_entity, aud_entity_id, aud_entity_ref, aud_after, aud_created_at)
      VALUES (${id}, ${ENT_ID}, ${userId}, ${action}, ${entity}, ${entityId}, ${ref}, ${JSON.stringify(after)}::jsonb, NOW() - (${interval})::interval)
      ON CONFLICT (aud_id) DO NOTHING
    `;
  }
  console.log('  ✓ 8 audit log entries');

  console.log();
  console.log('Done. Demo data is now in', target.toUpperCase());
} catch (err) {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
}
