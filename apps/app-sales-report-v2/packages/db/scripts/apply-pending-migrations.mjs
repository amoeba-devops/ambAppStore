// Apply migrations 0009-0017 (Selling/Listing price versions, prime-cost extras,
// fx_rates, period_snapshot fx_rate columns) to the dev Neon branch.
// Errors like "already exists" / 42701 / 42P07 are tolerated to keep this
// re-runnable.
import { neon } from '@neondatabase/serverless';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../../../.env'), 'utf-8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}

const sql = neon(process.env.DATABASE_URL);
const migrationsDir = resolve(__dirname, '../migrations');
// Catch-up applier — re-runs migrations 0009 onward idempotently. Earlier
// migrations (0000-0008) are handled by individual apply-*.mjs scripts or
// drizzle-kit and are skipped here. Errors like "already exists" are tolerated
// so this is safe to re-run after every `git pull` that brings new migrations.
const TARGET_RANGE = (name) => {
  const m = name.match(/^(\d{4})_/);
  if (!m) return false;
  return Number(m[1]) >= 9;
};

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql') && TARGET_RANGE(f))
  .sort();

console.log(`Applying ${files.length} migration file(s):`);
for (const f of files) console.log(`  - ${f}`);
console.log();

const TOLERABLE_CODES = new Set(['42701', '42P07', '42710', '42704', '42703']);

for (const file of files) {
  const text = readFileSync(resolve(migrationsDir, file), 'utf-8');
  const statements = text
    .split(/(?:--> statement-breakpoint|;)\s*\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter((s) => s.length > 0);

  console.log(`▸ ${file} (${statements.length} statements)`);
  for (const stmt of statements) {
    const oneLine = stmt.replace(/\s+/g, ' ');
    process.stdout.write('   → ' + oneLine.slice(0, 100) + (oneLine.length > 100 ? '…' : '') + ' ');
    try {
      await sql([stmt]);
      console.log('OK');
    } catch (err) {
      if (TOLERABLE_CODES.has(err?.code) || /already exists|does not exist/i.test(err?.message ?? '')) {
        console.log(`SKIP (${err.code ?? err.message?.slice(0, 40)})`);
      } else {
        console.log('FAIL');
        console.error(`     ${err.code ?? ''} ${err.message ?? err}`);
        process.exit(1);
      }
    }
  }
}

console.log('\n✓ All migrations applied (idempotent).');
