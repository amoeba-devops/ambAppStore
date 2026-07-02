-- ============================================================================
-- AMA Entity Custom App — Car Manager v2 — 7b REST (CARGO434 + UIT327)
-- zero-touch: eca_url = https://car-manager-production.onrender.com (nginx/basePath 미사용)
--
-- ⚠️ TARGET DB: prod AMA Postgres (amb-postgres-production, db_amb). psql -U amb_user -d db_amb
-- ⚠️ PRECONDITION: 7a VN01 카나리아 검증 OK 후에만 실행 (실제 iframe 로그인 확인).
--
-- prod 실재 엔티티 CARGO434 / UIT327 (외부 고객). VN01은 7a 카나리아에서 처리됨(여기 제외).
--   (DEMO는 prod AMA에 미존재 → 제외, 2026-06-04 확인)
-- 롤백: UPDATE amb_entity_custom_apps SET eca_is_active=false WHERE eca_code='app-car-manager-v2';
-- IDEMPOTENT on (ent_id, eca_code).
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
SELECT ent_id, eca_code, eca_url, eca_is_active
FROM amb_entity_custom_apps
WHERE eca_code = 'app-car-manager-v2' ORDER BY eca_updated_at;
