import 'server-only';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carUserRegionAccess } from '@car-v2/db/schema';
import { TRUCK_REGIONS, type TruckRegion } from '@car-v2/shared/zod';

/**
 * One user's granted regions (REQ-20260813), canonical `TRUCK_REGIONS` order.
 * Empty = unrestricted (sees every region) — the default, and also what an
 * ADMIN always effectively has (callers already know the role and skip this
 * query for ADMIN rather than relying on it to special-case them).
 */
export async function getUserRegionAccess(entId: string, userId: string): Promise<TruckRegion[]> {
  const rows = await db
    .select({ region: carUserRegionAccess.uraRegion })
    .from(carUserRegionAccess)
    .where(
      and(
        eq(carUserRegionAccess.entId, entId),
        eq(carUserRegionAccess.usrId, userId),
        isNull(carUserRegionAccess.uraDeletedAt),
      ),
    );
  const held = new Set(rows.map((r) => r.region));
  return TRUCK_REGIONS.filter((r) => held.has(r));
}

/**
 * Same as `getUserRegionAccess`, batched for a list of users — one round-trip
 * for a whole roster page instead of N. Callers should only pass ids of
 * live, non-ADMIN TRUCK members (the users list already filters that way).
 */
export async function getRegionAccessForUsers(
  entId: string,
  userIds: string[],
): Promise<Map<string, TruckRegion[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ usrId: carUserRegionAccess.usrId, region: carUserRegionAccess.uraRegion })
    .from(carUserRegionAccess)
    .where(
      and(
        eq(carUserRegionAccess.entId, entId),
        inArray(carUserRegionAccess.usrId, userIds),
        isNull(carUserRegionAccess.uraDeletedAt),
      ),
    );
  const byUser = new Map<string, string[]>();
  for (const r of rows) {
    const list = byUser.get(r.usrId) ?? [];
    list.push(r.region);
    byUser.set(r.usrId, list);
  }
  return new Map(userIds.map((id) => [id, TRUCK_REGIONS.filter((r) => (byUser.get(id) ?? []).includes(r))]));
}
