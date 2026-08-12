-- ============================================================
-- ambAppStore — Platform DB Initialization
-- Database: db_app_platform
-- ============================================================

CREATE DATABASE IF NOT EXISTS db_app_platform
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

SET NAMES utf8mb4;
USE db_app_platform;

-- ------------------------------------------------------------
-- plt_apps (앱 마스터)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plt_apps (
  app_id          CHAR(36)      NOT NULL PRIMARY KEY,
  app_slug        VARCHAR(50)   NOT NULL,
  app_name        VARCHAR(100)  NULL,
  app_name_en     VARCHAR(100)  NOT NULL,
  app_short_desc  VARCHAR(200)  NULL,
  app_description TEXT          NULL,
  app_icon_url    VARCHAR(500)  NULL,
  app_screenshots JSON          NULL,
  app_features    JSON          NULL,
  app_category    VARCHAR(50)   NULL,
  app_status      ENUM('ACTIVE','INACTIVE','COMING_SOON') NOT NULL DEFAULT 'COMING_SOON',
  app_port_fe     SMALLINT      NULL,
  app_port_be     SMALLINT      NULL,
  app_sort_order  SMALLINT      NOT NULL DEFAULT 0,
  app_created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  app_updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  app_deleted_at  DATETIME      NULL,

  UNIQUE KEY uq_plt_apps_slug (app_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- plt_subscriptions (Entity별 앱 구독)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plt_subscriptions (
  sub_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  ent_code            VARCHAR(20)   NOT NULL,
  ent_name            VARCHAR(100)  NOT NULL,
  app_id              CHAR(36)      NOT NULL,
  sub_status          ENUM('PENDING','ACTIVE','SUSPENDED','REJECTED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  sub_requested_by    CHAR(36)      NOT NULL,
  sub_requested_name  VARCHAR(100)  NOT NULL,
  sub_requested_email VARCHAR(200)  NOT NULL,
  sub_reason          VARCHAR(500)  NULL,
  sub_reject_reason   VARCHAR(500)  NULL,
  sub_approved_by     CHAR(36)      NULL,
  sub_approved_at     DATETIME      NULL,
  sub_expires_at      DATETIME      NULL,
  sub_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sub_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  sub_deleted_at      DATETIME      NULL,

  CONSTRAINT fk_plt_subscriptions_app FOREIGN KEY (app_id) REFERENCES plt_apps(app_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes
CREATE INDEX idx_plt_subscriptions_ent      ON plt_subscriptions(ent_id, sub_status);
CREATE INDEX idx_plt_subscriptions_app      ON plt_subscriptions(app_id, sub_status);
CREATE INDEX idx_plt_subscriptions_status   ON plt_subscriptions(sub_status, sub_created_at);
CREATE INDEX idx_plt_subscriptions_ent_code ON plt_subscriptions(ent_code);

-- ------------------------------------------------------------
-- plt_notifications (알림)
-- Entity: src/platform-notification/notification.entity.ts
--
-- NOTE: indexes are declared INLINE here (unlike the two tables above) so this
-- section stays idempotent — MySQL 8 has no `CREATE INDEX IF NOT EXISTS`, so a
-- re-run of this file would abort on the standalone CREATE INDEX form.
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
-- plt_external_integrations (외부 연동 설정)
-- Entity: src/admin/entity/admin-integration.entity.ts
-- Index names must match the entity's @Index decorators.
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
