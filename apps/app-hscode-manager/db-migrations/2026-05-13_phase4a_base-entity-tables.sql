-- Phase 4a — Base entity tables for classification / verification / expert-review
-- ------------------------------------------------------------------------------
-- These three tables are declared by TypeORM entities (ClassificationEntity,
-- VerificationEventEntity, ExpertReviewEntity) but had no CREATE in the migration
-- set — they were only ever materialized by `synchronize` in local dev, while the
-- Phase 4/5 ALTERs assumed they already existed. Production runs synchronize OFF,
-- so a fresh DB failed at "ALTER TABLE hsc_classifications" with table-not-found.
--
-- Columns added by the later idempotent ALTERs (cls_fta_agreement_code,
-- cls_created_by, vrf_inquiry_id, vrf_amount_usd) are INCLUDED here, so those
-- mysql_alter_safe steps detect the column and become no-ops. Idempotent via
-- CREATE TABLE IF NOT EXISTS.

USE db_app_hscode;

CREATE TABLE IF NOT EXISTS hsc_classifications (
  cls_id                     CHAR(36)      NOT NULL,
  cls_ent_id                 CHAR(36)      NOT NULL,
  cls_inquiry_id             CHAR(36)      NOT NULL,
  cls_item_id                CHAR(36)      NOT NULL,
  cls_hs_code                VARCHAR(16)   NOT NULL,
  cls_basic_tariff_rate      DECIMAL(6,3)  NULL,
  cls_fta_tariff_rate        DECIMAL(6,3)  NULL,
  cls_fta_agreement_code     VARCHAR(16)   NULL,
  cls_import_requirements    JSON          NULL,
  cls_confidence_score       DECIMAL(4,3)  NULL,
  cls_status                 VARCHAR(32)   NOT NULL DEFAULT 'PROPOSED',
  cls_recommendation_source  VARCHAR(16)   NULL,
  cls_ai_reasoning           TEXT          NULL,
  cls_ai_model_version       VARCHAR(64)   NULL,
  cls_external_sources       JSON          NULL,
  cls_selection_rationale    TEXT          NULL,
  cls_adopted_at             DATETIME      NULL,
  cls_superseded_at          DATETIME      NULL,
  cls_superseded_by_id       CHAR(36)      NULL,
  cls_created_by             CHAR(36)      NULL,
  cls_created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cls_updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cls_deleted_at             DATETIME      NULL,
  PRIMARY KEY (cls_id),
  KEY idx_classifications_ent_hs (cls_ent_id, cls_hs_code),
  KEY idx_classifications_inquiry (cls_inquiry_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hsc_verification_events (
  vrf_id               CHAR(36)      NOT NULL,
  vrf_ent_id           CHAR(36)      NOT NULL,
  vrf_classification_id CHAR(36)     NOT NULL,
  vrf_inquiry_id       CHAR(36)      NULL,
  vrf_event_type       VARCHAR(32)   NOT NULL,
  vrf_event_date       DATE          NOT NULL,
  vrf_result           VARCHAR(16)   NULL,
  vrf_confidence_delta DECIMAL(4,3)  NULL,
  vrf_follow_up_actions JSON         NULL,
  vrf_notes            TEXT          NULL,
  vrf_amount_usd       DECIMAL(15,2) NULL,
  vrf_created_by       CHAR(36)      NULL,
  vrf_created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vrf_updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  vrf_deleted_at       DATETIME      NULL,
  PRIMARY KEY (vrf_id),
  KEY idx_verification_classification (vrf_classification_id),
  KEY idx_verification_type_date (vrf_event_type, vrf_event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hsc_expert_reviews (
  rev_id               CHAR(36)     NOT NULL,
  rev_ent_id           CHAR(36)     NOT NULL,
  rev_classification_id CHAR(36)    NOT NULL,
  rev_expert_role      VARCHAR(32)  NOT NULL,
  rev_assigned_user_id CHAR(36)     NULL,
  rev_trigger_reason   VARCHAR(64)  NOT NULL,
  rev_requested_at     DATETIME     NULL,
  rev_responded_at     DATETIME     NULL,
  rev_verdict          VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
  rev_notes            TEXT         NULL,
  rev_created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rev_updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  rev_deleted_at       DATETIME     NULL,
  PRIMARY KEY (rev_id),
  KEY idx_expert_reviews_classification (rev_classification_id),
  KEY idx_expert_reviews_assignee (rev_assigned_user_id, rev_verdict)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
