-- =====================================================================
-- HS Code Manager — 지식창고(Knowledge Base) 메뉴 스키마 마이그레이션
-- 문서: REQ/PLAN-20260710-지식창고메뉴
-- 원천: knowledge-base-requirements.md (CGR/cgr_kb_) → app-hscode-manager 매핑
-- 적용: prefix cgr_kb_ → hsm_kb_. 전 테넌트 공용(ent_id NULL 허용). 쓰기=@SuperAdminOnly.
-- 대상: PostgreSQL 15 + pgvector. synchronize 비활성 → 수동 적용(스테이징 먼저).
-- 기존 hsm_* 테이블 무변경. Amoeba Code Convention v2 §4 (pk_/fk_/idx_/uq_).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- 다국어 검색 폴백(NFR-KB-002)

-- ---------------------------------------------------------------------
-- 1) 카테고리 (cgr_kb_categories → hsm_kb_categories, cat_) — FR-KB-015
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_kb_categories (
    cat_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    ent_id             UUID,                              -- NULL=전역 공용
    cat_name           VARCHAR(100) NOT NULL,
    cat_sort_order     INTEGER NOT NULL DEFAULT 0,
    cat_dot_color      VARCHAR(20),                       -- UI 표시 색상(예: #3B82F6)
    cat_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    cat_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    cat_deleted_at     TIMESTAMPTZ,
    CONSTRAINT pk_hsm_kb_categories PRIMARY KEY (cat_id)
);
CREATE INDEX IF NOT EXISTS idx_hsm_kb_categories_sort ON hsm_kb_categories (cat_sort_order);

-- ---------------------------------------------------------------------
-- 2) 게시글 (hsm_kb_posts, pst_) — FR-KB-001/002/003/008/010
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_kb_posts (
    pst_id                UUID NOT NULL DEFAULT gen_random_uuid(),
    ent_id                UUID,                           -- NULL=전역 공용
    pst_title             VARCHAR(300) NOT NULL,
    pst_content           TEXT NOT NULL,
    pst_source_lang       VARCHAR(5) NOT NULL DEFAULT 'ko',   -- ko/en/vi/id
    pst_category_id       UUID,
    pst_is_pinned         BOOLEAN NOT NULL DEFAULT false,
    pst_view_count        INTEGER NOT NULL DEFAULT 0,
    pst_is_promoted_to_rag BOOLEAN NOT NULL DEFAULT false,
    pst_promoted_doc_id   UUID,                           -- 승격 후 hsm_documents.doc_id (논리 참조, FK 미설정 — 도메인 격리)
    pst_created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    pst_updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    pst_deleted_at        TIMESTAMPTZ,
    CONSTRAINT pk_hsm_kb_posts PRIMARY KEY (pst_id),
    CONSTRAINT fk_hsm_kb_posts_categories FOREIGN KEY (pst_category_id) REFERENCES hsm_kb_categories (cat_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_hsm_kb_posts_category ON hsm_kb_posts (pst_category_id);
CREATE INDEX IF NOT EXISTS idx_hsm_kb_posts_pinned ON hsm_kb_posts (pst_is_pinned);
CREATE INDEX IF NOT EXISTS idx_hsm_kb_posts_view_count ON hsm_kb_posts (pst_view_count DESC);
CREATE INDEX IF NOT EXISTS idx_hsm_kb_posts_created ON hsm_kb_posts (pst_created_at DESC);
-- 통합 검색(제목·본문) — trigram(다국어 토큰화 폴백, FR-KB-004/NFR-KB-002)
CREATE INDEX IF NOT EXISTS idx_hsm_kb_posts_title_trgm ON hsm_kb_posts USING gin (pst_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_hsm_kb_posts_content_trgm ON hsm_kb_posts USING gin (pst_content gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 3) 번역 캐시 (hsm_kb_post_translations, ptr_) — FR-KB-009/NFR-KB-003
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_kb_post_translations (
    ptr_id                UUID NOT NULL DEFAULT gen_random_uuid(),
    pst_id                UUID NOT NULL,
    ptr_target_lang       VARCHAR(5) NOT NULL,            -- ko/en/vi/id
    ptr_translated_title  VARCHAR(300),
    ptr_translated_content TEXT,
    ptr_source            VARCHAR(10) NOT NULL DEFAULT 'AI', -- AI/MANUAL (MANUAL은 AI로 미덮어쓰기)
    ptr_translated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_kb_post_translations PRIMARY KEY (ptr_id),
    CONSTRAINT fk_hsm_kb_post_translations_posts FOREIGN KEY (pst_id) REFERENCES hsm_kb_posts (pst_id) ON DELETE CASCADE,
    CONSTRAINT uq_hsm_kb_post_translations_pst_lang UNIQUE (pst_id, ptr_target_lang)
);
CREATE INDEX IF NOT EXISTS idx_hsm_kb_post_translations_pst ON hsm_kb_post_translations (pst_id);

-- ---------------------------------------------------------------------
-- 4) 첨부 (hsm_kb_attachments, att_) — FR-KB-011/012/NFR-KB-004
--    로컬 볼륨 저장, DB는 경로만.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_kb_attachments (
    att_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    pst_id             UUID NOT NULL,
    att_file_path      VARCHAR(500) NOT NULL,             -- 볼륨 경로만 저장
    att_file_name      VARCHAR(300) NOT NULL,
    att_file_size      BIGINT NOT NULL,                   -- bytes (≤ 50MB)
    att_mime_type      VARCHAR(120),
    att_file_ext       VARCHAR(20),
    att_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_kb_attachments PRIMARY KEY (att_id),
    CONSTRAINT fk_hsm_kb_attachments_posts FOREIGN KEY (pst_id) REFERENCES hsm_kb_posts (pst_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_hsm_kb_attachments_pst ON hsm_kb_attachments (pst_id);

-- ---------------------------------------------------------------------
-- 5) 대시보드 블록 (hsm_kb_dashboard_blocks, dsb_) — FR-KB-005/006/007
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_kb_dashboard_blocks (
    dsb_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    ent_id             UUID,                              -- NULL=전역 공용
    dsb_block_type     VARCHAR(10) NOT NULL,              -- NOTICE/TIP
    dsb_title          VARCHAR(300),
    dsb_body           TEXT,
    dsb_flag_label     VARCHAR(50),                       -- 팁 카드 플래그(예: 실무)
    dsb_sort_order     INTEGER NOT NULL DEFAULT 0,
    dsb_is_active      BOOLEAN NOT NULL DEFAULT true,
    dsb_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    dsb_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_kb_dashboard_blocks PRIMARY KEY (dsb_id)
);
CREATE INDEX IF NOT EXISTS idx_hsm_kb_dashboard_blocks_type_sort ON hsm_kb_dashboard_blocks (dsb_block_type, dsb_sort_order);

-- ---------------------------------------------------------------------
-- 6) 태그 (hsm_kb_tags, tag_) — FR-KB-013
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_kb_tags (
    tag_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    ent_id             UUID,                              -- NULL=전역 공용
    tag_name           VARCHAR(80) NOT NULL,
    tag_type           VARCHAR(20) NOT NULL,              -- COUNTRY/HS_CHAPTER
    tag_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    tag_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_kb_tags PRIMARY KEY (tag_id),
    CONSTRAINT uq_hsm_kb_tags_name_type UNIQUE (tag_name, tag_type)
);

-- ---------------------------------------------------------------------
-- 7) 게시글-태그 맵 (hsm_kb_post_tags, ptg_) — FR-KB-013
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_kb_post_tags (
    ptg_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    pst_id             UUID NOT NULL,
    tag_id             UUID NOT NULL,
    ptg_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_kb_post_tags PRIMARY KEY (ptg_id),
    CONSTRAINT fk_hsm_kb_post_tags_posts FOREIGN KEY (pst_id) REFERENCES hsm_kb_posts (pst_id) ON DELETE CASCADE,
    CONSTRAINT fk_hsm_kb_post_tags_tags FOREIGN KEY (tag_id) REFERENCES hsm_kb_tags (tag_id) ON DELETE CASCADE,
    CONSTRAINT uq_hsm_kb_post_tags UNIQUE (pst_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_hsm_kb_post_tags_pst ON hsm_kb_post_tags (pst_id);
CREATE INDEX IF NOT EXISTS idx_hsm_kb_post_tags_tag ON hsm_kb_post_tags (tag_id);
