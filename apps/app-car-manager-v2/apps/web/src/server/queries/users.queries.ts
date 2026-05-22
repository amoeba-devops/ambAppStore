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
}

/**
 * v2 local users cache only (subset who logged in v2 ít nhất 1 lần).
 * Sort: last_login DESC.
 *
 * Use case: fallback khi AMA endpoint không reach được.
 * Primary source: `listEntityMembersFromAma` (AMA is source of truth).
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
    })
    .from(carUsers)
    .where(and(eq(carUsers.entId, entId), isNull(carUsers.usrDeletedAt)))
    .orderBy(desc(carUsers.usrLastLoginAt));

  return rows;
}

/**
 * Map: ama_user_id → car_users info (for cross-reference với AMA member list).
 * Returns chỉ những user có row trong car_users (đã login v2).
 */
export async function getCarUsersByAmaId(
  entId: string,
  amaUserIds: string[],
): Promise<Map<string, UserListItem>> {
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

  const map = new Map<string, UserListItem>();
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
