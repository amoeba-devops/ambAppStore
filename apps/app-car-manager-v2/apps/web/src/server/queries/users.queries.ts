import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carUserFleetAccess,
  carUsers,
  type CarUser,
  type CarVehicleType,
} from '@car-v2/db/schema';

/** Canonical order so the badge row reads the same everywhere. */
const DEPT_ORDER: readonly CarVehicleType[] = ['CAR', 'TRUCK'];

export interface UserListItem {
  usrId: string;
  usrName: string | null;
  usrEmail: string | null;
  usrLocalRole: CarUser['usrLocalRole'];
  usrAmaRoleSnapshot: string | null;
  usrLastLoginAt: Date | null;
  /** True when soft-deleted from car_users (admin blocked the user from car-v2). */
  blocked: boolean;
  /** Live CAR/TRUCK memberships, canonical order. Empty means "not assigned to
   * either app" — a real state, not an error: it is what a fresh AMA member
   * looks like, and what every driver created before /drivers/new started
   * passing a department looks like. ADMINs read as both regardless of rows
   * (resolveFleetAccess grants them implicitly). */
  depts: CarVehicleType[];
}

/**
 * List all v2 users (users who have logged into car-v2 at least once).
 * Includes blocked rows so admins can see + restore them.
 * Sort: last_login DESC.
 */
export async function listUsers(entId: string): Promise<UserListItem[]> {
  const rows = await db
    .select({
      usrId: carUsers.usrId,
      usrName: carUsers.usrName,
      usrEmail: carUsers.usrEmail,
      usrLocalRole: carUsers.usrLocalRole,
      usrAmaRoleSnapshot: carUsers.usrAmaRoleSnapshot,
      usrLastLoginAt: carUsers.usrLastLoginAt,
      usrDeletedAt: carUsers.usrDeletedAt,
    })
    .from(carUsers)
    .where(eq(carUsers.entId, entId))
    .orderBy(desc(carUsers.usrLastLoginAt));

  /* One extra round-trip for the whole tenant's memberships, grouped in memory —
   * not a per-row lookup. The roster is admin-only and bounded by tenant size. */
  const memberships = await db
    .select({ usrId: carUserFleetAccess.usrId, type: carUserFleetAccess.ufaVehicleType })
    .from(carUserFleetAccess)
    .where(and(eq(carUserFleetAccess.entId, entId), isNull(carUserFleetAccess.ufaDeletedAt)));

  const byUser = new Map<string, Set<CarVehicleType>>();
  for (const m of memberships) {
    let set = byUser.get(m.usrId);
    if (!set) byUser.set(m.usrId, (set = new Set()));
    set.add(m.type);
  }

  return rows.map((r) => ({
    usrId: r.usrId,
    usrName: r.usrName,
    usrEmail: r.usrEmail,
    usrLocalRole: r.usrLocalRole,
    usrAmaRoleSnapshot: r.usrAmaRoleSnapshot,
    usrLastLoginAt: r.usrLastLoginAt,
    blocked: r.usrDeletedAt !== null,
    depts: DEPT_ORDER.filter((d) => byUser.get(r.usrId)?.has(d)),
  }));
}

/** Live CAR/TRUCK memberships for ONE user — feeds the edit form's department
 *  controls. Same shape/order as `UserListItem.depts`. */
export async function getUserDepts(entId: string, userId: string): Promise<CarVehicleType[]> {
  const rows = await db
    .select({ type: carUserFleetAccess.ufaVehicleType })
    .from(carUserFleetAccess)
    .where(
      and(
        eq(carUserFleetAccess.entId, entId),
        eq(carUserFleetAccess.usrId, userId),
        isNull(carUserFleetAccess.ufaDeletedAt),
      ),
    );
  return DEPT_ORDER.filter((d) => rows.some((r) => r.type === d));
}

/** The identity fields only — no `blocked`, no `depts`. Kept separate from
 *  `UserListItem` so the roster can carry membership info without every lookup
 *  helper having to fetch it. */
export type UserIdentity = Omit<UserListItem, 'blocked' | 'depts'>;

/**
 * Map: ama_user_id → car_users info — used by Driver/Trip pages to attach
 * names/emails. Excludes soft-deleted users (blocked admins shouldn't appear
 * as assignable drivers).
 */
export async function getCarUsersByAmaId(
  entId: string,
  amaUserIds: string[],
): Promise<Map<string, UserIdentity>> {
  if (amaUserIds.length === 0) return new Map();
  const rows = await db
    .select({
      usrId: carUsers.usrId,
      usrName: carUsers.usrName,
      usrEmail: carUsers.usrEmail,
      usrLocalRole: carUsers.usrLocalRole,
      usrAmaRoleSnapshot: carUsers.usrAmaRoleSnapshot,
      usrLastLoginAt: carUsers.usrLastLoginAt,
      usrAmaUserId: carUsers.usrAmaUserId,
    })
    .from(carUsers)
    .where(and(eq(carUsers.entId, entId), isNull(carUsers.usrDeletedAt)));

  const map = new Map<string, UserIdentity>();
  for (const r of rows) {
    if (amaUserIds.includes(r.usrAmaUserId)) {
      map.set(r.usrAmaUserId, {
        usrId: r.usrId,
        usrName: r.usrName,
        usrEmail: r.usrEmail,
        usrLocalRole: r.usrLocalRole,
        usrAmaRoleSnapshot: r.usrAmaRoleSnapshot,
        usrLastLoginAt: r.usrLastLoginAt,
      });
    }
  }
  return map;
}
