# Excel Upload/Download — Task Plan v3.0 (엑셀 업로드/다운로드 작업계획서)

---
document_id: AMA-SAL-TASK-PLAN-3.0.0
version: 3.0.0
status: Draft
created: 2026-04-02
app: app-sales-report
based_on: AMA-SAL-ANALYSIS-3.0.0
previous_version: AMA-SAL-TASK-PLAN-2.0.0
---

## 1. System Development Status Analysis (시스템 개발 현황 분석)

### 1.1 Directory Structure (현재)

```
apps/app-sales-report/
├── backend/src/
│   ├── domain/
│   │   ├── spu-master/              ✅ Full CRUD (Entity, Controller, Service, DTO, Mapper)
│   │   ├── sku-master/              ✅ Full CRUD (Entity, Controller, Service, DTO, Mapper)
│   │   ├── channel-master/          ✅ Full CRUD (Entity, Controller, Service)
│   │   ├── channel-product-mapping/ ✅ Full CRUD (Entity, Controller, Service, DTO, Mapper)
│   │   ├── sku-cost-history/        ✅ Full CRUD (Entity, Controller, Service, DTO, Mapper)
│   │   └── raw-order/              ⚠️ Entity ONLY — no controller/service
│   │       ├── entity/
│   │       │   ├── raw-order.entity.ts       ✅ 40+ columns (Shopee order mapping)
│   │       │   └── raw-order-item.entity.ts  ✅ 20+ columns (SKU matching fields)
│   │       └── raw-order.module.ts           ⚠️ TypeOrmModule.forFeature only
│   ├── auth/                    ✅ JWT strategy, guards, @Auth() decorator
│   ├── common/                  ✅ Filters, interceptors
│   ├── app.module.ts            ✅ 6 modules registered (including RawOrderModule)
│   └── main.ts                  ✅ Port 3103
├── frontend/src/
│   ├── pages/
│   │   ├── DashboardPage.tsx         ✅ Placeholder
│   │   ├── SpuMasterListPage.tsx     ✅ Full CRUD
│   │   ├── SkuMasterListPage.tsx     ✅ Full CRUD + CostHistoryDrawer
│   │   ├── ChannelMappingListPage.tsx ✅ Full CRUD
│   │   └── auth/                     ✅ EntityInfo, Login, ChangePassword
│   ├── components/layout/AppLayout.tsx ✅ Sidebar navigation
│   ├── hooks/useSales.ts              ✅ React Query hooks
│   ├── services/sales.service.ts      ✅ API client
│   ├── stores/                        ✅ auth.store, toast.store
│   ├── lib/                           ✅ api-client, query-client, ama-token
│   └── i18n/locales/{ko,en,vi}/       ✅ sales.json
└── docker-compose.app-sales-report.yml ✅
```

### 1.2 Tech Stack & Dependencies — Already Available

| Dependency | Package | Status |
|-----------|---------|--------|
| **BE** Excel parsing | `xlsx@^0.18.5` (SheetJS) | ✅ Installed |
| **BE** File upload | `@nestjs/platform-express@^11.1.0` (includes multer) | ✅ Installed |
| **BE** UUID | `uuid@^11.0.0` | ✅ Installed |
| **FE** Charts | `recharts@^2.12.7` | ✅ Installed |
| **FE** Excel (client) | — | ❌ Not needed (download via API blob) |
| **FE** File saver | — | ❌ Not needed (native download) |

**Key insight**: No new npm dependencies needed for backend. Frontend may need `xlsx` only if client-side preview is required (optional).

### 1.3 Database Current State

| Table | Rows | Notes |
|-------|------|-------|
| `drd_spu_masters` | 44 | Seeded |
| `drd_sku_masters` | 178 | Seeded — `sku_wms_code` is the matching key |
| `drd_channel_masters` | 5 | SHOPEE, TIKTOK, INFLUENCER, B2B, OTHER |
| `drd_channel_product_mappings` | 0 | Empty |
| `drd_sku_cost_histories` | 0 | Empty |
| `drd_raw_orders` | ~4,977 | Seeded from Shopee sample |
| `drd_raw_order_items` | ~4,977+ | Seeded from Shopee sample |

### 1.4 Constraints & Observations

1. **raw-order module has entity but no controller/service** — must create these, NOT new entities
2. **xlsx + multer already installed** — no dependency installation phase needed
3. **channel_masters already seeded** — no seed step required
4. **Docker volume for uploads NOT needed** — files processed in-memory, not stored on disk
5. **DB_SYNC=true on staging** — new entities auto-create tables on restart
6. **Raw order entity already designed for both Shopee + TikTok** — `chn_code` distinguishes source

---

## 2. Implementation Plan (단계별 구현 계획)

### Phase 1: Shared Foundation (공통 기반) — Upload History + Common Utils

#### Step 1.1: Upload History entity & module
- Create `domain/upload-history/`
  - `entity/upload-history.entity.ts` — `drd_upload_histories` table
  - `upload-history.module.ts` — exports repository
  - `upload-history.service.ts` — CRUD for upload records
- Columns: `uph_id`, `ent_id`, `uph_type` (ENUM), `uph_channel`, `uph_file_name`, `uph_file_size`, `uph_row_count`, `uph_success_count`, `uph_error_count`, `uph_status`, `uph_error_detail`, `uph_period_start`, `uph_period_end`, `uph_batch_id`, `uph_created_by`, `uph_created_at`
- `└─ Side effect: New DB table auto-created (DB_SYNC=true). Register in app.module.ts`

#### Step 1.2: Common Excel/CSV parser utilities
- Create `common/utils/excel-parser.util.ts`
  - `readXlsx(buffer, options)` — SheetJS wrapper with header row offset, sheet name selection
  - `readCsv(buffer, options)` — CSV parsing with BOM handling, skip-rows support
  - `parseVietnameseNumber(str)` — `565.063.917` → `565063917`
  - `parseVietnamesePercent(str)` — `1,77%` → `0.0177`
  - `parseTikTokMoney(str)` — `192.612.578₫` → `192612578`
  - `parseDatetime(str, format?)` — flexible date parsing
  - `sanitizeString(str)` — trim, null for empty
- `└─ Side effect: None (utility file, no module registration)`

#### Step 1.3: Common SKU matching utility
- Create `common/utils/sku-matcher.util.ts`
  - Load all `sku_wms_code + sku_id` for `ent_id` into a Map
  - `matchSku(variantSku, entId)` → `{ skuId, status: 'MATCHED'|'UNMATCHED' }`
  - Used by both Shopee and TikTok order parsers
- `└─ Side effect: None`

---

### Phase 2: Product Master Excel (상품마스터 엑셀) — Upload/Download/Template

#### Step 2.1: Backend — Product Master Excel module
- Create `domain/product-master-excel/`
  - `product-master-excel.module.ts` — imports SpuMasterModule, SkuMasterModule, UploadHistoryModule
  - `product-master-excel.controller.ts`:
    - `GET  /api/v1/product-master/template` → sample XLSX download
    - `GET  /api/v1/product-master/export` → current SPU+SKU data XLSX download
    - `POST /api/v1/product-master/import` → multipart XLSX upload, UPSERT by `sku_wms_code`
  - `product-master-excel.service.ts`:
    - Template generation: headers with sample data row
    - Export: join SPU + SKU data, write to xlsx buffer
    - Import: parse rows → find by `sku_wms_code + ent_id` → INSERT or UPDATE
    - Return: `{ total, inserted, updated, errors: [{row, message}] }`
- UPSERT logic:
  1. Parse Excel rows (spu_code, spu_name, sku_wms_code, sku_name, sku_barcode, sku_weight, sku_selling_price, sku_listing_price)
  2. For each row: find SPU by `spu_code + ent_id` → create if not found
  3. Find SKU by `sku_wms_code + ent_id` → update if found, insert if not
  4. Record upload history
- `└─ Side effect: Register in app.module.ts`

#### Step 2.2: Frontend — SKU page Excel toolbar
- Modify `SkuMasterListPage.tsx` — add 3 toolbar buttons:
  - [📥 Template Download] → `GET /product-master/template` → browser download
  - [📥 Data Download] → `GET /product-master/export` → browser download  
  - [📤 Excel Upload] → open upload modal → file select → `POST /product-master/import`
- Create `components/common/ExcelUploadModal.tsx` — reusable upload modal:
  - Drag & drop zone or file input
  - File type/size validation (.xlsx/.csv, 10MB limit)
  - Upload progress indicator
  - Result display: total/inserted/updated/errors
- Add hooks: `useProductMasterExcel.ts`
- `└─ Side effect: SkuMasterListPage UI change, i18n keys`

#### Step 2.3: i18n — Upload/download keys
- Add translation keys to sales.json (ko/en/vi):
  - `upload.*` — upload, importing, uploadSuccess, uploadFailed, dragDrop, selectFile...
  - `productMaster.*` — template, export, import, upsertResult...
- `└─ Side effect: Locale files only`

---

### Phase 3: Order Report Upload (주문 데이터 업로드) — Shopee + TikTok

#### Step 3.1: Backend — Raw Order controller & service
- Create in `domain/raw-order/`:
  - `raw-order.controller.ts`:
    - `POST /api/v1/raw-orders/import/shopee` — Shopee order XLSX upload
    - `POST /api/v1/raw-orders/import/tiktok` — TikTok order XLSX upload
    - `GET  /api/v1/raw-orders` — paginated list (date, channel, status filters)
    - `GET  /api/v1/raw-orders/:ord_id` — detail with items
    - `GET  /api/v1/raw-orders/summary` — aggregated stats
    - `POST /api/v1/raw-orders/match-sku` — re-trigger SKU matching for batch
  - `raw-order.service.ts`:
    - Shared UPSERT logic: find by `(ent_id, chn_code, channel_order_id)` → update or insert
    - SKU matching using `sku-matcher.util.ts`
    - List/detail/summary queries
  - `dto/request/` — import DTOs, list query DTO
  - `dto/response/` — order response, order+items response, summary response
- Update `raw-order.module.ts` — add controller, service, import UploadHistoryModule, SkuMasterModule
- `└─ Side effect: raw-order.module.ts expanded (was entity-only)`

#### Step 3.2: Backend — Shopee order parser
- Create `domain/raw-order/service/shopee-order-parser.service.ts`:
  - Read XLSX with SheetJS (sheet `orders`, header Row 1, data Row 2+)
  - Map 68 Vietnamese columns to `RawOrderEntity` + `RawOrderItemEntity`
  - Group rows by `C01` (Mã đơn hàng) — multiple items share same order ID
  - Status normalization: Vietnamese → English ENUM
  - Price parsing: Vietnamese locale numbers (dots as thousands)
  - SKU matching: `C20` (SKU phân loại hàng) → `sku_wms_code` lookup
  - Duplicate handling: UPSERT on unique constraint
  - Return: `{ total, inserted, updated, skuMatched, skuUnmatched, errors }`
- `└─ Side effect: None (service within raw-order module)`

#### Step 3.3: Backend — TikTok order parser
- Create `domain/raw-order/service/tiktok-order-parser.service.ts`:
  - Read XLSX (sheet `OrderSKUList`, header Row 1, **skip Row 2 (description)**, data Row 3+)
  - Map 54 English columns to `RawOrderEntity` + `RawOrderItemEntity`
  - Channel code: `TIKTOK`
  - Status normalization: TikTok statuses → English ENUM
  - SKU matching: `C07` (Seller SKU) → `sku_wms_code` lookup
  - Same UPSERT logic as Shopee
- `└─ Side effect: None`

#### Step 3.4: Frontend — Order list & detail pages
- Create `pages/RawOrderListPage.tsx`:
  - Filters: date range, channel (Shopee/TikTok/All), status, search
  - Table columns: Order ID, date, channel, status, items count, total amount, SKU match rate
  - Click row → navigate to detail
- Create `pages/RawOrderDetailPage.tsx`:
  - Order header info (dates, status, shipping, financial)
  - Items table: product name, variant SKU, qty, price, match status badge
- Add routes: `/orders`, `/orders/:ordId`
- Add sidebar nav item: "Orders" (주문데이터)
- Hooks: `useRawOrders.ts`, `useRawOrderDetail.ts`
- Service: `raw-order.service.ts`
- `└─ Side effect: App.tsx routes, AppLayout sidebar`

#### Step 3.5: Frontend — Upload Center page
- Create `pages/UploadCenterPage.tsx`:
  - Tab-based layout: 판매리포트 | 트래픽 | 광고 | 제휴
  - [판매리포트] tab:
    - Channel selector: Shopee / TikTok
    - Drag & drop upload zone
    - Last upload history summary
    - Upload result display (total/new/updated/matched/errors)
  - Other tabs: placeholder → Phase 4
- Create `components/upload/UploadDropZone.tsx` — reusable drag & drop component
- Create `components/upload/UploadResultCard.tsx` — result display component
- Add route: `/upload`
- Add sidebar nav item: "Upload Center" (업로드)
- `└─ Side effect: App.tsx routes, AppLayout sidebar`

---

### Phase 4: Reference Report Upload (참고 보고서 업로드) — 6 Report Types

#### Step 4.1: Backend — Report Upload module & entities
- Create `domain/report-upload/`
  - `report-upload.module.ts`
  - `report-upload.controller.ts`:
    - `POST /api/v1/reports/traffic/shopee`
    - `POST /api/v1/reports/traffic/tiktok`
    - `POST /api/v1/reports/ads/shopee`
    - `POST /api/v1/reports/ads/tiktok-product`
    - `POST /api/v1/reports/ads/tiktok-live`
    - `POST /api/v1/reports/affiliate/shopee`
  - `report-upload.service.ts` — dispatcher to individual parsers
- `└─ Side effect: Register in app.module.ts`

#### Step 4.2: Backend — 6 new report entities
- Create `domain/report-upload/entity/`:
  - `shopee-traffic.entity.ts` → `drd_shopee_traffic` (40 cols, product+variant level)
  - `tiktok-traffic.entity.ts` → `drd_tiktok_traffic` (38 cols, product level, 4 channel groups)
  - `shopee-ad.entity.ts` → `drd_shopee_ads` (25 cols, ad-level)
  - `tiktok-ad.entity.ts` → `drd_tiktok_ads` (26 cols, creative-level)
  - `tiktok-ad-live.entity.ts` → `drd_tiktok_ad_lives` (19 cols, live session level)
  - `shopee-affiliate.entity.ts` → `drd_shopee_affiliates` (38 cols, order-product level)
- All entities: include `ent_id`, `uph_batch_id` (link to upload history), PK with UUID
- `└─ Side effect: 6 new DB tables auto-created`

#### Step 4.3: Backend — 6 report parser services
- Create `domain/report-upload/service/`:
  
  **4.3.1 `shopee-traffic-parser.service.ts`:**
  - XLSX, 7 sheets — parse primary sheet (sheet 0: "Sản Phẩm Hiệu Quả Tốt")
  - Header Row 1, data Row 2+
  - Vietnamese locale numbers: `parseVietnameseNumber()` for revenue, `parseVietnamesePercent()` for rates
  - Variant-level rows (C04 ≠ `-`) AND product-level rows
  - Batch replace: delete previous data for same period → bulk insert
  
  **4.3.2 `tiktok-traffic-parser.service.ts`:**
  - XLSX, Sheet1, **Row 1=date range label (extract period), Row 2=empty, Row 3=header, Row 4+=data**
  - Vietnamese locale with ₫ symbol: `parseTikTokMoney()`
  - 4 sub-channel groups (Cửa hàng, LIVE, video, thẻ sản phẩm) each with 8 metrics
  - Extract `period_start`/`period_end` from Row 1
  
  **4.3.3 `shopee-ad-parser.service.ts`:**
  - **CSV** (UTF-8 BOM), **rows 1-7 metadata (extract shop name + date range), row 8=header, row 9+=data**
  - Parse shop-level metadata from rows 1-7
  - Handle "Shop Ads" type in last row (different column structure → skip or handle)
  
  **4.3.4 `tiktok-ad-parser.service.ts`:**
  - XLSX, sheet `Data`, header Row 1, data Row 2+
  - 26 columns including video engagement rates (2s/6s/25/50/75/100%)
  - Currency column (C26) — verify VND
  
  **4.3.5 `tiktok-ad-live-parser.service.ts`:**
  - XLSX, sheet `Data`, header Row 1, data Row 2+
  - 19 columns for live session metrics
  - Revenue values may contain Vietnamese locale or standard numeric
  
  **4.3.6 `shopee-affiliate-parser.service.ts`:**
  - **CSV** (UTF-8 BOM), header Row 1, data Row 2+
  - 38 columns including commission breakdown
  - L1/L2/L3 category hierarchy

- `└─ Side effect: None (contained within report-upload module)`

#### Step 4.4: Frontend — Upload Center tabs completion
- Complete remaining tabs in `UploadCenterPage.tsx`:
  - [트래픽] tab: Shopee (xlsx, 7 sheets) / TikTok (xlsx, row3=header)
  - [광고] tab: Shopee (csv) / TikTok Product (xlsx) / TikTok Live (xlsx)
  - [제휴] tab: Shopee (csv)
- Each sub-tab: channel selector + upload zone + result card
- `└─ Side effect: UploadCenterPage expansion`

#### Step 4.5: Frontend — Upload History page
- Create `pages/UploadHistoryPage.tsx`:
  - Table: date, type, channel, filename, rows, success, errors, status
  - Filters: date range, type, channel, status
  - Click row → expand error details
- Add route: `/upload/history`
- Add sidebar nav item under "Upload Center"
- `└─ Side effect: App.tsx route, sidebar`

#### Step 4.6: Backend — Upload History controller
- Create `domain/upload-history/upload-history.controller.ts`:
  - `GET /api/v1/upload-histories` — paginated list
  - `GET /api/v1/upload-histories/:uph_id` — detail with error info
- `└─ Side effect: upload-history.module.ts expanded`

#### Step 4.7: i18n — Report & history translation keys
- Add keys: `reports.*`, `uploadHistory.*`, `traffic.*`, `ads.*`, `affiliate.*`
- `└─ Side effect: Locale files only`

---

### Phase 5: Build, Test & Deploy (빌드, 테스트, 배포)

#### Step 5.1: Build verification
```bash
cd apps/app-sales-report/backend && npx tsc --noEmit
cd apps/app-sales-report/frontend && npm run build
```
- `└─ Side effect: None`

#### Step 5.2: Git commit & push
- Commit message: `feat: Excel upload/download for sales report app (8 report types)`
- Push to `main`
- `└─ Side effect: Remote repository update`

#### Step 5.3: Staging deployment
```bash
ssh ambAppStore@stg-apps.amoeba.site "cd ~/ambAppStore && git pull origin main && bash platform/scripts/deploy-staging.sh"
```
- Verify: health check, 7 new tables created, API endpoints working
- `└─ Side effect: Staging environment update`

---

## 3. File Change List (변경 파일 목록)

### Backend (BE) — New Files (30)

| # | Path | Description |
|---|------|-------------|
| 1 | `common/utils/excel-parser.util.ts` | SheetJS/CSV wrapper + locale parsers |
| 2 | `common/utils/sku-matcher.util.ts` | SKU WMS code matching utility |
| 3 | `domain/upload-history/entity/upload-history.entity.ts` | `drd_upload_histories` entity |
| 4 | `domain/upload-history/upload-history.module.ts` | Upload history module |
| 5 | `domain/upload-history/upload-history.service.ts` | Upload history CRUD service |
| 6 | `domain/upload-history/upload-history.controller.ts` | Upload history API |
| 7 | `domain/upload-history/dto/upload-history-response.dto.ts` | Response DTO |
| 8 | `domain/product-master-excel/product-master-excel.module.ts` | Product Excel module |
| 9 | `domain/product-master-excel/product-master-excel.controller.ts` | Template/Export/Import API |
| 10 | `domain/product-master-excel/product-master-excel.service.ts` | Excel processing service |
| 11 | `domain/raw-order/raw-order.controller.ts` | Order import + CRUD API |
| 12 | `domain/raw-order/raw-order.service.ts` | Order business logic |
| 13 | `domain/raw-order/service/shopee-order-parser.service.ts` | Shopee 68-col XLSX parser |
| 14 | `domain/raw-order/service/tiktok-order-parser.service.ts` | TikTok 54-col XLSX parser |
| 15 | `domain/raw-order/dto/request/import-order.request.ts` | Import request DTO |
| 16 | `domain/raw-order/dto/request/list-order.request.ts` | List query DTO |
| 17 | `domain/raw-order/dto/response/order-response.dto.ts` | Order response DTO |
| 18 | `domain/raw-order/dto/response/order-summary-response.dto.ts` | Summary response DTO |
| 19 | `domain/report-upload/report-upload.module.ts` | Report upload module |
| 20 | `domain/report-upload/report-upload.controller.ts` | 6 upload endpoints |
| 21 | `domain/report-upload/report-upload.service.ts` | Dispatcher service |
| 22 | `domain/report-upload/entity/shopee-traffic.entity.ts` | `drd_shopee_traffic` |
| 23 | `domain/report-upload/entity/tiktok-traffic.entity.ts` | `drd_tiktok_traffic` |
| 24 | `domain/report-upload/entity/shopee-ad.entity.ts` | `drd_shopee_ads` |
| 25 | `domain/report-upload/entity/tiktok-ad.entity.ts` | `drd_tiktok_ads` |
| 26 | `domain/report-upload/entity/tiktok-ad-live.entity.ts` | `drd_tiktok_ad_lives` |
| 27 | `domain/report-upload/entity/shopee-affiliate.entity.ts` | `drd_shopee_affiliates` |
| 28 | `domain/report-upload/service/shopee-traffic-parser.service.ts` | 7-sheet XLSX parser |
| 29 | `domain/report-upload/service/tiktok-traffic-parser.service.ts` | Row3-header XLSX parser |
| 30 | `domain/report-upload/service/shopee-ad-parser.service.ts` | CSV skip-metadata parser |
| 31 | `domain/report-upload/service/tiktok-ad-parser.service.ts` | Creative-level XLSX parser |
| 32 | `domain/report-upload/service/tiktok-ad-live-parser.service.ts` | Live session XLSX parser |
| 33 | `domain/report-upload/service/shopee-affiliate-parser.service.ts` | Affiliate CSV parser |

### Backend (BE) — Modified Files (2)

| # | Path | Change |
|---|------|--------|
| 1 | `app.module.ts` | +3 modules: UploadHistoryModule, ProductMasterExcelModule, ReportUploadModule |
| 2 | `domain/raw-order/raw-order.module.ts` | +controller, +service, +imports (UploadHistoryModule, SkuMasterModule) |

### Frontend (FE) — New Files (14)

| # | Path | Description |
|---|------|-------------|
| 1 | `pages/RawOrderListPage.tsx` | Order data list |
| 2 | `pages/RawOrderDetailPage.tsx` | Order detail + items |
| 3 | `pages/UploadCenterPage.tsx` | Central upload hub (4 tabs) |
| 4 | `pages/UploadHistoryPage.tsx` | Upload history list |
| 5 | `components/common/ExcelUploadModal.tsx` | Reusable upload modal |
| 6 | `components/upload/UploadDropZone.tsx` | Drag & drop file input |
| 7 | `components/upload/UploadResultCard.tsx` | Upload result display |
| 8 | `hooks/useRawOrders.ts` | Order React Query hooks |
| 9 | `hooks/useUploadHistory.ts` | Upload history hooks |
| 10 | `hooks/useProductMasterExcel.ts` | Product master Excel hooks |
| 11 | `hooks/useReportUpload.ts` | Report upload mutation hooks |
| 12 | `services/raw-order.service.ts` | Order API client |
| 13 | `services/upload.service.ts` | Upload API client |
| 14 | `types/upload.types.ts` | Upload type definitions |

### Frontend (FE) — Modified Files (4)

| # | Path | Change |
|---|------|--------|
| 1 | `App.tsx` | +4 routes: /orders, /orders/:ordId, /upload, /upload/history |
| 2 | `components/layout/AppLayout.tsx` | +2 sidebar items: Orders, Upload Center |
| 3 | `pages/SkuMasterListPage.tsx` | +Excel toolbar buttons (template/export/import) |
| 4 | `services/sales.service.ts` | (optional) Product master Excel API methods |

### i18n — Modified Files (3)

| # | Path | Change |
|---|------|--------|
| 1 | `i18n/locales/ko/sales.json` | +upload, order, report translation keys |
| 2 | `i18n/locales/en/sales.json` | +upload, order, report translation keys |
| 3 | `i18n/locales/vi/sales.json` | +upload, order, report translation keys |

### Database — New Tables (7, auto-created by TypeORM sync)

| # | Table | Source |
|---|-------|--------|
| 1 | `drd_upload_histories` | Phase 1 |
| 2 | `drd_shopee_traffic` | Phase 4 |
| 3 | `drd_tiktok_traffic` | Phase 4 |
| 4 | `drd_shopee_ads` | Phase 4 |
| 5 | `drd_tiktok_ads` | Phase 4 |
| 6 | `drd_tiktok_ad_lives` | Phase 4 |
| 7 | `drd_shopee_affiliates` | Phase 4 |

---

## 4. Side Impact Analysis (사이드 임팩트 분석)

| Scope | Risk | Description |
|-------|------|-------------|
| raw-order module expansion | **Medium** | Entity-only module gains controller/service. No entity schema change needed. Module import list expanded. |
| app.module.ts | **Low** | 3 new module registrations. Additive change only. |
| Existing SKU page | **Low** | UI-only: 3 toolbar buttons added. No business logic change. |
| Existing APIs | **None** | All new endpoints on new paths (`/raw-orders/*`, `/product-master/*`, `/reports/*`, `/upload-histories`) |
| Database | **Low** | 7 new tables only. Zero ALTER on existing 7 tables. |
| Memory usage | **Medium** | SheetJS loads entire Excel in memory. Max ~10MB file → ~50MB memory spike. Acceptable for expected file sizes (<2MB typical). |
| SKU matching accuracy | **Medium** | Matches `oli_variant_sku` → `sku_wms_code`. May have false positives if WMS codes overlap. UNMATCHED fallback is safe. |
| Locale parsing | **Medium** | Vietnamese number format (dots=thousands) vs standard. Parser utility centralizes logic. Must handle edge cases (empty cells, N/A, `-`). |
| TikTok row offset | **Low** | Row 2 description skip for sales, Row 1-2 skip for traffic. Hardcoded in parser config. |
| CSV BOM handling | **Low** | Shopee CSVs have UTF-8 BOM. SheetJS `codepage` handles this natively. |
| Concurrent uploads | **Low** | Each upload creates independent batch ID. No locking needed. |
| Auth & ent_id | **None** | All new endpoints use existing `@Auth()` decorator. ent_id isolation fully inherited. |
| Docker compose | **None** | No docker-compose changes needed (no file storage, no volume mounts). |
| i18n | **Low** | Additive keys only. No existing key modifications. |

---

## 5. DB Migration (DB 마이그레이션)

### Staging (스테이징)

`DB_SYNC=true` — TypeORM auto-creates all 7 new tables on BFF restart. No manual SQL.

### Production (프로덕션)

Manual SQL required before deployment. Execute in order:

```sql
-- =====================================================
-- 1. Upload History (모든 리포트 업로드 이력)
-- =====================================================
CREATE TABLE IF NOT EXISTS drd_upload_histories (
  uph_id          CHAR(36)        NOT NULL PRIMARY KEY,
  ent_id          CHAR(36)        NOT NULL,
  uph_type        ENUM('PRODUCT_MASTER','ORDER_REPORT','TRAFFIC_REPORT','AD_REPORT','AFFILIATE_REPORT') NOT NULL,
  uph_channel     VARCHAR(20)     NOT NULL DEFAULT 'SHOPEE',
  uph_file_name   VARCHAR(300)    NOT NULL,
  uph_file_size   INT UNSIGNED    NOT NULL DEFAULT 0,
  uph_row_count   INT UNSIGNED    NULL,
  uph_success_count INT UNSIGNED  NULL,
  uph_error_count INT UNSIGNED    NULL DEFAULT 0,
  uph_status      ENUM('PROCESSING','COMPLETED','PARTIAL','FAILED') NOT NULL DEFAULT 'PROCESSING',
  uph_error_detail TEXT           NULL,
  uph_period_start DATE           NULL,
  uph_period_end  DATE            NULL,
  uph_batch_id    VARCHAR(50)     NULL,
  uph_created_by  VARCHAR(100)    NULL,
  uph_created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_uph_ent_type (ent_id, uph_type),
  INDEX idx_uph_ent_date (ent_id, uph_created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 2. Shopee Traffic Report (Shopee 트래픽 리포트)
-- =====================================================
CREATE TABLE IF NOT EXISTS drd_shopee_traffic (
  stf_id              CHAR(36)        NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)        NOT NULL,
  uph_batch_id        VARCHAR(50)     NULL,
  stf_product_id      VARCHAR(30)     NULL,
  stf_product_name    VARCHAR(500)    NULL,
  stf_product_status  VARCHAR(50)     NULL,
  stf_variant_id      VARCHAR(30)     NULL,
  stf_variant_name    VARCHAR(200)    NULL,
  stf_variant_sku     VARCHAR(50)     NULL,
  stf_product_sku     VARCHAR(50)     NULL,
  stf_revenue_placed  DECIMAL(15,2)   NULL,
  stf_revenue_confirmed DECIMAL(15,2) NULL,
  stf_views           INT UNSIGNED    NULL,
  stf_clicks          INT UNSIGNED    NULL,
  stf_ctr             DECIMAL(8,4)    NULL,
  stf_conv_rate_placed DECIMAL(8,4)   NULL,
  stf_conv_rate_confirmed DECIMAL(8,4) NULL,
  stf_orders_placed   INT UNSIGNED    NULL,
  stf_orders_confirmed INT UNSIGNED   NULL,
  stf_units_placed    INT UNSIGNED    NULL,
  stf_units_confirmed INT UNSIGNED    NULL,
  stf_unique_impressions INT UNSIGNED NULL,
  stf_unique_clicks   INT UNSIGNED    NULL,
  stf_search_clicks   INT UNSIGNED    NULL,
  stf_add_to_cart_visits INT UNSIGNED NULL,
  stf_add_to_cart_units INT UNSIGNED  NULL,
  stf_cart_conv_rate  DECIMAL(8,4)    NULL,
  stf_period_start    DATE            NULL,
  stf_period_end      DATE            NULL,
  stf_created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stf_ent_period (ent_id, stf_period_start),
  INDEX idx_stf_ent_sku (ent_id, stf_variant_sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 3. TikTok Traffic Report (TikTok 트래픽 리포트)
-- =====================================================
CREATE TABLE IF NOT EXISTS drd_tiktok_traffic (
  ttf_id              CHAR(36)        NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)        NOT NULL,
  uph_batch_id        VARCHAR(50)     NULL,
  ttf_product_id      VARCHAR(30)     NULL,
  ttf_product_name    VARCHAR(500)    NULL,
  ttf_status          VARCHAR(50)     NULL,
  ttf_gmv_total       DECIMAL(15,2)   NULL,
  ttf_units_sold      INT UNSIGNED    NULL,
  ttf_orders          INT UNSIGNED    NULL,
  -- Shop channel (Cửa hàng)
  ttf_shop_gmv        DECIMAL(15,2)   NULL,
  ttf_shop_units      INT UNSIGNED    NULL,
  ttf_shop_impressions INT UNSIGNED   NULL,
  ttf_shop_page_views INT UNSIGNED    NULL,
  ttf_shop_unique_views INT UNSIGNED  NULL,
  ttf_shop_unique_buyers INT UNSIGNED NULL,
  ttf_shop_ctr        DECIMAL(8,4)    NULL,
  ttf_shop_conv_rate  DECIMAL(8,4)    NULL,
  -- LIVE channel
  ttf_live_gmv        DECIMAL(15,2)   NULL,
  ttf_live_units      INT UNSIGNED    NULL,
  ttf_live_impressions INT UNSIGNED   NULL,
  ttf_live_page_views INT UNSIGNED    NULL,
  ttf_live_unique_views INT UNSIGNED  NULL,
  ttf_live_unique_buyers INT UNSIGNED NULL,
  ttf_live_ctr        DECIMAL(8,4)    NULL,
  ttf_live_conv_rate  DECIMAL(8,4)    NULL,
  -- Video channel
  ttf_video_gmv       DECIMAL(15,2)   NULL,
  ttf_video_units     INT UNSIGNED    NULL,
  ttf_video_impressions INT UNSIGNED  NULL,
  ttf_video_page_views INT UNSIGNED   NULL,
  ttf_video_unique_views INT UNSIGNED NULL,
  ttf_video_unique_buyers INT UNSIGNED NULL,
  ttf_video_ctr       DECIMAL(8,4)    NULL,
  ttf_video_conv_rate DECIMAL(8,4)    NULL,
  -- Product card channel (thẻ sản phẩm)
  ttf_card_gmv        DECIMAL(15,2)   NULL,
  ttf_card_units      INT UNSIGNED    NULL,
  ttf_card_impressions INT UNSIGNED   NULL,
  ttf_card_page_views INT UNSIGNED    NULL,
  ttf_card_unique_views INT UNSIGNED  NULL,
  ttf_card_unique_buyers INT UNSIGNED NULL,
  ttf_card_ctr        DECIMAL(8,4)    NULL,
  ttf_card_conv_rate  DECIMAL(8,4)    NULL,
  ttf_period_start    DATE            NULL,
  ttf_period_end      DATE            NULL,
  ttf_created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ttf_ent_period (ent_id, ttf_period_start),
  INDEX idx_ttf_ent_product (ent_id, ttf_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 4. Shopee Ad Report (Shopee 광고 리포트)
-- =====================================================
CREATE TABLE IF NOT EXISTS drd_shopee_ads (
  sad_id                  CHAR(36)        NOT NULL PRIMARY KEY,
  ent_id                  CHAR(36)        NOT NULL,
  uph_batch_id            VARCHAR(50)     NULL,
  sad_ad_name             VARCHAR(300)    NULL,
  sad_status              VARCHAR(50)     NULL,
  sad_ad_type             VARCHAR(50)     NULL,
  sad_product_id          VARCHAR(30)     NULL,
  sad_bid_method          VARCHAR(100)    NULL,
  sad_placement           VARCHAR(100)    NULL,
  sad_bid_type            VARCHAR(100)    NULL,
  sad_start_date          DATE            NULL,
  sad_end_date            DATE            NULL,
  sad_impressions         INT UNSIGNED    NULL,
  sad_clicks              INT UNSIGNED    NULL,
  sad_ctr                 DECIMAL(8,4)    NULL,
  sad_conversions         INT UNSIGNED    NULL,
  sad_direct_conversions  INT UNSIGNED    NULL,
  sad_conv_rate           DECIMAL(8,4)    NULL,
  sad_direct_conv_rate    DECIMAL(8,4)    NULL,
  sad_cost_per_conversion DECIMAL(15,2)   NULL,
  sad_cost_per_direct     DECIMAL(15,2)   NULL,
  sad_products_sold       INT UNSIGNED    NULL,
  sad_direct_products_sold INT UNSIGNED   NULL,
  sad_total_sales         DECIMAL(15,2)   NULL,
  sad_direct_sales        DECIMAL(15,2)   NULL,
  sad_total_cost          DECIMAL(15,2)   NULL,
  sad_roas                DECIMAL(8,4)    NULL,
  sad_period_start        DATE            NULL,
  sad_period_end          DATE            NULL,
  sad_created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sad_ent_period (ent_id, sad_period_start),
  INDEX idx_sad_ent_product (ent_id, sad_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 5. TikTok Ad (Product/Creative) Report (TikTok 상품광고 리포트)
-- =====================================================
CREATE TABLE IF NOT EXISTS drd_tiktok_ads (
  tad_id              CHAR(36)        NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)        NOT NULL,
  uph_batch_id        VARCHAR(50)     NULL,
  tad_campaign_name   VARCHAR(300)    NULL,
  tad_campaign_id     VARCHAR(50)     NULL,
  tad_product_id      VARCHAR(30)     NULL,
  tad_creative_type   VARCHAR(100)    NULL,
  tad_video_title     VARCHAR(500)    NULL,
  tad_video_id        VARCHAR(50)     NULL,
  tad_account         VARCHAR(200)    NULL,
  tad_post_time       DATETIME        NULL,
  tad_status          VARCHAR(50)     NULL,
  tad_auth_type       VARCHAR(100)    NULL,
  tad_cost            DECIMAL(15,2)   NULL,
  tad_sku_orders      INT UNSIGNED    NULL,
  tad_cost_per_order  DECIMAL(15,2)   NULL,
  tad_gross_revenue   DECIMAL(15,2)   NULL,
  tad_roi             DECIMAL(8,4)    NULL,
  tad_impressions     INT UNSIGNED    NULL,
  tad_clicks          INT UNSIGNED    NULL,
  tad_ctr             DECIMAL(8,4)    NULL,
  tad_conv_rate       DECIMAL(8,4)    NULL,
  tad_view_2s_rate    DECIMAL(8,4)    NULL,
  tad_view_6s_rate    DECIMAL(8,4)    NULL,
  tad_view_25_rate    DECIMAL(8,4)    NULL,
  tad_view_50_rate    DECIMAL(8,4)    NULL,
  tad_view_75_rate    DECIMAL(8,4)    NULL,
  tad_view_100_rate   DECIMAL(8,4)    NULL,
  tad_currency        VARCHAR(10)     NULL DEFAULT 'VND',
  tad_period_start    DATE            NULL,
  tad_period_end      DATE            NULL,
  tad_created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tad_ent_campaign (ent_id, tad_campaign_id),
  INDEX idx_tad_ent_product (ent_id, tad_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 6. TikTok Ad Live Report (TikTok 라이브광고 리포트)
-- =====================================================
CREATE TABLE IF NOT EXISTS drd_tiktok_ad_lives (
  tal_id              CHAR(36)        NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)        NOT NULL,
  uph_batch_id        VARCHAR(50)     NULL,
  tal_live_name       VARCHAR(300)    NULL,
  tal_launch_time     DATETIME        NULL,
  tal_status          VARCHAR(50)     NULL,
  tal_campaign_name   VARCHAR(300)    NULL,
  tal_campaign_id     VARCHAR(50)     NULL,
  tal_cost            DECIMAL(15,2)   NULL,
  tal_net_cost        DECIMAL(15,2)   NULL,
  tal_sku_orders      INT UNSIGNED    NULL,
  tal_sku_orders_shop INT UNSIGNED    NULL,
  tal_cost_per_order  DECIMAL(15,2)   NULL,
  tal_gross_revenue   DECIMAL(15,2)   NULL,
  tal_gross_revenue_shop DECIMAL(15,2) NULL,
  tal_roi_shop        DECIMAL(8,4)    NULL,
  tal_live_views      INT UNSIGNED    NULL,
  tal_cost_per_view   DECIMAL(15,2)   NULL,
  tal_live_views_10s  INT UNSIGNED    NULL,
  tal_cost_per_10s_view DECIMAL(15,2) NULL,
  tal_live_followers  INT UNSIGNED    NULL,
  tal_currency        VARCHAR(10)     NULL DEFAULT 'VND',
  tal_period_start    DATE            NULL,
  tal_period_end      DATE            NULL,
  tal_created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tal_ent_campaign (ent_id, tal_campaign_id),
  INDEX idx_tal_ent_date (ent_id, tal_launch_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 7. Shopee Seller/Affiliate Report (Shopee 제휴 리포트)
-- =====================================================
CREATE TABLE IF NOT EXISTS drd_shopee_affiliates (
  saf_id              CHAR(36)        NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)        NOT NULL,
  uph_batch_id        VARCHAR(50)     NULL,
  saf_order_id        VARCHAR(30)     NULL,
  saf_status          VARCHAR(50)     NULL,
  saf_fraud_status    VARCHAR(50)     NULL,
  saf_order_time      DATETIME        NULL,
  saf_product_id      VARCHAR(30)     NULL,
  saf_product_name    VARCHAR(500)    NULL,
  saf_model_id        VARCHAR(30)     NULL,
  saf_category_l1     VARCHAR(100)    NULL,
  saf_category_l2     VARCHAR(100)    NULL,
  saf_category_l3     VARCHAR(100)    NULL,
  saf_price           DECIMAL(15,2)   NULL,
  saf_quantity        INT UNSIGNED    NULL,
  saf_partner_name    VARCHAR(200)    NULL,
  saf_affiliate_account VARCHAR(200)  NULL,
  saf_mcn             VARCHAR(200)    NULL,
  saf_commission_rate DECIMAL(8,4)    NULL,
  saf_commission_amount DECIMAL(15,2) NULL,
  saf_seller_commission DECIMAL(15,2) NULL,
  saf_platform_commission DECIMAL(15,2) NULL,
  saf_total_cost      DECIMAL(15,2)   NULL,
  saf_deduction_status VARCHAR(50)    NULL,
  saf_channel         VARCHAR(50)     NULL,
  saf_period_start    DATE            NULL,
  saf_period_end      DATE            NULL,
  saf_created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_saf_ent_order (ent_id, saf_order_id),
  INDEX idx_saf_ent_period (ent_id, saf_period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Implementation Priority (구현 우선순위)

| Phase | Priority | Dependencies | Estimated Files |
|-------|----------|-------------|----------------|
| Phase 1 (Foundation) | P0 | None | ~4 files |
| Phase 2 (Product Master) | P0 | Phase 1 | ~8 files |
| Phase 3 (Order Upload) | P0 | Phase 1 | ~16 files |
| Phase 4 (Reference Reports) | P1 | Phase 1 | ~22 files |
| Phase 5 (Build & Deploy) | P0 | Phase 1-4 | — |

**Recommended approach**: Phase 1 → Phase 2 → Phase 3 → Phase 5 (deploy & verify) → Phase 4 → Phase 5 (redeploy)
