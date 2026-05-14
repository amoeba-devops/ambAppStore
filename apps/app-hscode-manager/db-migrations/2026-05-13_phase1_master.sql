-- HS Code Manager — Phase 1 Master Tables
-- 2026-05-13
-- 적용: 스테이징/프로덕션은 synchronize=false 이므로 본 스크립트를 수동 실행한다.

USE db_app_hscode;

-- 1.1 hsc_import_countries
CREATE TABLE IF NOT EXISTS hsc_import_countries (
  imc_id              CHAR(36)     NOT NULL,
  imc_code            VARCHAR(2)   NOT NULL,
  imc_name_ko         VARCHAR(100) NOT NULL,
  imc_name_en         VARCHAR(100) NOT NULL,
  imc_name_vi         VARCHAR(100) NOT NULL,
  imc_support_status  ENUM('ACTIVE','BETA','NOT_SUPPORTED')
                        NOT NULL DEFAULT 'NOT_SUPPORTED',
  imc_adapter_key     VARCHAR(64)  NULL,
  imc_currency_code   VARCHAR(3)   NULL,
  imc_default_tariff_currency VARCHAR(3) NULL,
  imc_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  imc_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  imc_deleted_at      DATETIME     NULL,
  PRIMARY KEY (imc_id),
  UNIQUE KEY uq_imc_code (imc_code)
) ENGINE=InnoDB;

-- 1.2 hsc_export_countries
CREATE TABLE IF NOT EXISTS hsc_export_countries (
  exc_id              CHAR(36)     NOT NULL,
  exc_code            VARCHAR(2)   NOT NULL,
  exc_name_ko         VARCHAR(100) NOT NULL,
  exc_name_en         VARCHAR(100) NOT NULL,
  exc_name_vi         VARCHAR(100) NOT NULL,
  exc_is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  exc_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exc_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  exc_deleted_at      DATETIME     NULL,
  PRIMARY KEY (exc_id),
  UNIQUE KEY uq_exc_code (exc_code)
) ENGINE=InnoDB;

-- 1.3 hsc_exporters
CREATE TABLE IF NOT EXISTS hsc_exporters (
  exp_id              CHAR(36)     NOT NULL,
  exp_ent_id          CHAR(36)     NOT NULL,
  exp_name            VARCHAR(255) NOT NULL,
  exp_country_code    VARCHAR(2)   NOT NULL,
  exp_aliases         JSON         NULL,
  exp_risk_flags      JSON         NULL,
  exp_memo            TEXT         NULL,
  exp_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exp_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  exp_deleted_at      DATETIME     NULL,
  PRIMARY KEY (exp_id),
  KEY idx_exporters_ent_name (exp_ent_id, exp_name),
  KEY idx_exporters_ent_country (exp_ent_id, exp_country_code)
) ENGINE=InnoDB;

-- 1.4 hsc_external_data_sources
CREATE TABLE IF NOT EXISTS hsc_external_data_sources (
  eds_id                CHAR(36)     NOT NULL,
  eds_adapter_key       VARCHAR(64)  NOT NULL,
  eds_import_country_code VARCHAR(2) NOT NULL,
  eds_display_name      VARCHAR(255) NOT NULL,
  eds_endpoint_url      VARCHAR(500) NULL,
  eds_cache_ttl_sec     INT          NOT NULL DEFAULT 86400,
  eds_is_active         TINYINT(1)   NOT NULL DEFAULT 0,
  eds_priority          INT          NOT NULL DEFAULT 100,
  eds_config            JSON         NULL,
  eds_created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eds_updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eds_deleted_at        DATETIME     NULL,
  PRIMARY KEY (eds_id),
  UNIQUE KEY uq_eds_adapter_key (eds_adapter_key),
  KEY idx_eds_country_priority (eds_import_country_code, eds_priority)
) ENGINE=InnoDB;

-- 1.5 hsc_fta_matrix
CREATE TABLE IF NOT EXISTS hsc_fta_matrix (
  fta_id                   CHAR(36)      NOT NULL,
  fta_import_country_code  VARCHAR(2)    NOT NULL,
  fta_export_country_code  VARCHAR(2)    NOT NULL,
  fta_agreement_code       VARCHAR(16)   NOT NULL,
  fta_hs_code              VARCHAR(16)   NOT NULL,
  fta_rate                 DECIMAL(6,3)  NOT NULL,
  fta_effective_from       DATE          NOT NULL,
  fta_effective_to         DATE          NULL,
  fta_memo                 VARCHAR(500)  NULL,
  fta_created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fta_updated_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  fta_deleted_at           DATETIME      NULL,
  PRIMARY KEY (fta_id),
  UNIQUE KEY uq_fta_lookup
    (fta_import_country_code, fta_export_country_code,
     fta_agreement_code, fta_hs_code, fta_effective_from),
  KEY idx_fta_lookup_hs
    (fta_import_country_code, fta_export_country_code, fta_hs_code),
  KEY idx_fta_effective_range (fta_effective_from, fta_effective_to)
) ENGINE=InnoDB;
