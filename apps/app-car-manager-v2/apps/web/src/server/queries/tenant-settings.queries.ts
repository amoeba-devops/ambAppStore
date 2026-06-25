import 'server-only';
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
