import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';

/**
 * Generate the next trip reference per tenant, e.g. "TR-1042".
 *
 * Extracts the numeric suffix server-side so it sorts numerically rather than
 * lexically ("TR-1000" > "TR-999"). Unique constraint on (ent_id, trp_ref)
 * acts as the safety net — caller should retry on conflict in the rare race
 * window between two near-simultaneous createTrip calls.
 */
export async function nextTripRef(entId: string): Promise<string> {
  const result = await db.execute(sql<{ max_num: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING(trp_ref FROM 'TR-([0-9]+)') AS INTEGER)) AS max_num
    FROM car_trips
    WHERE ent_id = ${entId} AND trp_ref ~ '^TR-[0-9]+$'
  `);
  const rows = result as unknown as { max_num: number | null }[];
  const lastNum = rows[0]?.max_num ?? 1000;
  const next = lastNum + 1;
  return `TR-${next.toString().padStart(4, '0')}`;
}
