# Excel Upload/Download — Task Plan v3.1 (엑셀 업로드/다운로드 작업계획서)

---
document_id: AMA-SAL-TASK-PLAN-3.1.0
version: 3.1.0
status: Draft
created: 2026-04-02
app: app-sales-report
based_on: AMA-SAL-ANALYSIS-3.1.0
previous_version: AMA-SAL-TASK-PLAN-3.0.0
change_note: v3.0 계획서의 Phase 3 (주문 업로드)가 이미 구현 완료됨을 반영하여 전면 재구성
---

## 1. System Development Status Analysis (시스템 개발 현황 분석)

### 1.1 Current Implementation (현재 구현 상태)

```
apps/app-sales-report/
├── backend/src/
│   ├── domain/
│   │   ├── spu-master/              ✅ Full CRUD
│   │   ├── sku-master/              ✅ Full CRUD + cost history
│   │   ├── channel-master/          ✅ Full CRUD
│   │   ├── channel-product-mapping/ ✅ Full CRUD
│   │   ├── sku-cost-history/        ✅ Full CRUD
│   │   └── raw-order/              ✅ FULLY IMPLEMENTED
│   │       ├── controller/raw-order.controller.ts  ✅ upload + history + daily-summary
│   │       ├── service/raw-order.service.ts        ✅ parse + SKU match + transaction
│   │       ├── parser/
│   │       │   ├── excel-parser.interface.ts       ✅ ParsedOrder/Item/Result interfaces
│   │       │   ├── shopee-excel.parser.ts          ✅ 68-col ExcelJS
│   │       │   └── tiktok-excel.parser.ts          ✅ 54-col ExcelJS (Row2 skip)
│   │       ├── dto/request/upload-order.request.ts ✅
│   │       ├── dto/response/upload-result.response.ts ✅
│   │       ├── entity/raw-order.entity.ts          ✅ 40+ columns
│   │       └── entity/raw-order-item.entity.ts     ✅ 20+ columns
│   ├── auth/                    ✅ JWT, @Auth(), guards
│   ├── common/                  ✅ Filters, exceptions, DTOs
│   ├── app.module.ts            ✅ 6 modules registered
│   └── main.ts                  ✅ Port 3103
├── frontend/src/
│   ├── pages/
│   │   ├── DashboardPage.tsx         ✅ Placeholder ("Coming Soon")
│   │   ├── SpuMasterListPage.tsx     ✅ Full CRUD
│   │   ├── SkuMasterListPage.tsx     ✅ Full CRUD + cost history
│   │   ├── ChannelMappingListPage.tsx ✅ Full CRUD
│   │   ├── OrderUploadPage.tsx       ✅ Drag&drop, channel selector, result
│   │   ├── DailyReportPage.tsx       ✅ Date/channel filters, summary cards, table
│   │   └── auth/                     ✅ EntityInfo, Login, ChangePassword
│   ├── components/layout/AppLayout.tsx ✅ 5-section sidebar
│   ├── hooks/useSales.ts              ✅ React Query hooks
│   ├── services/sales.service.ts      ✅ API client
│   └── i18n/locales/{ko,en,vi}/       ✅ upload.*, daily.*, nav.* keys
└── docker-compose.app-sales-report.yml ✅
```

### 1.2 Dependencies — ALL Available (no installation needed)

| Dependency | Package | Used By |
|-----------|---------|---------|
| Excel parsing | `exceljs@^4.4.0` | Shopee/TikTok parsers (actively used) |
| Excel (alt) | `xlsx@^0.18.5` | Installed but **not used** — may remove |
| File upload | `@nestjs/platform-express@^11.1.0` | `FileInterceptor` in controller |
| Multer types | `@types/multer@^2.1.0` | TypeScript types |
| Swagger | `@nestjs/swagger@^11.2.6` | API docs (installed) |
| Charts | `recharts@^2.12.7` | FE (not yet used in dashboard) |

### 1.3 Established Patterns (새 코드에서 반드시 따를 패턴)

| Pattern | Implementation | File Reference |
|---------|---------------|----------------|
| **Parser interface** | `ExcelParser` interface + `ParsedOrder`/`ParsedOrderItem` | `parser/excel-parser.interface.ts` |
| **ExcelJS loading** | `new ExcelJS.Workbook() → xlsx.load(buffer)` | `shopee-excel.parser.ts` |
| **Row skipping** | `ws.eachRow` with `if (rowNum <= N) return;` | Both parsers |
| **Order grouping** | `orderMap = new Map<string, ParsedOrder>()` | Both parsers |
| **StatusNormalization** | `STATUS_MAP` dictionary + `normalizeStatus()` | Both parsers |
| **Type helpers** | `toNum()`, `toStr()`, `toDate()`, `toBool()` | Both parsers |
| **SKU matching** | `skuMap = Map(wms_code → sku_id)` + COMBO detection | `raw-order.service.ts` |
| **Transaction** | `queryRunner.connect → startTransaction → save → commit` | `raw-order.service.ts` |
| **Upload endpoint** | `@Post() + FileInterceptor + @Body('channel')` | `raw-order.controller.ts` |
| **Error codes** | `DRD-E{xxxx}` via `BusinessException` | controller + service |
| **Response format** | `{ success, data, timestamp }` | All controllers |

### 1.4 What's Left to Build (구현 필요 항목 요약)

| Phase | Requirements | Description |
|-------|-------------|-------------|
| Phase 1 | R-012 | Upload history dedicated entity + module |
| Phase 2 | R-001, R-002, R-003 | Product master Excel (template/export/import) |
| Phase 3 | R-014 | Order list & detail pages |
| Phase 4 | R-006~R-011 | 6 reference report entities + parsers + upload UI |
| Phase 5 | — | Build, test, deploy |

---

## 2. Implementation Plan (단계별 구현 계획)

### Phase 1: Upload History Entity (업로드 이력 전용 엔티티)

> 현재 `ord_import_batch_id` 그루핑 → 파일명/파일크기/에러상세를 트래킹하지 못함

#### Step 1.1: Upload History entity & module
- Create `domain/upload-history/`
  - `entity/upload-history.entity.ts` — `drd_upload_histories` table
  - `upload-history.module.ts` — exports TypeOrmModule.forFeature, exports service
  - `upload-history.service.ts` — create/update/list
  - `upload-history.controller.ts`
    - `GET /api/v1/upload-histories` — paginated list by ent_id
    - `GET /api/v1/upload-histories/:uph_id` — detail with error info

**Entity columns:**

| Column | Type | Description |
|--------|------|-------------|
| `uph_id` | CHAR(36) PK | UUID |
| `ent_id` | CHAR(36) NOT NULL | Entity ID |
| `uph_type` | ENUM | `PRODUCT_MASTER`, `ORDER_REPORT`, `TRAFFIC_REPORT`, `AD_REPORT`, `AFFILIATE_REPORT` |
| `uph_channel` | VARCHAR(20) | `SHOPEE`, `TIKTOK`, `N/A` |
| `uph_file_name` | VARCHAR(300) | Original filename |
| `uph_file_size` | INT UNSIGNED | Bytes |
| `uph_row_count` | INT UNSIGNED NULL | Total data rows |
| `uph_success_count` | INT UNSIGNED NULL | Inserted/updated |
| `uph_skip_count` | INT UNSIGNED NULL | Duplicates skipped |
| `uph_error_count` | INT UNSIGNED NULL | Errors |
| `uph_status` | ENUM | `PROCESSING`, `COMPLETED`, `PARTIAL`, `FAILED` |
| `uph_error_detail` | TEXT NULL | JSON array of errors |
| `uph_batch_id` | VARCHAR(50) NULL | Links to `ord_import_batch_id` |
| `uph_created_by` | VARCHAR(100) NULL | User ID |
| `uph_created_at` | DATETIME | Auto |

- `└─ Side effect: app.module.ts에 UploadHistoryModule 등록. DB_SYNC=true → 테이블 자동생성`

#### Step 1.2: Integrate upload history into raw-order upload
- Modify `raw-order.service.ts`:
  - Import UploadHistoryService
  - On `uploadExcel()`: create history record (status=PROCESSING) → process → update (COMPLETED/FAILED)
  - Include file.originalname, file.size in history record
- Modify `raw-order.module.ts`: import UploadHistoryModule
- `└─ Side effect: raw-order.module.ts import 추가. upload workflow에 history 기록 추가`

---

### Phase 2: Product Master Excel (상품마스터 엑셀)

#### Step 2.1: Backend — Product Master Excel module
- Create `domain/product-master-excel/`
  - `product-master-excel.module.ts` — imports SpuMasterModule, SkuMasterModule, UploadHistoryModule
  - `product-master-excel.controller.ts`:
    - `GET  /api/v1/product-master/template` — sample XLSX with header + example row
    - `GET  /api/v1/product-master/export` — current SPU+SKU data as XLSX
    - `POST /api/v1/product-master/import` — multipart XLSX upload, UPSERT by `sku_wms_code + ent_id`
  - `product-master-excel.service.ts`:
    - **Template**: ExcelJS workbook with headers (spu_code, spu_name_kr, spu_name_en, spu_name_vi, brand_code, sub_brand_code, category, sku_wms_code, sku_name_kr, sku_name_en, sku_name_vi, variant, barcode, weight_g, prime_cost, supply_price, listing_price, selling_price, fulfillment_fee) + 1 example row
    - **Export**: join spu_masters + sku_masters → write to .xlsx buffer → stream response
    - **Import**: parse rows → find SPU by `spu_code + ent_id` → auto-create if not found → find SKU by `sku_wms_code + ent_id` → UPDATE if found / INSERT if not → record upload history
    - **Response**: `{ total, inserted, updated, errors: [{row, field, message}] }`
- Register in `app.module.ts`
- `└─ Side effect: app.module.ts +1 module. SpuMasterModule/SkuMasterModule export 필요할 수 있음`

#### Step 2.2: Frontend — SKU page Excel toolbar
- Modify `SkuMasterListPage.tsx`:
  - Add toolbar row above table with 3 buttons:
    - [📥 템플릿 다운로드] → `GET /product-master/template` → blob download
    - [📥 데이터 다운로드] → `GET /product-master/export` → blob download
    - [📤 엑셀 업로드] → open modal → file select → `POST /product-master/import` → result
- Create `components/common/ExcelUploadModal.tsx` — reusable upload+result modal:
  - Props: `title`, `accept`, `maxSize`, `onUpload(file) → Promise<result>`, `resultRenderer`
  - Drag & drop zone + file type/size validation + progress + error display
- Add hooks: `hooks/useProductMasterExcel.ts` — useMutation for import, useQuery wrappers
- `└─ Side effect: SkuMasterListPage.tsx UI 변경 (toolbar 추가)`

#### Step 2.3: i18n — Product master Excel keys
- Add to `sales.json` (ko/en/vi):
  - `productMaster.template`, `.export`, `.import`, `.upsertResult`, `.totalRows`, `.inserted`, `.updated`, `.errors`
- `└─ Side effect: locale files only`

---

### Phase 3: Order List & Detail Pages (주문 데이터 조회)

#### Step 3.1: Backend — Order list & detail endpoints
- Add to existing `raw-order.controller.ts`:
  - `GET /api/v1/raw-orders` — paginated list with filters (date_start, date_end, channel, status, search)
  - `GET /api/v1/raw-orders/:ord_id` — order detail with items (join)
- Add to existing `raw-order.service.ts`:
  - `findAll(entId, filters, page, limit)` — createQueryBuilder with pagination
  - `findOne(entId, ordId)` — findOne with items relation
- Add DTOs:
  - `dto/request/list-order.request.ts` — query params validation
  - `dto/response/order-response.dto.ts` — order + items
  - `dto/response/order-list-response.dto.ts` — paginated list
- `└─ Side effect: raw-order.controller.ts에 2개 endpoint 추가`

#### Step 3.2: Frontend — Order list page
- Create `pages/RawOrderListPage.tsx`:
  - Filters: date range, channel (ALL/SHOPEE/TIKTOK), status, text search
  - Table: Order ID, date, channel, status, item count, total amount, SKU match %
  - Pagination
  - Click row → navigate to `/orders/:ordId`
- Add route `/orders` to `App.tsx`
- Add sidebar nav item under "Sales Report" section
- `└─ Side effect: App.tsx route + AppLayout sidebar`

#### Step 3.3: Frontend — Order detail page
- Create `pages/RawOrderDetailPage.tsx`:
  - Order header: dates, status badge, shipping info, financial summary
  - Items table: product name, variant SKU, qty, price, matched SKU badge
- Add route `/orders/:ordId` to `App.tsx`
- `└─ Side effect: App.tsx route`

#### Step 3.4: Frontend hooks & services
- Create `hooks/useRawOrders.ts` — useQuery for list/detail
- Add API methods to `services/sales.service.ts` or create `services/raw-order.service.ts`
- `└─ Side effect: None (new files)`

#### Step 3.5: i18n — Order keys
- Add `order.*` keys to sales.json: title, date, channel, status, items, totalAmount, skuMatch, etc.
- `└─ Side effect: locale files only`

---

### Phase 4: Reference Report Upload (참고 보고서 업로드)

#### Step 4.1: Backend — Report Upload module
- Create `domain/report-upload/`
  - `report-upload.module.ts` — imports UploadHistoryModule, TypeOrmModule for 6 entities
  - `report-upload.controller.ts`:
    - `POST /api/v1/reports/traffic/shopee`
    - `POST /api/v1/reports/traffic/tiktok`
    - `POST /api/v1/reports/ads/shopee`
    - `POST /api/v1/reports/ads/tiktok-product`
    - `POST /api/v1/reports/ads/tiktok-live`
    - `POST /api/v1/reports/affiliate/shopee`
  - `report-upload.service.ts` — dispatcher to channel-specific parsers
- Register in `app.module.ts`
- `└─ Side effect: app.module.ts +1 module`

#### Step 4.2: Backend — 6 new report entities
- Create `domain/report-upload/entity/`:
  - `shopee-traffic.entity.ts` → `drd_shopee_traffic` (~28 data cols + meta)
  - `tiktok-traffic.entity.ts` → `drd_tiktok_traffic` (~38 data cols, 4 channel groups × 8)
  - `shopee-ad.entity.ts` → `drd_shopee_ads` (~25 data cols)
  - `tiktok-ad.entity.ts` → `drd_tiktok_ads` (~28 data cols)
  - `tiktok-ad-live.entity.ts` → `drd_tiktok_ad_lives` (~22 data cols)
  - `shopee-affiliate.entity.ts` → `drd_shopee_affiliates` (~25 data cols)
- All entities: `ent_id` (tenant), `uph_batch_id` (upload link), PK UUID, timestamps
- `└─ Side effect: 6 new DB tables auto-created (DB_SYNC=true)`

#### Step 4.3: Backend — 6 report parsers (ExcelJS pattern)
- Create `domain/report-upload/parser/`:

  **4.3.1 `shopee-traffic.parser.ts`:**
  - Implement `ExcelParser` interface pattern (same as order parsers)
  - Load XLSX → get sheet 0 ("Sản Phẩm Hiệu Quả Tốt") → header Row 1, data Row 2+
  - Vietnamese locale: `parseVietnameseNumber()` for revenue, `parseVietnamesePercent()` for rates
  - Handle variant-level rows (C04 ≠ `-`) AND product-level rows
  - Batch strategy: delete previous batch for same `ent_id + period` → insert new

  **4.3.2 `tiktok-traffic.parser.ts`:**
  - Sheet1, **Row 1=date label (extract period), Row 2=empty, Row 3=headers, Row 4+=data**
  - 4 sub-channel groups × 8 metrics each
  - `parseTikTokMoney()`: remove `₫` and dots

  **4.3.3 `shopee-ad.parser.ts`:**
  - **CSV parsing** (ExcelJS can read CSV, or use xlsx for CSV)
  - UTF-8 BOM handling, **rows 1-7 skip** (extract metadata from row 1-3 for shop/date)
  - Row 8 = header, Row 9+ = data
  - Handle "Shop Ads" type row at bottom

  **4.3.4 `tiktok-ad.parser.ts`:**
  - XLSX, sheet `Data`, header Row 1, data Row 2+
  - 26 cols including video view rates (2s/6s/25/50/75/100%)

  **4.3.5 `tiktok-ad-live.parser.ts`:**
  - XLSX, sheet `Data`, header Row 1, data Row 2+
  - 19 cols live session metrics

  **4.3.6 `shopee-affiliate.parser.ts`:**
  - **CSV parsing**, UTF-8 BOM, header Row 1, data Row 2+
  - 38 cols with commission breakdown, L1/L2/L3 categories

- `└─ Side effect: None (all within report-upload module)`

#### Step 4.4: Common parser utilities
- Create `common/utils/locale-parser.util.ts`:
  - `parseVietnameseNumber(str)` — `565.063.917` → `565063917`
  - `parseVietnamesePercent(str)` — `1,77%` → `0.0177`
  - `parseTikTokMoney(str)` — `192.612.578₫` → `192612578`
  - `parseCsvBuffer(buffer, skipRows)` — CSV with BOM handling + row skip
- `└─ Side effect: None (utility file)`

#### Step 4.5: Frontend — Upload page expansion
- Expand `OrderUploadPage.tsx` OR create new `UploadCenterPage.tsx`:
  - Tab navigation: **판매리포트** (existing) | **트래픽** | **광고** | **제휴**
  - Each tab: channel selector + upload zone + result → reuse `ExcelUploadModal` pattern
  - `[트래픽]` tab: Shopee (xlsx) / TikTok (xlsx)
  - `[광고]` tab: Shopee (csv) / TikTok Product (xlsx) / TikTok Live (xlsx)
  - `[제휴]` tab: Shopee (csv)
- `└─ Side effect: OrderUploadPage or new page + route`

#### Step 4.6: Frontend — Upload History page
- Create `pages/UploadHistoryPage.tsx`:
  - Table: date, type, channel, filename, rows, success, skip, errors, status
  - Filters: date range, type, channel
  - Click row → expand error detail
- Add route `/upload/history` to App.tsx
- `└─ Side effect: App.tsx route, sidebar nav`

#### Step 4.7: i18n — Report & history keys
- Add keys: `report.*`, `traffic.*`, `ads.*`, `affiliate.*`, `uploadHistory.*`
- `└─ Side effect: locale files only`

---

### Phase 5: Build, Test & Deploy (빌드, 테스트, 배포)

#### Step 5.1: Build verification
```bash
cd apps/app-sales-report/backend && npx tsc --noEmit
cd apps/app-sales-report/frontend && npm run build
```

#### Step 5.2: Git commit & push
```
feat: excel upload/download - product master, order view, reference reports
```

#### Step 5.3: Staging deployment
```bash
ssh ambAppStore@stg-apps.amoeba.site "cd ~/ambAppStore && git pull origin main && bash platform/scripts/deploy-staging.sh"
```
- Verify: health check, 7 new tables, API endpoints

---

## 3. File Change List (변경 파일 목록)

### Backend (BE) — New Files (~28)

| # | Path (under `backend/src/`) | Description |
|---|----------------------------|-------------|
| 1 | `domain/upload-history/entity/upload-history.entity.ts` | `drd_upload_histories` entity |
| 2 | `domain/upload-history/upload-history.module.ts` | Module |
| 3 | `domain/upload-history/upload-history.service.ts` | CRUD service |
| 4 | `domain/upload-history/upload-history.controller.ts` | History list/detail API |
| 5 | `domain/upload-history/dto/upload-history-response.dto.ts` | Response DTO |
| 6 | `domain/product-master-excel/product-master-excel.module.ts` | Module |
| 7 | `domain/product-master-excel/product-master-excel.controller.ts` | Template/Export/Import API |
| 8 | `domain/product-master-excel/product-master-excel.service.ts` | Excel processing |
| 9 | `domain/raw-order/dto/request/list-order.request.ts` | List query DTO |
| 10 | `domain/raw-order/dto/response/order-response.dto.ts` | Order+items response |
| 11 | `domain/raw-order/dto/response/order-list-response.dto.ts` | Paginated list |
| 12 | `domain/report-upload/report-upload.module.ts` | Report upload module |
| 13 | `domain/report-upload/report-upload.controller.ts` | 6 upload endpoints |
| 14 | `domain/report-upload/report-upload.service.ts` | Dispatcher |
| 15 | `domain/report-upload/entity/shopee-traffic.entity.ts` | `drd_shopee_traffic` |
| 16 | `domain/report-upload/entity/tiktok-traffic.entity.ts` | `drd_tiktok_traffic` |
| 17 | `domain/report-upload/entity/shopee-ad.entity.ts` | `drd_shopee_ads` |
| 18 | `domain/report-upload/entity/tiktok-ad.entity.ts` | `drd_tiktok_ads` |
| 19 | `domain/report-upload/entity/tiktok-ad-live.entity.ts` | `drd_tiktok_ad_lives` |
| 20 | `domain/report-upload/entity/shopee-affiliate.entity.ts` | `drd_shopee_affiliates` |
| 21 | `domain/report-upload/parser/shopee-traffic.parser.ts` | 7-sheet XLSX |
| 22 | `domain/report-upload/parser/tiktok-traffic.parser.ts` | Row3-header XLSX |
| 23 | `domain/report-upload/parser/shopee-ad.parser.ts` | CSV skip-7 |
| 24 | `domain/report-upload/parser/tiktok-ad.parser.ts` | 26-col XLSX |
| 25 | `domain/report-upload/parser/tiktok-ad-live.parser.ts` | 19-col XLSX |
| 26 | `domain/report-upload/parser/shopee-affiliate.parser.ts` | CSV 38-col |
| 27 | `common/utils/locale-parser.util.ts` | Vietnamese/TikTok number parsers |

### Backend (BE) — Modified Files (4)

| # | Path | Change |
|---|------|--------|
| 1 | `app.module.ts` | +3 modules: UploadHistoryModule, ProductMasterExcelModule, ReportUploadModule |
| 2 | `domain/raw-order/raw-order.module.ts` | +import UploadHistoryModule |
| 3 | `domain/raw-order/service/raw-order.service.ts` | +upload history recording, +findAll/findOne |
| 4 | `domain/raw-order/controller/raw-order.controller.ts` | +GET list/detail endpoints |

### Frontend (FE) — New Files (~10)

| # | Path (under `frontend/src/`) | Description |
|---|------------------------------|-------------|
| 1 | `pages/RawOrderListPage.tsx` | Order data list |
| 2 | `pages/RawOrderDetailPage.tsx` | Order detail + items |
| 3 | `pages/UploadHistoryPage.tsx` | Upload history list |
| 4 | `components/common/ExcelUploadModal.tsx` | Reusable upload modal |
| 5 | `hooks/useRawOrders.ts` | Order query hooks |
| 6 | `hooks/useUploadHistory.ts` | Upload history hooks |
| 7 | `hooks/useProductMasterExcel.ts` | Product master Excel hooks |
| 8 | `hooks/useReportUpload.ts` | Report upload hooks |
| 9 | `services/raw-order.service.ts` | Order API client (or add to existing sales.service) |
| 10 | `services/upload.service.ts` | Upload API client |

### Frontend (FE) — Modified Files (4)

| # | Path | Change |
|---|------|--------|
| 1 | `App.tsx` | +3 routes: /orders, /orders/:ordId, /upload/history |
| 2 | `components/layout/AppLayout.tsx` | +sidebar items (Orders, Upload History) |
| 3 | `pages/SkuMasterListPage.tsx` | +Excel toolbar (template/export/import buttons) |
| 4 | `pages/OrderUploadPage.tsx` | +tabs for reference reports OR separate page |

### i18n — Modified Files (3)

| # | Path | Change |
|---|------|--------|
| 1 | `i18n/locales/ko/sales.json` | +productMaster.*, order.*, report.*, uploadHistory.* |
| 2 | `i18n/locales/en/sales.json` | Same keys |
| 3 | `i18n/locales/vi/sales.json` | Same keys |

### Database — New Tables (7, auto-created by TypeORM sync)

| # | Table | Phase |
|---|-------|-------|
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
| raw-order service modification | **Medium** | upload history 기록 추가 + list/detail 메서드. 기존 upload 로직 변경 최소화. |
| raw-order module imports | **Low** | +UploadHistoryModule import. Additive only. |
| app.module.ts | **Low** | +3 new module registrations. Other modules unaffected. |
| SkuMasterListPage UI | **Low** | Excel toolbar 추가. 기존 CRUD 로직 불변. |
| OrderUploadPage | **Medium** | 탭 추가 시 기존 업로드 기능에 영향 가능 → 별도 페이지 선호 |
| Existing APIs | **None** | All new endpoints on new paths. No conflict. |
| Database | **Low** | 7 new tables. Zero ALTER on existing 7 tables. |
| Memory | **Medium** | ExcelJS loads file in memory. 10MB limit sufficient. |
| ExcelJS pattern | **None** | 기존 Shopee/TikTok 파서와 동일 패턴. Proven stable. |
| Auth & ent_id | **None** | @Auth() decorator inherited. ent_id isolation maintained. |
| Docker | **None** | No compose changes. No file storage on disk. |

---

## 5. DB Migration (DB 마이그레이션)

### Staging (스테이징)

`DB_SYNC=true` — TypeORM auto-creates all 7 new tables on BFF restart. No manual SQL.

### Production (프로덕션)

Manual SQL before deployment (same DDL as v3.0 §5 — unchanged):

```sql
-- 1. Upload History
CREATE TABLE IF NOT EXISTS drd_upload_histories (
  uph_id          CHAR(36)        NOT NULL PRIMARY KEY,
  ent_id          CHAR(36)        NOT NULL,
  uph_type        ENUM('PRODUCT_MASTER','ORDER_REPORT','TRAFFIC_REPORT','AD_REPORT','AFFILIATE_REPORT') NOT NULL,
  uph_channel     VARCHAR(20)     NOT NULL DEFAULT 'SHOPEE',
  uph_file_name   VARCHAR(300)    NOT NULL,
  uph_file_size   INT UNSIGNED    NOT NULL DEFAULT 0,
  uph_row_count   INT UNSIGNED    NULL,
  uph_success_count INT UNSIGNED  NULL,
  uph_skip_count  INT UNSIGNED    NULL DEFAULT 0,
  uph_error_count INT UNSIGNED    NULL DEFAULT 0,
  uph_status      ENUM('PROCESSING','COMPLETED','PARTIAL','FAILED') NOT NULL DEFAULT 'PROCESSING',
  uph_error_detail TEXT           NULL,
  uph_batch_id    VARCHAR(50)     NULL,
  uph_created_by  VARCHAR(100)    NULL,
  uph_created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_uph_ent_type (ent_id, uph_type),
  INDEX idx_uph_ent_date (ent_id, uph_created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2~7: Reference report tables (shopee_traffic, tiktok_traffic, shopee_ads, tiktok_ads, tiktok_ad_lives, shopee_affiliates)
-- DDL: See v3.0 §5 for complete SQL — unchanged from previous version
```

---

## Implementation Priority & Recommendation (구현 우선순위)

| Phase | Scope | Priority | Est. Files | Dependency |
|-------|-------|----------|-----------|------------|
| Phase 1 (Upload History) | Backend entity+module | P1 | 5 | None |
| Phase 2 (Product Master Excel) | BE+FE | P0 | 11 | Phase 1 |
| Phase 3 (Order List/Detail) | BE+FE | P1 | 9 | None |
| Phase 4 (Reference Reports) | BE+FE | P1 | 19 | Phase 1 |
| Phase 5 (Build & Deploy) | DevOps | P0 | — | All |

**Recommended execution order:**
```
Phase 1 → Phase 2 → Phase 3 → Phase 5 (deploy, verify)
         → Phase 4 → Phase 5 (redeploy)
```

Phase 3 (Order List/Detail)은 Phase 1과 독립적이므로 병행 가능.
