-- ============================================================================
-- AMA Entity Custom App — Car Manager v2 — 7a CANARY (VN01 / AMOEBA 자사)
-- zero-touch: eca_url = https://car-manager-production.onrender.com (nginx/basePath 미사용)
--
-- ⚠️ TARGET DB: prod AMA Postgres (amb-postgres-production, db_amb) — NOT Neon/MySQL.
--   psql -U amb_user -d db_amb
--
-- 배경(2026-06-04): DEMO(00000000-…-010)는 prod AMA(amb_hr_entities)에 미존재 → 카나리아를
--   자사 엔티티 VN01(acce6566-…)로 대체. VN01은 기존 행이 stg-apps를 가리키므로 onrender로 UPSERT.
--   prod 실재 엔티티: CARGO434 / UIT327 / VN01 (DEMO 없음).
--
-- 검증: VN01 사용자로 ama.amoeba.site 로그인 → custom-apps에서 v2 클릭 →
--       iframe에서 car-manager-production.onrender.com 대시보드 로드 + (3rd-party 쿠키) 로그인 확인.
-- 롤백: UPDATE amb_entity_custom_apps SET eca_is_active=false
--         WHERE eca_code='app-car-manager-v2' AND ent_id='acce6566-8a00-4071-b52b-082b69832510';
--       (또는 eca_url을 stg-apps로 복원)
-- IDEMPOTENT on (ent_id, eca_code).
-- ============================================================================

INSERT INTO amb_entity_custom_apps (
  eca_id, ent_id, eca_code, eca_name, eca_description, eca_icon, eca_url,
  eca_auth_mode, eca_open_mode, eca_allowed_roles, eca_sort_order,
  eca_is_active, eca_registered_by, eca_created_at, eca_updated_at
)
VALUES
  -- VN01 — AMOEBA CO., LTD (canary, 자사)
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

-- Verification
SELECT ent_id, eca_code, eca_url, eca_auth_mode, eca_open_mode, eca_is_active, eca_updated_at
FROM amb_entity_custom_apps
WHERE eca_code = 'app-car-manager-v2' AND ent_id = 'acce6566-8a00-4071-b52b-082b69832510';
