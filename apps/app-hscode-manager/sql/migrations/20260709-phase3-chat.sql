-- =====================================================================
-- HS Code 통관 에이전트 — Phase 3 Q&A 챗봇 (대화형 세션/메시지)
-- 자연어 질문 → RAG(면장+기준표+지식) 근거 대화형 답변, 세션 이력 유지, 되묻기.
-- 대상: PostgreSQL 15. synchronize 비활성 → 수동 적용(스테이징 먼저). 기존 테이블 무변경.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 대화 세션 — 사용자별 Q&A 챗봇 스레드.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_chat_sessions (
    cht_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    ent_id             UUID NOT NULL,
    cht_title          VARCHAR(300),
    cht_created_by     UUID,
    cht_message_count  INTEGER NOT NULL DEFAULT 0,
    cht_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    cht_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    cht_deleted_at     TIMESTAMPTZ,
    CONSTRAINT pk_hsm_chat_sessions PRIMARY KEY (cht_id)
);
CREATE INDEX IF NOT EXISTS idx_hsm_chat_sessions_ent_id ON hsm_chat_sessions (ent_id);
CREATE INDEX IF NOT EXISTS idx_hsm_chat_sessions_created_by ON hsm_chat_sessions (cht_created_by);

-- ---------------------------------------------------------------------
-- 대화 메시지 — USER/ASSISTANT 턴. 후보·근거·되묻기 메타 포함.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hsm_chat_messages (
    msg_id             UUID NOT NULL DEFAULT gen_random_uuid(),
    cht_id             UUID NOT NULL,
    ent_id             UUID NOT NULL,
    msg_role           VARCHAR(12) NOT NULL,                 -- USER/ASSISTANT
    msg_content        TEXT NOT NULL,
    msg_candidates     JSONB,                                -- [{hsCode,confidence,rationale}]
    msg_citations      JSONB,                                -- [{type,ref,text}]
    msg_need_question  BOOLEAN NOT NULL DEFAULT false,
    msg_source         VARCHAR(20),                          -- AI/SEARCH_FALLBACK
    msg_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_hsm_chat_messages PRIMARY KEY (msg_id),
    CONSTRAINT fk_hsm_chat_messages_hsm_chat_sessions
      FOREIGN KEY (cht_id) REFERENCES hsm_chat_sessions (cht_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_hsm_chat_messages_cht_id ON hsm_chat_messages (cht_id);
CREATE INDEX IF NOT EXISTS idx_hsm_chat_messages_ent_id ON hsm_chat_messages (ent_id);

-- =====================================================================
-- End — 적용: docker exec postgres-hscode psql -U hscode_app -d db_hsm -f (이 파일)
-- =====================================================================
