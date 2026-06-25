-- ============================================================================
-- ambAppStore Platform Catalog — Seed: app-sales-report-v2
--
-- Run against ambAppStore platform MySQL DB (db_app_platform), NOT v2 Neon.
-- This inserts the catalog row so the v2 app appears in the platform UI.
--
-- Idempotent on `app_slug` — safe to re-run.
--
-- Local dev:
--   mysql -h localhost -P 3306 -u root -proot \
--     < apps/app-sales-report-v2/scripts/seed-ambappstore-app.sql
--
-- Staging:
--   ssh ambAppStore@stg-apps.amoeba.site \
--     "docker exec -i mysql-apps mysql -uroot -p<pwd> db_app_platform \
--        < /path/to/seed-ambappstore-app.sql"
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
  'app-sales-report-v2',
  '매출리포트 v2',
  'Sales Report v2 (FIRGI)',
  'Next.js fullstack — Shopee + TikTok Vietnam automated reporting, GMV/Net GMV/CM, 48 configurable formula params, multi-tenant.',
  'FIRGI Sales Report v2 — Automate báo cáo Shopee Vietnam (6 sections) + TikTok Shop Vietnam (3 active sections) cho Socialbean Vietnam.\n\n• 3 personas: Operator (upload + view), Manager (approve + analyze), Admin (config + master data)\n• Tính GMV, Net GMV, NMV, Contribution Margin (per SKU + per platform)\n• 4 trending views: WoW/MoM × Shopee/TikTok\n• Cost master versioned (Prime Cost master, không retro thay đổi finalized report)\n• FX VND ↔ KRW (default 17.543 VND/KRW, configurable)\n• 48 formula parameters Admin configurable (FR-23)\n• Upload archive (NFR-06): re-upload archives previous file, never overwrite\n• Activity log triggers DENY UPDATE/DELETE (NFR-13) — insert-only audit\n• 3 ngôn ngữ KO / EN / VI (next-intl)\n• Render Background Worker — DB queue, exponential backoff retry\n• 2 Render Cron Jobs — daily user sync (4am VN) + retry-failed (every 15min)\n\nStack: Next.js 15 App Router · React 19 · Drizzle ORM + Neon Postgres · AWS S3 (raw upload archive) · JWT passthrough từ AMA · Tailwind 3 + shadcn/ui + Recharts · next-intl.',
  'ACTIVE',
  3001,
  3001,
  6,
  'REPORTING',
  JSON_ARRAY(
    JSON_OBJECT('icon', 'upload', 'label', 'Shopee + TikTok consolidated CSV upload — section splitter + 9 sub-parsers'),
    JSON_OBJECT('icon', 'calculator', 'label', 'GMV / Net GMV / NMV / Contribution Margin per SKU + per platform'),
    JSON_OBJECT('icon', 'trending-up', 'label', '4 trending views — WoW + MoM × Shopee + TikTok'),
    JSON_OBJECT('icon', 'settings', 'label', '48 formula parameters Admin configurable (FR-23) — no hard-coding'),
    JSON_OBJECT('icon', 'archive', 'label', 'Raw upload archive (NFR-06) — re-upload never overwrites prior'),
    JSON_OBJECT('icon', 'shield-check', 'label', 'Activity log insert-only (NFR-13) — DB triggers DENY UPDATE/DELETE'),
    JSON_OBJECT('icon', 'arrow-left-right', 'label', 'FX VND ↔ KRW — default 17.543 VND/KRW, configurable per period'),
    JSON_OBJECT('icon', 'languages', 'label', 'Trilingual UI — KO / EN / VI (next-intl)'),
    JSON_OBJECT('icon', 'cpu', 'label', 'Background worker — DB queue with FOR UPDATE SKIP LOCKED, exponential backoff retry')
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
WHERE app_slug = 'app-sales-report-v2';
