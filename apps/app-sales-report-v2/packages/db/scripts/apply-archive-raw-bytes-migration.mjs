import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../../../.env'), 'utf-8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}

const sql = neon(process.env.DATABASE_URL);
await sql`ALTER TABLE sal_archive_files ADD COLUMN IF NOT EXISTS arf_raw_bytes bytea`;
const cols = await sql`
  SELECT column_name, data_type
    FROM information_schema.columns
   WHERE table_name = 'sal_archive_files' AND column_name = 'arf_raw_bytes'
`;
console.log('arf_raw_bytes:', cols);
