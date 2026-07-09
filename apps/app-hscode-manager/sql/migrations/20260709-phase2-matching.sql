-- =====================================================================
-- HS Code 통관 에이전트 — Phase 2 문서 업로드 매칭 (요청건 단위 저장)
-- 문서 업로드 → AI 파싱 → 품목 → RAG 매칭 → 추천 → 승인/컨펌 → 요청건별 저장.
-- Phase 0 스키마(hsm_items/recommendations/class_cases) 재사용 + 요청건 그룹 테이블 추가.
-- 대상: PostgreSQL 15. synchronize 비활성 → 수동 적용(스테이징 먼저). 기존 테이블 무변경.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 요청건(Match Request) — 업로드 1건(파일) = 요청건. 품목·추천을 묶는다.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_match_requests (
    mrq_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    ent_id             UUID NOT NULL,
    mrq_file_name      VARCHAR(300),
    mrq_source_type    VARCHAR(20) NOT NULL DEFAULT 'EXCEL',   -- EXCEL/CSV/PDF/MANUAL
    mrq_status         VARCHAR(20) NOT NULL DEFAULT 'READY',    -- PROCESSING/READY/CONFIRMED
    mrq_item_count     INTEGER NOT NULL DEFAULT 0,
    mrq_matched_count  INTEGER NOT NULL DEFAULT 0,              -- 추천 1건 이상 확보
    mrq_review_count   INTEGER NOT NULL DEFAULT 0,              -- 검토필요(저신뢰/무후보)
    mrq_confirmed_count INTEGER NOT NULL DEFAULT 0,
    mrq_parse_note     TEXT,                                    -- 컬럼 매핑/파싱 요약(파싱 실패행 등)
    mrq_created_by     UUID,
    mrq_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    mrq_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    mrq_deleted_at     TIMESTAMPTZ,
    CONSTRAINT pk_hsm_match_requests PRIMARY KEY (mrq_id)
);
CREATE INDEX IF NOT EXISTS idx_hsm_match_requests_ent_id ON hsm_match_requests (ent_id);
CREATE INDEX IF NOT EXISTS idx_hsm_match_requests_status ON hsm_match_requests (mrq_status);

-- ---------------------------------------------------------------------
-- hsm_items 에 요청건 FK + 검토 플래그 추가 (품목을 요청건에 그룹핑)
-- ---------------------------------------------------------------------
ALTER TABLE hsm_items ADD COLUMN IF NOT EXISTS mrq_id UUID;
ALTER TABLE hsm_items ADD COLUMN IF NOT EXISTS itm_row_index INTEGER;         -- 업로드 파일 내 원본 행 순번
ALTER TABLE hsm_items ADD COLUMN IF NOT EXISTS itm_needs_review BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE hsm_items ADD COLUMN IF NOT EXISTS itm_raw_source TEXT;            -- 원본 행 원문(감사/재파싱)
CREATE INDEX IF NOT EXISTS idx_hsm_items_mrq_id ON hsm_items (mrq_id);

-- FK (요청건 삭제 시 품목 정리). 이미 있으면 무시.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_hsm_items_hsm_match_requests'
  ) THEN
    ALTER TABLE hsm_items
      ADD CONSTRAINT fk_hsm_items_hsm_match_requests
      FOREIGN KEY (mrq_id) REFERENCES hsm_match_requests (mrq_id) ON DELETE CASCADE;
  END IF;
END $$;

-- =====================================================================
-- End — 적용: docker exec postgres-hscode psql -U hscode_app -d db_hsm -f (이 파일)
-- =====================================================================
