#!/usr/bin/env node
/**
 * seed-truck-guide.mjs — top-up seed for the TRUCK user-guide screenshot pipeline.
 *
 * Layers rich, realistic truck data on top of db-seed so the truck-guide shots
 * (dashboard KPIs, region breakdown, fleet list, P&L, finance ledger, driver
 * "Hôm nay") are full and visual instead of empty:
 *
 *   • 5 trucks across all 3 regions (HCM / DONG_NAI / BAIKSAN), mixed status
 *   • 3 truck drivers with real VN names (+ TRUCK fleet access)
 *   • Renamed truck manager + driver personas (nicer than "QT/Tài xế Xe tải")
 *   • ~8 COMPLETED LOG trips in 2026-06 with fuel/toll/revenue → cost & P&L
 *   • 3 open trips (CONFIRMED / IN_PROGRESS) assigned to the guide driver so
 *     the driver "Hôm nay" screen shows "Cần hoàn thành"
 *
 * Idempotent — INSERT … ON CONFLICT DO UPDATE. Safe to re-run.
 * Usage:   node scripts/seed-truck-guide.mjs dev
 *          node scripts/seed-truck-guide.mjs staging
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');

const target = process.argv[2];
if (!target || !['dev', 'staging'].includes(target)) {
  console.error('Usage: node scripts/seed-truck-guide.mjs <dev | staging>');
  process.exit(1);
}
const vars = {};
for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const url = vars[`DATABASE_URL_${target.toUpperCase()}`] || vars.DATABASE_URL;
if (!url) {
  console.error(`✗ Missing DATABASE_URL_${target.toUpperCase()} (or DATABASE_URL) in .env`);
  process.exit(1);
}
const sql = neon(url);

const ENT = '00000000-0000-4000-8000-000000000010';
const U_ADMIN = '00000000-0000-4000-8000-000000000001';
// Personas from test-personas.ts (dev-login role+sub)
const U_MGR_TRUCK = '0a0a0a0a-0000-4000-8000-0000000000c2'; // mgr-truck
const U_DRV_TRUCK = '0a0a0a0a-0000-4000-8000-0000000000d2'; // drv-truck (user)
const D_DRV_TRUCK = '0a0a0a0a-0000-4000-8000-0000000000e2'; // drv-truck (car_drivers)

// New trucks
const TK = {
  hcm1:  '29ad0000-0000-4000-8000-000000000102', // keep existing 29C-99999 too
  hcm2:  '29ad0000-0000-4000-8000-000000000102',
  dn1:   '29ad0000-0000-4000-8000-000000000201',
  dn2:   '29ad0000-0000-4000-8000-000000000202',
  bs1:   '29ad0000-0000-4000-8000-000000000301',
};
// Extra truck drivers (user + driver ids)
const DRV2_U = '0b0b0b0b-0000-4000-8000-000000000d21', DRV2_D = '0b0b0b0b-0000-4000-8000-000000000e21';
const DRV3_U = '0b0b0b0b-0000-4000-8000-000000000d22', DRV3_D = '0b0b0b0b-0000-4000-8000-000000000e22';

const masked = url.replace(/:[^:@/]+@/, ':****@');
console.log(`→ Truck user-guide seed: ${target.toUpperCase()}\n  ${masked}\n`);

async function upsertUser(id, name, email, role) {
  await sql`
    INSERT INTO car_users (usr_id, ent_id, usr_ama_user_id, usr_email, usr_name, usr_local_role, usr_ama_role_snapshot)
    VALUES (${id}, ${ENT}, ${id}, ${email}, ${name}, ${role}, ${role})
    ON CONFLICT (usr_id) DO UPDATE SET usr_name = EXCLUDED.usr_name, usr_email = EXCLUDED.usr_email, usr_local_role = EXCLUDED.usr_local_role`;
}
async function grantTruck(userId) {
  const rows = await sql`SELECT ufa_id FROM car_user_fleet_access WHERE ent_id=${ENT} AND usr_id=${userId} AND ufa_vehicle_type='TRUCK' AND ufa_deleted_at IS NULL LIMIT 1`;
  if (rows.length === 0) {
    await sql`INSERT INTO car_user_fleet_access (ufa_id, ent_id, usr_id, ufa_vehicle_type) VALUES (gen_random_uuid(), ${ENT}, ${userId}, 'TRUCK')`;
  }
}
async function upsertDriver(id, userId) {
  await sql`
    INSERT INTO car_drivers (drv_id, ent_id, drv_user_id, drv_license_number, drv_license_class, drv_license_expiry, drv_status)
    VALUES (${id}, ${ENT}, ${userId}, ${'GUIDE-' + id.slice(-4)}, 'C', '2031-12-31', 'AVAILABLE')
    ON CONFLICT (drv_id) DO NOTHING`;
}
async function upsertTruck(id, plate, model, region, status) {
  await sql`
    INSERT INTO car_vehicles (cvh_id, ent_id, cvh_plate_number, cvh_model, cvh_type, cvh_region, cvh_status)
    VALUES (${id}, ${ENT}, ${plate}, ${model}, 'TRUCK', ${region}, ${status})
    ON CONFLICT (cvh_id) DO UPDATE SET cvh_plate_number=EXCLUDED.cvh_plate_number, cvh_model=EXCLUDED.cvh_model, cvh_region=EXCLUDED.cvh_region, cvh_status=EXCLUDED.cvh_status`;
}

try {
  // 1. Rename the truck personas to real names (nicer than "QT/Tài xế Xe tải").
  await upsertUser(U_MGR_TRUCK, 'Phạm Minh Quân', 'quan.pham@amoeba.group', 'MANAGER');
  await upsertUser(U_DRV_TRUCK, 'Trần Văn Sơn', 'son.tran@amoeba.group', 'DRIVER');
  await grantTruck(U_MGR_TRUCK); await grantTruck(U_DRV_TRUCK);
  await upsertDriver(D_DRV_TRUCK, U_DRV_TRUCK);
  console.log('  ✓ personas renamed (mgr=Phạm Minh Quân, drv=Trần Văn Sơn)');

  // 2. Two more truck drivers.
  await upsertUser(DRV2_U, 'Lê Văn Cường', 'cuong.le@amoeba.group', 'DRIVER');
  await upsertUser(DRV3_U, 'Đỗ Thành Nam', 'nam.do@amoeba.group', 'DRIVER');
  await grantTruck(DRV2_U); await grantTruck(DRV3_U);
  await upsertDriver(DRV2_D, DRV2_U); await upsertDriver(DRV3_D, DRV3_U);
  console.log('  ✓ 2 extra truck drivers (Lê Văn Cường, Đỗ Thành Nam)');

  // 3. Trucks across 3 regions (+ keep the existing 29C-99999 HCM).
  await sql`UPDATE car_vehicles SET cvh_region='HCM' WHERE ent_id=${ENT} AND cvh_plate_number='29C-99999'`;
  await upsertTruck(TK.hcm2, '51C-458.32', 'Hyundai HD210',   'HCM',      'AVAILABLE');
  await upsertTruck(TK.dn1,  '60C-311.07', 'Isuzu FVR 34S',   'DONG_NAI', 'IN_USE');
  await upsertTruck(TK.dn2,  '60C-522.18', 'Hino FG8J',       'DONG_NAI', 'AVAILABLE');
  await upsertTruck(TK.bs1,  '43C-201.55', 'Thaco Auman C300','BAIKSAN',  'MAINTENANCE');
  console.log('  ✓ 5 trucks total (2 HCM, 2 DONG_NAI, 1 BAIKSAN)');

  // 4. COMPLETED LOG trips with fuel/toll/revenue → dashboard KPIs, region P&L,
  //    finance ledger, recent trips. Dates are RELATIVE to now so "Tháng này"
  //    always has data: monthsAgo=0 (current month, day 1 so never future) and
  //    monthsAgo=1 (previous month → real period-over-period %). vehicle → region.
  //    [ref, veh, drv, cust, bol, from, to, monthsAgo, dom, liters, price, toll, revenue, endOdo]
  const done = [
    ['TRK-1001', TK.hcm2, D_DRV_TRUCK, 'Công ty TNHH ABC Logistics', 'BOL-24061', 'Kho Sóng Thần, Bình Dương', 'Cảng Cát Lái, TP.HCM',      0, 1, 62, 22000, 250000, 9800000, 118420],
    ['TRK-1002', TK.hcm2, DRV2_D,      'Nhà máy Samsung SEHC',       'BOL-24062', 'KCN Cao, TP.Thủ Đức',       'Cảng Cái Mép, Bà Rịa',      0, 1, 88, 22000, 380000, 14200000, 118980],
    ['TRK-1003', TK.hcm2, D_DRV_TRUCK, 'Kho vận Gemadept',           'BOL-24063', 'Cảng Cát Lái',              'Kho Long Bình, TP.Thủ Đức', 0, 1, 45, 21500, 150000, 6500000, 119400],
    ['TRK-2001', TK.dn1,  DRV3_D,      'Công ty Gỗ Trường Thành',    'BOL-24064', 'KCN Amata, Biên Hòa',       'Cảng Cát Lái, TP.HCM',      0, 1, 70, 22000, 300000, 11000000, 205300],
    ['TRK-3001', TK.bs1,  DRV3_D,      'Xi măng Hà Tiên',            'BOL-24067', 'Nhà máy Kiên Lương',        'Trạm trộn Baiksan',         0, 1, 92, 21500, 410000, 15200000, 302400],
    ['TRK-0901', TK.hcm2, DRV2_D,      'Nhà máy Bosch Đồng Nai',     'BOL-24051', 'KCN Long Thành',            'ICD Tân Cảng Long Bình',    1, 9, 55, 21800, 220000, 8600000, 90110],
    ['TRK-0902', TK.dn1,  DRV2_D,      'Công ty Nhựa Long Thành',    'BOL-24052', 'KCN Nhơn Trạch',            'Cảng Cát Lái',              1, 14, 60, 22000, 260000, 9200000, 90980],
    ['TRK-0903', TK.dn2,  DRV3_D,      'Kho vận Gemadept',           'BOL-24053', 'KCN Long Thành',            'Cảng Cát Lái',              1, 20, 50, 21800, 200000, 7800000, 60110],
    ['TRK-0904', TK.bs1,  D_DRV_TRUCK, 'Thép Hòa Phát',              'BOL-24054', 'Cảng Baiksan',              'KCN Long An',               1, 24, 78, 22000, 350000, 12800000, 300100],
  ];
  for (const [ref, veh, drv, cust, bol, from, to, monthsAgo, dom, liters, price, toll, rev, odo] of done) {
    const id = 'd7000000-0000-4000-8000-0000000' + ref.replace(/\D/g, '').padStart(5, '0');
    await sql`
      INSERT INTO car_trips
        (trp_id, ent_id, trp_ref, trp_kind, trp_creator_id, trp_driver_id, trp_vehicle_id, trp_status,
         trp_customer, trp_bol, trp_pickup_address, trp_dropoff_address, trp_scheduled_at, trp_duration_minutes,
         trp_fuel_liters, trp_fuel_price, trp_toll_fee, trp_revenue, trp_end_odometer)
      VALUES
        (${id}, ${ENT}, ${ref}, 'LOG', ${U_MGR_TRUCK}, ${drv}, ${veh}, 'COMPLETED',
         ${cust}, ${bol}, ${from}, ${to},
         date_trunc('month', now()) - make_interval(months => ${monthsAgo}) + make_interval(days => ${dom - 1}, hours => 8),
         240, ${liters}, ${price}, ${toll}, ${rev}, ${odo})
      ON CONFLICT (trp_id) DO UPDATE SET
        trp_status='COMPLETED', trp_customer=EXCLUDED.trp_customer, trp_vehicle_id=EXCLUDED.trp_vehicle_id,
        trp_driver_id=EXCLUDED.trp_driver_id, trp_scheduled_at=EXCLUDED.trp_scheduled_at,
        trp_fuel_liters=EXCLUDED.trp_fuel_liters, trp_fuel_price=EXCLUDED.trp_fuel_price,
        trp_toll_fee=EXCLUDED.trp_toll_fee, trp_revenue=EXCLUDED.trp_revenue`;
  }
  console.log(`  ✓ ${done.length} COMPLETED trips (current + previous month, across regions)`);

  // 5. Open trips assigned to the guide driver (Trần Văn Sơn) → "Cần hoàn thành".
  const open = [
    ['TRK-9001', TK.hcm2, 'CONFIRMED',   'Công ty TNHH ABC Logistics', 'Kho Sóng Thần, Bình Dương', 'Cảng Cát Lái, TP.HCM'],
    ['TRK-9002', '29ad0000-0000-4000-8000-000000000102', 'IN_PROGRESS', 'Kho vận Gemadept', 'Cảng Cát Lái', 'Kho Long Bình, TP.Thủ Đức'],
  ];
  for (const [ref, veh, status, cust, from, to] of open) {
    const id = 'd9000000-0000-4000-8000-0000000' + ref.replace(/\D/g, '').padStart(5, '0');
    await sql`
      INSERT INTO car_trips
        (trp_id, ent_id, trp_ref, trp_kind, trp_creator_id, trp_driver_id, trp_vehicle_id, trp_status,
         trp_customer, trp_pickup_address, trp_dropoff_address, trp_scheduled_at, trp_duration_minutes)
      VALUES
        (${id}, ${ENT}, ${ref}, 'LOG', ${U_MGR_TRUCK}, ${D_DRV_TRUCK}, ${veh}, ${status},
         ${cust}, ${from}, ${to}, NOW() + INTERVAL '3 hours', 240)
      ON CONFLICT (trp_id) DO UPDATE SET trp_status=EXCLUDED.trp_status, trp_driver_id=EXCLUDED.trp_driver_id, trp_vehicle_id=EXCLUDED.trp_vehicle_id`;
  }
  console.log(`  ✓ ${open.length} open trips for driver Trần Văn Sơn (Cần hoàn thành)`);

  const cnt = await sql`SELECT trp_status, count(*)::int n FROM car_trips WHERE ent_id=${ENT} AND trp_kind='LOG' AND trp_deleted_at IS NULL GROUP BY trp_status ORDER BY trp_status`;
  console.log('\n  LOG trips now:', JSON.stringify(cnt));
  console.log(`\nDone. Truck guide demo data seeded to ${target.toUpperCase()}.`);
} catch (err) {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
}
