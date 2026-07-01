-- HS Code Manager — Schema DDL
-- document_id: HSCODE-MGR-SQL-2.0.0 | version: 2.0.0 | created: 2026-06-23
-- Conforms to amoeba_code_convention_v2.md:
--   DB db_hsm | tables {prefix}_{plural} snake_case (prefix=hsm) | columns {colPrefix}_{name}
--   PK {colPrefix}_id UUID | ent_id FK (multi-tenancy) | created/updated/deleted_at | soft delete
--   constraints pk_/fk_/idx_/uq_  | Engine: PostgreSQL 15.x
-- Naming map (v1 -> v2):
--   gtin_hs_map->hsm_gtin_hs_maps(ghm) | gpc_hs_map->hsm_gpc_hs_maps(gpm)
--   hs_country_ext->hsm_hs_country_extensions(hce) | product_master->hsm_product_masters(prm)
--   import_batch->hsm_import_batches(imb) | hs_reference->hsm_hs_references(hsr)
--   query_log->hsm_query_logs(qlg) | review_queue->hsm_review_queues(rvq)
--   resolution_audit->hsm_resolution_audits(rsa)
-- Note: hsm_gpc_hs_maps / hsm_hs_country_extensions are GLOBAL reference data (no ent_id).

-- =====================================================================
-- 0) Extensions — pgvector (RAG 의미검색), pgcrypto (gen_random_uuid)
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- 1) hsm_gtin_hs_maps — Layer 1 direct mapping (highest priority)  FR-013 / FN-011
-- =====================================================================
CREATE TABLE hsm_gtin_hs_maps (
  ghm_id          UUID         NOT NULL DEFAULT gen_random_uuid(),
  ent_id          UUID         NOT NULL,                         -- multi-tenancy FK
  ghm_gtin        VARCHAR(14)  NOT NULL,                         -- normalized 14-digit
  ghm_hs6         VARCHAR(6)   NOT NULL,
  ghm_gpc_brick   VARCHAR(8)   NULL,
  ghm_source      VARCHAR(20)  NOT NULL,                         -- MANUAL | API | LEARNED
  ghm_confidence  DECIMAL(4,3) NULL,
  ghm_verified_by VARCHAR(64)  NULL,
  ghm_created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ghm_updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ghm_deleted_at  TIMESTAMPTZ  NULL,
  CONSTRAINT pk_hsm_gtin_hs_maps PRIMARY KEY (ghm_id),
  CONSTRAINT uq_hsm_gtin_hs_maps_gtin UNIQUE (ent_id, ghm_gtin)
);
CREATE INDEX idx_hsm_gtin_hs_maps_hs6 ON hsm_gtin_hs_maps (ghm_hs6);
CREATE INDEX idx_hsm_gtin_hs_maps_ent ON hsm_gtin_hs_maps (ent_id);

-- =====================================================================
-- 2) hsm_gpc_hs_maps — Layer 3 GPC->HS (1:many), global reference  FR-015 / FN-013
-- =====================================================================
CREATE TABLE hsm_gpc_hs_maps (
  gpm_id         UUID        NOT NULL DEFAULT gen_random_uuid(),
  gpm_gpc_brick  VARCHAR(8)  NOT NULL,
  gpm_hs6        VARCHAR(6)  NOT NULL,
  gpm_priority   INT         NULL,
  gpm_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  gpm_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_hsm_gpc_hs_maps PRIMARY KEY (gpm_id),
  CONSTRAINT uq_hsm_gpc_hs_maps_brick_hs6 UNIQUE (gpm_gpc_brick, gpm_hs6)
);
CREATE INDEX idx_hsm_gpc_hs_maps_brick ON hsm_gpc_hs_maps (gpm_gpc_brick, gpm_priority);

-- =====================================================================
-- 3) hsm_hs_country_extensions — HS6 -> national 8-10 digit, global ref  FR-017 / FN-015
-- =====================================================================
CREATE TABLE hsm_hs_country_extensions (
  hce_id          UUID         NOT NULL DEFAULT gen_random_uuid(),
  hce_hs6         VARCHAR(6)   NOT NULL,
  hce_country     CHAR(2)      NOT NULL,                          -- ISO 3166 alpha-2
  hce_hs_full     VARCHAR(12)  NOT NULL,                          -- 8~10 national digits
  hce_duty_rate   DECIMAL(6,3) NULL,
  hce_description TEXT         NULL,
  hce_created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  hce_updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_hsm_hs_country_extensions PRIMARY KEY (hce_id),
  CONSTRAINT uq_hsm_hs_country_extensions_full UNIQUE (hce_hs6, hce_country, hce_hs_full)
);
CREATE INDEX idx_hsm_hs_country_extensions_hs6 ON hsm_hs_country_extensions (hce_hs6, hce_country);

-- =====================================================================
-- 4) hsm_product_masters — Layer 2 cache: GTIN -> product info  FR-014 / FN-012
-- =====================================================================
CREATE TABLE hsm_product_masters (
  prm_id          UUID         NOT NULL DEFAULT gen_random_uuid(),
  ent_id          UUID         NULL,                              -- nullable: shared cache
  prm_gtin        VARCHAR(14)  NOT NULL,
  prm_name        VARCHAR(255) NULL,
  prm_gpc_brick   VARCHAR(8)   NULL,
  prm_brand       VARCHAR(128) NULL,
  prm_description TEXT         NULL,
  prm_created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  prm_updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  prm_deleted_at  TIMESTAMPTZ  NULL,
  CONSTRAINT pk_hsm_product_masters PRIMARY KEY (prm_id),
  CONSTRAINT uq_hsm_product_masters_gtin UNIQUE (prm_gtin)
);
CREATE INDEX idx_hsm_product_masters_brick ON hsm_product_masters (prm_gpc_brick);

-- =====================================================================
-- 5) hsm_import_batches — 면장리스트 import tracking  FR-040 / FN-040
-- =====================================================================
CREATE TABLE hsm_import_batches (
  imb_id            UUID         NOT NULL DEFAULT gen_random_uuid(),
  ent_id            UUID         NOT NULL,
  imb_file_name     VARCHAR(255) NOT NULL,
  imb_format_type   VARCHAR(32)  NOT NULL,                        -- BaoCaoHangChiTiet | BaoCaoToKhai | VMSG | OTHER
  imb_rows_total    INT          NOT NULL DEFAULT 0,
  imb_rows_imported INT          NOT NULL DEFAULT 0,
  imb_rows_failed   INT          NOT NULL DEFAULT 0,
  imb_created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_hsm_import_batches PRIMARY KEY (imb_id)
);
CREATE INDEX idx_hsm_import_batches_ent ON hsm_import_batches (ent_id);

-- =====================================================================
-- 6) hsm_hs_references — corpus reference (Q&A / attribute base)  FR-002/040/043
-- =====================================================================
CREATE TABLE hsm_hs_references (
  hsr_id             UUID          NOT NULL DEFAULT gen_random_uuid(),
  ent_id             UUID          NOT NULL,
  hsr_hs_code        VARCHAR(12)   NOT NULL,                      -- 8~10 digit as declared
  hsr_hs6            VARCHAR(6)    NOT NULL,
  hsr_description    TEXT          NOT NULL,                      -- Tên hàng
  hsr_origin         VARCHAR(64)   NULL,                         -- Xuất xứ
  hsr_unit           VARCHAR(32)   NULL,                         -- Đơn vị tính
  hsr_unit_price     DECIMAL(18,4) NULL,
  hsr_trade_type     VARCHAR(16)   NULL,                         -- Mã loại hình
  hsr_source_company VARCHAR(128)  NULL,
  imb_id             UUID          NULL,                         -- FK -> hsm_import_batches
  hsr_embedding_ref  VARCHAR(128)  NULL,                         -- pointer to vector index
  hsr_created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  hsr_deleted_at     TIMESTAMPTZ   NULL,
  CONSTRAINT pk_hsm_hs_references PRIMARY KEY (hsr_id),
  CONSTRAINT fk_hsm_hs_references_hsm_import_batches FOREIGN KEY (imb_id) REFERENCES hsm_import_batches (imb_id)
);
CREATE INDEX idx_hsm_hs_references_hs6     ON hsm_hs_references (hsr_hs6);
CREATE INDEX idx_hsm_hs_references_hs_code ON hsm_hs_references (hsr_hs_code);
CREATE INDEX idx_hsm_hs_references_company ON hsm_hs_references (hsr_source_company);
CREATE INDEX idx_hsm_hs_references_ent     ON hsm_hs_references (ent_id);

-- RAG 임베딩 (FR-002 / FN-041). 차원(1024)은 .env EMBEDDING_DIMENSIONS 와 일치해야 함.
-- 임베딩 공급자/차원 확정(Phase 0 PoC) 후 필요 시 차원 수정 + 재임베딩.
ALTER TABLE hsm_hs_references ADD COLUMN IF NOT EXISTS hsr_embedding vector(1024);
CREATE INDEX IF NOT EXISTS idx_hsm_hs_references_embedding
  ON hsm_hs_references USING hnsw (hsr_embedding vector_cosine_ops);

-- =====================================================================
-- 7) hsm_query_logs — all modes  FR-005 / FR-041
-- =====================================================================
CREATE TABLE hsm_query_logs (
  qlg_id         UUID         NOT NULL DEFAULT gen_random_uuid(),
  ent_id         UUID         NOT NULL,
  qlg_mode       VARCHAR(16)  NOT NULL,                           -- QA | BARCODE | ATTRIBUTE
  qlg_input_text TEXT         NULL,
  qlg_result_hs  VARCHAR(12)  NULL,
  qlg_confidence DECIMAL(4,3) NULL,
  hsr_id         UUID         NULL,                               -- FK -> hsm_hs_references
  qlg_user_id    VARCHAR(64)  NULL,
  qlg_session_id VARCHAR(64)  NULL,
  qlg_created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_hsm_query_logs PRIMARY KEY (qlg_id),
  CONSTRAINT fk_hsm_query_logs_hsm_hs_references FOREIGN KEY (hsr_id) REFERENCES hsm_hs_references (hsr_id)
);
CREATE INDEX idx_hsm_query_logs_mode ON hsm_query_logs (qlg_mode);
CREATE INDEX idx_hsm_query_logs_ent  ON hsm_query_logs (ent_id);

-- =====================================================================
-- 8) hsm_review_queues — low-confidence routing  FR-019 / FN-017
-- =====================================================================
CREATE TABLE hsm_review_queues (
  rvq_id           UUID        NOT NULL DEFAULT gen_random_uuid(),
  ent_id           UUID        NOT NULL,
  rvq_gtin         VARCHAR(14) NULL,
  rvq_product_info JSONB       NULL,
  rvq_candidates   JSONB       NULL,
  rvq_status       VARCHAR(16) NOT NULL DEFAULT 'PENDING',        -- PENDING | RESOLVED | REJECTED
  rvq_assigned_to  VARCHAR(64) NULL,
  rvq_created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  rvq_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_hsm_review_queues PRIMARY KEY (rvq_id)
);
CREATE INDEX idx_hsm_review_queues_status ON hsm_review_queues (rvq_status);
CREATE INDEX idx_hsm_review_queues_ent    ON hsm_review_queues (ent_id);

-- =====================================================================
-- 9) hsm_resolution_audits — customs justification trail  FR-020 / FN-018
-- =====================================================================
CREATE TABLE hsm_resolution_audits (
  rsa_id           UUID         NOT NULL DEFAULT gen_random_uuid(),
  ent_id           UUID         NOT NULL,
  rsa_query_type   VARCHAR(16)  NOT NULL,                         -- QA | BARCODE | ATTRIBUTE
  rsa_input        TEXT         NULL,
  rsa_resolved_hs  VARCHAR(12)  NULL,
  rsa_source       VARCHAR(16)  NOT NULL,                         -- DIRECT | GPC | API | MANUAL
  rsa_confidence   DECIMAL(4,3) NULL,
  rsa_dest_country CHAR(2)      NULL,
  rsa_verifier     VARCHAR(64)  NULL,
  rsa_created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_hsm_resolution_audits PRIMARY KEY (rsa_id)
);
CREATE INDEX idx_hsm_resolution_audits_hs      ON hsm_resolution_audits (rsa_resolved_hs);
CREATE INDEX idx_hsm_resolution_audits_created ON hsm_resolution_audits (rsa_created_at);
CREATE INDEX idx_hsm_resolution_audits_ent     ON hsm_resolution_audits (ent_id);

-- =====================================================================
-- 10) hsm_app_settings — 어드민(설정) AI/API 연결·설정  SCR-006 / R-18
--     ent_id별 동적 설정. .env 부트스트랩 값을 런타임 오버라이드.
--     비밀값(aps_is_secret=true)은 암호화 저장 (평문 노출 금지, POL-005).
-- =====================================================================
CREATE TABLE hsm_app_settings (
  aps_id         UUID         NOT NULL DEFAULT gen_random_uuid(),
  ent_id         UUID         NOT NULL,
  aps_category   VARCHAR(16)  NOT NULL,                          -- AI | EXTERNAL | EMBEDDING | THRESHOLD | CACHE
  aps_key        VARCHAR(64)  NOT NULL,
  aps_value      TEXT         NULL,                              -- 비밀값은 암호화 저장
  aps_is_secret  BOOLEAN      NOT NULL DEFAULT false,
  aps_updated_by VARCHAR(64)  NULL,
  aps_created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  aps_updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_hsm_app_settings PRIMARY KEY (aps_id),
  CONSTRAINT uq_hsm_app_settings_key UNIQUE (ent_id, aps_category, aps_key)
);
CREATE INDEX idx_hsm_app_settings_ent ON hsm_app_settings (ent_id);
