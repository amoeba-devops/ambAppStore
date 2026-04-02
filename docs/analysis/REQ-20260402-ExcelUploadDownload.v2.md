# Excel Upload/Download — Requirements Analysis (엑셀 업로드/다운로드 요구사항 분석서)

---
document_id: AMA-SAL-ANALYSIS-2.0.0
version: 2.0.0
status: Draft
created: 2026-04-02
app: app-sales-report
based_on: User Request 2026-04-02
---

## 1. Requirements Summary (요구사항 요약)

| # | Requirement (요구사항) | Type (유형) | Priority |
|---|----------------------|-------------|----------|
| R-001 | Product Master Excel upload — UPSERT by WMS code (SKU코드 기준 업서트) | Functional | P0 |
| R-002 | Product Master Excel download — current data export (현재 데이터 다운로드) | Functional | P0 |
| R-003 | Product Master upload sample Excel template (업로드 샘플 엑셀 제공) | Functional | P0 |
| R-004 | Sales data direct input — SPU+SKU+Channel+price+date manual entry (직접입력) | Functional | P1 |
| R-005 | Sales data Excel upload — Shopee order export parsing (쇼피 주문 업로드) | Functional | P1 |
| R-006 | Sales data Excel upload — TikTok order export parsing (틱톡 주문 업로드) | Functional | P1 |
| R-007 | Sales data Excel upload — Amoeba WMS daily shipment data (WMS 출고 업로드) | Functional | P1 |
| R-008 | Reference report upload — Shopee/TikTok marketplace reports by 4 types (참고리포트 업로드) | Functional | P2 |
| R-009 | Report file storage in categorized folders (보고서 폴더 분류 저장) | Functional | P2 |

---

## 2. AS-IS Analysis (현황 분석)

### 2.1 Backend (백엔드 현황)

| Item | Current State (현재 상태) |
|------|-------------------------|
| **Framework** | NestJS 11 + TypeORM 0.3.20 + MySQL 8.0 |
| **Domains** | 5 modules: `spu-master`, `sku-master`, `channel-master`, `channel-product-mapping`, `sku-cost-history` |
| **API Base** | `GET/POST/PATCH/DELETE /api/v1/{resource}` — standard CRUD only |
| **File upload** | **Not implemented** — no multipart support, no `multer`, no `exceljs` dependency |
| **File storage** | **Not implemented** — no disk/S3 storage mechanism |
| **Sales data tables** | **Not exist** — no `drd_sales_*` tables |
| **Auth** | `@Auth()` decorator → JWT + ent_id extraction, fully working |

**Key files (주요 파일):**
- Entity: [spu-master.entity.ts](../../apps/app-sales-report/backend/src/domain/spu-master/entity/spu-master.entity.ts) — 14 columns
- Entity: [sku-master.entity.ts](../../apps/app-sales-report/backend/src/domain/sku-master/entity/sku-master.entity.ts) — 22 columns
- Entity: [channel-master.entity.ts](../../apps/app-sales-report/backend/src/domain/channel-master/entity/channel-master.entity.ts) — 9 columns (PK=chn_code)
- Entity: [channel-product-mapping.entity.ts](../../apps/app-sales-report/backend/src/domain/channel-product-mapping/entity/channel-product-mapping.entity.ts) — 14 columns

### 2.2 Frontend (프론트엔드 현황)

| Item | Current State |
|------|--------------|
| **Pages** | 4 pages: Dashboard(placeholder), SPU List, SKU List, Channel Mapping |
| **Excel handling** | **Not implemented** — no xlsx/exceljs, no file upload component |
| **Sales data pages** | **Not exist** |
| **Report pages** | **Not exist** |
| **Routing** | `/`, `/spu`, `/sku`, `/channel-mapping` |
| **i18n** | `sales` namespace, 3 languages (ko/en/vi) |

### 2.3 Database (DB 현황)

| Table | Rows | Status |
|-------|------|--------|
| `drd_spu_masters` | 44 | Seeded (Socialbean data) |
| `drd_sku_masters` | 178 | Seeded (Socialbean data) |
| `drd_channel_masters` | 0 | Empty (needs seed data: SHOPEE, TIKTOK, INFLUENCER, B2B, OTHER) |
| `drd_channel_product_mappings` | 0 | Empty |
| `drd_sku_cost_histories` | 0 | Empty |
| Sales tables | — | **Not exist** |
| Report storage | — | **Not exist** |

### 2.4 Problems (문제점)

1. **No Excel processing capability** — Backend lacks `exceljs`/`multer` dependencies
2. **No sales transaction tables** — Cannot store daily sales data
3. **No file storage** — Cannot store uploaded report files
4. **Channel master is empty** — No seed data for Shopee/TikTok/etc.
5. **No sales input UI** — Dashboard is a placeholder

---

## 3. TO-BE Requirements (TO-BE 요구사항)

### 3.1 AS-IS → TO-BE Mapping (변경 매핑표)

| Area | AS-IS | TO-BE |
|------|-------|-------|
| Product Master | Manual SQL seed only | Excel upload (UPSERT by WMS code) + download + template |
| Sales Data | Not exist | Direct input form + Shopee/TikTok/WMS Excel upload |
| Report Files | Not exist | 4-type marketplace report upload with folder storage |
| Channel Master | Empty table | Seed data (SHOPEE, TIKTOK, INFLUENCER, B2B, OTHER) |
| Backend deps | No file handling | `multer` + `exceljs` + file storage |
| Frontend deps | No xlsx | `xlsx`(SheetJS) or `exceljs` for client-side template download |

### 3.2 New Entities (신규 엔티티)

#### 3.2.1 `drd_sales_records` — Sales Transaction (판매 데이터)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `sal_id` | CHAR(36) PK | NO | UUID |
| `ent_id` | CHAR(36) | NO | Entity ID (멀티테넌시) |
| `sku_id` | CHAR(36) FK | NO | SKU 참조 |
| `chn_code` | VARCHAR(20) FK | NO | 채널 코드 |
| `sal_order_date` | DATE | NO | 판매일 (고객 주문일) |
| `sal_order_id` | VARCHAR(100) | YES | 마켓플레이스 주문번호 |
| `sal_quantity` | INT | NO | 판매 수량 |
| `sal_selling_price` | DECIMAL(15,2) | NO | 실제 판매가 (할인 후) |
| `sal_listing_price` | DECIMAL(15,2) | YES | 정상가 (자동 삽입) |
| `sal_revenue` | DECIMAL(15,2) | NO | 매출액 (qty × selling_price) |
| `sal_source` | ENUM | NO | 'MANUAL', 'SHOPEE', 'TIKTOK', 'WMS' |
| `sal_memo` | VARCHAR(500) | YES | 메모 |
| `sal_created_at` | DATETIME | NO | 생성일 |
| `sal_updated_at` | DATETIME | NO | 수정일 |
| `sal_deleted_at` | DATETIME | YES | Soft delete |

#### 3.2.2 `drd_upload_histories` — Upload History (업로드 이력)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `uph_id` | CHAR(36) PK | NO | UUID |
| `ent_id` | CHAR(36) | NO | Entity ID |
| `uph_type` | ENUM | NO | 'PRODUCT_MASTER', 'SALES_SHOPEE', 'SALES_TIKTOK', 'SALES_WMS', 'REPORT_SALES', 'REPORT_ADS', 'REPORT_TRAFFIC', 'REPORT_AFFILIATE' |
| `uph_file_name` | VARCHAR(300) | NO | 원본 파일명 |
| `uph_file_path` | VARCHAR(500) | NO | 저장 경로 |
| `uph_file_size` | INT | NO | 파일 크기 (bytes) |
| `uph_row_count` | INT | YES | 처리 행 수 |
| `uph_success_count` | INT | YES | 성공 건수 |
| `uph_error_count` | INT | YES | 실패 건수 |
| `uph_status` | ENUM | NO | 'PROCESSING', 'COMPLETED', 'FAILED' |
| `uph_error_detail` | TEXT | YES | 에러 상세 |
| `uph_created_by` | VARCHAR(100) | YES | 업로드 사용자 |
| `uph_created_at` | DATETIME | NO | 업로드 시각 |

### 3.3 New API Endpoints (신규 API)

#### Product Master Excel (상품마스터 엑셀)

```
GET    /api/v1/product-master/template          # Sample Excel template download (샘플 다운로드)
GET    /api/v1/product-master/export             # Current data → Excel download (데이터 다운로드)
POST   /api/v1/product-master/import             # Excel upload → UPSERT (엑셀 업로드)
```

#### Sales Data (판매 데이터)

```
GET    /api/v1/sales-records                     # Sales list (판매 목록)
POST   /api/v1/sales-records                     # Direct input (직접 입력)
PATCH  /api/v1/sales-records/:sal_id             # Sales update (수정)
DELETE /api/v1/sales-records/:sal_id             # Soft delete
POST   /api/v1/sales-records/import/shopee       # Shopee Excel upload (쇼피 주문)
POST   /api/v1/sales-records/import/tiktok       # TikTok Excel upload (틱톡 주문)
POST   /api/v1/sales-records/import/wms          # WMS shipment Excel upload (WMS 출고)
```

#### Reference Reports (참고 보고서)

```
POST   /api/v1/reports/upload                    # Report file upload (보고서 업로드)
GET    /api/v1/reports                            # Report list (보고서 목록)
GET    /api/v1/reports/:uph_id/download           # Report file download (보고서 다운로드)
DELETE /api/v1/reports/:uph_id                    # Report delete (보고서 삭제)
```

### 3.4 New Frontend Pages (신규 페이지)

| Route | Page | Description |
|-------|------|-------------|
| `/sales` | `SalesRecordListPage` | Sales data list + direct input modal + Excel import |
| `/reports` | `ReportListPage` | Reference report upload/list by category |

Existing page enhancements:
- `SkuMasterListPage` — Add Excel upload/download/template buttons to toolbar

### 3.5 Business Logic (비즈니스 로직)

#### Product Master UPSERT Logic

```
1. Parse uploaded Excel (exceljs)
2. For each row:
   a. Find SKU by sku_wms_code (WMS code) + ent_id
   b. IF exists → UPDATE all fields
   c. IF not exists:
      - Extract spu_code from wms_code[:7]
      - Find or create SPU
      - INSERT new SKU with spu_id reference
3. Return: { total, inserted, updated, errors[] }
```

#### Shopee Order Excel Parsing

```
Expected columns (Shopee Vietnam export):
- Order ID, Order Creation Date, Product Name, Variation Name,
  Original Price, Deal Price, Quantity, Order Status
Mapping:
- sal_order_id ← Order ID
- sal_order_date ← Order Creation Date
- SKU matching ← Product Name + Variation → sku_wms_code lookup
- sal_selling_price ← Deal Price
- sal_listing_price ← Original Price
- sal_quantity ← Quantity
- chn_code ← 'SHOPEE'
- sal_source ← 'SHOPEE'
```

#### TikTok Order Excel Parsing

```
Expected columns (TikTok Shop export):
- Order ID, Created Time, Product Name, SKU Name,
  SKU Unit Original Price, SKU Subtotal After Discount, Quantity
Mapping:
- sal_order_id ← Order ID
- sal_order_date ← Created Time
- sal_selling_price ← SKU Subtotal After Discount / Quantity
- sal_listing_price ← SKU Unit Original Price
- sal_quantity ← Quantity
- chn_code ← 'TIKTOK'
- sal_source ← 'TIKTOK'
```

#### WMS Shipment Excel Parsing

```
Amoeba WMS daily shipment export:
- Shipment Date, WMS Code, Product Name, Quantity, Recipient
Mapping:
- sal_order_date ← Shipment Date
- SKU matching ← WMS Code → sku_wms_code exact match
- sal_quantity ← Quantity
- chn_code ← derived from order context or 'OTHER'
- sal_source ← 'WMS'
```

#### Report File Storage Structure

```
uploads/{ent_id}/reports/
├── sales/          # 판매 보고서 (REPORT_SALES)
├── ads/            # 광고 보고서 (REPORT_ADS)
├── traffic/        # 트래픽 보고서 (REPORT_TRAFFIC)
└── affiliate/      # 제휴 보고서 (REPORT_AFFILIATE)
```

---

## 4. Gap Analysis (갭 분석)

### 4.1 Change Scope Summary (변경 범위 요약)

| Area | Current | Change | Impact |
|------|---------|--------|--------|
| Backend dependencies | No file handling | +multer, +exceljs | Low |
| Backend modules | 5 domains | +product-master-excel, +sales-record, +report-upload (3 new) | Medium |
| DB tables | 5 tables | +drd_sales_records, +drd_upload_histories (2 new) | Medium |
| Frontend pages | 4 pages | +SalesRecordListPage, +ReportListPage (2 new) | Medium |
| Frontend dependencies | No xlsx | +exceljs(frontend) | Low |
| Existing SKU page | CRUD only | +Excel buttons (upload/download/template) | Low |
| i18n | sales namespace | +sales.upload.*, +sales.salesRecord.*, +sales.report.* keys | Low |
| File storage | None | Docker volume mount for uploads | Low |
| Channel master | Empty | Seed data required (5 channels) | Low |

### 4.2 File Change List (파일 변경 목록)

| Type | File | Change |
|------|------|--------|
| **BE** | `package.json` | Add `multer`, `exceljs`, `@types/multer` |
| **BE** | `domain/product-master-excel/` | **New** module (controller, service, module) |
| **BE** | `domain/sales-record/` | **New** module (entity, controller, service, dto, module) |
| **BE** | `domain/report-upload/` | **New** module (controller, service, module) |
| **BE** | `domain/upload-history/` | **New** entity + module |
| **BE** | `app.module.ts` | Register new modules |
| **FE** | `package.json` | Add `exceljs`, `file-saver` |
| **FE** | `domain/sku-master/pages/SkuMasterListPage.tsx` | Add upload/download buttons |
| **FE** | `domain/sales-record/` | **New** (pages, hooks, service, types) |
| **FE** | `domain/report-upload/` | **New** (pages, hooks, service, types) |
| **FE** | `App.tsx` | Add routes `/sales`, `/reports` |
| **FE** | `i18n/locales/{ko,en,vi}/sales.json` | Add new translation keys |
| **DB** | `drd_sales_records` | **New** table |
| **DB** | `drd_upload_histories` | **New** table |
| **DB** | `drd_channel_masters` | Seed data INSERT |

### 4.3 DB Migration Strategy

- **Staging**: `DB_SYNC=true` → TypeORM auto-creates tables on restart
- **Production**: Manual `ALTER TABLE` / `CREATE TABLE` SQL after staging validation
- Channel master seed: INSERT SQL script

---

## 5. User Flow (사용자 플로우)

### 5.1 Product Master Excel Upload

```
[User] SKU Master 페이지 접속
  │
  ├─ [Download Template] 클릭
  │   └─ GET /api/v1/product-master/template
  │   └─ 브라우저에서 sample_product_master.xlsx 다운로드
  │
  ├─ [Download Current Data] 클릭  
  │   └─ GET /api/v1/product-master/export
  │   └─ 현재 SPU+SKU 전체 데이터 엑셀 다운로드
  │
  └─ [Excel Upload] 클릭
      └─ 파일 선택 (drag & drop)
      └─ POST /api/v1/product-master/import (multipart/form-data)
      └─ 서버: parse → UPSERT (WMS code 기준)
      └─ 결과 표시: 총 N건, 신규 X건, 수정 Y건, 에러 Z건
      └─ 에러 행 목록 표시 (행번호 + 사유)
```

### 5.2 Sales Data Direct Input

```
[User] 판매 데이터 페이지 접속
  └─ [직접 입력] 버튼 클릭 → 모달 오픈
      ├─ 상품 선택: SPU → SKU 연동 (검색 셀렉트)
      ├─ 판매처 선택: 채널 드롭다운 (SHOPEE, TIKTOK, INFLUENCER, B2B, OTHER)
      ├─ 실 판매가 입력 (할인 후 가격)
      ├─ 정상가 자동 표시 (SKU listing_price or selling_price)
      ├─ 판매 수량 입력
      ├─ 판매일 선택 (DatePicker)
      └─ [저장] → POST /api/v1/sales-records
```

### 5.3 Sales Data Marketplace Excel Upload

```
[User] 판매 데이터 페이지
  └─ [엑셀 업로드] 드롭다운 → 쇼피/틱톡/WMS 선택
      └─ 파일 선택
      └─ POST /api/v1/sales-records/import/{shopee|tiktok|wms}
      └─ 서버: 마켓별 컬럼 파싱 → SKU 매칭 → INSERT
      └─ 결과: 총 N건 처리, 성공 X건, SKU 미매칭 Y건
```

### 5.4 Reference Report Upload

```
[User] 참고 보고서 페이지 접속
  └─ 보고서 유형 탭 선택 (판매/광고/트래픽/제휴)
      └─ [파일 업로드] 클릭
      └─ 마켓플레이스 선택 (SHOPEE/TIKTOK)
      └─ 파일 선택 (복수 가능)
      └─ POST /api/v1/reports/upload (multipart + type + marketplace)
      └─ 폴더별 저장 → 이력 기록
      └─ AI 분석보고서 작성시 참조 가능
```

---

## 6. Technical Constraints (기술 제약사항)

| Constraint | Description |
|-----------|-------------|
| **File size limit** | 10MB per upload (Excel/report files) |
| **Excel format** | `.xlsx` only (not `.xls`) — exceljs handles xlsx natively |
| **Multi-tenancy** | All data isolated by `ent_id` — uploads only affect own entity |
| **SKU matching** | Shopee/TikTok SKU matching relies on product name fuzzy match or WMS code mapping |
| **Storage** | Docker volume mount (`./uploads:/app/uploads`) — not S3 (staging) |
| **Concurrent uploads** | Single file per request (queue if needed later) |
| **Character encoding** | UTF-8 required for Vietnamese product names |
| **Report files** | Store as-is (no parsing), AI reads later for analysis report generation |
