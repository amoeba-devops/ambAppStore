import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carUsers, type CarUser } from '@car-v2/db/schema';

export interface UserListItem {
  usrId: string;
  usrName: string | null;
  usrEmail: string | null;
  usrLocalRole: CarUser['usrLocalRole'];
  usrAmaRoleSnapshot: string | null;
  usrLastLoginAt: Date | null;
  /** True when soft-deleted from car_users (admin blocked the user from car-v2). */
  blocked: boolean;
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

  return rows.map((r) => ({
    usrId: r.usrId,
    usrName: r.usrName,
    usrEmail: r.usrEmail,
    usrLocalRole: r.usrLocalRole,
    usrAmaRoleSnapshot: r.usrAmaRoleSnapshot,
    usrLastLoginAt: r.usrLastLoginAt,
    blocked: r.usrDeletedAt !== null,
  }));
}

/**
 * Map: ama_user_id → car_users info — used by Driver/Trip pages to attach
 * names/emails. Excludes soft-deleted users (blocked admins shouldn't appear
 * as assignable drivers).
 */
export async function getCarUsersByAmaId(
  entId: string,
  amaUserIds: string[],
): Promise<Map<string, Omit<UserListItem, 'blocked'>>> {
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

  const map = new Map<string, Omit<UserListItem, 'blocked'>>();
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
