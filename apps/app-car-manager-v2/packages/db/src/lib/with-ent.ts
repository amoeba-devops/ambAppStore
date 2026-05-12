import { eq, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

export function withEnt(entIdColumn: PgColumn, entId: string): SQL {
  return eq(entIdColumn, entId);
}
