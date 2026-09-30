import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTenantSettings, type CarTenantSettings } from '@car-v2/db/schema';

export async function getTenantSettings(entId: string): Promise<CarTenantSettings | null> {
  const rows = await db
    .select()
    .from(carTenantSettings)
    .where(eq(carTenantSettings.entId, entId))
    .limit(1);
  return rows[0] ?? null;
}

/** Fallback when the tenant has no settings row yet — the schema default. */
export const DEFAULT_TENANT_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * IANA timezone every server-rendered wall-clock timestamp must be formatted
 * in (BUG-260930 case 1). Server Components run where the process runs — UTC
 * on Render / in Docker — so `toLocaleTimeString(loc)` without an explicit
 * `timeZone` printed "Cập nhật 04:04:38" for an edit made at 11:04 in Vietnam.
 * Per-request memoised (`cache`) so a page can ask several times for free.
 */
export const getTenantTimeZone = cache(async (entId: string): Promise<string> => {
  const settings = await getTenantSettings(entId);
  return settings?.tnsTimezone || DEFAULT_TENANT_TIMEZONE;
});
