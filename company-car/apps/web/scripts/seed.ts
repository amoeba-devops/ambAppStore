/**
 * Seed initial data: 1 admin, 3 vehicles, 2 drivers (matching PRD §13 Phase 1).
 * Idempotent — checks existence by unique key before inserting.
 *
 * Run: pnpm --filter web db:seed
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import * as schema from '../lib/db/schema';

const { users, drivers, vehicles, systemSettings } = schema;

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const sql = neon(url);
const db = drizzle(sql, { schema });

const SYSTEM_DEFAULTS: Array<[string, unknown, string]> = [
  ['auto_approve_threshold_fuel', 1_000_000, 'Auto-approve threshold for FUEL costs (VND)'],
  ['auto_approve_threshold_meal', 500_000, 'Auto-approve threshold for MEAL costs (VND)'],
  ['auto_approve_threshold_oil', 2_000_000, 'Auto-approve threshold for OIL_CHANGE costs (VND)'],
  ['default_trip_duration_hours', 4, 'Default trip duration in hours when end time unknown'],
  ['oil_change_warning_km', 500, 'Warn when remaining km until oil change <= this value'],
  ['license_expiry_warning_days', 30, 'Warn when license expires within this many days'],
  ['sso_google_enabled', false, 'Whether Google SSO is enabled'],
];

async function main() {
  console.log('→ Seeding system_settings...');
  for (const [key, value, description] of SYSTEM_DEFAULTS) {
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);
    if (!existing) {
      await db.insert(systemSettings).values({ key, value, description });
      console.log(`  + ${key}`);
    } else {
      console.log(`  · ${key} (skip — exists)`);
    }
  }

  console.log('→ Seeding admin user...');
  const adminEmail = 'admin@company-car.local';
  const [adminExisting] = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (!adminExisting) {
    const passwordHash = await bcrypt.hash('admin123', 12);
    await db.insert(users).values({
      email: adminEmail,
      passwordHash,
      fullName: 'System Admin',
      position: 'Office Admin',
      role: 'ADMIN',
      language: 'en',
      status: 'ACTIVE',
    });
    console.log(`  + admin: ${adminEmail} / admin123`);
  } else {
    console.log(`  · admin exists`);
  }

  console.log('→ Seeding driver users + driver profiles...');
  const driverSeeds = [
    {
      email: 'driver1@company-car.local',
      fullName: 'Nguyễn Văn A',
      licenseNumber: 'A123456789',
      licenseClass: 'B2',
      licenseExpiryDate: '2027-12-31',
      phone: '+84901234567',
    },
    {
      email: 'driver2@company-car.local',
      fullName: 'Trần Văn B',
      licenseNumber: 'B987654321',
      licenseClass: 'B2',
      licenseExpiryDate: '2027-06-30',
      phone: '+84907654321',
    },
  ];

  for (const seed of driverSeeds) {
    let [driverUser] = await db.select().from(users).where(eq(users.email, seed.email)).limit(1);
    if (!driverUser) {
      const ph = await bcrypt.hash('driver123', 12);
      const inserted = await db
        .insert(users)
        .values({
          email: seed.email,
          passwordHash: ph,
          fullName: seed.fullName,
          role: 'DRIVER',
          language: 'vi',
          status: 'ACTIVE',
        })
        .returning();
      driverUser = inserted[0];
      if (!driverUser) throw new Error(`Failed to insert driver user ${seed.email}`);
      console.log(`  + driver user: ${seed.email}`);
    }

    const [existingDriver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.licenseNumber, seed.licenseNumber))
      .limit(1);

    if (!existingDriver) {
      await db.insert(drivers).values({
        userId: driverUser.id,
        fullName: seed.fullName,
        licenseNumber: seed.licenseNumber,
        licenseClass: seed.licenseClass,
        licenseExpiryDate: seed.licenseExpiryDate,
        phone: seed.phone,
        status: 'ACTIVE',
      });
      console.log(`  + driver profile: ${seed.licenseNumber}`);
    } else {
      console.log(`  · driver ${seed.licenseNumber} exists`);
    }
  }

  console.log('→ Seeding vehicles...');
  const vehicleSeeds = [
    { licensePlate: '51F-12345', vehicleType: 'Toyota Camry', manufactureYear: 2022, color: 'Black' },
    { licensePlate: '51F-23456', vehicleType: 'Hyundai Sonata', manufactureYear: 2021, color: 'White' },
    { licensePlate: '51F-34567', vehicleType: 'Kia Carnival', manufactureYear: 2023, color: 'Grey' },
  ];

  for (const v of vehicleSeeds) {
    const [existing] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.licensePlate, v.licensePlate))
      .limit(1);

    if (!existing) {
      await db.insert(vehicles).values({
        ...v,
        currentKm: 0,
        oilChangeIntervalKm: 5000,
        lastOilChangeKm: 0,
        status: 'ACTIVE',
      });
      console.log(`  + vehicle: ${v.licensePlate}`);
    } else {
      console.log(`  · vehicle ${v.licensePlate} exists`);
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
