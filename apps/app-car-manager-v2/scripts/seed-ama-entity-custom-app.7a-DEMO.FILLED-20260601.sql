-- ============================================================================
-- ambManagement (AMA) Entity Custom App Registration — Car Manager v2
-- STEP 7a — CANARY: DEMO entity ONLY (RUNBOOK-20260603 §5, gate G7)
--
-- Split from seed-ama-entity-custom-app.FILLED-20260601.sql.
-- Apply this FIRST. Only after DEMO login→iframe→CSP→session-expired round-trip
-- is verified GREEN, apply 7b (the remaining 3 entities).
--
-- ⚠️ TARGET DB: ambManagement (AMA) Postgres (amb-postgres-production) — NOT
--   platform MySQL, NOT Neon. User amb_user / DB db_amb.
--   psql -U amb_user -d db_amb
--
-- ⚠️ eca_url targets PRODUCTION: https://apps.amoeba.site/app-car-manager-v2
--
-- ⚠️ PRECONDITION (login will 401 / iframe blank otherwise) — apply ONLY after:
--   1. v2 Render PROD service is live and healthy
--   2. apps.amoeba.site nginx proxies /app-car-manager-v2/ → Render prod
--   3. prod AMA JWT_SECRET == Render prod JWT_SECRET (byte-for-byte, gate G1)
--   Click before these are done → /session-expired (401). Use rollback:
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
  -- DEMO — Demo Company (CANARY)
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'app-car-manager-v2',
   'Quản lý điều xe v2',
   'Hệ thống quản lý điều xe & kiểm soát chi phí nội bộ — Trip state machine, 8 expense categories, maintenance alerts. Multi-tenant, JWT passthrough.',
   'Car', 'https://apps.amoeba.site/app-car-manager-v2',
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

-- Verification (expect exactly 1 row: DEMO)
SELECT ent_id, eca_code, eca_name, eca_url, eca_auth_mode, eca_open_mode,
       eca_allowed_roles, eca_is_active
FROM amb_entity_custom_apps
WHERE eca_code = 'app-car-manager-v2'
ORDER BY eca_created_at;
