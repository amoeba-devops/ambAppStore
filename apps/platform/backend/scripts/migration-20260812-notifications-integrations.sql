-- ============================================================
-- ambAppStore — Platform DB Migration 2026-08-12
-- Database: db_app_platform
--
-- WHY: `synchronize` is disabled in production (app.module.ts:27 —
-- `synchronize: NODE_ENV !== 'production'`), and `scripts/init-db.sql` was
-- never extended when these entities landed. Result: the code queries tables
-- that do not exist and every affected endpoint returns 500 / PLT-E9999.
--
-- Confirmed missing on the live DB (2026-08-12):
--   plt_notifications           → GET /api/v1/platform/notifications{,/unread-count} 500
--   plt_external_integrations   → GET /api/v1/admin/integrations 500
--   plt_subscriptions.sub_status lacks 'EXPIRED' → NotificationSchedulerService
--     fails daily at 00:00 with "Data truncated for column 'sub_status'"
--     (28 occurrences in bff-platform logs)
--
-- Indexes are declared INLINE (not as separate CREATE INDEX statements like
-- init-db.sql) because MySQL 8 has no `CREATE INDEX IF NOT EXISTS` — inline
-- keys keep this script idempotent via `CREATE TABLE IF NOT EXISTS`.
--
-- Idempotent: safe to re-run. Verify block at the bottom.
-- ============================================================

SET NAMES utf8mb4;
USE db_app_platform;

-- ------------------------------------------------------------
-- 1) plt_notifications (알림)
--    Entity: src/platform-notification/notification.entity.ts
--    Query shape driving the index: count({ ntf_user_id, ent_id, ntf_is_read })
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plt_notifications (
  ntf_id          CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id          CHAR(36)      NOT NULL,
  ntf_user_id     CHAR(36)      NOT NULL,
  ntf_type        ENUM('SUB_APPROVED','SUB_REJECTED','SUB_SUSPENDED','SUB_EXPIRED','SUB_EXPIRING_SOON','SYSTEM') NOT NULL,
  ntf_title       VARCHAR(200)  NOT NULL,
  ntf_message     VARCHAR(500)  NOT NULL,
  ntf_ref_type    VARCHAR(50)   NULL,
  ntf_ref_id      CHAR(36)      NULL,
  ntf_is_read     TINYINT(1)    NOT NULL DEFAULT 0,
  ntf_read_at     DATETIME      NULL,
  ntf_created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ntf_deleted_at  DATETIME      NULL,

  KEY idx_plt_notifications_user_unread (ntf_user_id, ent_id, ntf_is_read),
  KEY idx_plt_notifications_ent_created (ent_id, ntf_created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2) plt_external_integrations (외부 연동 설정)
--    Entity: src/admin/entity/admin-integration.entity.ts
--    Index names match the entity's @Index decorators exactly.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plt_external_integrations (
  pei_id               CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id               CHAR(36)      NOT NULL,
  pei_category         VARCHAR(30)   NOT NULL,
  pei_service_code     VARCHAR(50)   NOT NULL,
  pei_service_name     VARCHAR(100)  NOT NULL,
  pei_endpoint         VARCHAR(500)  NULL,
  pei_key_name         VARCHAR(100)  NULL,
  pei_key_value        TEXT          NULL,
  pei_extra_config     JSON          NULL,
  pei_is_active        TINYINT(1)    NOT NULL DEFAULT 1,
  pei_last_verified_at DATETIME      NULL,
  pei_created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pei_updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  pei_deleted_at       DATETIME      NULL,

  KEY idx_pei_ent_id (ent_id),
  KEY idx_pei_category (ent_id, pei_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3) plt_subscriptions.sub_status — add 'EXPIRED'
--    Code: SubscriptionStatus.EXPIRED (subscription.entity.ts:13-20), written by
--    notification-scheduler.service.ts:40. Appending a value to the end of an
--    ENUM does not renumber the existing values, so stored rows are untouched.
-- ------------------------------------------------------------
ALTER TABLE plt_subscriptions
  MODIFY COLUMN sub_status
    ENUM('PENDING','ACTIVE','SUSPENDED','REJECTED','CANCELLED','EXPIRED')
    NOT NULL DEFAULT 'PENDING';

-- ------------------------------------------------------------
-- VERIFY (expect: 2 rows for the tables, and 'EXPIRED' present in the enum)
-- ------------------------------------------------------------
SELECT table_name, table_rows
  FROM information_schema.tables
 WHERE table_schema = 'db_app_platform'
   AND table_name IN ('plt_notifications','plt_external_integrations');

SELECT column_type AS sub_status_enum
  FROM information_schema.columns
 WHERE table_schema = 'db_app_platform'
   AND table_name   = 'plt_subscriptions'
   AND column_name  = 'sub_status';
