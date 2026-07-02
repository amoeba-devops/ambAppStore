-- HS Code Manager — Phase 2 Intake Tables
-- 2026-05-13

USE db_app_hscode;

-- 2.1 hsc_inquiries
CREATE TABLE IF NOT EXISTS hsc_inquiries (
  inq_id                      CHAR(36)     NOT NULL,
  inq_ent_id                  CHAR(36)     NOT NULL,
  inq_exporter_id             CHAR(36)     NULL,
  inq_export_country_code     VARCHAR(2)   NULL,
  inq_import_country_code     VARCHAR(2)   NULL,
  inq_title                   VARCHAR(255) NULL,
  inq_memo                    TEXT         NULL,
  inq_status                  VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
  inq_completeness_score      DECIMAL(4,3) NULL,
  inq_submitted_at            DATETIME     NULL,
  inq_created_by              CHAR(36)     NULL,
  inq_created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  inq_updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  inq_deleted_at              DATETIME     NULL,
  PRIMARY KEY (inq_id),
  KEY idx_inquiries_ent_exp_imc_submitted
    (inq_ent_id, inq_exporter_id, inq_import_country_code, inq_submitted_at)
) ENGINE=InnoDB;

-- 2.2 hsc_items
CREATE TABLE IF NOT EXISTS hsc_items (
  itm_id                  CHAR(36)     NOT NULL,
  itm_ent_id              CHAR(36)     NOT NULL,
  itm_inquiry_id          CHAR(36)     NULL,
  itm_name_raw            VARCHAR(500) NOT NULL,
  itm_name_normalized     VARCHAR(500) NULL,
  itm_category            VARCHAR(32)  NOT NULL,
  itm_usage_description   TEXT         NULL,
  itm_composition_hash    VARCHAR(64)  NULL,
  itm_spec_attributes     JSON         NULL,
  itm_gtin                VARCHAR(32)  NULL,
  itm_normalizer_version  VARCHAR(32)  NULL,
  itm_completeness_score  DECIMAL(4,3) NULL,
  itm_created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  itm_updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  itm_deleted_at          DATETIME     NULL,
  PRIMARY KEY (itm_id),
  KEY idx_items_ent_hash (itm_ent_id, itm_composition_hash),
  KEY idx_items_ent_category_name (itm_ent_id, itm_category, itm_name_normalized),
  KEY idx_items_inquiry (itm_inquiry_id)
) ENGINE=InnoDB;

-- 2.3 hsc_excel_import_batches
CREATE TABLE IF NOT EXISTS hsc_excel_import_batches (
  eib_id              CHAR(36)     NOT NULL,
  eib_ent_id          CHAR(36)     NOT NULL,
  eib_inquiry_id      CHAR(36)     NOT NULL,
  eib_filename        VARCHAR(500) NOT NULL,
  eib_total_rows      INT          NOT NULL DEFAULT 0,
  eib_imported_rows   INT          NOT NULL DEFAULT 0,
  eib_hold_rows       INT          NOT NULL DEFAULT 0,
  eib_mapping_snapshot JSON        NULL,
  eib_status          VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
  eib_created_by      CHAR(36)     NULL,
  eib_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eib_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (eib_id),
  KEY idx_excel_batches_ent_inquiry (eib_ent_id, eib_inquiry_id)
) ENGINE=InnoDB;

-- 2.4 hsc_excel_hold_rows
CREATE TABLE IF NOT EXISTS hsc_excel_hold_rows (
  hqr_id              CHAR(36)     NOT NULL,
  hqr_ent_id          CHAR(36)     NOT NULL,
  hqr_batch_id        CHAR(36)     NOT NULL,
  hqr_row_index       INT          NOT NULL,
  hqr_raw_data        JSON         NOT NULL,
  hqr_validation_errors JSON       NULL,
  hqr_resolved_at     DATETIME     NULL,
  hqr_resolved_item_id CHAR(36)    NULL,
  hqr_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hqr_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (hqr_id),
  KEY idx_hold_rows_batch (hqr_batch_id)
) ENGINE=InnoDB;

-- 2.5 hsc_excel_mapping_profiles
CREATE TABLE IF NOT EXISTS hsc_excel_mapping_profiles (
  emp_id              CHAR(36)     NOT NULL,
  emp_ent_id          CHAR(36)     NOT NULL,
  emp_exporter_id     CHAR(36)     NULL,
  emp_profile_name    VARCHAR(255) NOT NULL,
  emp_mapping_json    JSON         NOT NULL,
  emp_last_used_at    DATETIME     NULL,
  emp_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  emp_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  emp_deleted_at      DATETIME     NULL,
  PRIMARY KEY (emp_id),
  KEY idx_mapping_profiles_ent_exporter (emp_ent_id, emp_exporter_id)
) ENGINE=InnoDB;
