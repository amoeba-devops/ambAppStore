#!/usr/bin/env node
/**
 * Seed dev accounts để vượt qua onboarding flow.
 *
 * Seeds:
 *   ambManagement (Postgres `db_amb` qua Docker `amb-postgres`):
 *     - 1 entity DEV01 (ent_id = 00000000-0000-0000-0000-000000000010)
 *     - 3 users (OWNER/MANAGER/MEMBER) với fixed UUIDs khớp dev-login defaults
 *     - 3 entity_user_role rows ACTIVE
 *
 *   car-v2 (Neon):
 *     - 1 car_tenant_settings row với tns_users_synced_at = NOW() → skip onboarding
 *     - 3 car_users rows (mirror AMA users) → FK ready cho trips/expenses
 *
 * Idempotent — chạy nhiều lần OK (ON CONFLICT DO NOTHING / ON CONFLICT DO UPDATE).
 *
 * Usage:
 *   node --env-file=../../.env scripts/seed-dev-accounts.mjs
 *   # Hoặc từ root:
 *   node --env-file=apps/app-car-manager-v2/.env apps/app-car-manager-v2/scripts/seed-dev-accounts.mjs
 *
 * Pre-req:
 *   - Docker container `amb-postgres` running (PostgreSQL :5432)
 *   - DATABASE_URL env trỏ tới Neon dev branch
 *   - .env có DATABASE_URL set (load qua `--env-file`)
 */

import { neon } from '@neondatabase/serverless';
import { execSync } from 'node:child_process';

// ─── Fixed IDs (khớp dev-login defaults) ───────────────────────────────────
/* RFC 4122 version-4 format: position 13 = '4' (version nibble), position 17 = '8'
 * (variant 10xx). Old sentinels (all-zeros với last byte tăng dần) bị AMA
 * `resolveEntityId` reject với `uuidValidate()` strict — nó force version bits.
 * Vì pattern 0000-4000-8000-* không đụng RFC4122 timestamp/random nên KHÔNG
 * collision với real UUIDs gen từ Postgres `gen_random_uuid()`. */
const DEV_ENT_ID  = '00000000-0000-4000-8000-000000000010';
const DEV_OWNER   = '00000000-0000-4000-8000-000000000001';
const DEV_MANAGER = '00000000-0000-4000-8000-000000000002';
const DEV_DRIVER  = '00000000-0000-4000-8000-000000000003';

/* Legacy sentinel UUIDs từ seed cũ — cleanup nếu còn tồn tại trong DB. */
const LEGACY_IDS = {
  ent: '00000000-0000-0000-0000-000000000010',
  owner: '00000000-0000-0000-0000-000000000001',
  manager: '00000000-0000-0000-0000-000000000002',
  driver: '00000000-0000-0000-0000-000000000003',
};

const DEV_USERS = [
  { sub: DEV_OWNER,   name: 'Dev Owner',   email: 'dev-owner@local.dev',   role: 'MASTER', amaRole: 'MASTER',  localRole: 'ADMIN'   },
  { sub: DEV_MANAGER, name: 'Dev Manager', email: 'dev-manager@local.dev', role: 'MANAGER',amaRole: 'MANAGER', localRole: 'MANAGER' },
  { sub: DEV_DRIVER,  name: 'Dev Driver',  email: 'dev-driver@local.dev',  role: 'MEMBER', amaRole: 'MEMBER',  localRole: 'DRIVER'  },
];

// ─── ambManagement seed (Docker exec psql) ─────────────────────────────────

/* Bcrypt hash của 'dev-passwordless-only' — passwordless email-login bypass
 * field này nhưng schema yêu cầu NOT NULL. Không dùng cho real auth.
 * Generated với: node -e "console.log(require('bcrypt').hashSync('dev-passwordless-only', 10))"
 * Cố định trong source để idempotent. */
const PLACEHOLDER_PW = '$2b$10$dXJRZBaCPSwSr0J3rmgxXuKxKVZ0Uo.GpzVfFGdsxqYAehgxKkS7K';

function seedAma() {
  console.log('[seed-ama] Seeding entity + users in db_amb...');

  const sql = `
    -- 0) Cleanup legacy invalid-UUID seed rows (RFC4122 fail case)
    DELETE FROM amb_hr_entity_user_roles WHERE ent_id = '${LEGACY_IDS.ent}';
    DELETE FROM amb_users WHERE usr_id IN ('${LEGACY_IDS.owner}', '${LEGACY_IDS.manager}', '${LEGACY_IDS.driver}');
    DELETE FROM amb_hr_entities WHERE ent_id = '${LEGACY_IDS.ent}';

    -- 1) Entity
    INSERT INTO amb_hr_entities (
      ent_id, ent_code, ent_name, ent_name_en, ent_country, ent_currency,
      ent_status, ent_level, ent_is_hq, ent_sort_order
    ) VALUES (
      '${DEV_ENT_ID}', 'DEV01', 'Dev Entity (Local)', 'Dev Entity', 'VN', 'VND',
      'ACTIVE', 'SUBSIDIARY', false, 99
    )
    ON CONFLICT (ent_id) DO UPDATE SET
      ent_name = EXCLUDED.ent_name,
      ent_status = 'ACTIVE';

    -- 2) Users (3 roles)
    ${DEV_USERS.map(u => `
    INSERT INTO amb_users (
      usr_id, usr_email, usr_password, usr_name, usr_unit, usr_role,
      usr_level_code, usr_status, usr_company_id, usr_join_method
    ) VALUES (
      '${u.sub}', '${u.email}', '${PLACEHOLDER_PW}', '${u.name}', 'Dev',
      '${u.role}', 'USER_LEVEL', 'ACTIVE', '${DEV_ENT_ID}', 'DEV_SEED'
    )
    ON CONFLICT (usr_id) DO UPDATE SET
      usr_email = EXCLUDED.usr_email,
      usr_status = 'ACTIVE',
      usr_company_id = '${DEV_ENT_ID}';
    `).join('\n')}

    -- 3) Entity user roles
    ${DEV_USERS.map(u => `
    INSERT INTO amb_hr_entity_user_roles (ent_id, usr_id, eur_role, eur_status)
    VALUES ('${DEV_ENT_ID}', '${u.sub}', '${u.role}', 'ACTIVE')
    ON CONFLICT (ent_id, usr_id) DO UPDATE SET
      eur_role = EXCLUDED.eur_role,
      eur_status = 'ACTIVE';
    `).join('\n')}

    -- 4) Verify
    SELECT
      (SELECT ent_code FROM amb_hr_entities WHERE ent_id = '${DEV_ENT_ID}') AS entity,
      (SELECT COUNT(*) FROM amb_users WHERE usr_company_id = '${DEV_ENT_ID}') AS users,
      (SELECT COUNT(*) FROM amb_hr_entity_user_roles WHERE ent_id = '${DEV_ENT_ID}') AS roles;
  `;

  /* docker exec với heredoc stdin để xử lý quoted SQL correctly */
  const output = execSync(
    `docker exec -i amb-postgres psql -U amb_user -d db_amb -v ON_ERROR_STOP=1`,
    { input: sql, encoding: 'utf-8' },
  );
  console.log(output.split('\n').slice(-10).join('\n'));
}

// ─── car-v2 seed (Neon) ────────────────────────────────────────────────────

async function seedCarV2() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL env not set. Use --env-file=.env');
  const q = neon(url);

  console.log('[seed-carv2] Cleanup legacy seed rows + seeding car_tenant_settings + car_users...');

  /* Cleanup legacy tenant_settings để onboarding-state reset. KHÔNG xoá legacy
   * car_users vì car_audit_logs FK blocks. Legacy rows sẽ orphan với ent_id cũ
   * (đã xoá khỏi AMA) — không interfere với new ent_id mới. */
  await q`DELETE FROM car_tenant_settings WHERE ent_id = ${LEGACY_IDS.ent}`;

  /* tns_users_synced_at = NULL initially để test onboarding flow. Trước đây
   * seed set NOW() để bypass nhưng giờ muốn test sync action thực chạy được. */
  await q`
    INSERT INTO car_tenant_settings (
      tns_id, ent_id, tns_currency, tns_timezone,
      tns_users_synced_at, tns_users_synced_count
    ) VALUES (
      gen_random_uuid(), ${DEV_ENT_ID}, 'VND', 'Asia/Ho_Chi_Minh',
      NULL, 0
    )
    ON CONFLICT (ent_id) DO UPDATE SET
      tns_users_synced_at = NULL,
      tns_users_synced_count = 0
  `;

  /* car_users mirror — pre-populate để trip/expense creation không FK fail. */
  for (const u of DEV_USERS) {
    await q`
      INSERT INTO car_users (
        usr_id, ent_id, usr_ama_user_id, usr_email, usr_name,
        usr_local_role, usr_ama_role_snapshot
      ) VALUES (
        ${u.sub}, ${DEV_ENT_ID}, ${u.sub}, ${u.email}, ${u.name},
        ${u.localRole}, ${u.amaRole}
      )
      ON CONFLICT (ent_id, usr_ama_user_id) DO UPDATE SET
        usr_email = ${u.email},
        usr_name = ${u.name},
        usr_local_role = ${u.localRole},
        usr_updated_at = NOW()
    `;
  }

  /* Verify */
  const tenant = await q`SELECT tns_users_synced_at, tns_users_synced_count FROM car_tenant_settings WHERE ent_id = ${DEV_ENT_ID}`;
  const users = await q`SELECT usr_email, usr_local_role FROM car_users WHERE ent_id = ${DEV_ENT_ID} ORDER BY usr_email`;
  console.log('[seed-carv2] tenant:', tenant[0]);
  console.log('[seed-carv2] users:', users);
}

// ─── Run ───────────────────────────────────────────────────────────────────

(async () => {
  try {
    seedAma();
    await seedCarV2();
    console.log('\n✅ Seed done. Login URLs:');
    console.log('   ADMIN:   http://localhost:3001/dev-login?role=OWNER');
    console.log('   MANAGER: http://localhost:3001/dev-login?role=MANAGER');
    console.log('   DRIVER:  http://localhost:3001/dev-login?role=MEMBER');
    console.log('\nĐăng nhập dev → middleware bypass onboarding (đã synced) → vào / hoặc /today.');
  } catch (e) {
    console.error('\n❌ Seed failed:', e.message);
    process.exit(1);
  }
})();
