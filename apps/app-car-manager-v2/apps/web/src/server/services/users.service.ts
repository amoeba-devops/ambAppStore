import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carUsers } from '@car-v2/db/schema';
import { mapAmaRoleToLocal, type AmaJwtClaims } from '@car-v2/shared/auth';

/**
 * Upsert the local `car_users` row for an AMA-authenticated principal.
 *
 * AMA SSO passthrough doesn't seed local user rows — they're only created by
 * `scripts/db-seed.mjs` or by future admin invite flows. Any FK to `car_users`
 * (push subscriptions, driver records, notification recipients) breaks for a
 * fresh AMA user with code `23503 foreign_key_violation` until someone manually
 * inserts a row. This helper bridges that gap on demand using the
 * `(ent_id, usr_ama_user_id)` unique index.
 *
 * Convention (matches db-seed.mjs): `usr_id === usr_ama_user_id` so any code
 * path that joins on `usrId = claims.sub` keeps working.
 *
 * Idempotent. Safe to call from any authenticated server path.
 */
export async function ensureCarUser(input: {
  entId: string;
  /** AMA `sub` — also reused as the local `usr_id`. */
  userId: string;
  amaRole: AmaJwtClaims['role'];
  email?: string | null;
  name?: string | null;
}): Promise<void> {
  const localRole = mapAmaRoleToLocal(input.amaRole);
  const now = new Date();

  await db
    .insert(carUsers)
    .values({
      usrId: input.userId,
      entId: input.entId,
      usrAmaUserId: input.userId,
      usrEmail: input.email ?? null,
      usrName: input.name ?? null,
      usrLocalRole: localRole,
      usrAmaRoleSnapshot: input.amaRole,
      usrLastLoginAt: now,
    })
    .onConflictDoUpdate({
      target: [carUsers.entId, carUsers.usrAmaUserId],
      set: {
        usrAmaRoleSnapshot: input.amaRole,
        usrLastLoginAt: now,
        /* Backfill name/email only when currently null — never clobber values
         * an admin may have edited in `car_users` (e.g. translit fixes). */
        ...(input.email
          ? { usrEmail: sql`coalesce(${carUsers.usrEmail}, ${input.email})` }
          : {}),
        ...(input.name
          ? { usrName: sql`coalesce(${carUsers.usrName}, ${input.name})` }
          : {}),
      },
    });
}
