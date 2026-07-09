-- =====================================================================
-- HS Code 통관 에이전트 — 스키마 마이그레이션 (Phase 0)
-- 출처: hscode-classification-agent-schema.sql (CGR/cgr_hs_) → app-hscode-manager 매핑
-- 적용: prefix cgr_hs_ → hsm_, 청크에 pgvector(1024) 임베딩 인라인, 지식문서 ent_id NULL 허용(전역)
-- 대상: PostgreSQL 15 + pgvector. synchronize 비활성 → 수동 적용(스테이징 먼저).
-- 기존 hsm_* 테이블 무변경. Amoeba Code Convention v2 §4 (pk_/fk_/idx_).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------
-- 1) 마스터 데이터 계층
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_hs_codes (
    hsc_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    hsc_system         VARCHAR(10) NOT NULL,              -- VN/KR/CN/WCO
    hsc_version        VARCHAR(10) NOT NULL,
    hsc_chapter        VARCHAR(4)  NOT NULL,
    hsc_heading        VARCHAR(6),
    hsc_subheading     VARCHAR(10),
    hsc_national_subcode VARCHAR(20),
    hsc_description    TEXT,
    hsc_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    hsc_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_hs_codes PRIMARY KEY (hsc_id)
);
CREATE INDEX IF NOT EXISTS idx_hsm_hs_codes_system_chapter ON hsm_hs_codes (hsc_system, hsc_chapter);

CREATE TABLE IF NOT EXISTS hsm_materials (
    mat_id      UUID NOT NULL DEFAULT gen_random_uuid(),
    mat_name_ko VARCHAR(200),
    mat_name_en VARCHAR(200),
    mat_family  VARCHAR(50),                              -- PLASTIC/RUBBER/TEXTILE/CHEMICAL/METAL/WOOD/COMPOSITE
    mat_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    mat_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_materials PRIMARY KEY (mat_id)
);

CREATE TABLE IF NOT EXISTS hsm_product_names (
    pdn_id     UUID NOT NULL DEFAULT gen_random_uuid(),
    pdn_name_ko VARCHAR(200),
    pdn_name_en VARCHAR(200),
    pdn_name_local VARCHAR(200),
    pdn_alias  VARCHAR(200),
    pdn_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    pdn_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_product_names PRIMARY KEY (pdn_id)
);

CREATE TABLE IF NOT EXISTS hsm_uses (
    use_id     UUID NOT NULL DEFAULT gen_random_uuid(),
    use_name_ko VARCHAR(200),
    use_name_en VARCHAR(200),
    use_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    use_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_uses PRIMARY KEY (use_id)
);

CREATE TABLE IF NOT EXISTS hsm_processes (
    prc_id     UUID NOT NULL DEFAULT gen_random_uuid(),
    prc_name_ko VARCHAR(200),
    prc_name_en VARCHAR(200),
    prc_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    prc_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_processes PRIMARY KEY (prc_id)
);

-- ---------------------------------------------------------------------
-- 2) 트랜잭션/입력 계층 (Item, Composition) — ent_id NOT NULL
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_items (
    itm_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    ent_id             UUID NOT NULL,
    itm_product_name_ko    VARCHAR(200),
    itm_product_name_en    VARCHAR(200),
    itm_product_name_local VARCHAR(200),
    itm_trade_name         VARCHAR(200),
    itm_description        TEXT,
    itm_import_country     VARCHAR(2)  NOT NULL DEFAULT 'VN',
    itm_export_country     VARCHAR(2),
    itm_intended_use       VARCHAR(200),
    itm_processing_stage   VARCHAR(30),                   -- RAW_MATERIAL/SEMI_FINISHED/FINISHED
    itm_process_type       VARCHAR(50),                   -- MIXING/REACTION/EXTRUSION/MOLDING/COATING
    itm_supplier_name      VARCHAR(200),
    itm_brand_name         VARCHAR(200),
    itm_existing_hs_kr     VARCHAR(20),
    itm_existing_hs_cn     VARCHAR(20),
    itm_existing_hs_vn     VARCHAR(20),
    itm_status             VARCHAR(20) NOT NULL DEFAULT 'NEW',  -- NEW/UNDER_REVIEW/CONFIRMED/HOLD
    itm_material_family    VARCHAR(50),
    itm_chemical_family    VARCHAR(50),
    itm_textile_family     VARCHAR(50),
    itm_product_form       VARCHAR(30),
    itm_essential_character_type VARCHAR(50),
    itm_main_material      VARCHAR(200),
    itm_secondary_material VARCHAR(200),
    itm_composition_count  SMALLINT,
    itm_main_material_ratio NUMERIC(5,2),
    itm_ratio_confidence   VARCHAR(20),                   -- CONFIRMED/ESTIMATED/UNVERIFIED
    itm_is_mixed_material  BOOLEAN NOT NULL DEFAULT false,
    itm_is_layered_structure BOOLEAN NOT NULL DEFAULT false,
    itm_is_coated          BOOLEAN NOT NULL DEFAULT false,
    itm_import_purpose_code VARCHAR(20),
    itm_is_fta_applicable  BOOLEAN NOT NULL DEFAULT false,
    itm_is_origin_review_required BOOLEAN NOT NULL DEFAULT false,
    itm_is_pre_ruling_required BOOLEAN NOT NULL DEFAULT false,
    itm_customs_risk_level VARCHAR(10),                   -- LOW/MEDIUM/HIGH
    itm_created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    itm_updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    itm_deleted_at         TIMESTAMPTZ,
    CONSTRAINT pk_hsm_items PRIMARY KEY (itm_id)
);
CREATE INDEX IF NOT EXISTS idx_hsm_items_ent_id ON hsm_items (ent_id);
CREATE INDEX IF NOT EXISTS idx_hsm_items_status ON hsm_items (itm_status);
CREATE INDEX IF NOT EXISTS idx_hsm_items_customs_risk_level ON hsm_items (itm_customs_risk_level);

CREATE TABLE IF NOT EXISTS hsm_compositions (
    cps_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    itm_id             UUID NOT NULL,
    ent_id             UUID NOT NULL,
    cps_material_name  VARCHAR(200) NOT NULL,
    cps_material_category VARCHAR(100),
    cps_function_role  VARCHAR(50),                       -- PRIMARY/BINDER/SOLVENT/ADDITIVE/COATING
    cps_percentage     NUMERIC(5,2),
    cps_unit           VARCHAR(10) NOT NULL DEFAULT '%',
    cps_source_doc     VARCHAR(200),
    cps_certainty_level VARCHAR(20) NOT NULL DEFAULT 'ESTIMATED',
    cps_candidate_hs   VARCHAR(20),
    cps_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    cps_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_compositions PRIMARY KEY (cps_id),
    CONSTRAINT fk_hsm_compositions_hsm_items FOREIGN KEY (itm_id) REFERENCES hsm_items (itm_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_hsm_compositions_itm_id ON hsm_compositions (itm_id);
CREATE INDEX IF NOT EXISTS idx_hsm_compositions_ent_id ON hsm_compositions (ent_id);

-- ---------------------------------------------------------------------
-- 3) 지식 문서 계층 (Document, Chunk) — ent_id NULL 허용(전역=슈퍼관리자, LEARNED=엔티티)
--    청크는 pgvector(1024) 임베딩을 인라인 저장(앱 TEI/BGE-M3 재사용)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_documents (
    doc_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    ent_id             UUID,                              -- NULL=전역/슈퍼관리자 공용
    doc_type           VARCHAR(30) NOT NULL,              -- LAW/GUIDE/CASE_STUDY/TECHNICAL/SPEC_SHEET/SYSTEM/ADVANCE_RULING/LEARNED
    doc_title          VARCHAR(300) NOT NULL,
    doc_source_country VARCHAR(2),
    doc_source_org     VARCHAR(200),
    doc_language       VARCHAR(5) NOT NULL DEFAULT 'ko',
    doc_effective_date DATE,
    doc_hs_version     VARCHAR(10),
    doc_chapter_tags   JSONB,
    doc_material_tags  JSONB,
    doc_usecase_tags   JSONB,
    doc_process_tags   JSONB,
    doc_reliability_grade VARCHAR(20) NOT NULL DEFAULT 'REFERENCE', -- OFFICIAL/QUASI_OFFICIAL/REFERENCE
    doc_source_type    VARCHAR(30),
    doc_source_authority_level VARCHAR(20),
    doc_is_official    BOOLEAN NOT NULL DEFAULT false,
    doc_is_translated  BOOLEAN NOT NULL DEFAULT false,
    doc_last_verified_at TIMESTAMPTZ,
    doc_is_superseded  BOOLEAN NOT NULL DEFAULT false,
    doc_file_path      VARCHAR(500),
    doc_summary        TEXT,
    doc_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    doc_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    doc_deleted_at     TIMESTAMPTZ,
    CONSTRAINT pk_hsm_documents PRIMARY KEY (doc_id)
);
CREATE INDEX IF NOT EXISTS idx_hsm_documents_ent_id ON hsm_documents (ent_id);
CREATE INDEX IF NOT EXISTS idx_hsm_documents_type ON hsm_documents (doc_type);
CREATE INDEX IF NOT EXISTS idx_hsm_documents_country ON hsm_documents (doc_source_country);

CREATE TABLE IF NOT EXISTS hsm_doc_chunks (
    chk_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    doc_id             UUID NOT NULL,
    ent_id             UUID,                              -- 문서 ent_id 승계(검색 스코핑 최적화)
    chk_type           VARCHAR(20) NOT NULL,              -- RULE/CASE/TABLE/NOTE/TECHNICAL
    chk_chapter_tags   JSONB,
    chk_material_tags  JSONB,
    chk_rule_type      VARCHAR(20),                       -- GENERAL/EXCEPTION/CASE_COMMENTARY
    chk_is_applies_to_mix   BOOLEAN NOT NULL DEFAULT false,
    chk_is_applies_to_ratio BOOLEAN NOT NULL DEFAULT false,
    chk_language       VARCHAR(5) NOT NULL DEFAULT 'ko',
    chk_embedding_text TEXT NOT NULL,
    chk_citation_text  TEXT NOT NULL,
    chk_embedding      vector(1024),                      -- BGE-M3 (TEI). NULL=미임베딩
    chk_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_doc_chunks PRIMARY KEY (chk_id),
    CONSTRAINT fk_hsm_doc_chunks_hsm_documents FOREIGN KEY (doc_id) REFERENCES hsm_documents (doc_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_hsm_doc_chunks_doc_id ON hsm_doc_chunks (doc_id);
CREATE INDEX IF NOT EXISTS idx_hsm_doc_chunks_ent_id ON hsm_doc_chunks (ent_id);
CREATE INDEX IF NOT EXISTS idx_hsm_doc_chunks_embedding ON hsm_doc_chunks USING hnsw (chk_embedding vector_cosine_ops);

-- ---------------------------------------------------------------------
-- 4) 판정 결과 계층 (Classification Case, Recommendation) — ent_id NOT NULL
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_class_cases (
    cas_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    ent_id             UUID NOT NULL,
    cas_item_signature TEXT NOT NULL,
    cas_jurisdiction   VARCHAR(2) NOT NULL,               -- VN/KR/CN
    cas_recommended_hs VARCHAR(20),
    cas_final_hs       VARCHAR(20),
    cas_reasoning_summary TEXT,
    cas_essential_character VARCHAR(100),
    cas_main_material  VARCHAR(200),
    cas_risk_flags     JSONB,
    cas_source_case_doc VARCHAR(200),
    cas_reviewer_type  VARCHAR(20) NOT NULL DEFAULT 'AI', -- AI/CUSTOMS_BROKER/CUSTOMS_AUTHORITY
    cas_review_status  VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- CONFIRMED/REJECTED/HOLD
    cas_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    cas_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_class_cases PRIMARY KEY (cas_id)
);
CREATE INDEX IF NOT EXISTS idx_hsm_class_cases_jurisdiction ON hsm_class_cases (cas_jurisdiction);
CREATE INDEX IF NOT EXISTS idx_hsm_class_cases_ent_id ON hsm_class_cases (ent_id);

CREATE TABLE IF NOT EXISTS hsm_recommendations (
    rec_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    itm_id             UUID NOT NULL,
    ent_id             UUID NOT NULL,
    rec_candidate_rank SMALLINT NOT NULL,
    rec_candidate_hs_vn VARCHAR(20) NOT NULL,
    rec_mapped_hs_kr   VARCHAR(20),
    rec_mapped_hs_cn   VARCHAR(20),
    rec_confidence_score NUMERIC(5,4),
    rec_reasoning_text TEXT NOT NULL,
    rec_supporting_chunks JSONB,                          -- array of chk_id
    rec_rule_signals   JSONB,
    rec_unresolved_questions JSONB,
    rec_is_escalation_required BOOLEAN NOT NULL DEFAULT false,
    rec_final_user_action VARCHAR(20),                    -- ADOPTED/HELD/REJECTED
    rec_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    rec_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_recommendations PRIMARY KEY (rec_id),
    CONSTRAINT fk_hsm_recommendations_hsm_items FOREIGN KEY (itm_id) REFERENCES hsm_items (itm_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_hsm_recommendations_itm_id ON hsm_recommendations (itm_id);
CREATE INDEX IF NOT EXISTS idx_hsm_recommendations_ent_id ON hsm_recommendations (ent_id);
CREATE INDEX IF NOT EXISTS idx_hsm_recommendations_escalation ON hsm_recommendations (rec_is_escalation_required);

-- =====================================================================
-- End — 적용: docker exec postgres-hscode psql -U hscode_app -d db_hsm -f (이 파일)
--       또는 스테이징/프로덕션 수동 적용. 이후 TypeORM 엔티티는 이 스키마에 매핑.
-- =====================================================================
