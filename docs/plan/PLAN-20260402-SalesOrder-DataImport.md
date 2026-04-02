# Sales Order Data Import — Task Plan (판매주문 데이터 임포트 작업계획서)

---
```
document_id : PLAN-20260402-SalesOrder-DataImport
version     : 1.0.0
status      : Draft
created     : 2026-04-02
updated     : 2026-04-02
author      : Amoeba Dev Team
app         : app-sales-report
based_on    : REQ-20260402-SalesOrder-DataImport v1.0
```
---

## 1. System Development Status Analysis (시스템 개발 현황 분석)

### 1.1 Directory Structure (현재)

```
apps/app-sales-report/
├── backend/src/
│   ├── app.module.ts                      ← 수정 대상
│   ├── auth/                              (기존 유지)
│   ├── common/                            (기존 유지)
│   └── domain/
│       ├── spu-master/                    (기존 유지)
│       ├── sku-master/                    (기존 유지)
│       ├── channel-master/                (기존 유지)
│       ├── channel-product-mapping/       (기존 유지)
│       ├── sku-cost-history/              (기존 유지)
│       └── raw-order/                     ← 신규 모듈
│           ├── entity/
│           │   ├── raw-order.entity.ts    ← 신규
│           │   └── raw-order-item.entity.ts ← 신규
│           └── raw-order.module.ts        ← 신규
├── frontend/                              (변경 없음 — Phase 2에서 UI 추가)
├── generate-seed.py                       (기존 유지, 참조 패턴)
├── generate-order-seed.py                 ← 신규 Python 스크립트
├── seed-product-master.sql                (기존 유지)
└── seed-orders-202603.sql                 ← 신규 생성 결과
```

### 1.2 Tech Stack (기술 스택)

| Layer | Technology | Status |
|-------|-----------|--------|
| Backend | NestJS 10 + TypeORM 0.3.x | 기존 |
| Database | MySQL 8.0 (Docker) | 기존 |
| Seed Tool | Python 3 + openpyxl | 기존 패턴 |
| Entity Convention | UUID PK, `{prefix}_` column naming, explicit `type` on nullable columns | 기존 |

### 1.3 Existing Code Patterns (기존 코드 패턴)

- **Entity 정의**: `SpuMasterEntity` 패턴 — `@Entity`, `@PrimaryGeneratedColumn('uuid')`, 명시적 `type` 파라미터
- **TypeORM nullable column**: 반드시 `type` 명시 (reflect-metadata union type 이슈)
- **Module 등록**: `TypeOrmModule.forFeature([Entity])` + `app.module.ts` imports
- **Python Seed**: `openpyxl` → row iteration → UUID 생성 → SQL INSERT 문자열 생성
- **autoLoadEntities: true**: Entity를 Module에 등록하면 자동 인식

### 1.4 Constraints (제약사항)

- Docker 빌드 시 `npm install` 사용 (npm ci 불가 — 모노레포 lock 파일 이슈)
- `DB_SYNC=false` (스테이징/프로덕션) → 수동 DDL 필요
- `DB_SYNC=true` (로컬) → Entity 추가 시 자동 스키마 생성
- TypeORM entity가 `type: 'varchar'` 등 명시 안 하면 `Data type Object is not supported` 오류

---

## 2. Step-by-Step Implementation Plan (단계별 구현 계획)

### Phase 1: DB Schema & Entity Definition (DB 스키마 & 엔티티 정의)

#### Step 1.1: Create `RawOrderEntity` (주문 원시 데이터 엔티티)

**파일**: `backend/src/domain/raw-order/entity/raw-order.entity.ts`

TypeORM Entity 정의:
- Table: `drd_raw_orders`
- Column prefix: `ord_`
- PK: `ord_id` (UUID)
- UNIQUE: `(ent_id, chn_code, ord_channel_order_id)`
- Indexes: `(ent_id, ord_order_date)`, `(ent_id, ord_status)`
- Relations: OneToMany → `RawOrderItemEntity`

주요 컬럼:
| Property | Column | Type |
|----------|--------|------|
| ordId | ord_id | UUID PK |
| entId | ent_id | CHAR(36) NOT NULL |
| chnCode | chn_code | VARCHAR(20) NOT NULL |
| ordChannelOrderId | ord_channel_order_id | VARCHAR(30) NOT NULL |
| ordPackageId | ord_package_id | VARCHAR(30) NULL |
| ordOrderDate | ord_order_date | DATETIME NOT NULL |
| ordStatus | ord_status | VARCHAR(20) NOT NULL |
| ordStatusRaw | ord_status_raw | VARCHAR(500) NULL |
| ordCancelReason | ord_cancel_reason | VARCHAR(500) NULL |
| ordTrackingNo | ord_tracking_no | VARCHAR(50) NULL |
| ordCarrier | ord_carrier | VARCHAR(100) NULL |
| (... 금액 관련 30+ 컬럼) | | DECIMAL(15,2) NULL |
| ordImportBatchId | ord_import_batch_id | VARCHAR(50) NULL |
| ordCreatedAt | ord_created_at | DATETIME auto |
| ordUpdatedAt | ord_updated_at | DATETIME auto |

└─ **사이드 임팩트**: 없음 (신규 파일)

#### Step 1.2: Create `RawOrderItemEntity` (주문 아이템 엔티티)

**파일**: `backend/src/domain/raw-order/entity/raw-order-item.entity.ts`

TypeORM Entity 정의:
- Table: `drd_raw_order_items`
- Column prefix: `oli_`
- PK: `oli_id` (UUID)
- FK: `ord_id` → drd_raw_orders, `sku_id` → drd_sku_masters (nullable)
- Indexes: `(ent_id, ord_id)`, `(ent_id, oli_variant_sku)`, `(sku_id)`

주요 컬럼:
| Property | Column | Type |
|----------|--------|------|
| oliId | oli_id | UUID PK |
| entId | ent_id | CHAR(36) NOT NULL |
| ordId | ord_id | CHAR(36) FK NOT NULL |
| skuId | sku_id | CHAR(36) FK NULL |
| oliProductSku | oli_product_sku | VARCHAR(50) NULL |
| oliProductName | oli_product_name | VARCHAR(500) NULL |
| oliVariantSku | oli_variant_sku | VARCHAR(30) NULL |
| oliVariantName | oli_variant_name | VARCHAR(200) NULL |
| oliIsBestseller | oli_is_bestseller | BOOLEAN |
| oliOriginalPrice | oli_original_price | DECIMAL(15,2) NULL |
| oliSellerDiscount | oli_seller_discount | DECIMAL(15,2) NULL |
| oliShopeeDiscount | oli_shopee_discount | DECIMAL(15,2) NULL |
| oliDealPrice | oli_deal_price | DECIMAL(15,2) NULL |
| oliQuantity | oli_quantity | INT NOT NULL |
| oliReturnQuantity | oli_return_quantity | INT NULL |
| oliBuyerPaid | oli_buyer_paid | DECIMAL(15,2) NULL |
| oliReturnStatus | oli_return_status | VARCHAR(50) NULL |
| oliSkuMatchStatus | oli_sku_match_status | VARCHAR(10) NOT NULL |
| oliCreatedAt | oli_created_at | DATETIME auto |
| oliUpdatedAt | oli_updated_at | DATETIME auto |

└─ **사이드 임팩트**: 없음 (신규 파일)

#### Step 1.3: Create `RawOrderModule`

**파일**: `backend/src/domain/raw-order/raw-order.module.ts`

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([RawOrderEntity, RawOrderItemEntity])],
})
export class RawOrderModule {}
```

└─ **사이드 임팩트**: `app.module.ts` imports 배열에 추가 필요

#### Step 1.4: Register Module in `AppModule`

**파일**: `backend/src/app.module.ts`

- `RawOrderModule` import 추가
- 기존 모듈에 영향 없음 (배열 끝에 추가)

└─ **사이드 임팩트**: TypeORM autoLoadEntities가 새 Entity 자동 인식 → `DB_SYNC=true`(로컬)에서 테이블 자동 생성

---

### Phase 2: DDL Script for Staging/Production (수동 DDL)

#### Step 2.1: Create DDL SQL

**출력 위치**: `generate-order-seed.py` 스크립트 헤더 또는 별도 migration SQL

두 테이블의 `CREATE TABLE` + 인덱스 + 제약조건을 Python 스크립트 출력 SQL에 포함:

```sql
CREATE TABLE IF NOT EXISTS drd_raw_orders (...);
CREATE TABLE IF NOT EXISTS drd_raw_order_items (...);
```

└─ **사이드 임팩트**: 기존 테이블에 영향 없음 (신규 테이블 추가만)

---

### Phase 3: Python Seed Script (Excel→SQL 변환)

#### Step 3.1: Create `generate-order-seed.py`

**파일**: `apps/app-sales-report/generate-order-seed.py`

기능:
1. **Excel 파일 읽기**: `reference/appSalesReport/Order.all.20260301_20260331.xlsx`
2. **주문-아이템 분리**: 동일 `order_id`의 행들을 그룹화
3. **주문 상태 정규화**: Vietnamese → ENUM 매핑
4. **SKU 매칭**: DB의 기존 SKU WMS 코드 목록 로딩 → `oli_variant_sku` 매칭
5. **SQL 생성**: `seed-orders-202603.sql` 출력

처리 파이프라인:

```
1. openpyxl로 Excel 읽기
2. Row iteration → order_dict에 그룹화 (order_id 기준)
3. 각 order에 대해:
   a. UUID 생성 (ord_id)
   b. 주문 상태 정규화
   c. 주문 레벨 INSERT 생성
4. 각 item에 대해:
   a. UUID 생성 (oli_id)
   b. SKU 매칭 (variant_sku → sku_wms_code → sku_id)
   c. 아이템 레벨 INSERT 생성
5. SKU 매칭 결과 summary 출력
6. SQL 파일 기록
```

**SKU 매칭 방식**:
- Python 스크립트 내에 기존 `seed-product-master.sql` 또는 별도 매핑 데이터를 참조
- `sku_wms_code` → `sku_id` 딕셔너리 구축
- Combo 상품 (예: `Combo2_GIFT_KHANUOT`) → 'COMBO' 상태로 분류

**주문 레벨 중복 처리**:
- 동일 `order_id`가 여러 행에 나타날 때, 첫 번째 행의 주문 레벨 데이터 사용
- 금액/배송 관련은 주문 레벨이므로 행 간 차이 없음 확인

**PII 제외**:
- Col 54~56, 59~60 (이름, 전화, 상세주소) 건너뛰기

└─ **사이드 임팩트**: 기존 `generate-seed.py` 미변경. 독립 스크립트.

#### Step 3.2: Generate SQL & Execute

1. 로컬에서 스크립트 실행: `python3 apps/app-sales-report/generate-order-seed.py`
2. 출력 파일: `apps/app-sales-report/seed-orders-202603.sql`
3. 스테이징에서 SQL 실행:
   ```bash
   ssh ambAppStore@stg-apps.amoeba.site "docker exec -i mysql-apps mysql -uroot -pAmbApps2026Stg db_app_sales" < apps/app-sales-report/seed-orders-202603.sql
   ```

└─ **사이드 임팩트**: DB에 데이터 추가. 기존 테이블 무변경.

---

## 3. File Change List (변경 파일 목록)

| Category | File Path | Change Type |
|----------|-----------|-------------|
| **Backend/Entity** | `apps/app-sales-report/backend/src/domain/raw-order/entity/raw-order.entity.ts` | 신규 |
| **Backend/Entity** | `apps/app-sales-report/backend/src/domain/raw-order/entity/raw-order-item.entity.ts` | 신규 |
| **Backend/Module** | `apps/app-sales-report/backend/src/domain/raw-order/raw-order.module.ts` | 신규 |
| **Backend/AppModule** | `apps/app-sales-report/backend/src/app.module.ts` | 수정 (import 추가) |
| **Script** | `apps/app-sales-report/generate-order-seed.py` | 신규 |
| **SQL** | `apps/app-sales-report/seed-orders-202603.sql` | 신규 (생성 결과) |

---

## 4. Side Impact Analysis (사이드 임팩트 분석)

| Scope | Risk | Description |
|-------|------|-------------|
| 기존 5개 Entity | ✅ 없음 | `raw-order` 모듈은 독립적. 기존 Entity에 FK/관계 추가 없음 |
| 기존 API Endpoints | ✅ 없음 | Controller 미추가 (Phase 2에서 API 개발) |
| Frontend | ✅ 없음 | 변경 없음 |
| Docker Build | ✅ 없음 | Entity 추가만으로 빌드 영향 없음 |
| DB Sync (로컬) | ⚠️ 낮음 | `DB_SYNC=true` 시 자동 테이블 생성 — 기존 테이블 무영향 |
| DB Sync (스테이징) | ⚠️ 주의 | `DB_SYNC=false` — 수동 DDL 필요. DDL 미실행 시 Entity 로딩 경고 가능 |
| SKU Master 참조 | ⚠️ 낮음 | `drd_raw_order_items.sku_id`는 FK이지만 nullable — SKU 미매칭 허용 |
| 데이터 크기 | ✅ 낮음 | 월 5,000행 수준 — 성능 이슈 없음 |

---

## 5. DB Migration (DB 마이그레이션)

### 5.1 DDL — `drd_raw_orders`

```sql
CREATE TABLE IF NOT EXISTS drd_raw_orders (
  ord_id                        CHAR(36)        NOT NULL,
  ent_id                        CHAR(36)        NOT NULL,
  chn_code                      VARCHAR(20)     NOT NULL,
  ord_channel_order_id          VARCHAR(30)     NOT NULL,
  ord_package_id                VARCHAR(30)     NULL,
  ord_order_date                DATETIME        NOT NULL,
  ord_status                    VARCHAR(20)     NOT NULL,
  ord_status_raw                VARCHAR(500)    NULL,
  ord_cancel_reason             VARCHAR(500)    NULL,
  ord_tracking_no               VARCHAR(50)     NULL,
  ord_carrier                   VARCHAR(100)    NULL,
  ord_delivery_method           VARCHAR(50)     NULL,
  ord_order_type                VARCHAR(50)     NULL,
  ord_est_delivery_date         DATETIME        NULL,
  ord_ship_date                 DATETIME        NULL,
  ord_delivery_time             DATETIME        NULL,
  ord_total_weight_kg           DECIMAL(8,3)    NULL,
  ord_total_vnd                 DECIMAL(15,2)   NULL,
  ord_shop_voucher              VARCHAR(100)    NULL,
  ord_coin_cashback             DECIMAL(15,2)   NULL,
  ord_shopee_voucher            VARCHAR(100)    NULL,
  ord_promo_combo               VARCHAR(200)    NULL,
  ord_shopee_combo_discount     DECIMAL(15,2)   NULL,
  ord_shop_combo_discount       DECIMAL(15,2)   NULL,
  ord_shopee_coin_rebate        DECIMAL(15,2)   NULL,
  ord_card_discount             DECIMAL(15,2)   NULL,
  ord_trade_in_discount         DECIMAL(15,2)   NULL,
  ord_trade_in_bonus            DECIMAL(15,2)   NULL,
  ord_seller_trade_in_bonus     DECIMAL(15,2)   NULL,
  ord_shipping_fee_est          DECIMAL(15,2)   NULL,
  ord_buyer_shipping_fee        DECIMAL(15,2)   NULL,
  ord_shopee_shipping_subsidy   DECIMAL(15,2)   NULL,
  ord_return_shipping_fee       DECIMAL(15,2)   NULL,
  ord_total_buyer_payment       DECIMAL(15,2)   NULL,
  ord_completed_at              DATETIME        NULL,
  ord_paid_at                   DATETIME        NULL,
  ord_payment_method            VARCHAR(100)    NULL,
  ord_commission_fee            DECIMAL(15,2)   NULL,
  ord_service_fee               DECIMAL(15,2)   NULL,
  ord_payment_fee               DECIMAL(15,2)   NULL,
  ord_deposit                   DECIMAL(15,2)   NULL,
  ord_province                  VARCHAR(100)    NULL,
  ord_district                  VARCHAR(100)    NULL,
  ord_country                   VARCHAR(50)     NULL,
  ord_import_batch_id           VARCHAR(50)     NULL,
  ord_created_at                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ord_updated_at                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_drd_raw_orders PRIMARY KEY (ord_id),
  CONSTRAINT uq_drd_raw_orders_channel_order UNIQUE (ent_id, chn_code, ord_channel_order_id)
);

CREATE INDEX idx_drd_raw_orders_date ON drd_raw_orders (ent_id, ord_order_date);
CREATE INDEX idx_drd_raw_orders_status ON drd_raw_orders (ent_id, ord_status);
CREATE INDEX idx_drd_raw_orders_batch ON drd_raw_orders (ord_import_batch_id);
```

### 5.2 DDL — `drd_raw_order_items`

```sql
CREATE TABLE IF NOT EXISTS drd_raw_order_items (
  oli_id                    CHAR(36)        NOT NULL,
  ent_id                    CHAR(36)        NOT NULL,
  ord_id                    CHAR(36)        NOT NULL,
  sku_id                    CHAR(36)        NULL,
  oli_product_sku           VARCHAR(50)     NULL,
  oli_product_name          VARCHAR(500)    NULL,
  oli_variant_sku           VARCHAR(30)     NULL,
  oli_variant_name          VARCHAR(200)    NULL,
  oli_is_bestseller         TINYINT(1)      NOT NULL DEFAULT 0,
  oli_weight_kg             DECIMAL(8,3)    NULL,
  oli_original_price        DECIMAL(15,2)   NULL,
  oli_seller_discount       DECIMAL(15,2)   NULL,
  oli_shopee_discount       DECIMAL(15,2)   NULL,
  oli_total_seller_subsidy  DECIMAL(15,2)   NULL,
  oli_deal_price            DECIMAL(15,2)   NULL,
  oli_quantity              INT             NOT NULL DEFAULT 1,
  oli_return_quantity       INT             NULL DEFAULT 0,
  oli_buyer_paid            DECIMAL(15,2)   NULL,
  oli_return_status         VARCHAR(50)     NULL,
  oli_sku_match_status      VARCHAR(10)     NOT NULL DEFAULT 'UNMATCHED',
  oli_created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  oli_updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_drd_raw_order_items PRIMARY KEY (oli_id),
  CONSTRAINT fk_drd_raw_order_items_order FOREIGN KEY (ord_id) REFERENCES drd_raw_orders (ord_id),
  CONSTRAINT fk_drd_raw_order_items_sku FOREIGN KEY (sku_id) REFERENCES drd_sku_masters (sku_id)
);

CREATE INDEX idx_drd_raw_order_items_ord ON drd_raw_order_items (ent_id, ord_id);
CREATE INDEX idx_drd_raw_order_items_sku ON drd_raw_order_items (ent_id, oli_variant_sku);
CREATE INDEX idx_drd_raw_order_items_sku_id ON drd_raw_order_items (sku_id);
```

### 5.3 Execution Order (실행 순서)

```
1. drd_raw_orders CREATE TABLE (독립)
2. drd_raw_order_items CREATE TABLE (drd_raw_orders, drd_sku_masters FK 참조)
3. INDEX 생성
4. seed-orders-202603.sql 실행 (INSERT)
```

---

## 6. Implementation Checklist (구현 체크리스트)

| # | Task | Files | Priority |
|---|------|-------|----------|
| 1 | `RawOrderEntity` TypeORM Entity 작성 | `raw-order.entity.ts` | P0 |
| 2 | `RawOrderItemEntity` TypeORM Entity 작성 | `raw-order-item.entity.ts` | P0 |
| 3 | `RawOrderModule` 작성 | `raw-order.module.ts` | P0 |
| 4 | `AppModule`에 import 추가 | `app.module.ts` | P0 |
| 5 | `generate-order-seed.py` Python 스크립트 작성 | `generate-order-seed.py` | P0 |
| 6 | 로컬 실행 & SQL 생성 검증 | `seed-orders-202603.sql` | P0 |
| 7 | 스테이징 DDL 실행 + 데이터 임포트 | SSH + docker exec | P0 |
| 8 | 데이터 검증 (주문 수, 아이템 수, 매칭율) | SQL query | P0 |
