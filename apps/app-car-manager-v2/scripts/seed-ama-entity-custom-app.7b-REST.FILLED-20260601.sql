-- ============================================================================
-- ambManagement (AMA) Entity Custom App Registration — Car Manager v2
-- STEP 7b — REMAINING 3 entities: CARGO434 / UIT327 / VN01
--   (RUNBOOK-20260603 §5, gate G7)
--
-- Split from seed-ama-entity-custom-app.FILLED-20260601.sql.
-- Apply ONLY AFTER 7a (DEMO canary) login→iframe→CSP→session-expired is GREEN.
--
-- ⚠️ TARGET DB: ambManagement (AMA) Postgres (amb-postgres-production) — NOT
--   platform MySQL, NOT Neon. User amb_user / DB db_amb.
--   psql -U amb_user -d db_amb
--
-- ⚠️ eca_url = ZERO-TOUCH: Render prod 직접 https://car-manager-production.onrender.com (nginx/basePath 미사용)
--
-- ⚠️ PRECONDITION: same as 7a (Render prod live at ROOT + JWT_SECRET parity — zero-touch).
--   Rollback (hide all, including DEMO):
--   UPDATE amb_entity_custom_apps SET eca_is_active=false WHERE eca_code='app-car-manager-v2';
--
-- IDEMPOTENT on (ent_id, eca_code) — safe to re-run.
-- eca_registered_by left NULL (column is nullable) — no admin usr_id required.
-- ============================================================================

INSERT INTO amb_entity_custom_apps (
  eca_id, ent_id, eca_code, eca_name, eca_description, eca_icon, eca_url,
  eca_auth_mode, eca_open_mode, eca_allowed_roles, eca_sort_order,
  eca_is_active, eca_registered_by, eca_created_at, eca_updated_at
)
VALUES
  -- CARGO434 — Cargorush international
  (gen_random_uuid(), 'f55fb580-7ecf-44a0-b608-a7014064bf88', 'app-car-manager-v2',
   'Quản lý điều xe v2',
   'Hệ thống quản lý điều xe & kiểm soát chi phí nội bộ — Trip state machine, 8 expense categories, maintenance alerts. Multi-tenant, JWT passthrough.',
   'Car', 'https://car-manager-production.onrender.com',
   'jwt', 'iframe', 'MASTER,MANAGER,MEMBER,VIEWER', 10, TRUE, NULL, NOW(), NOW()),

  -- UIT327 — UIT
  (gen_random_uuid(), '2faa9340-165c-4e75-9454-998c24b930e5', 'app-car-manager-v2',
   'Quản lý điều xe v2',
   'Hệ thống quản lý điều xe & kiểm soát chi phí nội bộ — Trip state machine, 8 expense categories, maintenance alerts. Multi-tenant, JWT passthrough.',
   'Car', 'https://car-manager-production.onrender.com',
   'jwt', 'iframe', 'MASTER,MANAGER,MEMBER,VIEWER', 10, TRUE, NULL, NOW(), NOW()),

  -- VN01 — AMOEBA CO., LTD
  (gen_random_uuid(), 'acce6566-8a00-4071-b52b-082b69832510', 'app-car-manager-v2',
   'Quản lý điều xe v2',
   'Hệ thống quản lý điều xe & kiểm soát chi phí nội bộ — Trip state machine, 8 expense categories, maintenance alerts. Multi-tenant, JWT passthrough.',
   'Car', 'https://car-manager-production.onrender.com',
   'jwt', 'iframe', 'MASTER,MANAGER,MEMBER,VIEWER', 10, TRUE, NULL, NOW(), NOW())
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

-- Verification (expect 4 rows total: DEMO from 7a + CARGO434 + UIT327 + VN01)
SELECT ent_id, eca_code, eca_name, eca_url, eca_auth_mode, eca_open_mode,
       eca_allowed_roles, eca_is_active
FROM amb_entity_custom_apps
WHERE eca_code = 'app-car-manager-v2'
ORDER BY eca_created_at;
