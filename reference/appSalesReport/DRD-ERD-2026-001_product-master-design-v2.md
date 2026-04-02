# Product & Item Master — ERD v2.0 (Amoeba Code Convention v2 준수)

---
```
document_id : DRD-ERD-2026-001
version     : 2.0.0
status      : Draft
created     : 2026-04-02
updated     : 2026-04-02
author      : Amoeba Company
change_log  :
  - version: 1.0.0
    date: 2026-04-02
    description: Initial draft
  - version: 2.0.0
    date: 2026-04-02
    description: |
      Amoeba Code Convention v2 기준 전면 재작성
      - 테이블명 복수형 적용
      - 컬럼명 전체 {colPrefix}_{name} 3자리 접두사 적용
      - PK: {colPrefix}_id (UUID)
      - FK: 참조 테이블 PK 그대로 사용
      - Boolean: {colPrefix}_is_{name}
      - Soft Delete: {colPrefix}_deleted_at 추가
      - 멀티테넌시: ent_id FK 추가
      - 제약조건명: pk_ / uq_ / fk_ / idx_ / ck_ 규칙 적용
      - uix_ → uq_ / ix_ → idx_ 전면 변경
```

---

## 1. Convention Gap Analysis (컨벤션 준수 점검)

> 기준: `amoeba_code_convention_v2.md`

### ❌ 위반 항목 목록 (v1.0 기준)

| 항목 | 위반 규칙 | 위반 내용 | 수정 방향 |
|------|----------|----------|----------|
| **테이블명** | 4.2: 복수형 필수 | `drd_spu_master` → singular | `drd_spu_masters` |
| **테이블명** | 4.2: 복수형 필수 | `drd_sku_master` | `drd_sku_masters` |
| **테이블명** | 4.2: 복수형 필수 | `drd_channel_master` | `drd_channel_masters` |
| **테이블명** | 4.2: 복수형 필수 | `drd_channel_product_mapping` | `drd_channel_product_mappings` |
| **테이블명** | 4.2: 복수형 필수 | `drd_sku_cost_history` | `drd_sku_cost_histories` |
| **PK 컬럼명** | 4.3: `{colPrefix}_id` | `id` (접두사 없음) | `spu_id`, `sku_id`, `cpm_id` ... |
| **일반 컬럼명** | 4.3: `{colPrefix}_{name}` | `spu_code`, `brand_code`, `name_kr` 등 전체 | 전체 `{colPrefix}_` 적용 |
| **Boolean 컬럼** | 4.3: `{colPrefix}_is_{name}` | `is_active`, `is_api_integrated` | `spu_is_active`, `chn_is_api_integrated` |
| **Timestamp 컬럼** | 4.3: `{colPrefix}_created_at` | `created_at`, `updated_at` (접두사 없음) | `spu_created_at` 형식으로 전체 |
| **Soft Delete** | 4.3: `{colPrefix}_deleted_at` MUST | 미존재 | 전체 테이블에 `_deleted_at` 추가 |
| **멀티테넌시** | 4.3 / 12.1: `ent_id` FK MUST | 미존재 | 데이터 테이블 전체에 `ent_id` 추가 |
| **UNIQUE 제약명** | 4.4: `uq_{table}_{col}` | `uix_*` 사용 | `uq_*` 으로 전체 변경 |
| **INDEX 제약명** | 4.4: `idx_{table}_{col}` | `ix_*` 사용 | `idx_*` 으로 전체 변경 |
| **FK 제약명** | 4.4: `fk_{table}_{ref_table}` | `fk_{table}_{col}` 사용 | 참조 테이블명 기준으로 변경 |
| **PK 제약명** | 4.4: `pk_{table}` | `pk_spu_master` (테이블명 불일치) | `pk_drd_spu_masters` |
| **FK 컬럼값** | 4.3: 참조 테이블 PK 그대로 | `channel_code` (임의 이름) | `chn_code` (참조 테이블 PK 사용) |

### ✅ 준수 항목 (v1.0 기준)

| 항목 | 규칙 | 내용 |
|------|------|------|
| DB 이름 | `db_{project}` | `db_drd` ✅ |
| 테이블 prefix | `{3글자}_` | `drd_` ✅ |
| snake_case | 전체 | ✅ |
| UUID PK 사용 | PK는 UUID | ✅ |

---

## 2. Column Prefix 매핑표 (v2.0 확정)

| 테이블명 | colPrefix | 비고 |
|---------|---------|------|
| `drd_spu_masters` | `spu_` | SPU 마스터 |
| `drd_sku_masters` | `sku_` | SKU / 품목 마스터 |
| `drd_channel_masters` | `chn_` | 채널 마스터 |
| `drd_channel_product_mappings` | `cpm_` | 채널-SKU 매핑 |
| `drd_sku_cost_histories` | `sch_` | 원가 변경 이력 |

---

## 3. ERD (v2.0 — Amoeba Convention 준수)

```mermaid
erDiagram

    %% ─── SPU 마스터 ───────────────────────────────────────────────
    drd_spu_masters {
        UUID        spu_id              PK    "SPU ID"
        UUID        ent_id              FK    "멀티테넌시 법인 ID (MUST)"
        VARCHAR7    spu_code            UK    "WMS 앞 7자리 (예: SAFG18U)"
        VARCHAR10   spu_brand_code            "브랜드 코드 (예: SB)"
        VARCHAR20   spu_sub_brand       NULL  "서브 브랜드 (예: Firgi)"
        VARCHAR200  spu_name_kr               "상품명 한국어"
        VARCHAR200  spu_name_en               "상품명 영어"
        VARCHAR200  spu_name_vi               "상품명 베트남어"
        VARCHAR20   spu_category_code   NULL  "카테고리 코드"
        VARCHAR100  spu_category_name   NULL  "카테고리명"
        BOOLEAN     spu_is_active             "활성 여부"
        TIMESTAMP   spu_created_at            "생성일시"
        TIMESTAMP   spu_updated_at            "수정일시"
        TIMESTAMP   spu_deleted_at      NULL  "삭제일시 (Soft Delete)"
    }

    %% ─── SKU 마스터 (품목 관리) ────────────────────────────────────
    drd_sku_masters {
        UUID        sku_id              PK    "MasterProductItemCode (UUID)"
        UUID        ent_id              FK    "멀티테넌시 법인 ID (MUST)"
        UUID        spu_id              FK    "→ drd_spu_masters.spu_id"
        VARCHAR12   sku_wms_code        UK    "WMS 코드 (예: SAFG18U0008)"
        VARCHAR7    sku_spu_code              "SPU Code 보조 (검색용)"
        VARCHAR200  sku_name_kr               "품목명 한국어"
        VARCHAR200  sku_name_en               "품목명 영어"
        VARCHAR200  sku_name_vi               "품목명 베트남어"
        VARCHAR50   sku_variant_type    NULL  "옵션 유형 (Color / Color+Size)"
        VARCHAR100  sku_variant_value   NULL  "옵션 값 (예: Pastel Pink)"
        VARCHAR50   sku_sync_code       NULL  "외부 싱크용 코드"
        VARCHAR20   sku_gtin_code       NULL  "국제상품바코드 (EAN-13)"
        VARCHAR20   sku_hs_code         NULL  "HS Code (관세 분류)"
        DECIMAL     sku_prime_cost            "매입원가 VND (FOB)"
        DECIMAL     sku_supply_price    NULL  "공급가 VND"
        DECIMAL     sku_listing_price   NULL  "등록 정가 VND"
        DECIMAL     sku_selling_price   NULL  "실판매가 VND"
        DECIMAL     sku_fulfillment_fee_override NULL "단위 창고처리비 (NULL=기본값)"
        INTEGER     sku_weight_gram     NULL  "무게 g"
        VARCHAR10   sku_unit            NULL  "단위 EA/SET"
        BOOLEAN     sku_is_active             "활성 여부"
        DATE        sku_cost_updated_at NULL  "원가 최종 수정일"
        TIMESTAMP   sku_created_at            "생성일시"
        TIMESTAMP   sku_updated_at            "수정일시"
        TIMESTAMP   sku_deleted_at      NULL  "삭제일시 (Soft Delete)"
    }

    %% ─── 채널 마스터 ────────────────────────────────────────────────
    drd_channel_masters {
        VARCHAR20   chn_code            PK    "채널 코드 (SHOPEE/TIKTOK...)"
        VARCHAR100  chn_name                  "채널명"
        VARCHAR20   chn_type                  "MARKETPLACE/OWN/B2B/OFFLINE"
        DECIMAL     chn_default_platform_fee_rate NULL "기본 수수료율"
        DECIMAL     chn_default_fulfillment_fee   NULL "기본 창고처리비"
        BOOLEAN     chn_is_api_integrated         "API 연동 여부"
        BOOLEAN     chn_is_active                 "활성 여부"
        TIMESTAMP   chn_created_at               "생성일시"
        TIMESTAMP   chn_updated_at               "수정일시"
    }

    %% ─── 채널-SKU 매핑 ──────────────────────────────────────────────
    drd_channel_product_mappings {
        UUID        cpm_id              PK    "매핑 ID"
        UUID        ent_id              FK    "멀티테넌시 법인 ID (MUST)"
        UUID        sku_id              FK    "→ drd_sku_masters.sku_id"
        VARCHAR20   chn_code            FK    "→ drd_channel_masters.chn_code"
        VARCHAR50   cpm_channel_product_id   NULL  "채널 상품 ID"
        VARCHAR50   cpm_channel_variation_id NULL  "채널 옵션 ID"
        VARCHAR300  cpm_channel_name_vi      NULL  "채널 등록 베트남어명"
        DECIMAL     cpm_listing_price        NULL  "채널 등록 정가"
        DECIMAL     cpm_selling_price        NULL  "채널 실판매가"
        BOOLEAN     cpm_is_active                  "활성 여부"
        TIMESTAMP   cpm_created_at                 "생성일시"
        TIMESTAMP   cpm_updated_at                 "수정일시"
        TIMESTAMP   cpm_deleted_at           NULL  "삭제일시 (Soft Delete)"
    }

    %% ─── 원가 변경 이력 ─────────────────────────────────────────────
    drd_sku_cost_histories {
        UUID        sch_id              PK    "이력 ID"
        UUID        ent_id              FK    "멀티테넌시 법인 ID (MUST)"
        UUID        sku_id              FK    "→ drd_sku_masters.sku_id"
        DECIMAL     sch_prime_cost            "변경된 매입원가"
        DECIMAL     sch_supply_price    NULL  "공급가"
        DECIMAL     sch_listing_price   NULL  "등록 정가"
        DECIMAL     sch_selling_price   NULL  "실판매가"
        DATE        sch_effective_date        "적용 시작일"
        VARCHAR200  sch_memo            NULL  "변경 사유"
        VARCHAR100  sch_created_by            "변경자"
        TIMESTAMP   sch_created_at            "생성일시"
    }

    %% ─── 관계 ──────────────────────────────────────────────────────
    drd_spu_masters             ||--o{ drd_sku_masters              : "spu_id"
    drd_sku_masters             ||--o{ drd_channel_product_mappings  : "sku_id"
    drd_channel_masters         ||--o{ drd_channel_product_mappings  : "chn_code"
    drd_sku_masters             ||--o{ drd_sku_cost_histories        : "sku_id"
```

---

## 4. SQL DDL (v2.0 — Convention 완전 준수)

### 4.1 `drd_spu_masters`

```sql
-- ============================================================
-- DB: db_drd
-- Table: drd_spu_masters
-- colPrefix: spu_
-- ============================================================
CREATE TABLE drd_spu_masters (
    spu_id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    ent_id              UUID            NOT NULL,                        -- 멀티테넌시 (MUST)
    spu_code            VARCHAR(7)      NOT NULL,                        -- WMS 앞 7자리
    spu_brand_code      VARCHAR(10)     NOT NULL,                        -- SB, MB 등
    spu_sub_brand       VARCHAR(20)         NULL,                        -- Firgi / LittleCloud
    spu_name_kr         VARCHAR(200)    NOT NULL,
    spu_name_en         VARCHAR(200)    NOT NULL,
    spu_name_vi         VARCHAR(200)    NOT NULL,
    spu_category_code   VARCHAR(20)         NULL,
    spu_category_name   VARCHAR(100)        NULL,
    spu_is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    spu_created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    spu_updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    spu_deleted_at      TIMESTAMPTZ         NULL,                        -- Soft Delete (MUST)

    CONSTRAINT pk_drd_spu_masters         PRIMARY KEY (spu_id),
    CONSTRAINT uq_drd_spu_masters_code    UNIQUE (ent_id, spu_code)
);

-- 인덱스
CREATE INDEX idx_drd_spu_masters_ent_id      ON drd_spu_masters (ent_id);
CREATE INDEX idx_drd_spu_masters_brand       ON drd_spu_masters (spu_brand_code);
CREATE INDEX idx_drd_spu_masters_is_active   ON drd_spu_masters (spu_is_active);
CREATE INDEX idx_drd_spu_masters_deleted     ON drd_spu_masters (spu_deleted_at);

-- 코멘트
COMMENT ON TABLE  drd_spu_masters             IS 'SPU 마스터 - 상품 그룹 단위';
COMMENT ON COLUMN drd_spu_masters.spu_id      IS 'SPU UUID PK';
COMMENT ON COLUMN drd_spu_masters.ent_id      IS '멀티테넌시 법인 ID';
COMMENT ON COLUMN drd_spu_masters.spu_code    IS 'WMS Code 앞 7자리. 예: SAFG18U';
COMMENT ON COLUMN drd_spu_masters.spu_deleted_at IS 'Soft Delete. NULL = 정상, 값 있음 = 삭제';
```

---

### 4.2 `drd_sku_masters`

```sql
-- ============================================================
-- Table: drd_sku_masters
-- colPrefix: sku_
-- ============================================================
CREATE TABLE drd_sku_masters (
    sku_id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    ent_id                      UUID            NOT NULL,               -- 멀티테넌시 (MUST)
    spu_id                      UUID            NOT NULL,               -- FK → drd_spu_masters
    sku_wms_code                VARCHAR(12)     NOT NULL,               -- WMS 자체 관리코드
    sku_spu_code                VARCHAR(7)      NOT NULL,               -- SPU Code 검색 보조
    sku_name_kr                 VARCHAR(200)    NOT NULL,
    sku_name_en                 VARCHAR(200)    NOT NULL,
    sku_name_vi                 VARCHAR(200)    NOT NULL,
    sku_variant_type            VARCHAR(50)         NULL,               -- Color / Color+Size
    sku_variant_value           VARCHAR(100)        NULL,               -- Pastel Pink 등
    sku_sync_code               VARCHAR(50)         NULL,               -- 외부 싱크용 코드
    sku_gtin_code               VARCHAR(20)         NULL,               -- EAN-13 / UPC-A
    sku_hs_code                 VARCHAR(20)         NULL,               -- HS Code
    sku_prime_cost              DECIMAL(15,2)   NOT NULL,               -- 매입원가 VND
    sku_supply_price            DECIMAL(15,2)       NULL,               -- 공급가 VND
    sku_listing_price           DECIMAL(15,2)       NULL,               -- 등록 정가 VND
    sku_selling_price           DECIMAL(15,2)       NULL,               -- 실판매가 VND
    sku_fulfillment_fee_override DECIMAL(10,2)      NULL,               -- NULL = 시스템 기본값
    sku_weight_gram             INTEGER             NULL,
    sku_unit                    VARCHAR(10)         NULL DEFAULT 'EA',
    sku_is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    sku_cost_updated_at         DATE                NULL,               -- 원가 최종 수정일
    sku_created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    sku_updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    sku_deleted_at              TIMESTAMPTZ         NULL,               -- Soft Delete (MUST)

    CONSTRAINT pk_drd_sku_masters           PRIMARY KEY (sku_id),
    CONSTRAINT uq_drd_sku_masters_wms_code  UNIQUE (ent_id, sku_wms_code),
    CONSTRAINT fk_drd_sku_masters_spu_masters
        FOREIGN KEY (spu_id) REFERENCES drd_spu_masters (spu_id),
    CONSTRAINT ck_drd_sku_masters_prime_cost
        CHECK (sku_prime_cost >= 0)
);

-- 인덱스
CREATE INDEX idx_drd_sku_masters_ent_id     ON drd_sku_masters (ent_id);
CREATE INDEX idx_drd_sku_masters_spu_id     ON drd_sku_masters (spu_id);
CREATE INDEX idx_drd_sku_masters_spu_code   ON drd_sku_masters (sku_spu_code);
CREATE INDEX idx_drd_sku_masters_gtin       ON drd_sku_masters (sku_gtin_code);
CREATE INDEX idx_drd_sku_masters_is_active  ON drd_sku_masters (sku_is_active);
CREATE INDEX idx_drd_sku_masters_deleted    ON drd_sku_masters (sku_deleted_at);

-- 코멘트
COMMENT ON TABLE  drd_sku_masters                       IS 'SKU 마스터 - 품목 관리 테이블 (MasterProductItemCode)';
COMMENT ON COLUMN drd_sku_masters.sku_id                IS 'MasterProductItemCode - 전 채널 공통 UUID PK';
COMMENT ON COLUMN drd_sku_masters.ent_id                IS '멀티테넌시 법인 ID';
COMMENT ON COLUMN drd_sku_masters.sku_wms_code          IS 'WMS 관리 코드. 예: SAFG18U0008';
COMMENT ON COLUMN drd_sku_masters.sku_spu_code          IS 'sku_wms_code 앞 7자리. 검색 보조용';
COMMENT ON COLUMN drd_sku_masters.sku_sync_code         IS '외부 ERP/WMS 싱크용 코드';
COMMENT ON COLUMN drd_sku_masters.sku_gtin_code         IS '국제상품바코드 EAN-13/UPC-A';
COMMENT ON COLUMN drd_sku_masters.sku_hs_code           IS 'HS Code 관세 분류코드';
COMMENT ON COLUMN drd_sku_masters.sku_prime_cost        IS '매입원가 VND (FOB 기준)';
COMMENT ON COLUMN drd_sku_masters.sku_supply_price      IS '공급가 - 플랫폼 수수료/할인 제외 셀러 수취 기준가';
COMMENT ON COLUMN drd_sku_masters.sku_listing_price     IS '등록 정가 - GMV 산정 기준가';
COMMENT ON COLUMN drd_sku_masters.sku_selling_price     IS '실판매가 - 할인 적용 판매가';
COMMENT ON COLUMN drd_sku_masters.sku_fulfillment_fee_override
    IS 'NULL이면 시스템 기본값(14,000 VND/unit) 자동 적용';
COMMENT ON COLUMN drd_sku_masters.sku_deleted_at        IS 'Soft Delete. NULL = 정상';
```

---

### 4.3 `drd_channel_masters`

```sql
-- ============================================================
-- Table: drd_channel_masters
-- colPrefix: chn_
-- Note: 채널 마스터는 글로벌 공용 설정 테이블 → ent_id 없음
-- ============================================================
CREATE TABLE drd_channel_masters (
    chn_code                        VARCHAR(20)     NOT NULL,
    chn_name                        VARCHAR(100)    NOT NULL,
    chn_type                        VARCHAR(20)     NOT NULL,           -- MARKETPLACE/OWN/B2B/OFFLINE/INFLUENCER
    chn_default_platform_fee_rate   DECIMAL(5,4)        NULL,
    chn_default_fulfillment_fee     DECIMAL(10,2)       NULL DEFAULT 14000,
    chn_is_api_integrated           BOOLEAN         NOT NULL DEFAULT FALSE,
    chn_is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    chn_created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    chn_updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_drd_channel_masters       PRIMARY KEY (chn_code),
    CONSTRAINT ck_drd_channel_masters_type
        CHECK (chn_type IN ('MARKETPLACE','OWN','B2B','OFFLINE','INFLUENCER'))
);

-- 코멘트
COMMENT ON TABLE  drd_channel_masters IS '채널 마스터 - 전체 판매 채널 목록 (글로벌 공용)';
COMMENT ON COLUMN drd_channel_masters.chn_code IS 'PK 채널 코드. SHOPEE/TIKTOK/OWN_WEB/OFFLINE/B2B/INFLUENCER/AMOEBA_SHOP/AMAZON';
COMMENT ON COLUMN drd_channel_masters.chn_type IS 'MARKETPLACE: 마켓플레이스 / OWN: 자체몰 / B2B: 도매 / OFFLINE: 오프라인 / INFLUENCER: 인플루언서';
COMMENT ON COLUMN drd_channel_masters.chn_default_fulfillment_fee IS '채널 기본 창고처리비 (기본값: 14,000 VND/unit)';

-- 초기 데이터
INSERT INTO drd_channel_masters
    (chn_code, chn_name, chn_type, chn_default_platform_fee_rate, chn_default_fulfillment_fee, chn_is_api_integrated, chn_is_active, chn_created_at, chn_updated_at)
VALUES
    ('SHOPEE',       'Shopee Vietnam',       'MARKETPLACE', 0.2400, 14000, TRUE,  TRUE,  NOW(), NOW()),
    ('TIKTOK',       'TikTok Shop VN',       'MARKETPLACE', 0.2000, 14000, TRUE,  TRUE,  NOW(), NOW()),
    ('OWN_WEB',      'SocialBean 자체몰',     'OWN',         NULL,   14000, FALSE, FALSE, NOW(), NOW()),
    ('OFFLINE',      '오프라인 매장',           'OFFLINE',     NULL,   NULL,  FALSE, FALSE, NOW(), NOW()),
    ('B2B',          'B2B 도매',               'B2B',         NULL,   NULL,  FALSE, FALSE, NOW(), NOW()),
    ('INFLUENCER',   '인플루언서 개별 판매',     'INFLUENCER',  NULL,   NULL,  FALSE, FALSE, NOW(), NOW()),
    ('AMOEBA_SHOP',  '아메바샵',               'MARKETPLACE', NULL,   14000, FALSE, FALSE, NOW(), NOW()),
    ('AMAZON',       'Amazon',                'MARKETPLACE', NULL,   14000, FALSE, FALSE, NOW(), NOW());
```

---

### 4.4 `drd_channel_product_mappings`

```sql
-- ============================================================
-- Table: drd_channel_product_mappings
-- colPrefix: cpm_
-- ============================================================
CREATE TABLE drd_channel_product_mappings (
    cpm_id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    ent_id                      UUID            NOT NULL,               -- 멀티테넌시 (MUST)
    sku_id                      UUID            NOT NULL,               -- FK → drd_sku_masters
    chn_code                    VARCHAR(20)     NOT NULL,               -- FK → drd_channel_masters
    cpm_channel_product_id      VARCHAR(50)         NULL,               -- 채널 상품 ID
    cpm_channel_variation_id    VARCHAR(50)         NULL,               -- 채널 옵션/변형 ID
    cpm_channel_name_vi         VARCHAR(300)        NULL,               -- 채널 등록 베트남어명
    cpm_listing_price           DECIMAL(15,2)       NULL,               -- 채널 등록 정가
    cpm_selling_price           DECIMAL(15,2)       NULL,               -- 채널 실판매가
    cpm_is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    cpm_created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    cpm_updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    cpm_deleted_at              TIMESTAMPTZ         NULL,               -- Soft Delete (MUST)

    CONSTRAINT pk_drd_channel_product_mappings
        PRIMARY KEY (cpm_id),
    CONSTRAINT uq_drd_channel_product_mappings_sku_chn_var
        UNIQUE (ent_id, sku_id, chn_code, cpm_channel_variation_id),
    CONSTRAINT fk_drd_channel_product_mappings_sku_masters
        FOREIGN KEY (sku_id) REFERENCES drd_sku_masters (sku_id),
    CONSTRAINT fk_drd_channel_product_mappings_channel_masters
        FOREIGN KEY (chn_code) REFERENCES drd_channel_masters (chn_code)
);

-- 인덱스
CREATE INDEX idx_drd_channel_product_mappings_ent_id
    ON drd_channel_product_mappings (ent_id);
CREATE INDEX idx_drd_channel_product_mappings_sku_id
    ON drd_channel_product_mappings (sku_id);
CREATE INDEX idx_drd_channel_product_mappings_chn_product
    ON drd_channel_product_mappings (chn_code, cpm_channel_product_id);
CREATE INDEX idx_drd_channel_product_mappings_chn_variation
    ON drd_channel_product_mappings (chn_code, cpm_channel_variation_id);
CREATE INDEX idx_drd_channel_product_mappings_deleted
    ON drd_channel_product_mappings (cpm_deleted_at);

-- 코멘트
COMMENT ON TABLE  drd_channel_product_mappings IS '채널-SKU 매핑. 동일 SKU를 여러 채널에 연결';
COMMENT ON COLUMN drd_channel_product_mappings.cpm_channel_product_id
    IS '채널 상품 ID. Shopee: 숫자형 VARCHAR, TikTok: 18자리 BIGINT → VARCHAR 저장';
COMMENT ON COLUMN drd_channel_product_mappings.cpm_channel_variation_id
    IS '채널 옵션/변형 ID';
COMMENT ON COLUMN drd_channel_product_mappings.cpm_deleted_at
    IS 'Soft Delete. NULL = 정상';
```

---

### 4.5 `drd_sku_cost_histories`

```sql
-- ============================================================
-- Table: drd_sku_cost_histories
-- colPrefix: sch_
-- Note: 이력 테이블 → UPDATE/DELETE 없음. INSERT only.
-- ============================================================
CREATE TABLE drd_sku_cost_histories (
    sch_id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    ent_id              UUID            NOT NULL,               -- 멀티테넌시 (MUST)
    sku_id              UUID            NOT NULL,               -- FK → drd_sku_masters
    sch_prime_cost      DECIMAL(15,2)   NOT NULL,
    sch_supply_price    DECIMAL(15,2)       NULL,
    sch_listing_price   DECIMAL(15,2)       NULL,
    sch_selling_price   DECIMAL(15,2)       NULL,
    sch_effective_date  DATE            NOT NULL,
    sch_memo            VARCHAR(200)        NULL,
    sch_created_by      VARCHAR(100)    NOT NULL,
    sch_created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_drd_sku_cost_histories        PRIMARY KEY (sch_id),
    CONSTRAINT fk_drd_sku_cost_histories_sku_masters
        FOREIGN KEY (sku_id) REFERENCES drd_sku_masters (sku_id),
    CONSTRAINT ck_drd_sku_cost_histories_prime
        CHECK (sch_prime_cost >= 0)
);

-- 인덱스
CREATE INDEX idx_drd_sku_cost_histories_ent_id
    ON drd_sku_cost_histories (ent_id);
CREATE INDEX idx_drd_sku_cost_histories_sku_date
    ON drd_sku_cost_histories (sku_id, sch_effective_date DESC);

-- 코멘트
COMMENT ON TABLE  drd_sku_cost_histories IS '원가/가격 변경 이력. INSERT only - UPDATE/DELETE 금지';
COMMENT ON COLUMN drd_sku_cost_histories.sch_effective_date IS '적용 시작일. 이 날짜 이후 CM 산출에 적용됨';
COMMENT ON COLUMN drd_sku_cost_histories.sch_created_by     IS '변경 주체 (사용자 ID 또는 시스템)';
```

---

## 5. Convention 준수 체크리스트

> 기준: `amoeba_code_convention_v2.md` — Database 섹션

| 항목 | 규칙 | v1.0 | v2.0 | 상태 |
|------|------|:----:|:----:|:----:|
| DB 이름 | `db_{project}` | `db_drd` | `db_drd` | ✅ |
| 테이블 prefix | 3자리 + `_` | `drd_` | `drd_` | ✅ |
| 테이블명 복수형 | snake_case + plural | ❌ 단수형 | ✅ 복수형 | ✅ |
| PK 컬럼명 | `{colPrefix}_id` | ❌ `id` | ✅ `spu_id`, `sku_id`... | ✅ |
| 일반 컬럼명 | `{colPrefix}_{name}` | ❌ prefix 없음 | ✅ `spu_name_kr`... | ✅ |
| Boolean 컬럼 | `{colPrefix}_is_{name}` | ❌ `is_active` | ✅ `spu_is_active`... | ✅ |
| 생성일시 | `{colPrefix}_created_at` | ❌ `created_at` | ✅ `spu_created_at`... | ✅ |
| 수정일시 | `{colPrefix}_updated_at` | ❌ `updated_at` | ✅ `spu_updated_at`... | ✅ |
| Soft Delete | `{colPrefix}_deleted_at` | ❌ 미존재 | ✅ `spu_deleted_at`... | ✅ |
| 멀티테넌시 | `ent_id` FK MUST | ❌ 미존재 | ✅ 전 데이터 테이블 적용 | ✅ |
| FK 컬럼 | 참조 테이블 PK 그대로 | ❌ `channel_code` | ✅ `chn_code` | ✅ |
| PK 제약명 | `pk_{table}` | ❌ 테이블명 불일치 | ✅ `pk_drd_spu_masters` | ✅ |
| UNIQUE 제약명 | `uq_{table}_{col}` | ❌ `uix_*` | ✅ `uq_drd_*` | ✅ |
| INDEX 명 | `idx_{table}_{col}` | ❌ `ix_*` | ✅ `idx_drd_*` | ✅ |
| FK 제약명 | `fk_{table}_{ref_table}` | ❌ `fk_{table}_{col}` | ✅ `fk_drd_sku_masters_spu_masters` | ✅ |
| CHECK 제약명 | `ck_{table}_{col}` | ❌ 미존재 | ✅ `ck_drd_sku_masters_prime_cost` | ✅ |
| TIMESTAMPTZ | timezone 포함 타입 | ❌ `TIMESTAMP` | ✅ `TIMESTAMPTZ` | ✅ |

---

## 6. 컬럼명 대조표 (v1.0 → v2.0)

### `drd_spu_masters`

| v1.0 (위반) | v2.0 (준수) | 규칙 |
|------------|------------|------|
| `id` | `spu_id` | PK: `{colPrefix}_id` |
| _(없음)_ | `ent_id` | 멀티테넌시 MUST |
| `spu_code` | `spu_code` | ✅ (기존도 우연히 맞음) |
| `brand_code` | `spu_brand_code` | `{colPrefix}_` 적용 |
| `sub_brand` | `spu_sub_brand` | `{colPrefix}_` 적용 |
| `name_kr` | `spu_name_kr` | `{colPrefix}_` 적용 |
| `name_en` | `spu_name_en` | `{colPrefix}_` 적용 |
| `name_vi` | `spu_name_vi` | `{colPrefix}_` 적용 |
| `category_code` | `spu_category_code` | `{colPrefix}_` 적용 |
| `is_active` | `spu_is_active` | Boolean: `{colPrefix}_is_` |
| `created_at` | `spu_created_at` | `{colPrefix}_created_at` |
| `updated_at` | `spu_updated_at` | `{colPrefix}_updated_at` |
| _(없음)_ | `spu_deleted_at` | Soft Delete MUST |

### `drd_sku_masters`

| v1.0 (위반) | v2.0 (준수) | 규칙 |
|------------|------------|------|
| `id` | `sku_id` | PK: `{colPrefix}_id` |
| _(없음)_ | `ent_id` | 멀티테넌시 MUST |
| `spu_id` | `spu_id` | FK: 참조 PK 그대로 ✅ |
| `wms_code` | `sku_wms_code` | `{colPrefix}_` 적용 |
| `spu_code` | `sku_spu_code` | `{colPrefix}_` 적용 |
| `name_kr` | `sku_name_kr` | `{colPrefix}_` 적용 |
| `variant_type` | `sku_variant_type` | `{colPrefix}_` 적용 |
| `variant_value` | `sku_variant_value` | `{colPrefix}_` 적용 |
| `sync_code` | `sku_sync_code` | `{colPrefix}_` 적용 |
| `gtin_code` | `sku_gtin_code` | `{colPrefix}_` 적용 |
| `hs_code` | `sku_hs_code` | `{colPrefix}_` 적용 |
| `prime_cost` | `sku_prime_cost` | `{colPrefix}_` 적용 |
| `supply_price` | `sku_supply_price` | `{colPrefix}_` 적용 |
| `listing_price` | `sku_listing_price` | `{colPrefix}_` 적용 |
| `selling_price` | `sku_selling_price` | `{colPrefix}_` 적용 |
| `fulfillment_fee_override` | `sku_fulfillment_fee_override` | `{colPrefix}_` 적용 |
| `weight_gram` | `sku_weight_gram` | `{colPrefix}_` 적용 |
| `unit` | `sku_unit` | `{colPrefix}_` 적용 |
| `is_active` | `sku_is_active` | Boolean: `{colPrefix}_is_` |
| `cost_updated_at` | `sku_cost_updated_at` | `{colPrefix}_` 적용 |
| `created_at` | `sku_created_at` | `{colPrefix}_created_at` |
| `updated_at` | `sku_updated_at` | `{colPrefix}_updated_at` |
| _(없음)_ | `sku_deleted_at` | Soft Delete MUST |

### `drd_channel_masters`

| v1.0 (위반) | v2.0 (준수) | 규칙 |
|------------|------------|------|
| `channel_code` | `chn_code` | PK: `{colPrefix}_` 적용 |
| `channel_name` | `chn_name` | `{colPrefix}_` 적용 |
| `channel_type` | `chn_type` | `{colPrefix}_` 적용 |
| `default_platform_fee_rate` | `chn_default_platform_fee_rate` | `{colPrefix}_` 적용 |
| `default_fulfillment_fee` | `chn_default_fulfillment_fee` | `{colPrefix}_` 적용 |
| `is_api_integrated` | `chn_is_api_integrated` | Boolean: `{colPrefix}_is_` |
| `is_active` | `chn_is_active` | Boolean: `{colPrefix}_is_` |
| `created_at` | `chn_created_at` | `{colPrefix}_created_at` |
| _(없음)_ | `chn_updated_at` | `{colPrefix}_updated_at` 추가 |

### `drd_channel_product_mappings`

| v1.0 (위반) | v2.0 (준수) | 규칙 |
|------------|------------|------|
| `id` | `cpm_id` | PK: `{colPrefix}_id` |
| _(없음)_ | `ent_id` | 멀티테넌시 MUST |
| `sku_id` | `sku_id` | FK: 참조 PK 그대로 ✅ |
| `channel_code` | `chn_code` | FK: 참조 테이블 PK 그대로 (chn_code) |
| `channel_product_id` | `cpm_channel_product_id` | `{colPrefix}_` 적용 |
| `channel_variation_id` | `cpm_channel_variation_id` | `{colPrefix}_` 적용 |
| `channel_name_vi` | `cpm_channel_name_vi` | `{colPrefix}_` 적용 |
| `channel_listing_price` | `cpm_listing_price` | `{colPrefix}_` 적용 |
| `channel_selling_price` | `cpm_selling_price` | `{colPrefix}_` 적용 |
| `is_active` | `cpm_is_active` | Boolean: `{colPrefix}_is_` |
| `created_at` | `cpm_created_at` | `{colPrefix}_created_at` |
| `updated_at` | `cpm_updated_at` | `{colPrefix}_updated_at` |
| _(없음)_ | `cpm_deleted_at` | Soft Delete MUST |

### `drd_sku_cost_histories`

| v1.0 (위반) | v2.0 (준수) | 규칙 |
|------------|------------|------|
| `id` | `sch_id` | PK: `{colPrefix}_id` |
| _(없음)_ | `ent_id` | 멀티테넌시 MUST |
| `sku_id` | `sku_id` | FK: 참조 PK 그대로 ✅ |
| `prime_cost` | `sch_prime_cost` | `{colPrefix}_` 적용 |
| `supply_price` | `sch_supply_price` | `{colPrefix}_` 적용 |
| `listing_price` | `sch_listing_price` | `{colPrefix}_` 적용 |
| `selling_price` | `sch_selling_price` | `{colPrefix}_` 적용 |
| `effective_date` | `sch_effective_date` | `{colPrefix}_` 적용 |
| `memo` | `sch_memo` | `{colPrefix}_` 적용 |
| `created_by` | `sch_created_by` | `{colPrefix}_` 적용 |
| `created_at` | `sch_created_at` | `{colPrefix}_created_at` |
