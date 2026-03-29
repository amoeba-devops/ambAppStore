-- ============================================================
-- ambAppStore — Stock Management DB Initialization
-- Database: db_app_stock
-- ============================================================

CREATE DATABASE IF NOT EXISTS db_app_stock
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_app_stock;

-- ------------------------------------------------------------
-- asm_corporations (법인/엔티티)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_corporations (
  crp_id              CHAR(36)      NOT NULL PRIMARY KEY,
  crp_code            VARCHAR(30)   NOT NULL UNIQUE,
  crp_name            VARCHAR(100)  NOT NULL,
  crp_biz_no          VARCHAR(20)   NULL,
  crp_status          ENUM('ACTIVE','SUSPENDED','TERMINATED') NOT NULL DEFAULT 'ACTIVE',
  crp_ama_entity_id   CHAR(36)      NULL,
  crp_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  crp_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  crp_deleted_at      DATETIME      NULL,
  INDEX idx_corp_status (crp_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_users (사용자)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_users (
  usr_id              CHAR(36)      NOT NULL PRIMARY KEY,
  crp_id              CHAR(36)      NOT NULL,
  usr_code            VARCHAR(30)   NOT NULL,
  usr_email           VARCHAR(100)  NOT NULL,
  usr_name            VARCHAR(50)   NOT NULL,
  usr_password_hash   VARCHAR(255)  NOT NULL,
  usr_role            ENUM('SYSTEM_ADMIN','ADMIN','MANAGER','OPERATOR','VIEWER') NOT NULL DEFAULT 'OPERATOR',
  usr_status          ENUM('ACTIVE','LOCKED','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  usr_temp_password   BOOLEAN       NOT NULL DEFAULT TRUE,
  usr_fail_count      INT           NOT NULL DEFAULT 0,
  usr_phone           VARCHAR(20)   NULL,
  usr_ama_user_id     CHAR(36)      NULL,
  usr_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usr_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  usr_deleted_at      DATETIME      NULL,
  INDEX idx_user_crp (crp_id),
  INDEX idx_user_email (usr_email),
  CONSTRAINT fk_user_corp FOREIGN KEY (crp_id) REFERENCES asm_corporations(crp_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_user_applications (사용 신청)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_user_applications (
  uap_id              CHAR(36)      NOT NULL PRIMARY KEY,
  uap_no              VARCHAR(30)   NOT NULL UNIQUE,
  uap_ama_entity_id   CHAR(36)      NULL,
  uap_ama_entity_name VARCHAR(100)  NULL,
  uap_ama_user_id     CHAR(36)      NULL,
  uap_applicant_name  VARCHAR(50)   NOT NULL,
  uap_applicant_email VARCHAR(100)  NOT NULL,
  uap_applicant_phone VARCHAR(20)   NULL,
  uap_status          ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  uap_reviewed_by     CHAR(36)      NULL,
  uap_reviewed_at     DATETIME      NULL,
  uap_reject_reason   TEXT          NULL,
  crp_id              CHAR(36)      NULL,
  usr_id              CHAR(36)      NULL,
  uap_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uap_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_uap_status (uap_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_products (상품)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_products (
  prd_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  prd_code            VARCHAR(30)   NOT NULL,
  prd_name            VARCHAR(100)  NOT NULL,
  prd_category        VARCHAR(50)   NULL,
  prd_brand           VARCHAR(50)   NULL,
  prd_note            TEXT          NULL,
  prd_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  prd_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  prd_deleted_at      DATETIME      NULL,
  INDEX idx_prd_ent (ent_id),
  UNIQUE KEY uq_prd_ent_code (ent_id, prd_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_skus (SKU)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_skus (
  sku_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  prd_id              CHAR(36)      NOT NULL,
  sku_code            VARCHAR(30)   NOT NULL,
  sku_name            VARCHAR(100)  NOT NULL,
  sku_spec            VARCHAR(200)  NULL,
  sku_unit            VARCHAR(10)   NOT NULL DEFAULT 'EA',
  sku_status          ENUM('PENDING_IN','ACTIVE','INACTIVE','DISCONTINUED') NOT NULL DEFAULT 'PENDING_IN',
  sku_moq             INT           NOT NULL DEFAULT 1,
  sku_cost_price      DECIMAL(14,2) NULL,
  sku_sell_price      DECIMAL(14,2) NULL,
  sku_supplier        VARCHAR(100)  NULL,
  sku_note            TEXT          NULL,
  sku_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sku_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  sku_deleted_at      DATETIME      NULL,
  INDEX idx_sku_ent (ent_id),
  INDEX idx_sku_prd (prd_id),
  UNIQUE KEY uq_sku_ent_code (ent_id, sku_code),
  CONSTRAINT fk_sku_product FOREIGN KEY (prd_id) REFERENCES asm_products(prd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_sku_id_codes (SKU 식별 코드)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_sku_id_codes (
  sic_id              CHAR(36)      NOT NULL PRIMARY KEY,
  sku_id              CHAR(36)      NOT NULL,
  ent_id              CHAR(36)      NOT NULL,
  sic_type            ENUM('EAN','UPC','JAN','ASIN','FNSKU','CUSTOM') NOT NULL,
  sic_value           VARCHAR(100)  NOT NULL,
  sic_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sic_sku (sku_id),
  CONSTRAINT fk_sic_sku FOREIGN KEY (sku_id) REFERENCES asm_skus(sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_channels (판매 채널)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_channels (
  chn_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  chn_name            VARCHAR(100)  NOT NULL,
  chn_type            ENUM('B2C','B2B') NOT NULL DEFAULT 'B2C',
  chn_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  chn_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  chn_deleted_at      DATETIME      NULL,
  INDEX idx_chn_ent (ent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_inventories (재고 현황)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_inventories (
  inv_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  sku_id              CHAR(36)      NOT NULL,
  inv_current_qty     INT           NOT NULL DEFAULT 0,
  inv_pending_shipment_qty INT      NOT NULL DEFAULT 0,
  inv_last_in_at      DATETIME      NULL,
  inv_last_out_at     DATETIME      NULL,
  inv_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  inv_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_inv_ent_sku (ent_id, sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_transactions (입출고 트랜잭션)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_transactions (
  txn_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  sku_id              CHAR(36)      NOT NULL,
  txn_type            ENUM('IN','OUT') NOT NULL,
  txn_reason          ENUM('PURCHASE','RETURN','ADJUSTMENT','SALES','DISPOSE','TRANSFER','OTHER') NOT NULL,
  txn_qty             INT           NOT NULL,
  txn_unit_price      DECIMAL(14,2) NULL,
  txn_date            DATE          NOT NULL,
  txn_reference       VARCHAR(100)  NULL,
  txn_note            TEXT          NULL,
  sod_id              CHAR(36)      NULL,
  chn_id              CHAR(36)      NULL,
  txn_created_by      CHAR(36)      NULL,
  txn_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_txn_ent (ent_id),
  INDEX idx_txn_sku (sku_id),
  INDEX idx_txn_date (txn_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_receiving_schedules (입고 예정)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_receiving_schedules (
  rcv_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  sku_id              CHAR(36)      NOT NULL,
  obt_id              CHAR(36)      NULL,
  rcv_expected_qty    INT           NOT NULL,
  rcv_received_qty    INT           NULL,
  rcv_expected_date   DATE          NOT NULL,
  rcv_status          ENUM('EXPECTED','IN_TRANSIT','ARRIVED','INSPECTING','COMPLETED') NOT NULL DEFAULT 'EXPECTED',
  rcv_inspection_result ENUM('PASS','FAIL','PARTIAL') NULL,
  rcv_inspection_note TEXT          NULL,
  rcv_supplier        VARCHAR(100)  NULL,
  rcv_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rcv_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rcv_ent (ent_id),
  INDEX idx_rcv_status (rcv_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_sales_orders (판매 주문)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_sales_orders (
  sod_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  sku_id              CHAR(36)      NOT NULL,
  chn_id              CHAR(36)      NULL,
  sod_order_no        VARCHAR(50)   NOT NULL,
  sod_customer        VARCHAR(100)  NULL,
  sod_qty             INT           NOT NULL,
  sod_unit_price      DECIMAL(14,2) NULL,
  sod_status          ENUM('DRAFT','CONFIRMED','SHIPPED','DELIVERED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  sod_order_date      DATE          NOT NULL,
  sod_ship_date       DATE          NULL,
  sod_note            TEXT          NULL,
  sod_created_by      CHAR(36)      NULL,
  sod_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sod_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sod_ent (ent_id),
  INDEX idx_sod_status (sod_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_order_batches (발주 제안)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_order_batches (
  obt_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  sku_id              CHAR(36)      NOT NULL,
  obt_batch_no        VARCHAR(50)   NOT NULL,
  obt_proposed_qty    INT           NOT NULL,
  obt_adjusted_qty    INT           NULL,
  obt_final_qty       INT           NULL,
  obt_status          ENUM('PROPOSED','ADJUSTED','APPROVED','CONFIRMED','REJECTED') NOT NULL DEFAULT 'PROPOSED',
  obt_urgency         ENUM('NORMAL','URGENT','CRITICAL') NOT NULL DEFAULT 'NORMAL',
  obt_supplier        VARCHAR(100)  NULL,
  obt_expected_date   DATE          NULL,
  obt_approved_by     CHAR(36)      NULL,
  obt_approved_at     DATETIME      NULL,
  obt_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  obt_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_obt_ent (ent_id),
  INDEX idx_obt_status (obt_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_forecasts (수요 예측)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_forecasts (
  fct_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  sku_id              CHAR(36)      NOT NULL,
  fct_period          VARCHAR(20)   NOT NULL,
  fct_sma_value       DECIMAL(14,2) NULL,
  fct_si_value        DECIMAL(6,4)  NULL,
  fct_adjusted_demand DECIMAL(14,2) NULL,
  fct_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fct_ent_sku (ent_id, sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_safety_stocks (안전 재고)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_safety_stocks (
  sfs_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  sku_id              CHAR(36)      NOT NULL,
  sfs_safety_qty      INT           NOT NULL DEFAULT 0,
  sfs_target_qty      INT           NOT NULL DEFAULT 0,
  sfs_sigma           DECIMAL(14,4) NULL,
  sfs_calculated_at   DATETIME      NULL,
  sfs_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sfs_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sfs_ent_sku (ent_id, sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_parameters (파이프라인 파라미터)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_parameters (
  prm_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL UNIQUE,
  prm_lt1_days        INT           NOT NULL DEFAULT 3,
  prm_lt2_days        INT           NOT NULL DEFAULT 7,
  prm_lt3_days        INT           NOT NULL DEFAULT 14,
  prm_lt4_days        INT           NOT NULL DEFAULT 3,
  prm_lt5_days        INT           NOT NULL DEFAULT 1,
  prm_service_level   DECIMAL(5,2)  NOT NULL DEFAULT 95.00,
  prm_review_period_weeks INT       NOT NULL DEFAULT 4,
  prm_sma_weeks       INT           NOT NULL DEFAULT 12,
  prm_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  prm_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_seasonality_indices (계절 지수)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_seasonality_indices (
  ssi_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  ssi_month           TINYINT       NOT NULL,
  ssi_index           DECIMAL(6,4)  NOT NULL DEFAULT 1.0000,
  ssi_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ssi_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ssi_ent_month (ent_id, ssi_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_weekly_aggregations (주간 집계)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_weekly_aggregations (
  wag_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  sku_id              CHAR(36)      NOT NULL,
  wag_week            VARCHAR(10)   NOT NULL,
  wag_in_qty          INT           NOT NULL DEFAULT 0,
  wag_out_qty         INT           NOT NULL DEFAULT 0,
  wag_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wag_ent_sku_week (ent_id, sku_id, wag_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- asm_monthly_aggregations (월간 집계)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asm_monthly_aggregations (
  mag_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  sku_id              CHAR(36)      NOT NULL,
  mag_month           VARCHAR(7)    NOT NULL,
  mag_in_qty          INT           NOT NULL DEFAULT 0,
  mag_out_qty         INT           NOT NULL DEFAULT 0,
  mag_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mag_ent_sku_month (ent_id, sku_id, mag_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Seed: System Admin (SYSTEM_ADMIN)
-- Password: Admin!2345 (bcrypt hash)
-- ============================================================
INSERT INTO asm_corporations (crp_id, crp_code, crp_name, crp_status)
VALUES ('00000000-0000-0000-0000-000000000001', 'SYSTEM', 'System', 'ACTIVE')
ON DUPLICATE KEY UPDATE crp_name = VALUES(crp_name);

INSERT INTO asm_users (usr_id, crp_id, usr_code, usr_email, usr_name, usr_password_hash, usr_role, usr_status, usr_temp_password, usr_fail_count)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'USR-SYSTEM-ADMIN',
  'admin@amoeba.site',
  'System Admin',
  '$2b$12$LJ3m4ys3Gy1sBVxK3p8IXOQz3qQvqxK5fdJ.xqMnVzXhBmGNnmPK',
  'SYSTEM_ADMIN',
  'ACTIVE',
  FALSE,
  0
) ON DUPLICATE KEY UPDATE usr_name = VALUES(usr_name);
