#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Dev-mode cron loop — fires /api/v1/cron/maintenance-alert at a fixed
 * interval against the local dev server. Used by `npm run dev:full` to
 * mirror the production sidecar without needing Docker.
 *
 * Behaviour:
 *   1. Poll /api/v1/health until 200 (dev server may still be compiling).
 *   2. Fire the cron endpoint once immediately.
 *   3. Sleep CRON_INTERVAL_SECONDS, repeat. Errors logged but loop continues.
 *
 * Config (env or .env):
 *   CRON_SECRET                — required
 *   TARGET_URL                 — default http://localhost:3001
 *   CRON_INTERVAL_SECONDS      — default 60
 *   CRON_HEALTH_TIMEOUT_MS     — default 60000 (1 min)
 *
 * Stop: Ctrl+C (or whatever sends SIGTERM/SIGINT to `concurrently`).
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
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* .env is optional — env may already be populated by the parent process. */
  }
}

loadDotenv();

const target = (process.env.TARGET_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
const interval = Math.max(5, Number(process.env.CRON_INTERVAL_SECONDS ?? 60));
const healthTimeoutMs = Number(process.env.CRON_HEALTH_TIMEOUT_MS ?? 60_000);
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error('[dev-cron] CRON_SECRET missing — add to .env. Exiting.');
  process.exit(1);
}

const healthUrl = `${target}/api/v1/health`;
const cronUrl = `${target}/api/v1/cron/maintenance-alert`;
const tsPrefix = () => `[dev-cron ${new Date().toISOString().slice(11, 19)}]`;

let running = true;
const shutdown = (signal) => {
  console.log(`${tsPrefix()} ${signal} received — exiting loop`);
  running = false;
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function waitForHealth() {
  const deadline = Date.now() + healthTimeoutMs;
  while (running && Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        console.log(`${tsPrefix()} dev server ready at ${target}`);
        return true;
      }
    } catch {
      /* server still starting */
    }
    await sleep(2000);
  }
  return false;
}

async function fireOnce() {
  const started = Date.now();
  try {
    const res = await fetch(cronUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'X-Cron-Source': 'dev-loop' },
    });
    const body = await res.json().catch(() => ({ raw: 'non-json' }));
    if (res.ok && body.success) {
      const d = body.data ?? {};
      console.log(
        `${tsPrefix()} OK ${Date.now() - started}ms ` +
          `· vehicles=${d.vehiclesScanned ?? '?'} alerts=${d.alertsCreated ?? '?'} ` +
          `notify=${d.notificationsFanout ?? '?'}`,
      );
    } else {
      console.error(`${tsPrefix()} FAIL HTTP ${res.status}`, body);
    }
  } catch (err) {
    console.error(`${tsPrefix()} FAIL`, err instanceof Error ? err.message : err);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  console.log(
    `${tsPrefix()} starting — target=${target} · interval=${interval}s · ` +
      `waiting for ${healthUrl}`,
  );
  const ready = await waitForHealth();
  if (!ready) {
    console.error(`${tsPrefix()} dev server not ready within ${healthTimeoutMs}ms — exiting`);
    process.exit(1);
  }

  /* Fire immediately on start, then loop on schedule. */
  while (running) {
    await fireOnce();
    /* Interruptible sleep so SIGINT exits quickly instead of waiting full interval. */
    for (let s = 0; s < interval && running; s += 1) {
      await sleep(1000);
    }
  }

  console.log(`${tsPrefix()} loop exited`);
  process.exit(0);
})();
