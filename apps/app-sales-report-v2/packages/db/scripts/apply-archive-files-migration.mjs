// One-off: apply 0006_add_archive_files.sql directly via Neon driver,
// bypassing drizzle-kit's data-loss false-positives on unrelated columns.
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
const sqlText = readFileSync(resolve(__dirname, '../migrations/0006_add_archive_files.sql'), 'utf-8');
const statements = sqlText
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`Applying ${statements.length} statements from 0006_add_archive_files.sql ...`);
for (const stmt of statements) {
  console.log('  →', stmt.slice(0, 80).replace(/\s+/g, ' ') + (stmt.length > 80 ? '…' : ''));
  await sql([stmt]);
}
console.log('✓ Done. sal_archive_files table is live.');

const rows = await sql`SELECT COUNT(*)::int AS n FROM sal_archive_files`;
console.log(`  Rows in sal_archive_files: ${rows[0].n}`);
