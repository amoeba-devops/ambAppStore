# SB Data & Reporting System — Functional Definition (기능정의서)

---
```
document_id : DRD-FDS-2026-001
version     : 3.0.0
status      : Draft
created     : 2026-04-02
updated     : 2026-04-02
author      : Amoeba Company
change_log  :
  - version: 1.0.0 / 2.0.0 — 초기 작성 및 Shopee/TikTok 실데이터 반영
  - version: 3.0.0
    date: 2026-04-02
    description: |
      DRD-ERD-2026-001 v2.0 반영
      - FN-01: drd_sku_masters JOIN으로 prime_cost/listing_price 조회 방식 변경
      - FN-07: sku_prime_cost/sku_fulfillment_fee_override 참조 명시
      - FN-17: COGS Upload → SKU Master Upload 전면 재정의
      - FN-18~FN-21 신규 추가 (SPU/SKU CRUD / 채널매핑 / 원가이력)
      - Section 5 Data Model: Convention v2 테이블명/컬럼명 전면 재작성
      - API Endpoints: 상품 마스터 관련 14개 엔드포인트 추가
      - FR 매핑: FR-18~FR-21 추가
```
---

## 1. Overview (개요)

- **System**: SB Data & Reporting System
- **Project Code**: DRD / **DB**: `db_drd`
- **Reference**: DRD-REQ-2026-001 v3.0 · DRD-SCN-2026-001 v1.0 · DRD-ERD-2026-001 v2.0
- **Tech Stack**: React 18 + TypeScript · NestJS 10 · PostgreSQL 15 · Redis 7
- **Base URL**: `apps.amoeba.site/app-daily-report`

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Frontend (React 18)                           │
│  Daily │ Weekly CM │ Monthly CM │ Inventory │ Product Master │ Manual│
└────────────────────────┬─────────────────────────────────────────────┘
                         │ REST API / SSE
┌────────────────────────▼─────────────────────────────────────────────┐
│                      Backend (NestJS 10)                             │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌───────────────────────┐ │
│  │  Ingest  │ │ Calculator │ │  Report  │ │  Product Master       │ │
│  │  Module  │ │  Engine    │ │  Builder │ │  SPU/SKU/Mapping      │ │
│  └────┬─────┘ └─────┬──────┘ └────┬─────┘ └─────────┬─────────────┘ │
│       └─────────────┴─────────────┴─────────────────┴──────────┐    │
│                    PostgreSQL (db_drd)                          │    │
│  drd_spu_masters · drd_sku_masters · drd_channel_masters        │    │
│  drd_channel_product_mappings · drd_sku_cost_histories          │    │
│  drd_daily_summaries · drd_product_dailies · drd_manual_inputs  │    │
└─────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. FR → FN Mapping

| FR ID | 요구사항 | FN ID | 기능명 | Priority |
|-------|---------|-------|--------|----------|
| FR-01 | 플랫폼 데이터 자동 수집 | FN-01 | 플랫폼 데이터 수집 배치 | P0 |
| FR-02 | 플랫폼별 필터 조회 | FN-02 | 플랫폼 필터 | P0 |
| FR-03 | 수동 비용 주간 입력 | FN-03 | 수동 비용 입력 | P0 |
| FR-04 | NMV 비율 배분 | FN-04 | NMV 비율 배분 엔진 | P0 |
| FR-05 | Daily 리포트 KPI | FN-05 | Daily 리포트 렌더링 | P0 |
| FR-06 | 환율 설정·재산출 | FN-06 | 환율 관리 | P0 |
| FR-07 | 상품별 CM 산출 | FN-07 | CM 산출 엔진 | P0 |
| FR-08 | 추정값 시각 구분 | FN-08 | 추정값 시각 구분 | P1 |
| FR-09 | 기간 비교 | FN-09 | 기간 비교 | P1 |
| FR-10 | 이상값 알림 | FN-10 | 이상값 감지·알림 | P1 |
| FR-11 | 내보내기 | FN-11 | Excel 내보내기 | P2 |
| FR-12 | Weekly CM 리포트 | FN-12 | Weekly CM 리포트 | P0 |
| FR-13 | Monthly CM 리포트 | FN-13 | Monthly CM 리포트 | P1 |
| FR-14 | Flash Sale 집계 | FN-14 | Flash Sale 리포트 | P1 |
| FR-15 | Livestream 집계 | FN-15 | Livestream 리포트 | P1 |
| FR-16 | Creator Outreach | FN-16 | Creator Outreach 관리 | P2 |
| FR-17 | SKU 원가 파일 업로드 | FN-17 | SKU Master 파일 업로드 | P0 |
| **FR-18** | SPU 마스터 관리 | **FN-18** | SPU Master CRUD | P0 |
| **FR-19** | SKU 마스터 관리 | **FN-19** | SKU Master CRUD | P0 |
| **FR-20** | 채널 상품 매핑 관리 | **FN-20** | 채널 상품 매핑 관리 | P0 |
| **FR-21** | 원가 변경 이력 조회 | **FN-21** | 원가 이력 관리 | P1 |

---

## 4. Functional Definition

### FN-01: Platform Data Ingestion Batch ← v3.0 처리 파이프라인 업데이트

**Type**: 백엔드 배치 (매일 03:00 GMT+7)

#### 처리 파이프라인

```
1. API 호출 → drd_raw_orders / drd_raw_ads 저장
2. 채널 상품 ID → SKU 매핑 (drd_channel_product_mappings JOIN drd_sku_masters)
   - cpm_channel_product_id + cpm_channel_variation_id → sku_id
3. Prime Cost: drd_sku_masters.sku_prime_cost
4. Fulfillment Fee:
   sku_fulfillment_fee_override IS NOT NULL → override
   ELSE → chn_default_fulfillment_fee (drd_channel_masters)
5. NMV = Net GMV − Seller Discount
6. Platform Fee = GMV × chn_default_platform_fee_rate
7. CM 산출 (FN-07)
8. drd_daily_summaries / drd_product_dailies 저장
9. 미매핑 상품 감지 → prd_cm_status = 'SKU_UNMAPPED' + WARNING 알림
```

#### Shopee 수집 항목 (Convention v2 컬럼명)

| 항목 | DB 컬럼 | 비고 |
|------|--------|------|
| 채널 상품 ID | `cpm_channel_product_id` | VARCHAR(50) |
| 채널 옵션 ID | `cpm_channel_variation_id` | VARCHAR(50) |
| WMS Code | `sku_wms_code` (JOIN) | 자동 매핑 |
| Prime Cost | `sku_prime_cost` (JOIN) | |
| Fulfillment | `sku_fulfillment_fee_override` OR `chn_default_fulfillment_fee` | |
| Items Sold | `prd_items_sold` | |
| NMV | `prd_nmv` = Net GMV − Seller Discount | |
| Seller Voucher | `prd_seller_voucher` + `prd_sv_is_estimated=true` | 배분 추정 |
| Platform Discount | `prd_platform_discount` | 참고용, CM 제외 |
| Affiliate Commission | `prd_affiliate_commission` | API 수집 |

#### TikTok 차이점

- `cpm_channel_product_id`: 18자리 VARCHAR(50)
- Affiliate Commission: `drd_manual_inputs` (수동 입력)
- Live GMV Max: `sum_live_gmv_max`

#### Business Rules

- Shopee Discount는 `prd_platform_discount`로만 저장, CM에서 완전 제외
- 미매핑: `prd_cm_status = 'SKU_UNMAPPED'` + FN-10 WARNING

---

### FN-02 ~ FN-06 (기존 유지)

> 플랫폼 필터 / 수동 비용 입력 / NMV 배분 / Daily 렌더링 / 환율 관리  
> DB 참조는 Convention v2 테이블명으로 갱신됨 (상세 v2.0 참조)

---

### FN-07: CM Calculation Engine ← v3.0 SKU Master 참조 명시

**Reference**: FR-07

#### CM 산출 로직 (상품별)

```sql
CM = prd_gross_revenue
   - (sku_prime_cost × prd_items_sold)                     -- drd_sku_masters
   - prd_logistics_cost                                     -- 선적 배분
   - (COALESCE(sku_fulfillment_fee_override,
              chn_default_fulfillment_fee, 14000)
      × prd_items_sold)                                     -- Override or Default
   - prd_platform_fee
   - prd_ad_spend
   - prd_affiliate_commission
   - prd_affiliate_booking     -- prd_ab_is_estimated=true
   - prd_livestream_fee        -- prd_lf_is_estimated=true
   - prd_seller_voucher        -- prd_sv_is_estimated=true
   - prd_seller_discount
   - prd_free_gift

CM% = CM / NULLIF(prd_gross_revenue, 0) * 100
```

#### Fulfillment Fee 우선순위

```
1순위: sku_fulfillment_fee_override (drd_sku_masters) — NOT NULL이면 사용
2순위: chn_default_fulfillment_fee (drd_channel_masters)
3순위: 하드코딩 기본값 14,000 VND
```

#### CM Status

| `prd_cm_status` | 조건 |
|----------------|------|
| `NORMAL` | 정상 산출 |
| `NEGATIVE` | CM < 0 → CRITICAL 알림 |
| `SKU_UNMAPPED` | 채널 매핑 미등록 |
| `PRIME_COST_MISSING` | sku_prime_cost = 0 or NULL |
| `INCOMPLETE` | 기타 누락 |

---

### FN-08 ~ FN-16 (기존 유지)

> 추정값 구분 / 기간 비교 / 이상값 알림 / Excel 내보내기  
> Weekly CM / Monthly CM / Flash Sale / Livestream / Creator Outreach  
> v2.0 내용 유지, DB 테이블명 Convention v2 갱신

---

### FN-17: SKU Master File Upload ← v3.0 전면 재정의

**Reference**: FR-17  
**변경**: COGS Master Upload → SKU Master Upload

#### Upload Template Columns

| 헤더 | DB 컬럼 | 필수 | 예시 |
|-----|--------|:---:|------|
| SPU Code | `spu_code` (drd_spu_masters) | ✅ | `SAFG18U` |
| WMS Code | `sku_wms_code` | ✅ | `SAFG18U0008` |
| Product Name (KR) | `sku_name_kr` | ✅ | `이중밀폐 이유식큐브 4구` |
| Product Name (EN) | `sku_name_en` | ✅ | `Dual Lock Slim Multicube 4` |
| Product Name (VI) | `sku_name_vi` | ✅ | `Khay platinum silicone 4 ngăn` |
| Variant Type | `sku_variant_type` | — | `Color` |
| Variant Value | `sku_variant_value` | — | `Pastel Pink` |
| Prime Cost (VND) | `sku_prime_cost` | ✅ | `65000` |
| Supply Price (VND) | `sku_supply_price` | — | `153000` |
| Listing Price (VND) | `sku_listing_price` | — | `235000` |
| Selling Price (VND) | `sku_selling_price` | — | `153000` |
| Fulfillment Override | `sku_fulfillment_fee_override` | — | `14000` |
| GTIN | `sku_gtin_code` | — | `8809123456789` |
| HS Code | `sku_hs_code` | — | `3924.90` |
| Sync Code | `sku_sync_code` | — | |

#### 처리 Pipeline

```
1. Excel/CSV 업로드
2. 컬럼 매핑 미리보기 (자동 매핑 + 수동 조정)
3. 유효성 검증:
   - sku_wms_code 형식 (최대 12자)
   - sku_prime_cost > 0
   - spu_code → drd_spu_masters 존재 확인
4. drd_sku_masters UPSERT (ent_id + sku_wms_code UNIQUE)
5. 가격 변경 시 → drd_sku_cost_histories INSERT 자동
6. 연관 CM 재산출 트리거
7. 결과 리포트 (성공 N / 실패 N / 건너뜀 N)
```

#### Business Rules

- `sku_wms_code` 기준 UPSERT
- 가격 변경 시 `drd_sku_cost_histories` 자동 INSERT (이력 영구 보존)
- Soft Delete SKU 복구 확인 모달 표시
- 채널 매핑은 FN-20에서 별도 처리

---

### FN-18: SPU Master CRUD ← v3.0 신규

**Reference**: FR-18

#### 오퍼레이션

| 오퍼레이션 | 설명 | 제약 |
|----------|------|------|
| 조회 | spu_code / name 검색 | `spu_deleted_at IS NULL` |
| 등록 | ent_id + spu_code UNIQUE 검증 | `ent_id` 자동 주입 |
| 수정 | name_kr/en/vi / category 수정 | spu_code 변경 불가 |
| 삭제 | Soft Delete | 하위 SKU 존재 시 삭제 불가 |

#### WMS Code 자동 도출

업로드 시 `sku_wms_code[:7]` → `spu_code` 자동 도출 후 `drd_spu_masters` 조회.  
미존재 시 → 자동 생성 또는 오류 반환 선택.

---

### FN-19: SKU Master CRUD ← v3.0 신규

**Reference**: FR-19

`sku_id` (UUID = MasterProductItemCode) 기반, `sku_wms_code`가 Natural Key.

#### 오퍼레이션

| 오퍼레이션 | 설명 | 제약 |
|----------|------|------|
| 조회 | wms_code / name / spu_code / variant 검색 | `sku_deleted_at IS NULL` |
| 등록 | sku_wms_code UNIQUE 검증, spu_id 자동 연결 | spu_code = wms_code[:7] |
| 수정 | 가격 4종·이름·Variant | wms_code 변경 불가 |
| 삭제 | Soft Delete | 활성 채널 매핑 존재 시 불가 |
| 가격 이력 | 가격 변경 시 drd_sku_cost_histories 자동 INSERT | |

#### SKU 목록 필수 표시 컬럼

| 컬럼 | DB 필드 |
|------|--------|
| WMS Code | `sku_wms_code` |
| SPU Code | `sku_spu_code` |
| 상품명 KR/EN/VI | `sku_name_kr`, `sku_name_en`, `sku_name_vi` |
| Variant | `sku_variant_value` |
| 매입원가 | `sku_prime_cost` |
| 공급가 | `sku_supply_price` |
| 등록 정가 | `sku_listing_price` |
| 실판매가 | `sku_selling_price` |
| Fulfillment Override | `sku_fulfillment_fee_override` |
| GTIN / HS Code | `sku_gtin_code`, `sku_hs_code` |
| 활성 여부 | `sku_is_active` |

---

### FN-20: Channel Product Mapping ← v3.0 신규

**Reference**: FR-20

`drd_sku_masters`의 SKU를 각 채널 상품 ID에 연결. 신규 채널 추가 시 이 테이블만 확장.

#### 오퍼레이션

| 오퍼레이션 | 설명 |
|----------|------|
| 조회 | SKU별 등록 채널 목록 조회 |
| 등록 | sku_id + chn_code + cpm_channel_variation_id UNIQUE 검증 |
| 수정 | cpm_listing_price / cpm_selling_price 수정 |
| 비활성화 | Soft Delete (`cpm_deleted_at = NOW()`) |
| 일괄 등록 | CSV 업로드 (WMS Code ↔ 채널 ID 매핑) |

#### 매핑 Entry 필드

| 필드 | DB 컬럼 | 비고 |
|------|--------|------|
| SKU (WMS Code) | `sku_wms_code` (JOIN) | |
| 채널 | `chn_code` | SHOPEE / TIKTOK 등 |
| 채널 상품 ID | `cpm_channel_product_id` VARCHAR(50) | TikTok: 18자리 |
| 채널 옵션 ID | `cpm_channel_variation_id` VARCHAR(50) | |
| 채널 등록명 (VI) | `cpm_channel_name_vi` | |
| 채널 정가 | `cpm_listing_price` | |
| 채널 판매가 | `cpm_selling_price` | |
| 활성 여부 | `cpm_is_active` | |

#### Business Rules

- `ent_id + sku_id + chn_code + cpm_channel_variation_id` UNIQUE
- TikTok Product ID → VARCHAR(50) 저장
- 미매핑 판매 감지 → R-11 WARNING 알림 (FN-10)

---

### FN-21: SKU Cost History ← v3.0 신규

**Reference**: FR-21

`drd_sku_cost_histories` 조회. INSERT only — UPDATE/DELETE 금지.

| 항목 | DB 컬럼 |
|------|--------|
| 적용일 | `sch_effective_date` |
| 매입원가 | `sch_prime_cost` |
| 공급가 | `sch_supply_price` |
| 등록 정가 | `sch_listing_price` |
| 실판매가 | `sch_selling_price` |
| 변경 사유 | `sch_memo` |
| 변경자 | `sch_created_by` |
| 기록 시각 | `sch_created_at` |

CM 재산출 시 `sch_effective_date ≤ 산출 대상 날짜` 중 가장 최근 원가 사용.

---

## 5. Data Model (Amoeba Convention v2 완전 준수)

### 상품 마스터 그룹

```sql
-- drd_spu_masters (colPrefix: spu_)
spu_id UUID PK | ent_id UUID FK
spu_code VARCHAR(7) UK | spu_brand_code | spu_sub_brand
spu_name_kr | spu_name_en | spu_name_vi
spu_category_code | spu_category_name | spu_is_active
spu_created_at | spu_updated_at | spu_deleted_at

-- drd_sku_masters (colPrefix: sku_) = MasterProductItemCode
sku_id UUID PK | ent_id UUID FK | spu_id UUID FK
sku_wms_code VARCHAR(12) UK | sku_spu_code VARCHAR(7)
sku_name_kr | sku_name_en | sku_name_vi
sku_variant_type | sku_variant_value
sku_sync_code | sku_gtin_code | sku_hs_code
sku_prime_cost DECIMAL    -- 매입원가
sku_supply_price DECIMAL  -- 공급가 (NULL 가능)
sku_listing_price DECIMAL -- 등록 정가 = GMV 기준 (NULL 가능)
sku_selling_price DECIMAL -- 실판매가 = Net GMV 기준 (NULL 가능)
sku_fulfillment_fee_override DECIMAL  -- NULL=채널 기본값
sku_weight_gram | sku_unit | sku_is_active | sku_cost_updated_at
sku_created_at | sku_updated_at | sku_deleted_at

-- drd_channel_masters (colPrefix: chn_)
chn_code VARCHAR(20) PK | chn_name | chn_type
chn_default_platform_fee_rate | chn_default_fulfillment_fee(=14000)
chn_is_api_integrated | chn_is_active | chn_created_at | chn_updated_at

-- drd_channel_product_mappings (colPrefix: cpm_)
cpm_id UUID PK | ent_id UUID FK | sku_id UUID FK | chn_code FK
cpm_channel_product_id VARCHAR(50) | cpm_channel_variation_id VARCHAR(50)
cpm_channel_name_vi | cpm_listing_price | cpm_selling_price
cpm_is_active | cpm_created_at | cpm_updated_at | cpm_deleted_at

-- drd_sku_cost_histories (colPrefix: sch_) -- INSERT only
sch_id UUID PK | ent_id UUID FK | sku_id UUID FK
sch_prime_cost | sch_supply_price | sch_listing_price | sch_selling_price
sch_effective_date DATE | sch_memo | sch_created_by | sch_created_at
```

### 리포트 집계 그룹

```sql
-- drd_daily_summaries (colPrefix: sum_)
sum_id UUID PK | ent_id UUID FK | chn_code FK | sum_date DATE
sum_net_gmv | sum_gmv | sum_nmv | sum_gross_revenue
sum_items_sold | sum_orders | sum_cr | sum_aov
sum_page_views | sum_visitors | sum_impressions
sum_ad_spend | sum_ad_gmv | sum_ad_rate | sum_roas
sum_affiliate_commission | sum_affiliate_booking | sum_livestream_fee
sum_seller_voucher | sum_seller_discount | sum_free_gift
sum_platform_discount | sum_platform_fee
sum_prime_cost_total | sum_logistics_cost | sum_fulfillment_fee
sum_cm | sum_cm_pct | sum_batch_status
sum_created_at | sum_updated_at

-- drd_product_dailies (colPrefix: prd_)
prd_id UUID PK | ent_id UUID FK | sku_id UUID FK | chn_code FK | prd_date DATE
prd_page_views | prd_visitors | prd_cr
prd_items_sold | prd_gmv | prd_net_gmv | prd_nmv | prd_gross_revenue
prd_seller_discount (확정)
prd_seller_voucher + prd_sv_is_estimated BOOLEAN (추정)
prd_free_gift | prd_platform_discount | prd_platform_fee
prd_ad_spend | prd_ad_gmv
prd_affiliate_commission + prd_ac_is_estimated BOOLEAN
prd_affiliate_booking + prd_ab_is_estimated BOOLEAN (추정)
prd_livestream_fee + prd_lf_is_estimated BOOLEAN (추정)
prd_logistics_cost | prd_fulfillment_fee | prd_prime_cost_total
prd_cm | prd_cm_pct | prd_cm_status
prd_created_at | prd_updated_at
```

### 운영 입력 그룹

```sql
-- drd_manual_inputs (colPrefix: min_)
min_id UUID PK | ent_id UUID FK | chn_code FK | min_year_week
min_affiliate_booking_fee | min_livestream_fee | min_tiktok_affiliate_commission
min_memo | min_created_by | min_created_at | min_updated_at

-- drd_exchange_rates (colPrefix: exr_)
exr_id UUID PK | ent_id UUID FK
exr_effective_date DATE | exr_vnd_per_krw DECIMAL
exr_memo | exr_created_by | exr_created_at

-- drd_logistics_costs (colPrefix: lgs_)
lgs_id UUID PK | ent_id UUID FK
lgs_shipment_id | lgs_shipment_date | lgs_total_cost
lgs_allocation_method | lgs_unit_count | lgs_cost_per_unit
lgs_created_by | lgs_created_at
```

### 배치·알림·플랫폼별 그룹

```sql
-- drd_batch_logs (colPrefix: bat_)
-- drd_alert_logs (colPrefix: alt_)
-- drd_flash_sale_dailies (colPrefix: fls_) -- Shopee only
-- drd_livestream_sessions (colPrefix: liv_)
-- drd_creator_outreach_weeklies (colPrefix: cou_) -- TikTok only
-- drd_weekly_summaries (colPrefix: wks_)
-- drd_monthly_summaries (colPrefix: mts_)
```

---

## 6. API Endpoints

### 리포트 API

| Method | Endpoint | 설명 | FN |
|--------|----------|------|-----|
| GET | `/api/drd/daily` | Daily 리포트 KPI | FN-05 |
| GET | `/api/drd/daily/product-breakdown` | 상품별 Daily CM | FN-07 |
| GET | `/api/drd/weekly` | Weekly CM 리포트 | FN-12 |
| GET | `/api/drd/monthly` | Monthly CM 리포트 | FN-13 |
| GET | `/api/drd/flash-sale` | Flash Sale (Shopee) | FN-14 |
| GET | `/api/drd/livestream` | Livestream 리포트 | FN-15 |
| GET | `/api/drd/creator-outreach` | Creator Outreach | FN-16 |
| GET | `/api/drd/compare` | 기간 비교 | FN-09 |
| GET | `/api/drd/export` | Excel 내보내기 | FN-11 |

### 운영 입력 API

| Method | Endpoint | 설명 | FN |
|--------|----------|------|-----|
| POST | `/api/drd/manual-inputs` | 수동 비용 저장 | FN-03 |
| GET | `/api/drd/manual-inputs/{year_week}` | 주간 수동 조회 | FN-03 |
| GET | `/api/drd/exchange-rates` | 환율 이력 | FN-06 |
| POST | `/api/drd/exchange-rates` | 환율 저장 | FN-06 |
| GET | `/api/drd/alerts` | 알림 목록 | FN-10 |
| POST | `/api/drd/batch/trigger` | 수동 배치 | FN-01 |

### 상품 마스터 API ← v3.0 신규

| Method | Endpoint | 설명 | FN |
|--------|----------|------|-----|
| GET | `/api/drd/spu-masters` | SPU 목록 조회 | FN-18 |
| POST | `/api/drd/spu-masters` | SPU 등록 | FN-18 |
| PATCH | `/api/drd/spu-masters/{spu_id}` | SPU 수정 | FN-18 |
| DELETE | `/api/drd/spu-masters/{spu_id}` | SPU Soft Delete | FN-18 |
| GET | `/api/drd/sku-masters` | SKU 목록 조회 | FN-19 |
| GET | `/api/drd/sku-masters/{sku_id}` | SKU 상세 조회 | FN-19 |
| POST | `/api/drd/sku-masters` | SKU 등록 | FN-19 |
| PATCH | `/api/drd/sku-masters/{sku_id}` | SKU 수정 | FN-19 |
| DELETE | `/api/drd/sku-masters/{sku_id}` | SKU Soft Delete | FN-19 |
| POST | `/api/drd/sku-masters/upload` | SKU Master 파일 업로드 | FN-17 |
| GET | `/api/drd/channel-product-mappings` | 채널 매핑 목록 | FN-20 |
| POST | `/api/drd/channel-product-mappings` | 채널 매핑 등록 | FN-20 |
| PATCH | `/api/drd/channel-product-mappings/{cpm_id}` | 채널 매핑 수정 | FN-20 |
| DELETE | `/api/drd/channel-product-mappings/{cpm_id}` | 채널 매핑 비활성화 | FN-20 |
| GET | `/api/drd/sku-cost-histories/{sku_id}` | 원가 이력 조회 | FN-21 |

---

## 7. Traceability Matrix

| FN ID | 기능명 | FR | SCN | SCR |
|-------|--------|-----|-----|-----|
| FN-01 | 플랫폼 데이터 수집 배치 | FR-01 | SCN-01 | — |
| FN-02 | 플랫폼 필터 | FR-02 | SCN-08 | SCR-01 |
| FN-03 | 수동 비용 입력 | FR-03 | SCN-02 | SCR-03 |
| FN-04 | NMV 비율 배분 엔진 | FR-04 | SCN-02,04 | — |
| FN-05 | Daily 리포트 렌더링 | FR-05 | SCN-01 | SCR-01 |
| FN-06 | 환율 관리 | FR-06 | SCN-03 | SCR-04 |
| FN-07 | CM 산출 엔진 | FR-07 | SCN-01,04 | SCR-02 |
| FN-08 | 추정값 시각 구분 | FR-08 | SCN-04 | SCR-02 |
| FN-09 | 기간 비교 | FR-09 | SCN-05 | SCR-01 |
| FN-10 | 이상값 감지·알림 | FR-10 | SCN-06 | SCR-06 |
| FN-11 | Excel 내보내기 | FR-11 | SCN-07 | SCR-01 |
| FN-12 | Weekly CM 리포트 | FR-12 | SCN-01 | SCR-07 |
| FN-13 | Monthly CM 리포트 | FR-13 | SCN-01 | SCR-08 |
| FN-14 | Flash Sale 리포트 | FR-14 | SCN-01 | SCR-01 |
| FN-15 | Livestream 리포트 | FR-15 | SCN-01 | SCR-09 |
| FN-16 | Creator Outreach | FR-16 | SCN-02 | SCR-10 |
| FN-17 | SKU Master 파일 업로드 | FR-17 | SCN-02 | SCR-11 |
| **FN-18** | SPU Master CRUD | **FR-18** | SCN-02 | **SCR-11** |
| **FN-19** | SKU Master CRUD | **FR-19** | SCN-02 | **SCR-12** |
| **FN-20** | 채널 상품 매핑 관리 | **FR-20** | SCN-02 | **SCR-13** |
| **FN-21** | 원가 이력 관리 | **FR-21** | SCN-04 | **SCR-12** |
