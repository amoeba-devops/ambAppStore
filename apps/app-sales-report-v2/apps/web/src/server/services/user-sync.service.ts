import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema, withEnt } from '@v2/db';
import { mapAmaRoleToLocal, type AmaJwtClaims, type LocalRole } from '@v2/shared/auth';

type UserStatus = (typeof schema.userStatusEnum.enumValues)[number];

export interface SyncResult {
  usrId: string;
  localRole: LocalRole;
  status: UserStatus;
}

/**
 * Upsert the current AMA user into sal_users on each request.
 * - On first sync: INSERT with default role from AMA mapping.
 * - On subsequent: bump last_login_at, count, refresh AMA snapshot fields.
 * - PRESERVES `usr_local_role` (admin override) so role changes persist.
 * Returns the persisted local role + status for the caller to enforce.
 */
export async function ensureUserSynced(claims: {
  entId: string;
  amaUserId: string;
  amaRole: AmaJwtClaims['role'];
  email: string | null;
  name: string | null;
}): Promise<SyncResult> {
  const existing = await db
    .select({
      usrId: schema.salUsers.usrId,
      localRole: schema.salUsers.usrLocalRole,
      status: schema.salUsers.usrStatus,
    })
    .from(schema.salUsers)
    .where(
      and(
        withEnt(schema.salUsers.entId, claims.entId),
        eq(schema.salUsers.usrAmaUserId, claims.amaUserId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    // Update heartbeat fields, preserve local role override.
    await db
      .update(schema.salUsers)
      .set({
        usrLastLoginAt: new Date(),
        usrLoginCount: sql`${schema.salUsers.usrLoginCount} + 1`,
        usrAmaRoleSnapshot: claims.amaRole,
        usrEmail: claims.email ?? undefined,
        usrName: claims.name ?? undefined,
        usrUpdatedAt: new Date(),
      })
      .where(eq(schema.salUsers.usrId, existing[0].usrId));
    return {
      usrId: existing[0].usrId,
      localRole: existing[0].localRole,
      status: existing[0].status,
    };
  }

  const usrId = randomUUID();
  const localRole = mapAmaRoleToLocal(claims.amaRole);
  await db
    .insert(schema.salUsers)
    .values({
      usrId,
      entId: claims.entId,
      usrAmaUserId: claims.amaUserId,
      usrEmail: claims.email,
      usrName: claims.name,
      usrLocalRole: localRole,
      usrAmaRoleSnapshot: claims.amaRole,
      usrLoginCount: 1,
      usrLastLoginAt: new Date(),
    })
    .onConflictDoNothing();
  return { usrId, localRole, status: 'ACTIVE' };
}
