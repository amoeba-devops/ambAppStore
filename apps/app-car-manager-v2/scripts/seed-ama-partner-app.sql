-- ============================================================================
-- ambManagement (AMA) Partner App Registration — Car Manager v2
--
-- Run against ambManagement Postgres DB (NOT car-manager-v2 Neon DB).
-- This registers car-manager-v2 so AMA can:
--   1. Issue JWT tokens with shared JWT_SECRET (HS256)
--   2. Show the app in AMA admin → Custom Apps
--   3. Allow entities to install/subscribe to the app
--
-- Mirrors the v1 pattern in:
--   ambManagement/scripts/seed-car-manager-app.sql
--   ambManagement/sql/migration_app_store_oauth_clients.sql
--
-- Auth mode: jwt (passthrough — AMA mints JWT, app verifies with jose).
-- Open mode: iframe (embedded inside AMA + ambAppStore).
--
-- ⚠️ Before running:
--   1. Replace `<ADMIN_USER_UUID>` with a real `usr_id` from amb_users
--   2. Confirm `JWT_SECRET` in AMA env matches car-manager-v2 `.env`
--   3. Replace deploy URL(s) below if different
-- ============================================================================

-- Step 1 — ensure internal partner exists
INSERT INTO amb_partners (
  ptn_id, ptn_code, ptn_company_name, ptn_company_name_local,
  ptn_country, ptn_contact_email, ptn_status
)
SELECT gen_random_uuid(), 'AMOEBA_APPS', 'Amoeba Global Apps', '아메바글로벌 앱스',
       'KR', 'apps@amoebaglobal.com', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM amb_partners WHERE ptn_code = 'AMOEBA_APPS');

-- ----------------------------------------------------------------------------
-- Step 2 — register car-manager-v2 (STAGING)
-- ----------------------------------------------------------------------------
INSERT INTO amb_partner_apps (
  pap_id, ptn_id, pap_code, pap_name, pap_description,
  pap_url, pap_auth_mode, pap_open_mode, pap_category,
  pap_status, pap_version,
  pap_registered_by, pap_reviewed_by, pap_reviewed_at, pap_published_at,
  pap_scopes
)
SELECT
  gen_random_uuid(),
  p.ptn_id,
  'car-manager-v2',
  'Company Car Management v2',
  'Hệ thống quản lý điều xe & kiểm soát chi phí nội bộ (CCMS v2). '
    || 'Next.js 15 + Drizzle/Neon Postgres. Trip state machine, 8 expense categories, maintenance alerts.',
  'https://stg-apps.amoeba.site/app-car-manager-v2',
  'jwt',
  'iframe',
  'ASSET_MANAGEMENT',
  'PUBLISHED',
  '2.0.0',
  -- ⚠️ replace below with real admin usr_id
  '<ADMIN_USER_UUID>',
  '<ADMIN_USER_UUID>',
  NOW(),
  NOW(),
  ARRAY['profile', 'entity:read']
FROM amb_partners p
WHERE p.ptn_code = 'AMOEBA_APPS'
  AND NOT EXISTS (SELECT 1 FROM amb_partner_apps WHERE pap_code = 'car-manager-v2');

-- ----------------------------------------------------------------------------
-- Step 3 — auto-install for testing entity (optional, only for dev/staging)
--          Adjust ent_id below. URL construction follows the doc REQ-260312:
--            {eca_url}?ama_token={jwt}&locale={lang}
-- ----------------------------------------------------------------------------
-- INSERT INTO amb_entity_custom_apps (
--   eca_id, ent_id, eca_code, eca_name, eca_description, eca_icon,
--   eca_url, eca_auth_mode, eca_open_mode, eca_allowed_roles,
--   eca_sort_order, eca_is_active, eca_registered_by, eca_source_pap_id
-- )
-- SELECT
--   gen_random_uuid(),
--   '<ENT_UUID>',
--   'car-manager-v2',
--   'Company Car Management v2',
--   'Quản lý điều xe & chi phí',
--   'CarFront',
--   'https://stg-apps.amoeba.site/app-car-manager-v2',
--   'jwt',
--   'iframe',
--   ARRAY['OWNER', 'MASTER', 'MANAGER', 'MEMBER'],
--   10,
--   TRUE,
--   '<ADMIN_USER_UUID>',
--   (SELECT pap_id FROM amb_partner_apps WHERE pap_code = 'car-manager-v2')
-- ON CONFLICT (ent_id, eca_code) DO UPDATE SET
--   eca_url = EXCLUDED.eca_url,
--   eca_is_active = TRUE,
--   eca_updated_at = NOW();

-- ----------------------------------------------------------------------------
-- Verification
-- ----------------------------------------------------------------------------
SELECT pap_code, pap_name, pap_url, pap_auth_mode, pap_open_mode, pap_status
FROM amb_partner_apps
WHERE pap_code = 'car-manager-v2';
