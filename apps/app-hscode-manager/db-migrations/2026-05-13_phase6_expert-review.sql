-- HS Code Manager — Phase 6 ExpertReview
-- 2026-05-13
--
-- Note: ALTER 부분은 00_apply_all.sh 가 컬럼 존재 검증 후 적용 (idempotent).
-- 본 파일은 신규 테이블·인덱스만 포함.

USE db_app_hscode;

-- hsc_expert_keyword_dictionary — 수입금지·제한 키워드 사전 (수입국별)
CREATE TABLE IF NOT EXISTS hsc_expert_keyword_dictionary (
  ekd_id              CHAR(36)     NOT NULL,
  ekd_import_country_code VARCHAR(2) NOT NULL,
  ekd_category        VARCHAR(64)  NOT NULL,   -- prohibited / restricted / requires_local_check
  ekd_keyword         VARCHAR(255) NOT NULL,
  ekd_routing_hint    VARCHAR(32)  NULL,        -- EXPERT_LOCAL / EXPERT_INTERNAL
  ekd_severity        INT          NOT NULL DEFAULT 50,
  ekd_notes           TEXT         NULL,
  ekd_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ekd_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ekd_deleted_at      DATETIME     NULL,
  PRIMARY KEY (ekd_id),
  KEY idx_ekd_country_keyword (ekd_import_country_code, ekd_keyword)
) ENGINE=InnoDB;

-- 기본 시드 — VN 수입금지/제한 키워드 (Phase 7에서 운영팀이 보강)
INSERT IGNORE INTO hsc_expert_keyword_dictionary
  (ekd_id, ekd_import_country_code, ekd_category, ekd_keyword, ekd_routing_hint, ekd_severity)
VALUES
  (UUID(), 'VN', 'prohibited',  'weapon',         'EXPERT_LOCAL', 100),
  (UUID(), 'VN', 'prohibited',  'ammunition',     'EXPERT_LOCAL', 100),
  (UUID(), 'VN', 'prohibited',  'firearm',        'EXPERT_LOCAL', 100),
  (UUID(), 'VN', 'prohibited',  'narcotic',       'EXPERT_LOCAL', 100),
  (UUID(), 'VN', 'restricted',  'precursor',      'EXPERT_LOCAL',  80),
  (UUID(), 'VN', 'restricted',  'explosive',      'EXPERT_LOCAL',  80),
  (UUID(), 'VN', 'restricted',  'radioactive',    'EXPERT_LOCAL',  80),
  (UUID(), 'VN', 'restricted',  'wildlife',       'EXPERT_LOCAL',  70),
  (UUID(), 'VN', 'requires_local_check', 'fta',  'EXPERT_INTERNAL', 40),
  (UUID(), 'VN', 'requires_local_check', 'msds', 'EXPERT_INTERNAL', 30),
  (UUID(), 'VN', 'requires_local_check', 'license_required', 'EXPERT_LOCAL', 60);
