#!/usr/bin/env node
/**
 * seed-user-guide.mjs — top-up seed for the user-guide screenshot pipeline.
 *
 * Runs AFTER `db-seed.mjs` and layers the data needed for documentation shots:
 *
 *   • Tenant branding ("Amoeba" instead of AMA-default "Cargorush")
 *   • Localized user names (Việt for vi shots, ko names handled by /dev-login
 *     `?preset=*-ko` query — same DB row, different JWT name claim per shot)
 *   • Manager user (Lê Hoàng) — the base seed only has 1 Admin + 3 Drivers
 *   • In-app notifications with Vietnamese-language title/body (the base seed
 *     leaves these in English from earlier dev work — confusing in a vi guide)
 *
 * Idempotent — INSERT … ON CONFLICT DO {NOTHING|UPDATE}. Safe to re-run.
 *
 * Usage:   node scripts/seed-user-guide.mjs dev
 *          node scripts/seed-user-guide.mjs staging
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
  console.error(`Usage: node scripts/seed-user-guide.mjs <${VALID_TARGETS.join(' | ')}>`);
  process.exit(1);
}

// Parse .env using the same minimal logic as db-seed.mjs so this script has
// no extra dependencies beyond @neondatabase/serverless.
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

// ─── Deterministic IDs (must match /dev-login presets) ───────────────────
// Sentinel UUIDs migrated to RFC 4122 v4 format (position 13='4', position 17='8')
// because AMA `resolveEntityId` uses strict `uuidValidate()` that rejects all-zero
// variants. Keep aligned with `apps/web/src/app/dev-login/route.ts`.
const ENT_ID  = '00000000-0000-4000-8000-000000000010';
const U_ADMIN = '00000000-0000-4000-8000-000000000001';
const U_MGR   = '11111111-1111-1111-1111-111111111200';
const U_TU    = '11111111-1111-1111-1111-111111111101';
const U_HUNG  = '11111111-1111-1111-1111-111111111102';
const U_DUC   = '11111111-1111-1111-1111-111111111103';

const TNS_ID  = '66666666-6666-6666-6666-666666666601';

const masked = url.replace(/:[^:@/]+@/, ':****@');
console.log(`→ User-guide seed: ${target.toUpperCase()}`);
console.log(`  ${masked}`);
console.log();

try {
  // 1. Tenant branding — sidebar header reads tns_tenant_name with fallback
  //    to JWT ent_name → i18n default. Setting it here makes the brand match
  //    the doc tenant "Amoeba".
  await sql`
    INSERT INTO car_tenant_settings (tns_id, ent_id, tns_tenant_name, tns_app_name, tns_users_synced_at)
    VALUES (${TNS_ID}, ${ENT_ID}, 'Amoeba', 'Amoeba Car', NOW())
    ON CONFLICT (ent_id) DO UPDATE SET
      tns_tenant_name = EXCLUDED.tns_tenant_name,
      tns_app_name = EXCLUDED.tns_app_name,
      tns_users_synced_at = COALESCE(car_tenant_settings.tns_users_synced_at, EXCLUDED.tns_users_synced_at),
      tns_updated_at = NOW()
  `;
  console.log('  ✓ tenant_settings (tenant=Amoeba, app=Amoeba Car, users_synced_at set)');

  // 2. User name overrides — set Việt names so /dev-login JWT.name doesn't
  //    leak "Demo OWNER" into the sidebar profile card. Note: ensureCarUser
  //    in users.service.ts uses `coalesce(usrName, JWT.name)` so once we set
  //    a non-NULL value the JWT name will never overwrite it. Note also that
  //    the SIDEBAR pulls from getCurrentUser() which reads JWT.name — that's
  //    handled by /dev-login presets, not the DB.
  await sql`
    UPDATE car_users
       SET usr_name  = 'Nguyễn Thanh An',
           usr_email = 'an.nguyen@amoeba.group'
     WHERE usr_id = ${U_ADMIN}
  `;
  console.log('  ✓ Admin renamed → Nguyễn Thanh An');

  // 3. Manager user — base seed has none. Pipeline needs this for
  //    manager-vi / manager-ko presets to land on a valid car_users row.
  await sql`
    INSERT INTO car_users
      (usr_id, ent_id, usr_ama_user_id, usr_email, usr_name, usr_local_role, usr_ama_role_snapshot)
    VALUES
      (${U_MGR}, ${ENT_ID}, ${U_MGR}, 'hoang.le@amoeba.group', 'Lê Hoàng', 'MANAGER', 'MANAGER')
    ON CONFLICT (usr_id) DO UPDATE SET
      usr_name  = EXCLUDED.usr_name,
      usr_email = EXCLUDED.usr_email,
      usr_local_role = EXCLUDED.usr_local_role
  `;
  console.log('  ✓ Manager user (Lê Hoàng) upserted');

  // 4. Notifications — wipe and re-insert with Vietnamese strings so the
  //    inbox shot in a vi guide doesn't show English. The base seed leaves
  //    behind English text from earlier dev work; this is intentionally a
  //    destructive replace scoped to the demo user only.
  await sql`DELETE FROM car_notifications WHERE ent_id = ${ENT_ID} AND ntf_user_id = ${U_ADMIN}`;

  const ntfId = (n) => `77777777-7777-7777-7777-7777777777${String(n).padStart(2, '0')}`;
  const ntfRows = [
    [ntfId(1), 'MAINTENANCE.OIL_OVERDUE',
       '30A-556.07 — Đã quá hạn thay dầu',
       'Đã chạy 7.118 km kể từ lần thay dầu gần nhất (chu kỳ 5.000 km). Đề nghị xếp lịch bảo dưỡng sớm.',
       '33333333-3333-3333-3333-333333333302', '30A-556.07', '4 days'],

    [ntfId(2), 'MAINTENANCE.OIL_DUE_SOON',
       '51F-712.34 — Sắp đến hạn thay dầu',
       'Đã chạy 4.230 km kể từ lần thay dầu gần nhất (chu kỳ 5.000 km — còn ~770 km).',
       '33333333-3333-3333-3333-333333333303', '51F-712.34', '2 days'],

    [ntfId(3), 'TRIP.CONFIRMED',
       'TR-1045 đã được xác nhận',
       'Tài xế Nguyễn Văn Tú đã xác nhận chuyến TR-1045 (Quận 1 → Sân bay Tân Sơn Nhất).',
       '44444444-4444-4444-4444-444444444401', 'TR-1045', '5 days'],

    [ntfId(4), 'TRIP.ASSIGNED',
       'Chuyến mới TR-1045 đã được gán',
       'Quận 1 → Sân bay Tân Sơn Nhất, khởi hành 16:30. Chờ tài xế xác nhận.',
       '44444444-4444-4444-4444-444444444401', 'TR-1045', '5 days'],

    [ntfId(5), 'EXPENSE.APPROVED',
       'Khoản chi 850.000₫ đã được duyệt',
       'Sửa chữa thay lốp xe 51K-238.91 do Nguyễn Văn Tú nộp.',
       null, 'EXP-2031', '5 days'],

    [ntfId(6), 'TRIP.REJECTED',
       'TR-1041 bị từ chối',
       'Tài xế Trần Quốc Hùng đã từ chối chuyến với lý do "Trùng lịch khám sức khoẻ định kỳ".',
       '44444444-4444-4444-4444-444444444402', 'TR-1041', '6 days'],
  ];

  for (const [id, event, title, body, entityId, entityRef, interval] of ntfRows) {
    await sql`
      INSERT INTO car_notifications
        (ntf_id, ent_id, ntf_user_id, ntf_event, ntf_title, ntf_body, ntf_entity_id, ntf_entity_ref, ntf_created_at)
      VALUES
        (${id}, ${ENT_ID}, ${U_ADMIN}, ${event}, ${title}, ${body}, ${entityId}, ${entityRef},
         NOW() - (${interval})::interval)
    `;
  }
  console.log(`  ✓ ${ntfRows.length} notifications (tiếng Việt) seeded for Admin`);

  // 5. Trips for driver Tú — base seed only has 1 IN_PROGRESS + 1 COMPLETED.
  //    Pipeline needs a PENDING_DRIVER_CONFIRMATION + a CONFIRMED trip too so
  //    the driver-guide can shoot the full lifecycle (confirm → start → end).
  const D_TU = '22222222-2222-2222-2222-222222222201';
  const V_STARIA = '33333333-3333-3333-3333-333333333301';
  const TGUIDE_PENDING   = '88888888-8888-8888-8888-888888888801';
  const TGUIDE_CONFIRMED = '88888888-8888-8888-8888-888888888802';

  await sql`
    INSERT INTO car_trips
      (trp_id, ent_id, trp_ref, trp_creator_id, trp_passenger_id, trp_driver_id, trp_vehicle_id,
       trp_status, trp_pickup_address, trp_dropoff_address, trp_scheduled_at, trp_duration_minutes, trp_purpose)
    VALUES
      (${TGUIDE_PENDING}, ${ENT_ID}, 'TR-2001', ${U_ADMIN}, ${U_ADMIN}, ${D_TU}, ${V_STARIA},
       'PENDING_DRIVER_CONFIRMATION', '90 Pasteur, Quận 1, TP.HCM', 'Khách sạn Park Hyatt Saigon',
       NOW() + INTERVAL '6 hours', 45, 'Đón đoàn khách Hàn Quốc'),
      (${TGUIDE_CONFIRMED}, ${ENT_ID}, 'TR-2002', ${U_ADMIN}, ${U_ADMIN}, ${D_TU}, ${V_STARIA},
       'CONFIRMED', '225 Lê Thánh Tôn, Quận 1', 'Sân bay Tân Sơn Nhất Ga T2',
       NOW() + INTERVAL '20 hours', 60, 'Đưa giám đốc ra sân bay')
    ON CONFLICT (trp_id) DO UPDATE SET
      trp_status = EXCLUDED.trp_status,
      trp_scheduled_at = EXCLUDED.trp_scheduled_at,
      trp_purpose = EXCLUDED.trp_purpose
  `;
  console.log('  ✓ 2 extra trips for driver Tú (TR-2001 PENDING_DRIVER_CONFIRMATION, TR-2002 CONFIRMED)');

  // 6. Trips created by / for Manager Lê Hoàng — so when we login as Manager
  //    the dashboard and "my trips" tab show non-empty data. listTrips filters
  //    by `trp_creator_id = userId OR trp_passenger_id = userId` when role is
  //    MANAGER (queries/trips.queries.ts).
  const D_HUNG = '22222222-2222-2222-2222-222222222202';
  const V_CARNIVAL = '33333333-3333-3333-3333-333333333302';
  const TGUIDE_MGR_OWN     = '88888888-8888-8888-8888-888888888803';
  const TGUIDE_MGR_PASSGR  = '88888888-8888-8888-8888-888888888804';
  const TGUIDE_MGR_DONE    = '88888888-8888-8888-8888-888888888805';

  await sql`
    INSERT INTO car_trips
      (trp_id, ent_id, trp_ref, trp_creator_id, trp_passenger_id, trp_driver_id, trp_vehicle_id,
       trp_status, trp_pickup_address, trp_dropoff_address, trp_scheduled_at, trp_duration_minutes, trp_purpose,
       trp_started_at, trp_ended_at, trp_start_odometer, trp_end_odometer)
    VALUES
      (${TGUIDE_MGR_OWN}, ${ENT_ID}, 'TR-3001', ${U_MGR}, ${U_MGR}, NULL, NULL,
       'PENDING_ASSIGNMENT', 'Tòa nhà Bitexco, Quận 1', 'Khu công nghệ cao Quận 9',
       NOW() + INTERVAL '2 days', 90, 'Họp đối tác Samsung Vietnam',
       NULL, NULL, NULL, NULL),

      (${TGUIDE_MGR_PASSGR}, ${ENT_ID}, 'TR-3002', ${U_ADMIN}, ${U_MGR}, ${D_HUNG}, ${V_CARNIVAL},
       'CONFIRMED', 'Sân bay Tân Sơn Nhất Ga Quốc nội', 'Khách sạn Sheraton Saigon',
       NOW() + INTERVAL '1 day', 45, 'Đón từ Hà Nội về',
       NULL, NULL, NULL, NULL),

      (${TGUIDE_MGR_DONE}, ${ENT_ID}, 'TR-3000', ${U_MGR}, ${U_MGR}, ${D_HUNG}, ${V_CARNIVAL},
       'COMPLETED', 'Văn phòng Quận 7', 'Cảng Cát Lái',
       NOW() - INTERVAL '3 days', 60, 'Kiểm tra container nhập khẩu',
       NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days 23 hours', 42000, 42035)
    ON CONFLICT (trp_id) DO UPDATE SET
      trp_status = EXCLUDED.trp_status,
      trp_scheduled_at = EXCLUDED.trp_scheduled_at
  `;
  console.log('  ✓ 3 trips for Manager Lê Hoàng (TR-3001 PENDING, TR-3002 CONFIRMED-pax, TR-3000 COMPLETED)');

  console.log();
  console.log(`Done. User-guide demo data is now in ${target.toUpperCase()}.`);
} catch (err) {
  console.error('✗ Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
