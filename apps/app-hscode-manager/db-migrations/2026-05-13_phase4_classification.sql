-- HS Code Manager — Phase 4 Classification + Audit
-- 2026-05-13

USE db_app_hscode;

-- 4.1 ALTER hsc_classifications — fta_agreement_code + created_by 추가
ALTER TABLE hsc_classifications
  ADD COLUMN cls_fta_agreement_code VARCHAR(16) NULL AFTER cls_fta_tariff_rate,
  ADD COLUMN cls_created_by CHAR(36) NULL AFTER cls_superseded_by_id;

-- 4.2 hsc_classification_candidates (후보 N개)
CREATE TABLE IF NOT EXISTS hsc_classification_candidates (
  cnd_id                  CHAR(36)     NOT NULL,
  cnd_ent_id              CHAR(36)     NOT NULL,
  cnd_classification_id   CHAR(36)     NOT NULL,
  cnd_hs_code             VARCHAR(16)  NOT NULL,
  cnd_description         TEXT         NULL,
  cnd_basic_tariff_rate   DECIMAL(6,3) NULL,
  cnd_fta_tariff_rate     DECIMAL(6,3) NULL,
  cnd_fta_agreement_code  VARCHAR(16)  NULL,
  cnd_source              VARCHAR(16)  NOT NULL,
  cnd_ranking             INT          NOT NULL,
  cnd_confidence          DECIMAL(4,3) NULL,
  cnd_reasoning           TEXT         NULL,
  cnd_source_citations    JSON         NULL,
  cnd_external_adapter_keys JSON       NULL,
  cnd_flags               JSON         NULL,
  cnd_past_adoption_count INT          NOT NULL DEFAULT 0,
  cnd_created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cnd_id),
  KEY idx_cnd_classification (cnd_classification_id),
  KEY idx_cnd_classification_rank (cnd_classification_id, cnd_ranking)
) ENGINE=InnoDB;

-- 4.3 hsc_audit_logs
CREATE TABLE IF NOT EXISTS hsc_audit_logs (
  aud_id          CHAR(36)     NOT NULL,
  aud_ent_id      CHAR(36)     NOT NULL,
  aud_user_id     CHAR(36)     NULL,
  aud_user_email  VARCHAR(255) NULL,
  aud_action      VARCHAR(32)  NOT NULL,
  aud_target_table VARCHAR(64) NOT NULL,
  aud_target_id   VARCHAR(64)  NULL,
  aud_diff_json   JSON         NULL,
  aud_ip          VARCHAR(45)  NULL,
  aud_user_agent  VARCHAR(500) NULL,
  aud_request_id  VARCHAR(64)  NULL,
  aud_created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (aud_id),
  KEY idx_audit_ent_created (aud_ent_id, aud_created_at),
  KEY idx_audit_target (aud_target_table, aud_target_id)
) ENGINE=InnoDB;
