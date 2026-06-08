# HS Code Manager — DB Schema

> 본 문서는 `db_app_hscode`의 누적 DDL 정의서다. Phase별로 추가되는 테이블·인덱스·제약조건이 누적된다.
> Amoeba 컨벤션:
> - 테이블 prefix: `hsc_`
> - 컬럼 prefix: 3자리 (테이블별)
> - 멀티테넌시 컬럼: `ent_id CHAR(36) NOT NULL` (글로벌 마스터는 예외)
> - 타임스탬프: `{prefix}_created_at`, `{prefix}_updated_at`, `{prefix}_deleted_at` (Soft delete)
> - PK: `{prefix}_id CHAR(36)` (UUIDv4)

---

## Phase 0 — DB 초기화

```sql
CREATE DATABASE IF NOT EXISTS db_app_hscode
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'hscode_app'@'%' IDENTIFIED BY 'hscode_app_password';
GRANT ALL PRIVILEGES ON db_app_hscode.* TO 'hscode_app'@'%';
FLUSH PRIVILEGES;
```

---

## Phase 1 — 마스터 데이터

### 1.1 `hsc_import_countries` (수입국 마스터, 글로벌)

```sql
CREATE TABLE hsc_import_countries (
  imc_id              CHAR(36)     NOT NULL,
  imc_code            VARCHAR(2)   NOT NULL,                        -- ISO 3166-1 alpha-2
  imc_name_ko         VARCHAR(100) NOT NULL,
  imc_name_en         VARCHAR(100) NOT NULL,
  imc_name_vi         VARCHAR(100) NOT NULL,
  imc_support_status  ENUM('ACTIVE','BETA','NOT_SUPPORTED')
                        NOT NULL DEFAULT 'NOT_SUPPORTED',
  imc_adapter_key     VARCHAR(64)  NULL,                            -- e.g. bieu_thue_xnk_2026
  imc_currency_code   VARCHAR(3)   NULL,                            -- USD, VND, KRW
  imc_default_tariff_currency VARCHAR(3) NULL,
  imc_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  imc_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  imc_deleted_at      DATETIME     NULL,
  PRIMARY KEY (imc_id),
  UNIQUE KEY uq_imc_code (imc_code)
) ENGINE=InnoDB;
```

### 1.2 `hsc_export_countries` (수출국 마스터, 글로벌)

```sql
CREATE TABLE hsc_export_countries (
  exc_id              CHAR(36)     NOT NULL,
  exc_code            VARCHAR(2)   NOT NULL,
  exc_name_ko         VARCHAR(100) NOT NULL,
  exc_name_en         VARCHAR(100) NOT NULL,
  exc_name_vi         VARCHAR(100) NOT NULL,
  exc_is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  exc_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exc_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  exc_deleted_at      DATETIME     NULL,
  PRIMARY KEY (exc_id),
  UNIQUE KEY uq_exc_code (exc_code)
) ENGINE=InnoDB;
```

### 1.3 `hsc_exporters` (수출업체 마스터, ent_id 격리)

```sql
CREATE TABLE hsc_exporters (
  exp_id              CHAR(36)     NOT NULL,
  exp_ent_id          CHAR(36)     NOT NULL,
  exp_name            VARCHAR(255) NOT NULL,
  exp_country_code    VARCHAR(2)   NOT NULL,
  exp_aliases         JSON         NULL,                            -- ["ABC Co.", "ABC Corp."]
  exp_risk_flags      JSON         NULL,                            -- {"strict_check": true, "memo": "..."}
  exp_memo            TEXT         NULL,
  exp_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exp_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  exp_deleted_at      DATETIME     NULL,
  PRIMARY KEY (exp_id),
  KEY idx_exporters_ent_name (exp_ent_id, exp_name),
  KEY idx_exporters_ent_country (exp_ent_id, exp_country_code)
) ENGINE=InnoDB;
```

### 1.4 `hsc_external_data_sources` (외부 어댑터 등록, 글로벌)

```sql
CREATE TABLE hsc_external_data_sources (
  eds_id                CHAR(36)     NOT NULL,
  eds_adapter_key       VARCHAR(64)  NOT NULL,                      -- code-side key
  eds_import_country_code VARCHAR(2) NOT NULL,
  eds_display_name      VARCHAR(255) NOT NULL,
  eds_endpoint_url      VARCHAR(500) NULL,
  eds_cache_ttl_sec     INT          NOT NULL DEFAULT 86400,
  eds_is_active         TINYINT(1)   NOT NULL DEFAULT 0,
  eds_priority          INT          NOT NULL DEFAULT 100,          -- 작을수록 1차 권위
  eds_config            JSON         NULL,                          -- adapter-specific config
  eds_created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eds_updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eds_deleted_at        DATETIME     NULL,
  PRIMARY KEY (eds_id),
  UNIQUE KEY uq_eds_adapter_key (eds_adapter_key),
  KEY idx_eds_country_priority (eds_import_country_code, eds_priority)
) ENGINE=InnoDB;
```

### 1.5 `hsc_fta_matrix` (FTA 협정세율 매트릭스, 글로벌)

```sql
CREATE TABLE hsc_fta_matrix (
  fta_id                   CHAR(36)      NOT NULL,
  fta_import_country_code  VARCHAR(2)    NOT NULL,
  fta_export_country_code  VARCHAR(2)    NOT NULL,
  fta_agreement_code       VARCHAR(16)   NOT NULL,                  -- VKFTA, AKFTA, ATIGA, RCEP
  fta_hs_code              VARCHAR(16)   NOT NULL,
  fta_rate                 DECIMAL(6,3)  NOT NULL,
  fta_effective_from       DATE          NOT NULL,
  fta_effective_to         DATE          NULL,
  fta_memo                 VARCHAR(500)  NULL,
  fta_created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fta_updated_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  fta_deleted_at           DATETIME      NULL,
  PRIMARY KEY (fta_id),
  UNIQUE KEY uq_fta_lookup
    (fta_import_country_code, fta_export_country_code,
     fta_agreement_code, fta_hs_code, fta_effective_from),
  KEY idx_fta_lookup_hs
    (fta_import_country_code, fta_export_country_code, fta_hs_code),
  KEY idx_fta_effective_range (fta_effective_from, fta_effective_to)
) ENGINE=InnoDB;
```

---

---

## Phase 2 — 입력 채널 (Intake)

### 2.1 `hsc_inquiries` (문의 단위, ent_id 격리)

```sql
CREATE TABLE hsc_inquiries (
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
```

상태: `DRAFT → INTAKE → MATCHING → REVIEWING → RESPONDED → VERIFIED | DISPUTED`

### 2.2 `hsc_items` (물품 마스터, ent_id 격리)

```sql
CREATE TABLE hsc_items (
  itm_id                  CHAR(36)     NOT NULL,
  itm_ent_id              CHAR(36)     NOT NULL,
  itm_inquiry_id          CHAR(36)     NULL,  -- 어떤 문의에서 등록되었는지
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
```

### 2.3 `hsc_excel_import_batches`

```sql
CREATE TABLE hsc_excel_import_batches (
  eib_id              CHAR(36)     NOT NULL,
  eib_ent_id          CHAR(36)     NOT NULL,
  eib_inquiry_id      CHAR(36)     NOT NULL,
  eib_filename        VARCHAR(500) NOT NULL,
  eib_total_rows      INT          NOT NULL DEFAULT 0,
  eib_imported_rows   INT          NOT NULL DEFAULT 0,
  eib_hold_rows       INT          NOT NULL DEFAULT 0,
  eib_mapping_snapshot JSON        NULL,
  eib_status          VARCHAR(16)  NOT NULL DEFAULT 'PENDING',  -- PENDING/IMPORTED/PARTIAL/FAILED
  eib_created_by      CHAR(36)     NULL,
  eib_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eib_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (eib_id),
  KEY idx_excel_batches_ent_inquiry (eib_ent_id, eib_inquiry_id)
) ENGINE=InnoDB;
```

### 2.4 `hsc_excel_hold_rows`

```sql
CREATE TABLE hsc_excel_hold_rows (
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
```

### 2.5 `hsc_excel_mapping_profiles`

```sql
CREATE TABLE hsc_excel_mapping_profiles (
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
```

> 카테고리 스키마는 Phase 2 MVP에서는 *코드 상수*로 제공하고, Phase 7에서 DB(`hsc_category_schemas`) 로 이전한다.

---

## Phase 3 — 매칭·추천 엔진

### 3.1 `hsc_authority_hs_codes` (외부 권위 데이터 시드, 글로벌)

```sql
CREATE TABLE hsc_authority_hs_codes (
  auh_id                CHAR(36)     NOT NULL,
  auh_import_country_code VARCHAR(2) NOT NULL,
  auh_adapter_key       VARCHAR(64)  NOT NULL,
  auh_hs_code           VARCHAR(16)  NOT NULL,
  auh_description_local TEXT         NULL,
  auh_description_en    TEXT         NULL,
  auh_keywords          JSON         NULL,
  auh_category_hints    JSON         NULL,
  auh_tariff_rate       DECIMAL(6,3) NULL,
  auh_import_requirements JSON       NULL,
  auh_effective_from    DATE         NULL,
  auh_effective_to      DATE         NULL,
  auh_created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  auh_updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  auh_deleted_at        DATETIME     NULL,
  PRIMARY KEY (auh_id),
  KEY idx_auh_country_adapter (auh_import_country_code, auh_adapter_key),
  KEY idx_auh_hs_code (auh_hs_code)
) ENGINE=InnoDB;
```

### 3.2 `hsc_ai_recommendation_logs`

```sql
CREATE TABLE hsc_ai_recommendation_logs (
  arl_id                  CHAR(36)     NOT NULL,
  arl_ent_id              CHAR(36)     NOT NULL,
  arl_inquiry_id          CHAR(36)     NULL,
  arl_item_id             CHAR(36)     NULL,
  arl_classification_id   CHAR(36)     NULL,
  arl_prompt_hash         CHAR(32)     NOT NULL,
  arl_model_version       VARCHAR(64)  NOT NULL,
  arl_status              VARCHAR(16)  NOT NULL,
  arl_latency_ms          INT          NULL,
  arl_cost_usd            DECIMAL(8,5) NULL,
  arl_hallucinated_count  INT          NULL,
  arl_candidate_count     INT          NULL,
  arl_payload_blob_uri    VARCHAR(500) NULL,
  arl_created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (arl_id),
  KEY idx_arl_ent_inquiry (arl_ent_id, arl_inquiry_id),
  KEY idx_arl_created (arl_created_at)
) ENGINE=InnoDB;
```

`arl_status` 값: `OK` / `PARSE_FAIL` / `HALLUCINATED` / `TIMEOUT` / `API_ERROR` / `MOCK`

---

## Phase 4 — 컨펌·영속화

### 4.1 ALTER `hsc_classifications`

```sql
ALTER TABLE hsc_classifications
  ADD COLUMN cls_fta_agreement_code VARCHAR(16) NULL AFTER cls_fta_tariff_rate,
  ADD COLUMN cls_created_by CHAR(36) NULL AFTER cls_superseded_by_id;
```

상태 머신:
```
PROPOSED → ADOPTED → SUPERSEDED  (정정 시)
                 → SEALED        (세관 확인 후)
                 → DISPUTED      (분쟁 발생 시)
```
ADOPTED 이상 상태는 *직접 수정 차단* — 정정은 새 레코드 + 기존 SUPERSEDED 처리만 허용.

### 4.2 `hsc_classification_candidates` (후보 N개)

```sql
CREATE TABLE hsc_classification_candidates (
  cnd_id                  CHAR(36)     NOT NULL,
  cnd_ent_id              CHAR(36)     NOT NULL,
  cnd_classification_id   CHAR(36)     NOT NULL,
  cnd_hs_code             VARCHAR(16)  NOT NULL,
  cnd_description         TEXT         NULL,
  cnd_basic_tariff_rate   DECIMAL(6,3) NULL,
  cnd_fta_tariff_rate     DECIMAL(6,3) NULL,
  cnd_fta_agreement_code  VARCHAR(16)  NULL,
  cnd_source              VARCHAR(16)  NOT NULL,
  cnd_ranking             INT          NOT NULL,
  cnd_confidence          DECIMAL(4,3) NULL,
  cnd_reasoning           TEXT         NULL,
  cnd_source_citations    JSON         NULL,
  cnd_external_adapter_keys JSON       NULL,
  cnd_flags               JSON         NULL,
  cnd_past_adoption_count INT          NOT NULL DEFAULT 0,
  cnd_created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cnd_id),
  KEY idx_cnd_classification (cnd_classification_id),
  KEY idx_cnd_classification_rank (cnd_classification_id, cnd_ranking)
) ENGINE=InnoDB;
```

### 4.3 `hsc_audit_logs` (NFR-SE-02)

```sql
CREATE TABLE hsc_audit_logs (
  aud_id          CHAR(36)     NOT NULL,
  aud_ent_id      CHAR(36)     NOT NULL,
  aud_user_id     CHAR(36)     NULL,
  aud_user_email  VARCHAR(255) NULL,
  aud_action      VARCHAR(32)  NOT NULL,
  aud_target_table VARCHAR(64) NOT NULL,
  aud_target_id   VARCHAR(64)  NULL,
  aud_diff_json   JSON         NULL,
  aud_ip          VARCHAR(45)  NULL,
  aud_user_agent  VARCHAR(500) NULL,
  aud_request_id  VARCHAR(64)  NULL,
  aud_created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (aud_id),
  KEY idx_audit_ent_created (aud_ent_id, aud_created_at),
  KEY idx_audit_target (aud_target_table, aud_target_id)
) ENGINE=InnoDB;
```

Append-only 정책 — UPDATE/DELETE는 운영 권한으로도 차단 (DB grant 별도 분리 권장).

---

## Phase 5~7 (예정)

Phase 5 — VerificationEvent, ReviewQueue
Phase 6 — ExpertReview
Phase 7 — PolicyThreshold, UnsupportedCountryRequest, CategorySchema(메타 이전)

> 각 Phase 진입 시 본 문서의 해당 섹션을 누적 작성한다.

---

## 시드 데이터 (Phase 1)

### 수입국 시드 (`seed-import-countries.sql`)

```sql
INSERT INTO hsc_import_countries (imc_id, imc_code, imc_name_ko, imc_name_en, imc_name_vi, imc_support_status, imc_adapter_key, imc_currency_code) VALUES
  (UUID(), 'VN', '베트남', 'Vietnam', 'Việt Nam', 'ACTIVE', 'bieu_thue_xnk_2026', 'VND'),
  (UUID(), 'KR', '한국',   'South Korea', 'Hàn Quốc', 'ACTIVE', 'kr_customs', 'KRW'),
  (UUID(), 'TH', '태국',   'Thailand', 'Thái Lan', 'BETA',  NULL, 'THB'),
  (UUID(), 'ID', '인도네시아', 'Indonesia', 'Indonesia', 'NOT_SUPPORTED', NULL, 'IDR'),
  (UUID(), 'JP', '일본',   'Japan',    'Nhật Bản', 'NOT_SUPPORTED', NULL, 'JPY'),
  (UUID(), 'CN', '중국',   'China',    'Trung Quốc', 'NOT_SUPPORTED', NULL, 'CNY');
```

### 수출국 시드 (`seed-export-countries.sql`)

```sql
INSERT INTO hsc_export_countries (exc_id, exc_code, exc_name_ko, exc_name_en, exc_name_vi, exc_is_active) VALUES
  (UUID(), 'KR', '한국',   'South Korea', 'Hàn Quốc', 1),
  (UUID(), 'CN', '중국',   'China',       'Trung Quốc', 1),
  (UUID(), 'JP', '일본',   'Japan',       'Nhật Bản', 1),
  (UUID(), 'VN', '베트남', 'Vietnam',     'Việt Nam', 1),
  (UUID(), 'TH', '태국',   'Thailand',    'Thái Lan', 1),
  (UUID(), 'TW', '대만',   'Taiwan',      'Đài Loan', 1),
  (UUID(), 'US', '미국',   'United States', 'Hoa Kỳ', 1),
  (UUID(), 'DE', '독일',   'Germany',     'Đức', 1);
```

### 외부 데이터 소스 시드

```sql
INSERT INTO hsc_external_data_sources
  (eds_id, eds_adapter_key, eds_import_country_code, eds_display_name, eds_cache_ttl_sec, eds_is_active, eds_priority)
VALUES
  (UUID(), 'bieu_thue_xnk_2026', 'VN', 'Vietnam BIEU THUE XNK 2026', 86400, 1, 10),
  (UUID(), 'kr_customs',         'KR', 'Korea Customs HS Lookup',     86400, 1, 20);
```
