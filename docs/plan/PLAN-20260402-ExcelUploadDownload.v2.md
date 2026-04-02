# Excel Upload/Download — Task Plan (엑셀 업로드/다운로드 작업계획서)

---
document_id: AMA-SAL-TASK-PLAN-2.0.0
version: 2.0.0
status: Draft
created: 2026-04-02
app: app-sales-report
based_on: AMA-SAL-ANALYSIS-2.0.0
---

## 1. System Development Status Analysis (시스템 개발 현황 분석)

### 1.1 Directory Structure

```
apps/app-sales-report/
├── backend/src/
│   ├── domain/
│   │   ├── spu-master/          ✅ Entity, Controller, Service, DTO, Module
│   │   ├── sku-master/          ✅ Entity, Controller, Service, DTO, Module  
│   │   ├── channel-master/      ✅ Entity, Controller, Service, Module
│   │   ├── channel-product-mapping/ ✅ Entity, Controller, Service, DTO, Module
│   │   └── sku-cost-history/    ✅ Entity, Controller, Service, Module
│   ├── auth/                    ✅ JWT strategy, guards, decorators
│   ├── global/                  ✅ Filters, interceptors
│   ├── app.module.ts            ✅ All 5 domains registered
│   └── main.ts                  ✅ Port 3103
├── frontend/src/
│   ├── domain/
│   │   ├── dashboard/           ✅ DashboardPage (placeholder)
│   │   ├── spu-master/          ✅ SpuMasterListPage
│   │   ├── sku-master/          ✅ SkuMasterListPage + CostHistoryDrawer
│   │   └── channel-mapping/     ✅ ChannelMappingListPage
│   ├── components/              ✅ Common UI (Header, Sidebar, etc.)
│   ├── hooks/useSales.ts        ✅ React Query hooks
│   ├── services/sales.service.ts ✅ API client methods
│   └── i18n/locales/{ko,en,vi}/ ✅ sales.json (3 languages)
└── docker-compose.app-sales-report.yml ✅
```

### 1.2 Tech Stack & Dependencies

| Category | Current | To Add |
|----------|---------|--------|
| **BE** multer | ❌ | `@nestjs/platform-express` (includes multer) |
| **BE** exceljs | ❌ | `exceljs@^4.4.0` |
| **BE** uuid | ❌ (TypeORM handles) | Already available via TypeORM |
| **FE** exceljs | ❌ | `exceljs@^4.4.0` |
| **FE** file-saver | ❌ | `file-saver@^2.0.5`, `@types/file-saver` |

### 1.3 Current Constraints

- Backend has no `uploads/` directory or volume mount in Docker
- No `multer` configuration in `app.module.ts`
- Channel master table is empty (no seed data)
- Dashboard page is placeholder "Coming Soon"

---

## 2. Implementation Plan (단계별 구현 계획)

### Phase 1: Foundation — Dependencies & Channel Seed (기반 세팅)

#### Step 1.1: Backend dependency installation
- Install `exceljs`, `@types/multer`
- `└─ Side effect: package.json, package-lock.json change`

#### Step 1.2: Frontend dependency installation
- Install `exceljs`, `file-saver`, `@types/file-saver`
- `└─ Side effect: package.json change`

#### Step 1.3: Channel master seed data
- Create seed SQL for 5 channels: SHOPEE, TIKTOK, INFLUENCER, B2B, OTHER
- Execute on staging DB
- `└─ Side effect: drd_channel_masters gets 5 rows`

#### Step 1.4: Docker volume mount for uploads
- Add `./uploads:/app/uploads` volume to `docker-compose.app-sales-report.yml`
- Add `.gitkeep` to `uploads/` directory
- `└─ Side effect: Docker compose change → requires container recreation`

---

### Phase 2: Product Master Excel (상품마스터 엑셀)

#### Step 2.1: Backend — Product Master Excel module
- Create `domain/product-master-excel/` module:
  - `product-master-excel.module.ts`
  - `product-master-excel.controller.ts`
  - `product-master-excel.service.ts`
- Endpoints:
  - `GET /api/v1/product-master/template` — generate & return sample Excel
  - `GET /api/v1/product-master/export` — export current SPU+SKU data to Excel
  - `POST /api/v1/product-master/import` — upload Excel, UPSERT by WMS code
- UPSERT logic: Find by `sku_wms_code + ent_id`, update if exists, insert if not
- Auto-create SPU if spu_code not found
- Return `{ total, inserted, updated, errors: [{row, reason}] }`
- `└─ Side effect: Registers in app.module.ts`

#### Step 2.2: Backend — Upload history entity & module
- Create `domain/upload-history/` module:
  - `upload-history.entity.ts` (drd_upload_histories)
  - `upload-history.module.ts` (exports repository)
- Record every upload attempt with status, counts, errors
- `└─ Side effect: New DB table auto-created (DB_SYNC=true)`

#### Step 2.3: Frontend — SKU page Excel buttons
- Add toolbar buttons to `SkuMasterListPage.tsx`:
  - [Download Template] — calls template API, triggers browser download
  - [Download Data] — calls export API, triggers browser download
  - [Excel Upload] — file input dialog → calls import API → shows result
- Upload result modal showing insert/update/error counts
- `└─ Side effect: SkuMasterListPage UI changes`

#### Step 2.4: i18n — Add upload/download translation keys
- Add keys: `upload.*`, `download.*`, `import.*` to sales.json (3 languages)
- `└─ Side effect: i18n locale file changes`

---

### Phase 3: Sales Data (판매 데이터)

#### Step 3.1: Backend — Sales record entity
- Create `domain/sales-record/entity/sales-record.entity.ts`
  - Table: `drd_sales_records`
  - Columns: sal_id, ent_id, sku_id(FK), chn_code(FK), sal_order_date, sal_order_id, sal_quantity, sal_selling_price, sal_listing_price, sal_revenue, sal_source, sal_memo, timestamps
  - Relations: ManyToOne → SkuMasterEntity, ManyToOne → ChannelMasterEntity
- `└─ Side effect: New DB table auto-created`

#### Step 3.2: Backend — Sales record CRUD
- Create `domain/sales-record/`:
  - `sales-record.controller.ts` — CRUD + marketplace import endpoints
  - `sales-record.service.ts` — business logic
  - `dto/request/create-sales-record.request.ts` — direct input DTO
  - `dto/response/sales-record.response.ts`
  - `sales-record.module.ts`
- Endpoints:
  - `GET /api/v1/sales-records` (list with date range, channel, search filters)
  - `POST /api/v1/sales-records` (direct input)
  - `PATCH /api/v1/sales-records/:sal_id` (update)
  - `DELETE /api/v1/sales-records/:sal_id` (soft delete)
- Direct input: auto-populate listing_price from SKU master, compute revenue
- `└─ Side effect: Registers in app.module.ts`

#### Step 3.3: Backend — Marketplace Excel parsers
- Create parser services in `domain/sales-record/service/`:
  - `shopee-parser.service.ts` — parse Shopee order export
  - `tiktok-parser.service.ts` — parse TikTok order export
  - `wms-parser.service.ts` — parse Amoeba WMS shipment
- Each parser:
  1. Read Excel with exceljs
  2. Map marketplace-specific columns to `drd_sales_records` fields
  3. Match SKU by product name / WMS code / channel_product_id
  4. Bulk INSERT with source tag
  5. Record upload history
- Endpoints:
  - `POST /api/v1/sales-records/import/shopee`
  - `POST /api/v1/sales-records/import/tiktok`
  - `POST /api/v1/sales-records/import/wms`
- `└─ Side effect: None (contained in sales-record module)`

#### Step 3.4: Frontend — Sales record page
- Create `domain/sales-record/`:
  - `pages/SalesRecordListPage.tsx` — table with date range filter, channel filter, search
  - `components/SalesInputModal.tsx` — direct input form
  - `components/SalesImportModal.tsx` — marketplace select + file upload
  - `hooks/useSalesRecords.ts` — React Query hooks
  - `service/sales-record.service.ts` — API client
  - `types/sales-record.types.ts`
- Features:
  - Date range filter (default: this month)
  - Channel filter tabs/dropdown
  - Direct input modal: SPU→SKU cascading select, channel select, price, quantity, date
  - Excel upload modal: marketplace type select → file upload → result display
- `└─ Side effect: App.tsx route addition`

#### Step 3.5: Frontend — Navigation & routing
- Add `/sales` route to `App.tsx`
- Add "Sales Data" (판매 데이터) to sidebar navigation
- `└─ Side effect: Sidebar component change`

---

### Phase 4: Reference Report Upload (참고 보고서 업로드)

#### Step 4.1: Backend — Report upload module
- Create `domain/report-upload/`:
  - `report-upload.controller.ts`
  - `report-upload.service.ts`
  - `report-upload.module.ts`
- Endpoints:
  - `POST /api/v1/reports/upload` — multipart file + type + marketplace
  - `GET /api/v1/reports` — list by type, marketplace filter
  - `GET /api/v1/reports/:uph_id/download` — file download
  - `DELETE /api/v1/reports/:uph_id` — delete file + record
- Storage: `uploads/{ent_id}/reports/{type}/` directory structure
- Uses upload-history entity for tracking
- `└─ Side effect: Registers in app.module.ts`

#### Step 4.2: Frontend — Report page
- Create `domain/report-upload/`:
  - `pages/ReportListPage.tsx` — tab-based view (4 report types)
  - `components/ReportUploadModal.tsx` — type select + marketplace select + file input
  - `hooks/useReports.ts`
  - `service/report.service.ts`
  - `types/report.types.ts`
- Features:
  - 4 tabs: Sales Report / Ads Report / Traffic Report / Affiliate Report
  - Each tab shows uploaded files list with download/delete actions
  - Upload modal: marketplace (Shopee/TikTok) + file select
- `└─ Side effect: App.tsx route, sidebar nav`

#### Step 4.3: i18n — Sales & report translation keys
- Add all remaining translation keys for sales records and reports
- `└─ Side effect: Locale files only`

---

### Phase 5: Build & Deploy (빌드 및 배포)

#### Step 5.1: Build verification
- `cd backend && npx tsc --noEmit` — backend type check
- `cd frontend && npm run build` — frontend Vite build
- `└─ Side effect: None`

#### Step 5.2: Git commit & push
- Commit all changes with descriptive message
- Push to `main`
- `└─ Side effect: Remote repository update`

#### Step 5.3: Staging deployment
- SSH → git pull → `deploy-staging.sh build sales` → restart
- Verify: health check, table creation, API endpoints
- `└─ Side effect: Staging environment update`

---

## 3. File Change List (변경 파일 목록)

### Backend (BE)

| Category | File | Change Type |
|----------|------|------------|
| Config | `backend/package.json` | Modify — add exceljs, @types/multer |
| Config | `backend/src/app.module.ts` | Modify — register 4 new modules |
| **New** | `backend/src/domain/product-master-excel/product-master-excel.module.ts` | New |
| **New** | `backend/src/domain/product-master-excel/product-master-excel.controller.ts` | New |
| **New** | `backend/src/domain/product-master-excel/product-master-excel.service.ts` | New |
| **New** | `backend/src/domain/upload-history/entity/upload-history.entity.ts` | New |
| **New** | `backend/src/domain/upload-history/upload-history.module.ts` | New |
| **New** | `backend/src/domain/sales-record/entity/sales-record.entity.ts` | New |
| **New** | `backend/src/domain/sales-record/sales-record.module.ts` | New |
| **New** | `backend/src/domain/sales-record/controller/sales-record.controller.ts` | New |
| **New** | `backend/src/domain/sales-record/service/sales-record.service.ts` | New |
| **New** | `backend/src/domain/sales-record/service/shopee-parser.service.ts` | New |
| **New** | `backend/src/domain/sales-record/service/tiktok-parser.service.ts` | New |
| **New** | `backend/src/domain/sales-record/service/wms-parser.service.ts` | New |
| **New** | `backend/src/domain/sales-record/dto/request/create-sales-record.request.ts` | New |
| **New** | `backend/src/domain/sales-record/dto/response/sales-record.response.ts` | New |
| **New** | `backend/src/domain/report-upload/report-upload.module.ts` | New |
| **New** | `backend/src/domain/report-upload/report-upload.controller.ts` | New |
| **New** | `backend/src/domain/report-upload/report-upload.service.ts` | New |

### Frontend (FE)

| Category | File | Change Type |
|----------|------|------------|
| Config | `frontend/package.json` | Modify — add exceljs, file-saver |
| Route | `frontend/src/App.tsx` | Modify — add /sales, /reports routes |
| Navigation | `frontend/src/components/Sidebar.tsx` | Modify — add menu items |
| Existing | `frontend/src/domain/sku-master/pages/SkuMasterListPage.tsx` | Modify — add Excel buttons |
| **New** | `frontend/src/domain/sku-master/components/ExcelUploadModal.tsx` | New |
| **New** | `frontend/src/domain/sku-master/hooks/useProductMasterExcel.ts` | New |
| **New** | `frontend/src/domain/sales-record/pages/SalesRecordListPage.tsx` | New |
| **New** | `frontend/src/domain/sales-record/components/SalesInputModal.tsx` | New |
| **New** | `frontend/src/domain/sales-record/components/SalesImportModal.tsx` | New |
| **New** | `frontend/src/domain/sales-record/hooks/useSalesRecords.ts` | New |
| **New** | `frontend/src/domain/sales-record/service/sales-record.service.ts` | New |
| **New** | `frontend/src/domain/sales-record/types/sales-record.types.ts` | New |
| **New** | `frontend/src/domain/report-upload/pages/ReportListPage.tsx` | New |
| **New** | `frontend/src/domain/report-upload/components/ReportUploadModal.tsx` | New |
| **New** | `frontend/src/domain/report-upload/hooks/useReports.ts` | New |
| **New** | `frontend/src/domain/report-upload/service/report.service.ts` | New |
| **New** | `frontend/src/domain/report-upload/types/report.types.ts` | New |

### i18n

| File | Change Type |
|------|------------|
| `frontend/src/i18n/locales/ko/sales.json` | Modify — add upload/sales/report keys |
| `frontend/src/i18n/locales/en/sales.json` | Modify |
| `frontend/src/i18n/locales/vi/sales.json` | Modify |

### DB

| Table | Change Type |
|-------|------------|
| `drd_sales_records` | New (TypeORM auto-sync) |
| `drd_upload_histories` | New (TypeORM auto-sync) |
| `drd_channel_masters` | Seed data INSERT (5 rows) |

### Docker

| File | Change Type |
|------|------------|
| `docker-compose.app-sales-report.yml` | Modify — add volume mount |

---

## 4. Side Impact Analysis (사이드 임팩트 분석)

| Scope | Risk | Description |
|-------|------|-------------|
| Existing SKU CRUD | Low | UI-only change (add buttons), no business logic change |
| Existing APIs | None | All new endpoints on new paths — no conflict |
| Database | Low | New tables only — no ALTER on existing tables |
| Docker | Low | Volume mount addition requires container recreation |
| File system | Medium | Upload files stored on disk — needs disk space monitoring |
| Memory | Medium | Large Excel parsing (exceljs) may use significant memory for big files |
| SKU matching | Medium | Shopee/TikTok product name → SKU matching may have false matches |
| Auth | None | All new endpoints use existing `@Auth()` decorator |
| i18n | Low | Additive keys only — no existing key changes |

---

## 5. DB Migration (DB 마이그레이션)

### Staging (스테이징)

`DB_SYNC=true` is already set — TypeORM auto-creates tables on BFF restart.

### Production (프로덕션)

Manual SQL required:

```sql
-- 1. Sales Records table
CREATE TABLE drd_sales_records (
  sal_id            CHAR(36)        NOT NULL PRIMARY KEY,
  ent_id            CHAR(36)        NOT NULL,
  sku_id            CHAR(36)        NOT NULL,
  chn_code          VARCHAR(20)     NOT NULL,
  sal_order_date    DATE            NOT NULL,
  sal_order_id      VARCHAR(100)    NULL,
  sal_quantity      INT             NOT NULL,
  sal_selling_price DECIMAL(15,2)   NOT NULL,
  sal_listing_price DECIMAL(15,2)   NULL,
  sal_revenue       DECIMAL(15,2)   NOT NULL,
  sal_source        ENUM('MANUAL','SHOPEE','TIKTOK','WMS') NOT NULL DEFAULT 'MANUAL',
  sal_memo          VARCHAR(500)    NULL,
  sal_created_at    DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  sal_updated_at    DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  sal_deleted_at    DATETIME(6)     NULL,
  INDEX idx_drd_sales_ent (ent_id),
  INDEX idx_drd_sales_date (sal_order_date),
  INDEX idx_drd_sales_sku (sku_id),
  INDEX idx_drd_sales_chn (chn_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Upload Histories table
CREATE TABLE drd_upload_histories (
  uph_id            CHAR(36)        NOT NULL PRIMARY KEY,
  ent_id            CHAR(36)        NOT NULL,
  uph_type          ENUM('PRODUCT_MASTER','SALES_SHOPEE','SALES_TIKTOK','SALES_WMS',
                         'REPORT_SALES','REPORT_ADS','REPORT_TRAFFIC','REPORT_AFFILIATE') NOT NULL,
  uph_file_name     VARCHAR(300)    NOT NULL,
  uph_file_path     VARCHAR(500)    NOT NULL,
  uph_file_size     INT             NOT NULL DEFAULT 0,
  uph_row_count     INT             NULL,
  uph_success_count INT             NULL,
  uph_error_count   INT             NULL,
  uph_status        ENUM('PROCESSING','COMPLETED','FAILED') NOT NULL DEFAULT 'PROCESSING',
  uph_error_detail  TEXT            NULL,
  uph_created_by    VARCHAR(100)    NULL,
  uph_created_at    DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_drd_upload_ent (ent_id),
  INDEX idx_drd_upload_type (uph_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Channel Master seed data
INSERT INTO drd_channel_masters (chn_code, chn_name, chn_type, chn_default_platform_fee_rate, chn_default_fulfillment_fee, chn_is_api_integrated, chn_is_active, chn_created_at, chn_updated_at)
VALUES
  ('SHOPEE', 'Shopee Vietnam', 'MARKETPLACE', 0.0300, 14000.00, 1, 1, NOW(), NOW()),
  ('TIKTOK', 'TikTok Shop', 'SOCIAL_COMMERCE', 0.0500, 15000.00, 0, 1, NOW(), NOW()),
  ('INFLUENCER', 'Influencer / KOL', 'INFLUENCER', NULL, NULL, 0, 1, NOW(), NOW()),
  ('B2B', 'B2B Wholesale', 'B2B', NULL, NULL, 0, 1, NOW(), NOW()),
  ('OTHER', 'Other Channels', 'OTHER', NULL, NULL, 0, 1, NOW(), NOW());
```

---

## 6. Implementation Order Summary (구현 순서 요약)

| Phase | Steps | Estimated Files | Dependency |
|-------|-------|----------------|-----------|
| **Phase 1** Foundation | 1.1~1.4 | 4 files | None |
| **Phase 2** Product Master Excel | 2.1~2.4 | ~10 files | Phase 1 |
| **Phase 3** Sales Data | 3.1~3.5 | ~15 files | Phase 2 (upload-history) |
| **Phase 4** Reference Reports | 4.1~4.3 | ~8 files | Phase 2 (upload-history) |
| **Phase 5** Build & Deploy | 5.1~5.3 | 0 (ops) | Phase 2~4 |

**Total new files**: ~33  
**Total modified files**: ~10  
**New DB tables**: 2  
**New API endpoints**: 12  
