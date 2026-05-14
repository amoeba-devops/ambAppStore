-- HS Code Manager — Phase 5 Verification + ReviewQueue
-- 2026-05-13
--
-- Note: ALTER TABLE 부분은 00_apply_all.sh 가 컬럼 존재 검증 후 적용 (idempotent).
-- 본 파일은 신규 테이블 CREATE 만 포함.

USE db_app_hscode;

-- hsc_review_queue — 재검토 큐
CREATE TABLE IF NOT EXISTS hsc_review_queue (
  rvq_id              CHAR(36)     NOT NULL,
  rvq_ent_id          CHAR(36)     NOT NULL,
  rvq_target_type     VARCHAR(32)  NOT NULL,
  rvq_target_id       CHAR(36)     NOT NULL,
  rvq_trigger_event_id CHAR(36)    NULL,
  rvq_reason          VARCHAR(64)  NOT NULL,
  rvq_priority        INT          NOT NULL DEFAULT 100,
  rvq_resolved_at     DATETIME     NULL,
  rvq_resolved_by     CHAR(36)     NULL,
  rvq_notes           TEXT         NULL,
  rvq_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rvq_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rvq_id),
  KEY idx_rvq_ent_resolved (rvq_ent_id, rvq_resolved_at),
  KEY idx_rvq_target (rvq_target_type, rvq_target_id),
  KEY idx_rvq_priority (rvq_ent_id, rvq_priority, rvq_resolved_at)
) ENGINE=InnoDB;
