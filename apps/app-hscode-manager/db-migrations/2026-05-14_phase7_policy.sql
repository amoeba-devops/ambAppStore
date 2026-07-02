-- HS Code Manager — Phase 7 PolicyThreshold + UnsupportedCountryRequest
-- 2026-05-14

USE db_app_hscode;

-- 7.1 hsc_policy_thresholds — 수입국별 정책 임계값
CREATE TABLE IF NOT EXISTS hsc_policy_thresholds (
  plt_id              CHAR(36)     NOT NULL,
  plt_import_country_code VARCHAR(2) NULL,        -- NULL = 글로벌 기본값
  plt_key             VARCHAR(64)  NOT NULL,
  plt_value           VARCHAR(255) NOT NULL,      -- string serialize (number/bool/json 모두 가능)
  plt_value_type      VARCHAR(16)  NOT NULL DEFAULT 'number',  -- number/boolean/string/json
  plt_description     TEXT         NULL,
  plt_updated_by      CHAR(36)     NULL,
  plt_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  plt_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  plt_deleted_at      DATETIME     NULL,
  PRIMARY KEY (plt_id),
  UNIQUE KEY uq_plt_country_key (plt_import_country_code, plt_key),
  KEY idx_plt_key (plt_key)
) ENGINE=InnoDB;

-- 기본 정책 시드 (글로벌 = NULL country)
INSERT IGNORE INTO hsc_policy_thresholds
  (plt_id, plt_import_country_code, plt_key, plt_value, plt_value_type, plt_description)
VALUES
  (UUID(), NULL, 'confidence_cutoff',     '0.6',   'number',  '에스컬레이션 트리거 (a) — 신뢰도 임계'),
  (UUID(), NULL, 'tariff_gap_3pp',        '3.0',   'number',  '보수적 세율 룰 — 격차 3%p 이상 임계'),
  (UUID(), NULL, 'tariff_gap_1pp',        '1.0',   'number',  '보수적 세율 룰 — 격차 1%p 임계'),
  (UUID(), NULL, 'escalation_amount_usd', '50000', 'number',  '트리거 (f) — 금액 임계 USD'),
  (UUID(), NULL, 'freshness_months',      '12',    'number',  '내부 매칭 신선도 게이트'),
  (UUID(), NULL, 'internal_skip_threshold', '0.85','number',  '내부 매칭 외부 호출 생략 신뢰도'),
  (UUID(), NULL, 'multi_candidate_gap',   '0.1',   'number',  '트리거 (b) — 1·2위 confidence 격차 임계'),
  (UUID(), NULL, 'completeness_threshold','0.7',   'number',  '완성도 점수 soft block 임계');

-- VN 오버라이드 (베트남 운영팀 정책)
INSERT IGNORE INTO hsc_policy_thresholds
  (plt_id, plt_import_country_code, plt_key, plt_value, plt_value_type, plt_description)
VALUES
  (UUID(), 'VN', 'escalation_amount_usd', '50000', 'number', 'VN 추징 임계 — 운영팀 6개월 단위 재조정'),
  (UUID(), 'VN', 'confidence_cutoff',     '0.6',   'number', NULL);

-- 7.2 hsc_unsupported_country_requests — 미지원 수입국 추가 요청 큐
CREATE TABLE IF NOT EXISTS hsc_unsupported_country_requests (
  ucr_id              CHAR(36)     NOT NULL,
  ucr_ent_id          CHAR(36)     NOT NULL,
  ucr_user_id         CHAR(36)     NULL,
  ucr_user_email      VARCHAR(255) NULL,
  ucr_requested_country_code VARCHAR(2) NOT NULL,
  ucr_business_case   TEXT         NULL,
  ucr_estimated_volume INT         NULL,
  ucr_status          VARCHAR(16)  NOT NULL DEFAULT 'OPEN', -- OPEN / IN_PROGRESS / RESOLVED / REJECTED
  ucr_resolved_at     DATETIME     NULL,
  ucr_resolution_note TEXT         NULL,
  ucr_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ucr_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ucr_id),
  KEY idx_ucr_ent_status (ucr_ent_id, ucr_status),
  KEY idx_ucr_country (ucr_requested_country_code)
) ENGINE=InnoDB;
