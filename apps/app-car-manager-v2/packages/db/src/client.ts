import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema/index.js';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

// Lazy initialization: Next.js 15 "Collect page data" step loads page modules
// at build time even for dynamic routes. Throwing on missing DATABASE_URL at
// module-load would break the production build. Defer to first query instead.
let _db: DrizzleDb | null = null;

function getDb(): DrizzleDb {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  const sql = neon(process.env.DATABASE_URL);
  _db = drizzle(sql, { schema });
  return _db;
}

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
}) as DrizzleDb;

export type Db = DrizzleDb;
