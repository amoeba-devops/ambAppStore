import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTrips } from '@car-v2/db/schema';

/**
 * Generate the next trip reference per tenant, e.g. "TR-1042".
 *
 * Uses the typed `db.select()` API instead of `db.execute(sql\`...\`)` because
 * the latter returns a raw driver-specific wrapper (neon-http wraps rows in
 * `{ rows: [...] }`), which was being mis-cast as a flat array → always
 * undefined → fallback to 1000 → infinite TR-1001 collisions.
 *
 * Race-safety: this is a `SELECT MAX` + insert pattern, so two concurrent
 * callers can read the same MAX before either inserts. The unique constraint
 * on `(ent_id, trp_ref)` catches the collision; createTripAction retries.
 */
export async function nextTripRef(entId: string): Promise<string> {
  const rows = await db
    .select({
      maxNum: sql<number | null>`MAX(CAST(SUBSTRING(${carTrips.trpRef} FROM 'TR-([0-9]+)') AS INTEGER))`,
    })
    .from(carTrips)
    .where(
      and(
        eq(carTrips.entId, entId),
        sql`${carTrips.trpRef} ~ '^TR-[0-9]+$'`,
      ),
    );

  /* maxNum can come back as string from Postgres aggregate — coerce. Null
   * happens on the very first trip per tenant. Floor 1000 means refs start
   * at TR-1001 for a clean look. */
  const raw = rows[0]?.maxNum;
  const lastNum = raw == null ? 1000 : Number(raw);
  const next = lastNum + 1;
  return `TR-${next.toString().padStart(4, '0')}`;
}
