import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { systemSettings } from '@/lib/db/schema';
import { HttpError } from '@/lib/api/response';

export type SystemSettingRow = {
  key: string;
  value: unknown;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

export async function listSettings(): Promise<SystemSettingRow[]> {
  const rows = await db.select().from(systemSettings).orderBy(systemSettings.key);
  return rows.map((r) => ({
    key: r.key,
    value: r.value,
    description: r.description,
    updatedBy: r.updatedBy,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getSetting(key: string): Promise<SystemSettingRow | null> {
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  if (!row) return null;
  return {
    key: row.key,
    value: row.value,
    description: row.description,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updateSetting(
  key: string,
  value: unknown,
  updatedBy: string,
): Promise<SystemSettingRow> {
  const [existing] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  if (!existing) {
    throw new HttpError(404, 'SETTING_NOT_FOUND', `Setting ${key} not found`);
  }

  const [updated] = await db
    .update(systemSettings)
    .set({ value: value as Record<string, unknown>, updatedBy, updatedAt: new Date() })
    .where(eq(systemSettings.key, key))
    .returning();

  if (!updated) throw new HttpError(500, 'UPDATE_FAILED', 'Failed to update setting');

  return {
    key: updated.key,
    value: updated.value,
    description: updated.description,
    updatedBy: updated.updatedBy,
    updatedAt: updated.updatedAt.toISOString(),
  };
}
