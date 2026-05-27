import { neon } from '@neondatabase/serverless';

/**
 * DB helpers — query Neon (car-v2 DB) trực tiếp để verify state sau actions.
 *
 * Yêu cầu env DATABASE_URL set trước khi run test (Playwright tự load qua dotenv
 * hoặc test command pass DATABASE_URL=... npx playwright test).
 */
function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

export async function resetTenantSyncState(entId: string): Promise<void> {
  const q = sql();
  await q`
    UPDATE car_tenant_settings
    SET tns_users_synced_at = NULL,
        tns_users_synced_count = 0
    WHERE ent_id = ${entId}
  `;
}

export async function deleteCarUsers(entId: string): Promise<number> {
  const q = sql();
  /* car_users có FK chain phức tạp (audit_logs, drivers, trips, etc.). Trong test
   * env, dùng soft-delete: SET usr_deleted_at = NOW(). List helpers filter
   * `usr_deleted_at IS NULL` → soft-deleted không count.
   * Sync action upsert ON CONFLICT sẽ refresh các field (name/email/role) nhưng
   * không reset usr_deleted_at → row vẫn "deleted". Vì vậy sau reset, trước
   * khi sync, ta cần `revive` rows: SET usr_deleted_at = NULL. */
  const result = await q`
    UPDATE car_users
    SET usr_deleted_at = NOW()
    WHERE ent_id = ${entId} AND usr_deleted_at IS NULL
    RETURNING usr_id
  `;
  return result.length;
}

/** Revive soft-deleted rows: SET usr_deleted_at = NULL. Dùng sau khi sync để
 *  upsert ON CONFLICT refresh được rows đã soft-delete. */
export async function reviveCarUsers(entId: string): Promise<number> {
  const q = sql();
  const result = await q`
    UPDATE car_users
    SET usr_deleted_at = NULL
    WHERE ent_id = ${entId} AND usr_deleted_at IS NOT NULL
    RETURNING usr_id
  `;
  return result.length;
}

export async function countCarUsers(entId: string): Promise<number> {
  const q = sql();
  const rows = await q`
    SELECT COUNT(*) AS c
    FROM car_users
    WHERE ent_id = ${entId} AND usr_deleted_at IS NULL
  `;
  return Number(rows[0]?.c ?? 0);
}

export async function listCarUserEmails(entId: string): Promise<string[]> {
  const q = sql();
  const rows = await q`
    SELECT usr_email
    FROM car_users
    WHERE ent_id = ${entId} AND usr_deleted_at IS NULL
    ORDER BY usr_email
  `;
  return rows.map((r) => r.usr_email).filter((e): e is string => !!e);
}

export interface TenantSyncSummary {
  syncedAt: Date | null;
  syncedCount: number;
}

export async function getTenantSyncState(entId: string): Promise<TenantSyncSummary> {
  const q = sql();
  const rows = await q`
    SELECT tns_users_synced_at AS synced_at,
           tns_users_synced_count AS synced_count
    FROM car_tenant_settings
    WHERE ent_id = ${entId}
  `;
  const row = rows[0];
  return {
    syncedAt: row?.synced_at ? new Date(row.synced_at) : null,
    syncedCount: Number(row?.synced_count ?? 0),
  };
}

/** Reset cho test: clear sync state + invalidate Next.js unstable_cache.
 *  KHÔNG delete car_users vì FK chain phức tạp (audit_logs, drivers, trips).
 *  Sync action ON CONFLICT DO UPDATE → idempotent giữa các test runs.
 *  Test assertions kiểm tra membership emails thay vì exact count. */
export async function fullReset(entId: string): Promise<void> {
  await resetTenantSyncState(entId);
  await invalidateTenantCache(entId);
}

/** Gọi dev endpoint để revalidateTag — buộc (app)/layout.tsx re-query DB
 *  thay vì serve cached value. Cần thiết sau khi reset tns_users_synced_at.
 *
 *  Note: middleware sau Wave 4 (2026-05-27) đã bypass unstable_cache trong
 *  dev mode, nên function này chỉ còn no-op trong dev. Giữ lại cho production
 *  test khi cache active. */
export async function invalidateTenantCache(entId: string): Promise<void> {
  const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${baseUrl}/api/dev/revalidate-tenant?ent_id=${entId}`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      /* Best-effort — server có thể chưa ready hoặc dev endpoint disabled.
       * Không throw vì DB reset đã xong, sync state đúng. */
      console.warn(`[e2e] invalidateTenantCache HTTP ${res.status} — best-effort skip`);
    }
  } catch (e) {
    console.warn(`[e2e] invalidateTenantCache fetch fail — best-effort skip`, e instanceof Error ? e.message : e);
  }
}
