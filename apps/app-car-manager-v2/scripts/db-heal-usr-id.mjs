#!/usr/bin/env node
/**
 * One-shot data migration: align car_users.usr_id with usr_ama_user_id.
 *
 *   node scripts/db-heal-usr-id.mjs dev       # uses DATABASE_URL_DEV from .env
 *   node scripts/db-heal-usr-id.mjs staging   # uses DATABASE_URL_STAGING
 *
 * WHY:
 *   ensureCarUser ban đầu sinh random UUID cho usr_id, khác với JWT `sub`
 *   (= usr_ama_user_id). Mọi FK reference dùng JWT sub (trp_creator_id,
 *   exp_submitted_by, ntf_user_id, ...) đều fail vì target không match.
 *
 *   Code đã sửa để insert mới với usr_id = ama_user_id. Script này heal các
 *   row LEGACY còn tồn tại trong DB (cả dev và staging).
 *
 * IDEMPOTENT — chỉ động đến row có usr_id != usr_ama_user_id. Sau lần chạy
 * đầu, lần chạy kế tiếp report 0 rows healed.
 *
 * ORDER (per row):
 *   1. Stash old row's usr_ama_user_id = oldId   (free unique slot)
 *   2. INSERT new row with usr_id = ama_user_id   (parent NEW tồn tại)
 *   3. UPDATE all FK columns oldId → newId        (parallel)
 *   4. DELETE old orphan row                       (no FK left)
 *   5. INSERT audit row USR_ID_HEALED              (traceable)
 *
 * KHÔNG chạy tự động trong app — đây là dev/staging data fix one-shot.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');

const VALID_TARGETS = ['dev', 'staging'];
const target = process.argv[2];
if (!target || !VALID_TARGETS.includes(target)) {
  console.error(`Usage: node scripts/db-heal-usr-id.mjs <${VALID_TARGETS.join(' | ')}>`);
  process.exit(1);
}

// Parse .env (same pattern as db-migrate.mjs / db-seed.mjs)
const vars = {};
for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m) vars[m[1]] = m[2];
}
const url = vars[`DATABASE_URL_${target.toUpperCase()}`];
if (!url) {
  console.error(`✗ Missing DATABASE_URL_${target.toUpperCase()} in .env`);
  process.exit(1);
}

const sql = neon(url);
const masked = url.replace(/:[^:@/]+@/, ':****@');
console.log(`→ Healing ${target.toUpperCase()} branch`);
console.log(`  ${masked}`);
console.log();

const now = new Date().toISOString();

try {
  // Lấy tất cả row cần heal
  const orphans = await sql`
    SELECT usr_id, ent_id, usr_ama_user_id, usr_email, usr_name,
           usr_local_role, usr_ama_role_snapshot, usr_last_login_at
    FROM car_users
    WHERE usr_id != usr_ama_user_id
      AND usr_deleted_at IS NULL
  `;

  if (orphans.length === 0) {
    console.log('  ✓ No orphan rows — DB already aligned.');
    process.exit(0);
  }

  console.log(`  Found ${orphans.length} row(s) to heal:\n`);

  let healed = 0;
  for (const row of orphans) {
    const oldId = row.usr_id;
    const newId = row.usr_ama_user_id;
    console.log(`  → ${row.usr_email ?? row.usr_name ?? oldId}`);
    console.log(`      ${oldId}  →  ${newId}`);

    try {
      // Step 1: stash old ama_user_id để né unique (ent_id, usr_ama_user_id)
      await sql`UPDATE car_users SET usr_ama_user_id = ${oldId} WHERE usr_id = ${oldId}`;

      // Step 2: INSERT row mới với usr_id = ama_user_id
      await sql`
        INSERT INTO car_users (
          usr_id, ent_id, usr_ama_user_id, usr_email, usr_name,
          usr_local_role, usr_ama_role_snapshot, usr_last_login_at
        )
        VALUES (
          ${newId}, ${row.ent_id}, ${newId}, ${row.usr_email}, ${row.usr_name},
          ${row.usr_local_role}, ${row.usr_ama_role_snapshot}, ${row.usr_last_login_at}
        )
      `;

      // Step 3: rebind FK children (parallel)
      await Promise.all([
        sql`UPDATE car_trips SET trp_creator_id = ${newId} WHERE trp_creator_id = ${oldId}`,
        sql`UPDATE car_trips SET trp_passenger_id = ${newId} WHERE trp_passenger_id = ${oldId}`,
        sql`UPDATE car_drivers SET drv_user_id = ${newId} WHERE drv_user_id = ${oldId}`,
        sql`UPDATE car_expenses SET exp_submitted_by = ${newId} WHERE exp_submitted_by = ${oldId}`,
        sql`UPDATE car_expenses SET exp_reviewed_by = ${newId} WHERE exp_reviewed_by = ${oldId}`,
        sql`UPDATE car_notifications SET ntf_user_id = ${newId} WHERE ntf_user_id = ${oldId}`,
        sql`UPDATE car_audit_logs SET aud_user_id = ${newId} WHERE aud_user_id = ${oldId}`,
        sql`UPDATE car_push_subscriptions SET psh_user_id = ${newId} WHERE psh_user_id = ${oldId}`,
      ]);

      // Step 4: delete old orphan row
      await sql`DELETE FROM car_users WHERE usr_id = ${oldId}`;

      // Step 5: audit
      await sql`
        INSERT INTO car_audit_logs (
          aud_id, ent_id, aud_user_id, aud_action, aud_entity, aud_entity_id,
          aud_before, aud_after, aud_created_at
        )
        VALUES (
          ${randomUUID()}, ${row.ent_id}, ${newId},
          'USR_ID_HEALED', 'USER', ${newId},
          ${JSON.stringify({ usr_id: oldId })},
          ${JSON.stringify({ usr_id: newId, reason: 'align with usr_ama_user_id (data migration)' })},
          ${now}
        )
      `;

      healed++;
      console.log(`      ✓ healed`);
    } catch (err) {
      console.error(`      ✗ failed: ${err.message}`);
      throw err;
    }
  }

  console.log();
  console.log(`  ✓ ${healed}/${orphans.length} rows healed.`);
} catch (err) {
  console.error('✗ Heal aborted:', err.message);
  process.exit(1);
}
