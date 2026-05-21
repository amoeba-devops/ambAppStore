import 'server-only';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTenantSettings, type CarTenantSettings } from '@car-v2/db/schema';
import { CarError } from '@car-v2/shared/errors';

/* Allowed values mirror the option set shown in the Settings UI. Direct
 * action calls bypassing the UI still hit these — never trust the wire. */
export const TIMEZONE_ALLOWLIST = ['Asia/Ho_Chi_Minh', 'Asia/Seoul'] as const;
export const TRIP_RETENTION_ALLOWLIST = [1, 3, 5, 7] as const;
export const AUDIT_RETENTION_ALLOWLIST = [3, 5] as const; // NULL = indefinite handled separately

export type TimezoneAllowed = (typeof TIMEZONE_ALLOWLIST)[number];

/**
 * Read tenant settings, seeding a default row on first access for the tenant.
 * Race-safe: two parallel admins opening /settings both end up reading the
 * single row that wins the unique-constraint insert (ON CONFLICT DO NOTHING
 * then re-SELECT).
 */
export async function getOrSeedTenantSettings(
  entId: string,
  userId: string,
): Promise<CarTenantSettings> {
  const existing = await db
    .select()
    .from(carTenantSettings)
    .where(eq(carTenantSettings.entId, entId))
    .limit(1);
  if (existing[0]) return existing[0];

  /* Insert with onConflictDoNothing so the loser of a parallel race doesn't
   * throw 23505 — it falls through to the re-SELECT below. */
  await db
    .insert(carTenantSettings)
    .values({
      tnsId: randomUUID(),
      entId,
      tnsTenantName: null,
      tnsUpdatedBy: userId,
    })
    .onConflictDoNothing({ target: carTenantSettings.entId });

  const seeded = await db
    .select()
    .from(carTenantSettings)
    .where(eq(carTenantSettings.entId, entId))
    .limit(1);
  if (!seeded[0]) {
    throw new CarError('CAR-E0500', 500, 'Tenant settings row missing after seed');
  }
  return seeded[0];
}

export function assertTimezoneAllowed(tz: string): asserts tz is TimezoneAllowed {
  if (!(TIMEZONE_ALLOWLIST as readonly string[]).includes(tz)) {
    throw new CarError('CAR-E0001', 400, `Unsupported timezone: ${tz}`);
  }
}

export function assertTripRetentionAllowed(years: number): void {
  if (!(TRIP_RETENTION_ALLOWLIST as readonly number[]).includes(years)) {
    throw new CarError('CAR-E0001', 400, `Unsupported trip retention: ${years}`);
  }
}

/* Audit retention: NULL = indefinite. Number must be in allowlist. */
export function assertAuditRetentionAllowed(years: number | null): void {
  if (years === null) return;
  if (!(AUDIT_RETENTION_ALLOWLIST as readonly number[]).includes(years)) {
    throw new CarError('CAR-E0001', 400, `Unsupported audit retention: ${years}`);
  }
}
