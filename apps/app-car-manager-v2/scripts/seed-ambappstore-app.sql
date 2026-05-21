-- ============================================================================
-- ambAppStore Platform Catalog — Seed: app-car-manager-v2
--
-- Run against ambAppStore platform MySQL DB (db_app_platform), NOT v2 Neon.
-- This inserts the catalog row so the v2 app appears in the platform UI.
--
-- Idempotent on `app_slug` — safe to re-run.
--
-- Local dev:
--   mysql -h localhost -P 3306 -u root -proot \
--     < apps/app-car-manager-v2/scripts/seed-ambappstore-app.sql
--
-- Staging:
--   ssh ambAppStore@stg-apps.amoeba.site \
--     "mysql -u root -p<pwd> db_app_platform < /path/to/seed-ambappstore-app.sql"
-- ============================================================================

SET NAMES utf8mb4;
USE db_app_platform;

INSERT INTO plt_apps (
  app_id,
  app_slug,
  app_name,
  app_name_en,
  app_short_desc,
  app_description,
  app_status,
  app_port_fe,
  app_port_be,
  app_sort_order,
  app_category,
  app_features,
  app_screenshots
)
VALUES (
  UUID(),
  'app-car-manager-v2',
  '법인차량관리 v2',
  'Company Car Management v2',
  'Next.js fullstack — Trip dispatch state machine, 8 expense categories, maintenance alerts, multi-tenant.',
  'Company Car Management System v2 (CCMS) — Hệ thống quản lý điều xe & kiểm soát chi phí nội bộ.\n\n• 3 personas: Admin (web), Manager/Director (PWA + web), Driver (PWA only)\n• Trip state machine 6 trạng thái: PENDING_ASSIGNMENT → PENDING_DRIVER_CONFIRMATION → CONFIRMED → IN_PROGRESS → COMPLETED (+ REJECTED_BY_DRIVER, CANCELLED)\n• 8 loại chi phí: Fuel, Oil, Accident, Meal, Repair, Parking, Toll, Inspection\n• Approval rules cấu hình theo loại + ngưỡng auto-approve\n• Audit log (insert-only), retention 5 năm\n• 3 ngôn ngữ EN / KO / VI\n• Maintenance alerts theo định kỳ (Render Cron)\n\nStack: Next.js 15 App Router · React 19 · Drizzle ORM + Neon Postgres · AWS S3 (chứng từ) · JWT passthrough từ AMA · Tailwind 3 + shadcn/ui · next-intl.',
  'ACTIVE',
  3001,
  3001,
  5,
  'ASSET_MANAGEMENT',
  JSON_ARRAY(
    JSON_OBJECT('icon', 'car', 'label', 'Vehicle registration with status (Available / In Use / Maintenance / Retired)'),
    JSON_OBJECT('icon', 'workflow', 'label', 'Trip state machine — Admin assign → Driver confirm → Start / End'),
    JSON_OBJECT('icon', 'receipt', 'label', '8 expense categories with approval rules and auto-approve thresholds'),
    JSON_OBJECT('icon', 'upload', 'label', 'Receipt upload to S3 via presigned URL (image + PDF)'),
    JSON_OBJECT('icon', 'bell', 'label', 'Maintenance & inspection alerts via Web Push + Email'),
    JSON_OBJECT('icon', 'history', 'label', 'Audit log (insert-only), 5-year retention'),
    JSON_OBJECT('icon', 'smartphone', 'label', 'PWA installable for Driver mobile experience'),
    JSON_OBJECT('icon', 'languages', 'label', 'Trilingual UI — EN / KO / VI (next-intl)'),
    JSON_OBJECT('icon', 'shield-check', 'label', 'Multi-tenant — strict ent_id isolation, JWT passthrough from AMA')
  ),
  JSON_ARRAY()
)
ON DUPLICATE KEY UPDATE
  app_name       = VALUES(app_name),
  app_name_en    = VALUES(app_name_en),
  app_short_desc = VALUES(app_short_desc),
  app_description= VALUES(app_description),
  app_status     = VALUES(app_status),
  app_port_fe    = VALUES(app_port_fe),
  app_port_be    = VALUES(app_port_be),
  app_sort_order = VALUES(app_sort_order),
  app_category   = VALUES(app_category),
  app_features   = VALUES(app_features);

-- Verify
SELECT app_slug, app_name_en, app_status, app_port_fe, app_sort_order
FROM plt_apps
WHERE app_slug = 'app-car-manager-v2';
