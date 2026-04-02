# Excel Upload/Download — Requirements Analysis v3.1 (엑셀 업로드/다운로드 요구사항 분석서)

---
document_id: AMA-SAL-ANALYSIS-3.1.0
version: 3.1.0
status: Draft
created: 2026-04-02
app: app-sales-report
based_on: Codebase review 2026-04-02 + Actual sample file analysis
previous_version: AMA-SAL-ANALYSIS-3.0.0
change_note: v3.0 문서의 AS-IS가 실제 코드와 불일치 → 전면 재작성
---

## 1. Requirements Summary (요구사항 요약)

| # | Requirement (요구사항) | Type | Priority | Status |
|---|----------------------|------|----------|--------|
| R-001 | Product Master Excel upload — UPSERT by WMS code (상품마스터 업로드) | Functional | P0 | **TODO** |
| R-002 | Product Master Excel download — current data export (상품마스터 다운로드) | Functional | P0 | **TODO** |
| R-003 | Product Master upload sample template (샘플 엑셀 템플릿 다운로드) | Functional | P0 | **TODO** |
| R-004 | Shopee order report upload & parsing — `Order_report.xlsx` (쇼피 판매리포트 업로드) | Functional | P0 | **DONE** |
| R-005 | TikTok order report upload & parsing — `tiktok-sales_report.xlsx` (틱톡 판매리포트 업로드) | Functional | P0 | **DONE** |
| R-006 | Shopee traffic report upload — `traffice_report.xlsx` (쇼피 트래픽리포트) | Functional | P1 | **TODO** |
| R-007 | TikTok traffic report upload — `tiktok-traffic-product_list.xlsx` (틱톡 트래픽리포트) | Functional | P1 | **TODO** |
| R-008 | Shopee ad report upload — `ad_report.csv` (쇼피 광고리포트) | Functional | P1 | **TODO** |
| R-009 | TikTok ad product report upload — `tiktok-ad-creative...xlsx` (틱톡 상품광고리포트) | Functional | P1 | **TODO** |
| R-010 | TikTok ad live report upload — `tiktok-ad-livestream...xlsx` (틱톡 라이브광고리포트) | Functional | P1 | **TODO** |
| R-011 | Shopee seller/affiliate report upload — `seller_report.csv` (쇼피 셀러/제휴리포트) | Functional | P2 | **TODO** |
| R-012 | Upload history tracking & management (업로드 이력 관리) | Functional | P1 | **PARTIAL** |
| R-013 | SKU auto-matching from order imports (주문 업로드 시 SKU 자동매칭) | Functional | P0 | **DONE** |
| R-014 | Order list & detail view (주문 데이터 조회) | Functional | P1 | **TODO** |
| R-015 | Daily report page with metrics (일일 리포트 페이지) | Functional | P0 | **DONE** |

---

## 2. AS-IS Analysis (현황 분석) — 2026-04-02 기준 실제 코드

### 2.1 Backend (백엔드 현황)

| Item | Current State |
|------|--------------|
| **Framework** | NestJS 11 + TypeORM 0.3.20 + MySQL 8.0 |
| **Domains** | 6 modules: `spu-master`, `sku-master`, `channel-master`, `channel-product-mapping`, `sku-cost-history`, `raw-order` |
| **API Base** | `GET/POST/PATCH/DELETE /api/v1/{resource}` — standard CRUD |
| **File upload** | `@nestjs/platform-express` + `@types/multer` installed, **order upload endpoint WORKING** |
| **Excel libraries** | `exceljs@^4.4.0` (actively used in parsers) + `xlsx@^0.18.5` (installed but unused) |
| **Raw Order** | **FULLY IMPLEMENTED** — controller + service + 2 parsers + DTOs |
| **Auth** | `@Auth()` decorator → JWT + ent_id extraction, fully working |
| **Swagger** | `@nestjs/swagger` installed |

**Raw Order Module — IMPLEMENTED files:**
```
domain/raw-order/
├── controller/raw-order.controller.ts    ✅ 3 endpoints
├── service/raw-order.service.ts          ✅ upload, history, daily summary
├── parser/
│   ├── excel-parser.interface.ts         ✅ ParsedOrder, ParsedOrderItem, ExcelParser
│   ├── shopee-excel.parser.ts            ✅ 68-col Vietnamese, ExcelJS
│   └── tiktok-excel.parser.ts            ✅ 54-col English, Row 2 skip, ExcelJS
├── dto/
│   ├── request/upload-order.request.ts   ✅ channel validation
│   └── response/upload-result.response.ts ✅ ordersCreated/Skipped/matchStats
├── entity/
│   ├── raw-order.entity.ts               ✅ 40+ columns
│   └── raw-order-item.entity.ts          ✅ 20+ columns
└── raw-order.module.ts                   ✅ controller + service + parsers registered
```

**Working API Endpoints:**
| Method | Path | Description | Status |
|--------|------|-------------|--------|
| `POST` | `/v1/raw-orders/upload` | Excel file upload (channel=SHOPEE/TIKTOK) | ✅ Working |
| `GET` | `/v1/raw-orders/upload-history` | Last 50 uploads by batch_id | ✅ Working |
| `GET` | `/v1/raw-orders/daily-summary` | Aggregated daily stats (date range, channel) | ✅ Working |

**Key Implementation Details:**
1. **Single upload endpoint** (`POST /v1/raw-orders/upload`) with `channel` body param — NOT separate per-channel endpoints
2. **ExcelJS** is the actual parser library (not xlsx/SheetJS)
3. **Upload history** is NOT a separate entity/table — tracked via `ord_import_batch_id` field grouped in query
4. **SKU matching** implemented in service: `variant_sku` → `sku_wms_code` lookup + COMBO detection (`Combo`, `COMBO`, `_GIFT_` prefix)
5. **Duplicate handling**: skip existing orders (not UPSERT — ordersSkipped counter)
6. **Transaction-based** batch import with rollback on error

**Other Existing Modules (unchanged from v3.0):**
- `spu-master/` — Full CRUD (Entity, Controller, Service, DTO, Mapper)
- `sku-master/` — Full CRUD + cost history
- `channel-master/` — Full CRUD
- `channel-product-mapping/` — Full CRUD (Entity, Controller, Service, DTO, Mapper)
- `sku-cost-history/` — Full CRUD
- `auth/` — JWT strategy, guards, @Auth() decorator
- `common/` — Filters, exceptions, DTOs

### 2.2 Frontend (프론트엔드 현황)

| Item | Current State |
|------|--------------|
| **Pages** | **6 pages**: Dashboard, SPU, SKU, ChannelMapping, **OrderUpload, DailyReport** |
| **Routing** | `/`, `/spu`, `/sku`, `/channel-mapping`, `/daily-report`, `/upload` |
| **Upload UI** | **OrderUploadPage** — FULLY IMPLEMENTED (drag&drop, channel selector, result display) |
| **Daily Report** | **DailyReportPage** — FULLY IMPLEMENTED (date filters, channel tabs, summary cards, data table) |
| **Charts** | `recharts@^2.12.7` installed (not yet used in dashboard) |
| **i18n** | `sales` namespace with `upload.*`, `daily.*`, `nav.*` keys in 3 languages |
| **State** | Zustand (auth/toast), React Query 5 (server) |

**Sidebar Navigation (현재 5개 섹션):**
```
Dashboard                    → / (placeholder)
├── Product Master
│   ├── SPU 관리             → /spu ✅
│   ├── SKU 관리             → /sku ✅
│   └── 채널 매핑            → /channel-mapping ✅
├── Sales Report
│   ├── 일일 리포트          → /daily-report ✅
│   ├── 주간 CM              → /weekly-cm (nav only, no page)
│   ├── 월간 CM              → /monthly-cm (nav only, no page)
│   ├── 라이브스트림          → /livestream (nav only, no page)
│   └── 크리에이터            → /creator (nav only, no page)
├── Data Input
│   ├── 판매 데이터 업로드    → /upload ✅
│   └── 수동 입력            → /manual-input (nav only, no page)
└── Settings
    ├── 설정                  → /settings (nav only, no page)
    └── 알림                  → /notifications (nav only, no page)
```

### 2.3 Database (DB 현황)

| Table | Rows | Status |
|-------|------|--------|
| `drd_spu_masters` | 44 | Seeded |
| `drd_sku_masters` | 178 | Seeded — `sku_wms_code` = matching key |
| `drd_channel_masters` | 5 | SHOPEE, TIKTOK, INFLUENCER, B2B, OTHER |
| `drd_channel_product_mappings` | 0 | Empty |
| `drd_sku_cost_histories` | 0 | Empty |
| `drd_raw_orders` | ~4,977 | Imported from Shopee sample |
| `drd_raw_order_items` | ~4,977+ | Imported from Shopee sample |

### 2.4 Remaining Problems (미해결 문제)

1. **No Product Master Excel** — SPU/SKU 벌크 업로드/다운로드 기능 없음
2. **No reference report tables** — traffic/ad/affiliate 데이터 저장 불가
3. **No dedicated upload history entity** — `ord_import_batch_id` 그루핑 방식은 제한적 (파일명, 파일크기, 에러 상세 누락)
4. **No order list/detail page** — 업로드 후 데이터 조회 UI 없음
5. **Dashboard placeholder** — 실제 매출 지표 없음
6. **Duplicate handling**: 현재 SKIP 방식 → UPSERT 필요 (재업로드 시 기존 데이터 갱신)

---

## 3. TO-BE Requirements (TO-BE 요구사항)

### 3.1 AS-IS → TO-BE Mapping

| Area | AS-IS (현재 구현 상태) | TO-BE (추가 구현 필요) |
|------|----------------------|----------------------|
| Product Master | CRUD via UI only | +Excel upload (UPSERT by WMS) +download +template |
| Order Import (Shopee) | ✅ Upload working, SKIP duplicates | Enhance: UPSERT on re-upload (update existing) |
| Order Import (TikTok) | ✅ Upload working, SKIP duplicates | Enhance: UPSERT on re-upload |
| Order View | ❌ No page | +Order list/detail pages |
| Upload History | Basic batch_id grouping | +Dedicated entity (filename, size, errors, period) |
| Traffic (Shopee) | ❌ Not exist | +New entity + parser (7 sheets, 40 cols Vietnamese) |
| Traffic (TikTok) | ❌ Not exist | +New entity + parser (38 cols, header at Row 3) |
| Ad (Shopee) | ❌ Not exist | +New entity + CSV parser (metadata rows 1-7, ~25 cols) |
| Ad (TikTok Product) | ❌ Not exist | +New entity + parser (26 cols Vietnamese) |
| Ad (TikTok Live) | ❌ Not exist | +New entity + parser (19 cols Vietnamese) |
| Affiliate (Shopee) | ❌ Not exist | +New entity + CSV parser (38 cols Vietnamese) |
| Dashboard | Placeholder | +Real metrics from daily summary data |
| Daily Report | ✅ Working | Maintain |

### 3.2 Sample File Specifications (실제 샘플 파일 분석 결과)

> Note: §3.2.1과 §3.2.2는 이미 구현 완료. 아래는 참고용 + 구현된 파서와의 비교 보존.

#### 3.2.1 Shopee Order Report — `Order_report.xlsx` ✅ IMPLEMENTED

| Attribute | Value | Parser |
|-----------|-------|--------|
| Format | XLSX | `shopee-excel.parser.ts` (ExcelJS) |
| Sheet | `orders` | `workbook.getWorksheet('orders') \|\| worksheets[0]` |
| Total columns | **68** | Mapped via 1-indexed ExcelJS row.values |
| Header row | Row 1 | `if (rowNum === 1) return;` → skip |
| Data start | Row 2 | `ws.eachRow` from row 2 |
| Language | Vietnamese | Status map: `Hoàn thành→COMPLETED`, etc. |
| SKU matching | C20 (`SKU phân loại hàng`) | `parsedItem.variantSku` → `sku_wms_code` |
| Duplicate | Check `(ent_id, chn_code, ordChannelOrderId)` | Skip if exists (not UPSERT) |
| Multi-item | Multiple rows share same C01 (Order ID) | `orderMap.has(orderId)` grouping |

#### 3.2.2 TikTok Sales Report — `tiktok-sales_report.xlsx` ✅ IMPLEMENTED

| Attribute | Value | Parser |
|-----------|-------|--------|
| Format | XLSX | `tiktok-excel.parser.ts` (ExcelJS) |
| Sheet | `OrderSKUList` | `workbook.getWorksheet('OrderSKUList') \|\| worksheets[0]` |
| Total columns | **54** | Mapped via 1-indexed ExcelJS row.values |
| **Row 2** | **column descriptions — SKIPPED** | `if (rowNum <= 2) return;` |
| Data start | **Row 3** | OK |
| Language | English headers | Status map: `Đã hoàn tất→COMPLETED`, etc. |
| Date format | **DD/MM/YYYY HH:mm:ss** | `parseTikTokDate()` with regex |
| SKU matching | C07 (`Seller SKU`) | `= r[7]` → `parsedItem.variantSku` |

#### 3.2.3 Shopee Traffic Report — `traffice_report.xlsx` (TODO)

| Attribute | Value |
|-----------|-------|
| Format | XLSX |
| Sheets | **7 sheets** (Sản Phẩm Hiệu Quả Tốt, 5더… see v3.0 §3.2.3) |
| Primary sheet | Sheet 0: ~40 columns, ~249 product rows |
| Header language | Vietnamese |
| Data format | Dots=thousands (`565.063.917`), comma=decimal for % (`1,77%`) |
| Variant-level | C04≠`-` → variant row; C04=`-` → product aggregate |
| SKU key | C07 (SKU phân loại) |

#### 3.2.4 TikTok Traffic Report — `tiktok-traffic-product_list.xlsx` (TODO)

| Attribute | Value |
|-----------|-------|
| Format | XLSX |
| Sheet | `Sheet1`, **38 columns**, ~205 products |
| **Row 1** | Date range label → **SKIP** (extract period) |
| **Row 2** | Empty → **SKIP** |
| **Row 3** | Actual headers |
| Data start | **Row 4** |
| Data format | ₫ symbol in GMV (`192.612.578₫`), dot decimal for % |
| 4 channel groups | Cửa hàng / LIVE / video / thẻ sản phẩm (each 8 metrics) |

#### 3.2.5 Shopee Ad Report — `ad_report.csv` (TODO)

| Attribute | Value |
|-----------|-------|
| Format | **CSV** (UTF-8 with BOM) |
| **Rows 1-7** | Metadata (shop info, date range) → **SKIP** |
| Header row | **Row 8** |
| Data start | **Row 9** |
| Columns | **~25** |
| Last row | May be "Shop Ads" type — different structure |

#### 3.2.6 TikTok Ad Product — `tiktok-ad-creative...xlsx` (TODO)

| Attribute | Value |
|-----------|-------|
| Format | XLSX, sheet `Data` |
| Columns | **26**, ~1,121 creative-level rows |
| Data start | Row 2 |
| Includes | Video engagement rates (2s/6s/25/50/75/100%) |

#### 3.2.7 TikTok Ad Live — `tiktok-ad-livestream...xlsx` (TODO)

| Attribute | Value |
|-----------|-------|
| Format | XLSX, sheet `Data` |
| Columns | **19**, ~16 live sessions |
| Data start | Row 2 |

#### 3.2.8 Shopee Seller/Affiliate — `seller_report.csv` (TODO)

| Attribute | Value |
|-----------|-------|
| Format | **CSV** (UTF-8 with BOM) |
| Columns | **38**, ~2,830 rows |
| Data start | Row 2 |
| Includes | Commission breakdown, L1/L2/L3 category |

### 3.3 New Entities Needed (신규 엔티티)

| # | Entity / Table | Purpose | Source File |
|---|---------------|---------|-------------|
| 1 | `drd_upload_histories` | **Dedicated** upload tracking (all types) | All uploads |
| 2 | `drd_shopee_traffic` | Shopee traffic report data | `traffice_report.xlsx` |
| 3 | `drd_tiktok_traffic` | TikTok traffic report data | `tiktok-traffic-product_list.xlsx` |
| 4 | `drd_shopee_ads` | Shopee ad report data | `ad_report.csv` |
| 5 | `drd_tiktok_ads` | TikTok product ad data | `tiktok-ad-creative...xlsx` |
| 6 | `drd_tiktok_ad_lives` | TikTok live ad data | `tiktok-ad-livestream...xlsx` |
| 7 | `drd_shopee_affiliates` | Shopee seller/affiliate data | `seller_report.csv` |

**Existing entities (NO schema changes needed):**
- `drd_raw_orders` — already working for Shopee + TikTok
- `drd_raw_order_items` — already working with SKU matching

### 3.4 New API Endpoints Needed

#### Product Master Excel (Phase 2 — ALL NEW)
```
GET    /api/v1/product-master/template          # Sample XLSX template
GET    /api/v1/product-master/export             # Current SPU+SKU data export
POST   /api/v1/product-master/import             # XLSX upload UPSERT by wms_code
```

#### Raw Orders — Enhancement to existing (Phase 3)
```
GET    /api/v1/raw-orders                         # Order list (paginated) — NEW
GET    /api/v1/raw-orders/:ord_id                 # Order detail with items — NEW
POST   /api/v1/raw-orders/match-sku               # Re-trigger SKU matching — NEW
```
> Existing endpoints preserved: `POST upload`, `GET upload-history`, `GET daily-summary`

#### Reference Report Upload (Phase 4 — ALL NEW)
```
POST   /api/v1/reports/traffic/shopee             # Shopee traffic XLSX
POST   /api/v1/reports/traffic/tiktok             # TikTok traffic XLSX
POST   /api/v1/reports/ads/shopee                 # Shopee ad CSV
POST   /api/v1/reports/ads/tiktok-product         # TikTok product ad XLSX
POST   /api/v1/reports/ads/tiktok-live            # TikTok live ad XLSX
POST   /api/v1/reports/affiliate/shopee           # Shopee affiliate CSV
```

#### Upload History (Phase 1 — NEW dedicated entity)
```
GET    /api/v1/upload-histories                    # History list (paginated)
GET    /api/v1/upload-histories/:uph_id            # History detail + error info
```

### 3.5 New Frontend Pages Needed

| Route | Page | Description |
|-------|------|-------------|
| `/orders` | `RawOrderListPage` | Order data list from imports |
| `/orders/:ordId` | `RawOrderDetailPage` | Order detail with items |
| `/upload/history` | `UploadHistoryPage` | Upload history list |

**Existing page enhancements:**
- `SkuMasterListPage` → +Excel toolbar (template/export/import buttons)
- `OrderUploadPage` → expand to handle reference reports (tabs) or create separate page
- `DashboardPage` → replace placeholder with real metrics

---

## 4. Gap Analysis (갭 분석)

### 4.1 Change Scope Summary

| Area | Current | Change | Impact |
|------|---------|--------|--------|
| BE product-master-excel | Not exist | +New module (template/export/import) | Medium |
| BE upload-history | batch_id grouping | +Dedicated entity + controller + service | Medium |
| BE report-upload | Not exist | +New module + 6 entities + 6 parsers | High |
| BE raw-order | Fully working | +list/detail endpoints, enhance UPSERT | Low |
| DB tables | 7 tables | +7 new tables | High |
| FE pages | 6 pages working | +3 new pages (order list/detail, upload history) | Medium |
| FE existing | — | SKU page buttons, Dashboard upgrade, Upload page expand | Medium |
| Dependencies | exceljs + multer exist | **No new BE deps needed** | None |
| i18n | upload.*, daily.* exist | +order.*, report.*, productMaster.* keys | Low |

### 4.2 Implementation Completion Status

| Requirement | Backend | Frontend | i18n | Overall |
|------------|---------|----------|------|---------|
| R-001 Product Master Upload | ❌ | ❌ | ❌ | **0%** |
| R-002 Product Master Download | ❌ | ❌ | ❌ | **0%** |
| R-003 Product Master Template | ❌ | ❌ | ❌ | **0%** |
| R-004 Shopee Order Upload | ✅ | ✅ | ✅ | **100%** |
| R-005 TikTok Order Upload | ✅ | ✅ | ✅ | **100%** |
| R-006 Shopee Traffic | ❌ | ❌ | ❌ | **0%** |
| R-007 TikTok Traffic | ❌ | ❌ | ❌ | **0%** |
| R-008 Shopee Ad | ❌ | ❌ | ❌ | **0%** |
| R-009 TikTok Ad Product | ❌ | ❌ | ❌ | **0%** |
| R-010 TikTok Ad Live | ❌ | ❌ | ❌ | **0%** |
| R-011 Shopee Affiliate | ❌ | ❌ | ❌ | **0%** |
| R-012 Upload History | ⚠️ basic | ❌ | ❌ | **20%** |
| R-013 SKU Matching | ✅ | ✅ | ✅ | **100%** |
| R-014 Order List/Detail | ❌ | ❌ | ❌ | **0%** |
| R-015 Daily Report | ✅ | ✅ | ✅ | **100%** |

**Overall: 4/15 requirements complete (27%), 1 partial**

---

## 5. User Flow (사용자 플로우)

### 5.1 Product Master Excel Upload (NEW)
```
[User] SKU Master (/sku)
  ├─ [Template] → GET /product-master/template → .xlsx download
  ├─ [Download] → GET /product-master/export → current data .xlsx
  └─ [Upload] → file select → POST /product-master/import → result modal
```

### 5.2 Order Report Upload (EXISTING — enhance)
```
[User] Upload (/upload)
  ├─ Select channel: Shopee / TikTok (EXISTING ✅)
  ├─ Drag & drop .xlsx file (EXISTING ✅)
  └─ Result: N created / M skipped / SKU match rate (EXISTING ✅)
  [Enhancement] → UPSERT instead of SKIP for re-uploads
```

### 5.3 Reference Report Upload (NEW)
```
[User] Upload (/upload) — add tabs/sections for:
  ├─ [트래픽] → Shopee(xlsx) / TikTok(xlsx)
  ├─ [광고] → Shopee(csv) / TikTok Product(xlsx) / TikTok Live(xlsx)
  └─ [제휴] → Shopee(csv)
```

### 5.4 Order Viewing (NEW)
```
[User] Orders (/orders)
  ├─ Filters: date range, channel, status, search
  ├─ Table: Order ID, date, channel, status, items, amount, match rate
  └─ Click → Detail (/orders/:ordId) → header info + items table
```

---

## 6. Technical Constraints (기술 제약사항)

### 6.1 Established Architecture Patterns (기존 구현 패턴 — 반드시 유지)
- **ExcelJS** for Excel parsing (NOT xlsx/SheetJS) — already in use by Shopee/TikTok parsers
- **ExcelParser interface** pattern (`excel-parser.interface.ts`) → all new parsers implement same interface
- **Single upload endpoint** with `channel` body param → extend this pattern for report types
- **Transaction-based** batch import with `queryRunner` and rollback
- **BusinessException** with `DRD-E{xxxx}` error codes
- **@Auth() decorator** on all endpoints → ent_id isolation

### 6.2 File Size & Memory
- Max upload: **10MB** (multer limit configured in controller)
- ExcelJS loads entire file in memory — adequate for expected sizes (<2MB typical)

### 6.3 Data Format Parsing (locale-specific)
- **Shopee Vietnamese numbers**: `565.063.917` → dots are thousands
- **Shopee percentages**: `1,77%` → comma is decimal
- **TikTok money**: `192.612.578₫` → remove ₫ and dots
- **TikTok percentages**: `6.87%` → dot is decimal (differs from Shopee!)
- **TikTok dates**: `DD/MM/YYYY HH:mm:ss` → custom regex parser exists

### 6.4 Security
- MIME type validation: `.xlsx` only for Excel; CSV via separate endpoint
- Files processed in memory, **not stored on disk**
- PII columns excluded from storage
- All endpoints behind `@Auth()` with ent_id isolation
