#!/usr/bin/env node
/**
 * Apply Drizzle migrations to a specific Neon branch.
 *
 *   node scripts/db-migrate.mjs dev       # uses DATABASE_URL_DEV from .env
 *   node scripts/db-migrate.mjs staging   # uses DATABASE_URL_STAGING from .env
 *
 * Reads .env at app-car-manager-v2 root, picks the URL by key, sets it as
 * DATABASE_URL in the child process, then invokes the same `drizzle-kit migrate`
 * the normal `npm run db:migrate` would run.
 *
 * Does NOT modify .env on disk — only overrides for one process.
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');

const VALID_TARGETS = ['dev', 'staging'];
const target = process.argv[2];

if (!target || !VALID_TARGETS.includes(target)) {
  console.error(`Usage: node scripts/db-migrate.mjs <${VALID_TARGETS.join('|')}>`);
  if (target) console.error(`  Got: "${target}" (not valid)`);
  process.exit(1);
}

if (!existsSync(ENV_PATH)) {
  console.error(`✗ .env file not found at ${ENV_PATH}`);
  console.error('  Run: cp .env.example .env');
  process.exit(1);
}

// Parse .env into a flat map (no quotes, no expansion — Neon URLs don't need it)
const vars = {};
for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m) vars[m[1]] = m[2];
}

const urlKey = `DATABASE_URL_${target.toUpperCase()}`;
const url = vars[urlKey];

if (!url) {
  console.error(`✗ Missing ${urlKey} in .env.`);
  console.error(`  Add the ${target} branch connection string from Neon Console:`);
  console.error(`  ${urlKey}=postgresql://neondb_owner:...@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require`);
  process.exit(1);
}

// Mask password for log
const masked = url.replace(/:[^:@/]+@/, ':****@');
console.log(`→ Migrating ${target.toUpperCase()} branch`);
console.log(`  ${masked}`);
console.log();

// Spawn `npm run db:migrate -w @car-v2/db` with overridden DATABASE_URL.
// dotenv-cli (default mode) will NOT override env vars already in process.env,
// so our override survives all the way to drizzle-kit.
const child = spawn(
  'npm',
  ['run', 'db:migrate', '-w', '@car-v2/db'],
  {
    stdio: 'inherit',
    cwd: ROOT,
    env: { ...process.env, ...vars, DATABASE_URL: url },
    shell: true, // required on Windows to spawn npm.cmd
  },
);

child.on('exit', (code) => process.exit(code ?? 1));
