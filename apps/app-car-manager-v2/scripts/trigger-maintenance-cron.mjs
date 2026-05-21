#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Manual trigger for /api/v1/cron/maintenance-alert.
 *
 * Decision D9 of REQ-20260519: until Render Cron is registered, dev/staging
 * runs the evaluator via this script. Usage:
 *
 *   # Against local dev server:
 *   node scripts/trigger-maintenance-cron.mjs
 *
 *   # Against staging on Render:
 *   TARGET_URL=https://car-manager-staging.onrender.com \
 *   CRON_SECRET=xxx \
 *   node scripts/trigger-maintenance-cron.mjs
 *
 * Reads `CRON_SECRET` from env or from the local .env file. Falls back to
 * http://localhost:3001 when TARGET_URL is not provided.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadDotenv() {
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    /* .env optional in CI/staging — already populated by env. */
  }
}

loadDotenv();

const target = (process.env.TARGET_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error('CRON_SECRET is required (set in .env or pass via env)');
  process.exit(1);
}

const url = `${target}/api/v1/cron/maintenance-alert`;
console.log(`[cron] POST ${url}`);

const started = Date.now();
const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${secret}`,
    'X-Trigger': 'manual-script',
  },
});
const body = await res.json().catch(() => ({ raw: 'non-json response' }));
console.log(`[cron] HTTP ${res.status} in ${Date.now() - started}ms`);
console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);
