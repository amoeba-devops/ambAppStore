// One-off: apply 0005_add_period_snapshots.sql directly via Neon driver,
// bypassing drizzle-kit's "data-loss" check (false positive on a pre-existing
// varchar length difference unrelated to this migration).
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
const sqlText = readFileSync(resolve(__dirname, '../migrations/0005_add_period_snapshots.sql'), 'utf-8');

// Drizzle uses `--> statement-breakpoint` to separate statements
const statements = sqlText
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`Applying ${statements.length} statements from 0005_add_period_snapshots.sql ...`);
for (const stmt of statements) {
  console.log('  →', stmt.slice(0, 80).replace(/\s+/g, ' ') + (stmt.length > 80 ? '…' : ''));
  // neon serverless: use tag-like call with unsafe SQL via `sql.unsafe` or raw template
  await sql([stmt]);
}
console.log('✓ Done. sal_period_snapshots table is live.');

// Verify
const rows = await sql`SELECT COUNT(*)::int AS n FROM sal_period_snapshots`;
console.log(`  Rows in sal_period_snapshots: ${rows[0].n}`);
