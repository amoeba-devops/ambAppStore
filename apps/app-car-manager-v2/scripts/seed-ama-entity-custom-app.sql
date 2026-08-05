-- ============================================================================
-- ambManagement (AMA) Entity Custom App Registration — Car Manager v2
--
-- This is the PRIMARY path for wiring v2 into AMA. Run against ambManagement
-- Postgres DB (NOT car-manager-v2 Neon DB).
--
-- WHY THIS PATH (vs amb_partner_apps):
--   AMA's `amb_partner_apps` lifecycle (DRAFT→SUBMITTED→...→PUBLISHED) is
--   only partly implemented — there's no backend endpoint that mints a JWT
--   for `pap_auth_mode='SSO_JWT'`. The proven working path used by every
--   embedded app today (apps-stock, redmine, etc.) is `amb_entity_custom_apps`
--   with `eca_auth_mode='jwt'` + `eca_open_mode='iframe'`. AMA's launch
--   endpoint mints the HS256 JWT via entity-custom-app.service.ts
--   `generateAppToken()`, which is what v2 middleware expects.
--
--   See INTEGRATION.md §5.4 and the staging audit in commit logs for the
--   full reasoning.
--
-- WHAT THIS DOES:
--   INSERTs one row per entity that should see "Quản lý điều xe v2" in
--   their AMA sidebar / app launcher. AMA will mint a JWT with shared
--   JWT_SECRET on click and redirect to:
--     {eca_url}?ama_token={jwt}&locale={lang}
--
-- IDEMPOTENT on (ent_id, eca_code) — safe to re-run.
--
-- ⚠️ Before running, replace TWO placeholders below:
--   1. `<ENT_UUID>`         — entity that should get access (one row per entity)
--   2. `<ADMIN_USER_UUID>`  — `usr_id` from amb_users that registers the link
--
-- Usage (staging):
--   psql -h 192.168.1.150 -U amb_user -d db_amb \
--     -f apps/app-car-manager-v2/scripts/seed-ama-entity-custom-app.sql
--
-- For multiple entities: copy the INSERT block once per entity, or wrap in
-- a script that loops over an ent_id list.
-- ============================================================================

INSERT INTO amb_entity_custom_apps (
  eca_id,
  ent_id,
  eca_code,
  eca_name,
  eca_description,
  eca_icon,
  eca_url,
  eca_auth_mode,
  eca_open_mode,
  eca_allowed_roles,
  eca_sort_order,
  eca_is_active,
  eca_registered_by,
  eca_created_at,
  eca_updated_at
) VALUES (
  gen_random_uuid(),
  '<ENT_UUID>',                                              -- 👈 entity that gets the app
  'app-car-manager-v2',
  'Quản lý điều xe v2',
  'Hệ thống quản lý điều xe & kiểm soát chi phí nội bộ — Trip state machine, 8 expense categories, maintenance alerts. Multi-tenant, JWT passthrough.',
  'Car',                                                     -- lucide icon name (matches platform AppCard mapping)
  'https://stg-apps.amoeba.site/app-car-manager-v2',         -- nginx proxies → Render
  'jwt',
  'iframe',
  'SUPER_ADMIN,ADMIN,MASTER,MANAGER',                        -- comma-separated, no spaces (admin+manager tier only; MEMBER/VIEWER excluded)
  10,
  TRUE,
  '<ADMIN_USER_UUID>',                                       -- 👈 admin user registering the link
  NOW(),
  NOW()
)
ON CONFLICT (ent_id, eca_code) DO UPDATE SET
  eca_name          = EXCLUDED.eca_name,
  eca_description   = EXCLUDED.eca_description,
  eca_icon          = EXCLUDED.eca_icon,
  eca_url           = EXCLUDED.eca_url,
  eca_auth_mode     = EXCLUDED.eca_auth_mode,
  eca_open_mode     = EXCLUDED.eca_open_mode,
  eca_allowed_roles = EXCLUDED.eca_allowed_roles,
  eca_is_active     = TRUE,
  eca_updated_at    = NOW();

-- Verification
SELECT
  ent_id,
  eca_code,
  eca_name,
  eca_url,
  eca_auth_mode,
  eca_open_mode,
  eca_allowed_roles,
  eca_is_active
FROM amb_entity_custom_apps
WHERE eca_code = 'app-car-manager-v2'
ORDER BY eca_created_at;
