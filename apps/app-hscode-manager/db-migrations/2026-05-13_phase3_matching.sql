-- HS Code Manager — Phase 3 Matching/AI Tables
-- 2026-05-13

USE db_app_hscode;

-- 3.1 hsc_authority_hs_codes
CREATE TABLE IF NOT EXISTS hsc_authority_hs_codes (
  auh_id                  CHAR(36)     NOT NULL,
  auh_import_country_code VARCHAR(2)   NOT NULL,
  auh_adapter_key         VARCHAR(64)  NOT NULL,
  auh_hs_code             VARCHAR(16)  NOT NULL,
  auh_description_local   TEXT         NULL,
  auh_description_en      TEXT         NULL,
  auh_keywords            JSON         NULL,
  auh_category_hints      JSON         NULL,
  auh_tariff_rate         DECIMAL(6,3) NULL,
  auh_import_requirements JSON         NULL,
  auh_effective_from      DATE         NULL,
  auh_effective_to        DATE         NULL,
  auh_created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  auh_updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  auh_deleted_at          DATETIME     NULL,
  PRIMARY KEY (auh_id),
  KEY idx_auh_country_adapter (auh_import_country_code, auh_adapter_key),
  KEY idx_auh_hs_code (auh_hs_code)
) ENGINE=InnoDB;

-- 3.2 hsc_ai_recommendation_logs
CREATE TABLE IF NOT EXISTS hsc_ai_recommendation_logs (
  arl_id                  CHAR(36)     NOT NULL,
  arl_ent_id              CHAR(36)     NOT NULL,
  arl_inquiry_id          CHAR(36)     NULL,
  arl_item_id             CHAR(36)     NULL,
  arl_classification_id   CHAR(36)     NULL,
  arl_prompt_hash         CHAR(32)     NOT NULL,
  arl_model_version       VARCHAR(64)  NOT NULL,
  arl_status              VARCHAR(16)  NOT NULL,
  arl_latency_ms          INT          NULL,
  arl_cost_usd            DECIMAL(8,5) NULL,
  arl_hallucinated_count  INT          NULL,
  arl_candidate_count     INT          NULL,
  arl_payload_blob_uri    VARCHAR(500) NULL,
  arl_created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (arl_id),
  KEY idx_arl_ent_inquiry (arl_ent_id, arl_inquiry_id),
  KEY idx_arl_created (arl_created_at)
) ENGINE=InnoDB;
