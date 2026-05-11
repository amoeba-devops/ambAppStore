import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required for drizzle-kit');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
