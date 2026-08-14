import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carUsers,
  carUserFleetAccess,
  carUserRegionAccess,
  type CarUserLocalRole,
} from '@car-v2/db/schema';
import { TRUCK_REGIONS, type TruckRegion } from '@car-v2/shared/zod';

export interface RegionMemberRow {
  usrId: string;
  name: string | null;
  email: string | null;
  localRole: CarUserLocalRole;
  /** Explicit grants. Empty means unrestricted — see `unrestricted`. */
  regions: TruckRegion[];
  /** True when the user sees every region: ADMIN, or nobody narrowed them yet. */
  unrestricted: boolean;
  /** True for ADMIN, whose access can't be narrowed at all. */
  implicit: boolean;
}

/**
 * Members whose region scope an admin can manage (REQ-20260813): live users with
 * TRUCK department access, since region only exists inside the truck fleet.
 * ADMIN rows are listed but flagged `implicit` — they always see every region.
 */
export async function listRegionAccessMembers(entId: string): Promise<RegionMemberRow[]> {
  const [users, grants] = await Promise.all([
    db
      .select({
        usrId: carUsers.usrId,
        name: carUsers.usrName,
        email: carUsers.usrEmail,
        localRole: carUsers.usrLocalRole,
        truckAccessId: carUserFleetAccess.ufaId,
      })
      .from(carUsers)
      .leftJoin(
        carUserFleetAccess,
        and(
          eq(carUserFleetAccess.usrId, carUsers.usrId),
          eq(carUserFleetAccess.entId, entId),
          eq(carUserFleetAccess.ufaVehicleType, 'TRUCK'),
          isNull(carUserFleetAccess.ufaDeletedAt),
        ),
      )
      .where(and(eq(carUsers.entId, entId), isNull(carUsers.usrDeletedAt))),
    db
      .select({ usrId: carUserRegionAccess.usrId, region: carUserRegionAccess.uraRegion })
      .from(carUserRegionAccess)
      .where(and(eq(carUserRegionAccess.entId, entId), isNull(carUserRegionAccess.uraDeletedAt))),
  ]);

  const byUser = new Map<string, string[]>();
  for (const g of grants) {
    const list = byUser.get(g.usrId) ?? [];
    list.push(g.region);
    byUser.set(g.usrId, list);
  }

  return users
    /* ADMIN reaches TRUCK implicitly (no membership row), everyone else needs one. */
    .filter((u) => u.localRole === 'ADMIN' || u.truckAccessId !== null)
    .map(({ truckAccessId: _truckAccessId, ...u }) => {
      const implicit = u.localRole === 'ADMIN';
      const held = byUser.get(u.usrId) ?? [];
      const regions = implicit ? [] : TRUCK_REGIONS.filter((r) => held.includes(r));
      return { ...u, regions, unrestricted: implicit || regions.length === 0, implicit };
    });
}
