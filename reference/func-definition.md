---
document_id: APPSTORE-FN-1.0.0
version: 1.0.0
status: Draft
created: 2026-03-27
updated: 2026-03-27
author: Kim Igyong
---

# ambAppStore — Functional Specification
# (기능명세서)

---

## 1. Common Specifications (공통 명세)

### 1.1 API 공통 규칙

```
Base Path:    /api/v1
Request:      snake_case (JSON body)
Response:     camelCase (JSON)
Auth Header:  Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**표준 응답 형식**:
```typescript
// 성공
{ success: true, data: T, timestamp: string }

// 실패
{ success: false, data: null, error: { code: string, message: string }, timestamp: string }
```

**에러 코드 체계**:
```
E1xxx — 인증/인가 오류
E2xxx — 유효성 검증 오류
E3xxx — 리소스 없음 (404 류)
E5xxx — 서버 오류
E9xxx — 외부 연동 오류

앱별 prefix:
  car-manager:        CAR-E{4자리}
  app-hscode:         HSC-E{4자리}
  app-sales-report:   SAL-E{4자리}
  app-stock-forecast: STK-E{4자리}
```

### 1.2 공통 DB 컬럼 패턴

```sql
-- 공통 컬럼 (모든 테이블)
{prefix}_id           CHAR(36)     NOT NULL PRIMARY KEY,  -- UUID v4
{prefix}_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
{prefix}_updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
{prefix}_deleted_at   DATETIME     NULL      DEFAULT NULL  -- soft delete
```

### 1.3 Clean Architecture 레이어별 역할

```
Presentation   — Controller, DTO, Request/Response 변환
Application    — UseCase (비즈니스 흐름 조율, 트랜잭션 경계)
Domain         — Entity, 도메인 서비스, Repository Interface (순수 비즈니스 규칙)
Infrastructure — TypeORM Entity, Repository 구현체, 외부 API 어댑터
```

---

## 2. App 1 — car-manager 기능명세

### 2.1 DB Schema (`db_app_car`)

```sql
-- 차량
CREATE TABLE car_vehicles (
  car_id           CHAR(36)     NOT NULL PRIMARY KEY,
  car_plate_no     VARCHAR(20)  NOT NULL UNIQUE,             -- 차량번호
  car_make         VARCHAR(50)  NOT NULL,                    -- 제조사
  car_model        VARCHAR(100) NOT NULL,                    -- 모델명
  car_year         SMALLINT     NOT NULL,                    -- 연식
  car_color        VARCHAR(30),
  car_fuel_type    ENUM('GASOLINE','DIESEL','ELECTRIC','HYBRID') NOT NULL,
  car_capacity     TINYINT      NOT NULL DEFAULT 5,          -- 최대 탑승인원
  car_status       ENUM('AVAILABLE','IN_USE','MAINTENANCE','DISPOSED') NOT NULL DEFAULT 'AVAILABLE',
  car_mileage      INT          NOT NULL DEFAULT 0,          -- 누적 주행거리 (km)
  car_insure_exp   DATE,                                     -- 보험 만료일
  car_note         TEXT,
  car_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  car_updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  car_deleted_at   DATETIME
);

-- 배차
CREATE TABLE car_dispatches (
  dsp_id           CHAR(36)     NOT NULL PRIMARY KEY,
  car_id           CHAR(36)     NOT NULL,
  dsp_driver_id    CHAR(36)     NOT NULL,                    -- 운전자 user_id (AMA or local)
  dsp_driver_name  VARCHAR(100) NOT NULL,
  dsp_purpose      VARCHAR(255) NOT NULL,                    -- 사용 목적
  dsp_from_loc     VARCHAR(255) NOT NULL,                    -- 출발지
  dsp_to_loc       VARCHAR(255) NOT NULL,                    -- 목적지
  dsp_start_dt     DATETIME     NOT NULL,                    -- 시작 예정일시
  dsp_end_dt       DATETIME     NOT NULL,                    -- 종료 예정일시
  dsp_actual_end   DATETIME,                                 -- 실제 반납일시
  dsp_passengers   VARCHAR(500),                             -- 동승자 (JSON array)
  dsp_status       ENUM('PENDING','APPROVED','IN_USE','COMPLETED','CANCELLED','REJECTED') NOT NULL DEFAULT 'PENDING',
  dsp_reject_note  VARCHAR(500),                             -- 반려 사유
  dsp_approved_by  CHAR(36),
  dsp_approved_at  DATETIME,
  dsp_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dsp_updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  dsp_deleted_at   DATETIME,
  FOREIGN KEY (car_id) REFERENCES car_vehicles(car_id)
);

-- 운행일지
CREATE TABLE car_drive_logs (
  drv_id           CHAR(36)     NOT NULL PRIMARY KEY,
  dsp_id           CHAR(36)     NOT NULL UNIQUE,             -- 배차 1:1
  car_id           CHAR(36)     NOT NULL,
  drv_start_km     INT          NOT NULL,                    -- 출발 주행거리
  drv_end_km       INT          NOT NULL,                    -- 도착 주행거리
  drv_distance     INT          NOT NULL,                    -- 운행 거리 (자동계산)
  drv_purpose      VARCHAR(500),
  drv_waypoints    TEXT,                                     -- 경유지
  drv_fuel_filled  TINYINT(1)   NOT NULL DEFAULT 0,
  drv_note         TEXT,
  drv_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  drv_updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  drv_deleted_at   DATETIME
);

-- 유지보수 기록
CREATE TABLE car_maintenances (
  mnt_id           CHAR(36)     NOT NULL PRIMARY KEY,
  car_id           CHAR(36)     NOT NULL,
  mnt_type         ENUM('ENGINE_OIL','TIRE','INSURANCE','INSPECTION','REPAIR','OTHER') NOT NULL,
  mnt_date         DATE         NOT NULL,
  mnt_cost         INT          NOT NULL DEFAULT 0,          -- 비용 (원)
  mnt_vendor       VARCHAR(100),
  mnt_note         TEXT,
  mnt_receipt_url  VARCHAR(500),                             -- 영수증 첨부 URL
  mnt_created_by   CHAR(36)     NOT NULL,
  mnt_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  mnt_updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  mnt_deleted_at   DATETIME
);

-- 인덱스
CREATE INDEX idx_car_dispatches_car_status ON car_dispatches(car_id, dsp_status);
CREATE INDEX idx_car_dispatches_driver ON car_dispatches(dsp_driver_id);
CREATE INDEX idx_car_dispatches_period ON car_dispatches(dsp_start_dt, dsp_end_dt);
CREATE INDEX idx_car_maintenances_car ON car_maintenances(car_id, mnt_date);
```

### 2.2 API Endpoints

#### Vehicle (차량)
```
GET    /api/v1/vehicles                  차량 목록 (status, search 쿼리 파라미터)
POST   /api/v1/vehicles                  차량 등록
GET    /api/v1/vehicles/:id              차량 상세
PATCH  /api/v1/vehicles/:id              차량 수정
DELETE /api/v1/vehicles/:id              차량 삭제 (soft)
PATCH  /api/v1/vehicles/:id/status       상태 변경
```

#### Dispatch (배차)
```
GET    /api/v1/dispatches                배차 목록 (status, carId, driverId, from, to)
POST   /api/v1/dispatches                배차 신청
GET    /api/v1/dispatches/:id            배차 상세
PATCH  /api/v1/dispatches/:id/approve    배차 승인 (Admin)
PATCH  /api/v1/dispatches/:id/reject     배차 반려 (Admin, body: { reason })
PATCH  /api/v1/dispatches/:id/complete   배차 완료 처리
PATCH  /api/v1/dispatches/:id/cancel     배차 취소
GET    /api/v1/dispatches/calendar       캘린더용 배차 조회 (year, month)
```

#### Drive Log (운행일지)
```
POST   /api/v1/drive-logs                운행일지 작성 (dsp_id 필수)
GET    /api/v1/drive-logs                운행일지 목록 (from, to, carId, driverId)
GET    /api/v1/drive-logs/:id            운행일지 상세
PATCH  /api/v1/drive-logs/:id            운행일지 수정
```

#### Maintenance (유지보수)
```
GET    /api/v1/maintenances              유지보수 이력 (carId, type, from, to)
POST   /api/v1/maintenances              유지보수 기록 등록
GET    /api/v1/maintenances/:id          상세
PATCH  /api/v1/maintenances/:id          수정
DELETE /api/v1/maintenances/:id          삭제 (soft)
GET    /api/v1/maintenances/summary      차량별 비용 집계 (carId, year)
```

### 2.3 Frontend Module Structure

```
apps/car-manager/frontend/src/
├── router/index.tsx          # base: /car-manager
├── domain/
│   ├── vehicle/
│   │   ├── pages/            VehicleListPage, VehicleDetailPage, VehicleFormPage
│   │   ├── components/       VehicleCard, VehicleStatusBadge, VehicleFilterBar
│   │   ├── hooks/            useVehicles, useVehicle, useCreateVehicle, useUpdateVehicleStatus
│   │   └── service/          vehicle.service.ts
│   ├── dispatch/
│   │   ├── pages/            DispatchListPage, DispatchCalendarPage, DispatchFormPage
│   │   ├── components/       DispatchCard, DispatchStatusBadge, CalendarView
│   │   ├── hooks/            useDispatches, useCreateDispatch, useApproveDispatch
│   │   └── service/          dispatch.service.ts
│   ├── drive-log/
│   │   ├── pages/            DriveLogListPage, DriveLogFormPage
│   │   ├── hooks/            useDriveLogs, useCreateDriveLog
│   │   └── service/          drive-log.service.ts
│   └── maintenance/
│       ├── pages/            MaintenanceListPage, MaintenanceSummaryPage
│       ├── hooks/            useMaintenances, useMaintenanceSummary
│       └── service/          maintenance.service.ts
├── components/common/
│   ├── Layout.tsx             # /car-manager 전용 레이아웃
│   ├── Sidebar.tsx
│   └── Header.tsx
└── store/
    └── auth.store.ts
```

---

## 3. App 2 — app-hscode 기능명세

### 3.1 DB Schema (`db_app_hscode`)

```sql
-- HS Code 마스터
CREATE TABLE hsc_codes (
  hsc_id           CHAR(36)     NOT NULL PRIMARY KEY,
  hsc_code         VARCHAR(12)  NOT NULL UNIQUE,             -- 10자리 국내세번
  hsc_code_6       CHAR(6)      NOT NULL,                    -- 국제 6자리
  hsc_code_4       CHAR(4)      NOT NULL,                    -- 호(4자리)
  hsc_code_2       CHAR(2)      NOT NULL,                    -- 류(2자리)
  hsc_name_ko      VARCHAR(500) NOT NULL,                    -- 한국어 품목명
  hsc_name_en      VARCHAR(500),                             -- 영어 품목명
  hsc_unit         VARCHAR(20),                              -- 단위
  hsc_mfn_rate     DECIMAL(5,2),                             -- 기본 관세율 (%)
  hsc_note         TEXT,
  hsc_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hsc_updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  hsc_deleted_at   DATETIME
);

-- FTA 협정 세율
CREATE TABLE hsc_fta_rates (
  fta_id           CHAR(36)     NOT NULL PRIMARY KEY,
  hsc_id           CHAR(36)     NOT NULL,
  fta_agreement    VARCHAR(50)  NOT NULL,                    -- 'KOR-US', 'KOR-EU', 'RCEP', etc.
  fta_country      VARCHAR(50)  NOT NULL,
  fta_rate         DECIMAL(5,2) NOT NULL,
  fta_note         VARCHAR(255),
  fta_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fta_updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hsc_id) REFERENCES hsc_codes(hsc_id)
);

-- 즐겨찾기
CREATE TABLE hsc_favorites (
  fav_id           CHAR(36)     NOT NULL PRIMARY KEY,
  fav_user_id      VARCHAR(100) NOT NULL,
  hsc_id           CHAR(36)     NOT NULL,
  fav_memo         VARCHAR(255),
  fav_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_fav_user_code (fav_user_id, hsc_id)
);

-- AI 분류 이력
CREATE TABLE hsc_ai_classifications (
  aic_id           CHAR(36)     NOT NULL PRIMARY KEY,
  aic_user_id      VARCHAR(100),
  aic_input_text   TEXT         NOT NULL,
  aic_results      JSON         NOT NULL,                    -- [{code, name, confidence, reason}]
  aic_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 풀텍스트 인덱스 (검색 성능)
CREATE FULLTEXT INDEX ft_hsc_name ON hsc_codes(hsc_name_ko, hsc_name_en);
CREATE INDEX idx_hsc_code_6 ON hsc_codes(hsc_code_6);
CREATE INDEX idx_hsc_code_4 ON hsc_codes(hsc_code_4);
CREATE INDEX idx_fta_hsc ON hsc_fta_rates(hsc_id, fta_agreement);
```

### 3.2 API Endpoints

```
GET    /api/v1/codes                     HS Code 검색 (q, level: 2|4|6|10, page, limit)
GET    /api/v1/codes/:code               HS Code 상세 (세율 포함)
GET    /api/v1/codes/:code/fta-rates     FTA 협정세율 목록
GET    /api/v1/codes/hierarchy           계층 탐색 (parent_code 파라미터)

POST   /api/v1/ai/classify               AI 품목 분류 (body: { description })
GET    /api/v1/ai/history                AI 분류 이력 (로그인 사용자)

GET    /api/v1/favorites                 즐겨찾기 목록
POST   /api/v1/favorites                 즐겨찾기 추가
DELETE /api/v1/favorites/:id             즐겨찾기 삭제

POST   /api/v1/admin/codes/upload        CSV 일괄 업로드 (Admin)
PATCH  /api/v1/admin/codes/:id           HS Code 수정 (Admin)
```

### 3.3 AI 분류 로직 (FN-HSC-AI)

```typescript
// application/use-cases/ClassifyHsCodeUseCase.ts
// Claude API 호출 흐름:
// 1. 사용자 입력 텍스트 → Claude에게 HS Code 분류 요청
// 2. System Prompt: 관세청 HS Code 전문가 페르소나 + DB의 관련 코드 컨텍스트 제공
// 3. 응답 파싱 → [{code, confidence, reason}] 최대 5개
// 4. DB에서 각 code 상세 조회 → 합본 응답 반환
// 5. 이력 저장

const systemPrompt = `
You are an expert in Korean Customs tariff classification.
Given a product description, suggest the most appropriate HS Codes.
Respond only in JSON format:
[{"code": "0000000000", "confidence": 0.95, "reason": "..."}]
`;
```

---

## 4. App 3 — app-sales-report 기능명세

### 4.1 DB Schema (`db_app_sales`)

```sql
-- 판매 채널 마스터
CREATE TABLE sal_channels (
  chn_id           CHAR(36)     NOT NULL PRIMARY KEY,
  chn_name         VARCHAR(100) NOT NULL,                    -- '자사몰', '쿠팡', '네이버', etc.
  chn_type         ENUM('OWNED','MARKETPLACE','SNS','OFFLINE','OTHER') NOT NULL,
  chn_active       TINYINT(1)   NOT NULL DEFAULT 1,
  chn_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  chn_updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  chn_deleted_at   DATETIME
);

-- 매출 원시 데이터
CREATE TABLE sal_transactions (
  txn_id           CHAR(36)     NOT NULL PRIMARY KEY,
  chn_id           CHAR(36)     NOT NULL,
  txn_order_no     VARCHAR(100),                             -- 주문번호 (채널 기준)
  txn_date         DATE         NOT NULL,                    -- 주문일
  txn_product_id   VARCHAR(100),
  txn_product_name VARCHAR(500) NOT NULL,
  txn_sku          VARCHAR(100),
  txn_qty          INT          NOT NULL DEFAULT 1,
  txn_unit_price   DECIMAL(12,2) NOT NULL,
  txn_amount       DECIMAL(12,2) NOT NULL,                   -- 실 매출액
  txn_discount     DECIMAL(12,2) NOT NULL DEFAULT 0,
  txn_type         ENUM('SALE','REFUND','CANCEL') NOT NULL DEFAULT 'SALE',
  txn_upload_id    CHAR(36),                                 -- 업로드 배치 ID
  txn_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  txn_updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (chn_id) REFERENCES sal_channels(chn_id),
  INDEX idx_txn_date (txn_date),
  INDEX idx_txn_channel_date (chn_id, txn_date)
);

-- 업로드 이력
CREATE TABLE sal_upload_batches (
  upl_id           CHAR(36)     NOT NULL PRIMARY KEY,
  upl_channel      VARCHAR(100),
  upl_filename     VARCHAR(255) NOT NULL,
  upl_row_count    INT          NOT NULL,
  upl_success_cnt  INT          NOT NULL DEFAULT 0,
  upl_fail_cnt     INT          NOT NULL DEFAULT 0,
  upl_uploaded_by  VARCHAR(100) NOT NULL,
  upl_status       ENUM('PROCESSING','DONE','FAILED') NOT NULL DEFAULT 'PROCESSING',
  upl_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  upl_updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 집계 캐시 (일별 채널별)
CREATE TABLE sal_daily_summary (
  dsum_id          CHAR(36)     NOT NULL PRIMARY KEY,
  chn_id           CHAR(36)     NOT NULL,
  dsum_date        DATE         NOT NULL,
  dsum_amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  dsum_order_cnt   INT          NOT NULL DEFAULT 0,
  dsum_refund_amt  DECIMAL(14,2) NOT NULL DEFAULT 0,
  dsum_updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_daily_channel (chn_id, dsum_date)
);
```

### 4.2 API Endpoints

```
-- 대시보드
GET    /api/v1/dashboard/summary        기간별 매출 요약 (from, to)
GET    /api/v1/dashboard/trend          매출 추이 (from, to, granularity: day|week|month)
GET    /api/v1/dashboard/channel-share  채널별 매출 비중 (from, to)
GET    /api/v1/dashboard/top-products   상위 상품 (from, to, limit)
GET    /api/v1/dashboard/yoy            전년 동기 비교 (year, month)

-- 채널별 리포트
GET    /api/v1/channels                 채널 목록
GET    /api/v1/reports/channel/:id      채널별 상세 리포트 (from, to)

-- 데이터 업로드
POST   /api/v1/upload                   CSV/Excel 업로드 (multipart/form-data)
GET    /api/v1/upload/history           업로드 이력
GET    /api/v1/upload/:id/status        업로드 처리 상태

-- 다운로드
GET    /api/v1/export/excel             리포트 Excel 다운로드 (from, to, channelId)
```

---

## 5. App 4 — app-stock-forecast 기능명세

### 5.1 DB Schema (`db_app_stock`)

```sql
-- 상품
CREATE TABLE stk_products (
  stk_id           CHAR(36)     NOT NULL PRIMARY KEY,
  stk_sku          VARCHAR(100) NOT NULL UNIQUE,
  stk_name         VARCHAR(500) NOT NULL,
  stk_category     VARCHAR(100),
  stk_barcode      VARCHAR(100),
  stk_unit_cost    DECIMAL(12,2),                            -- 원가
  stk_unit_price   DECIMAL(12,2),                            -- 판매가
  stk_safety_qty   INT          NOT NULL DEFAULT 0,          -- 안전 재고량
  stk_min_order    INT          NOT NULL DEFAULT 1,          -- 최소 발주 단위
  stk_lead_days    SMALLINT     NOT NULL DEFAULT 7,          -- 리드타임 (일)
  stk_supplier     VARCHAR(200),
  stk_status       ENUM('ACTIVE','DISCONTINUED','PENDING') NOT NULL DEFAULT 'ACTIVE',
  stk_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  stk_updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  stk_deleted_at   DATETIME
);

-- 재고 현황 (창고별)
CREATE TABLE stk_inventory (
  inv_id           CHAR(36)     NOT NULL PRIMARY KEY,
  stk_id           CHAR(36)     NOT NULL,
  inv_warehouse    VARCHAR(100) NOT NULL DEFAULT 'MAIN',      -- 창고명
  inv_qty          INT          NOT NULL DEFAULT 0,
  inv_updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_inv_product_wh (stk_id, inv_warehouse)
);

-- 입출고 이력
CREATE TABLE stk_movements (
  mov_id           CHAR(36)     NOT NULL PRIMARY KEY,
  stk_id           CHAR(36)     NOT NULL,
  mov_type         ENUM('IN_PURCHASE','IN_RETURN','IN_ADJUST','OUT_SALE','OUT_DAMAGE','OUT_ADJUST') NOT NULL,
  mov_qty          INT          NOT NULL,                    -- 양수: 입고, 음수: 출고
  mov_warehouse    VARCHAR(100) NOT NULL DEFAULT 'MAIN',
  mov_ref_id       CHAR(36),                                 -- 발주 ID 또는 판매 참조
  mov_unit_cost    DECIMAL(12,2),
  mov_note         TEXT,
  mov_created_by   VARCHAR(100) NOT NULL,
  mov_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mov_product_date (stk_id, mov_created_at),
  INDEX idx_mov_type (mov_type)
);

-- 판매 이력 (예측 학습용)
CREATE TABLE stk_sales_history (
  his_id           CHAR(36)     NOT NULL PRIMARY KEY,
  stk_id           CHAR(36)     NOT NULL,
  his_date         DATE         NOT NULL,
  his_channel      VARCHAR(100),
  his_qty_sold     INT          NOT NULL DEFAULT 0,
  his_amount       DECIMAL(12,2),
  his_created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_his_product_date (stk_id, his_date)
);

-- AI 수요 예측 결과
CREATE TABLE stk_forecasts (
  fct_id           CHAR(36)     NOT NULL PRIMARY KEY,
  stk_id           CHAR(36)     NOT NULL,
  fct_generated_at DATETIME     NOT NULL,
  fct_horizon_days SMALLINT     NOT NULL,                    -- 예측 기간 (30/60/90)
  fct_results      JSON         NOT NULL,                    -- [{date, predicted_qty, lower, upper}]
  fct_accuracy     DECIMAL(5,2),                             -- MAPE (%)
  fct_model_note   TEXT,
  INDEX idx_fct_product (stk_id, fct_generated_at)
);

-- 발주서
CREATE TABLE stk_purchase_orders (
  po_id            CHAR(36)     NOT NULL PRIMARY KEY,
  po_no            VARCHAR(50)  NOT NULL UNIQUE,             -- 발주번호
  po_supplier      VARCHAR(200) NOT NULL,
  po_order_date    DATE         NOT NULL,
  po_due_date      DATE,
  po_status        ENUM('DRAFT','ORDERED','PARTIAL_RECEIVED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  po_total_amount  DECIMAL(14,2) NOT NULL DEFAULT 0,
  po_note          TEXT,
  po_created_by    VARCHAR(100) NOT NULL,
  po_created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  po_updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  po_deleted_at    DATETIME
);

-- 발주 상세
CREATE TABLE stk_po_items (
  poi_id           CHAR(36)     NOT NULL PRIMARY KEY,
  po_id            CHAR(36)     NOT NULL,
  stk_id           CHAR(36)     NOT NULL,
  poi_qty_ordered  INT          NOT NULL,
  poi_qty_received INT          NOT NULL DEFAULT 0,
  poi_unit_cost    DECIMAL(12,2) NOT NULL,
  poi_amount       DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (po_id) REFERENCES stk_purchase_orders(po_id)
);
```

### 5.2 API Endpoints

```
-- 상품
GET    /api/v1/products                  상품 목록 (status, category, search)
POST   /api/v1/products                  상품 등록
GET    /api/v1/products/:id              상품 상세 + 현재 재고
PATCH  /api/v1/products/:id              상품 수정
DELETE /api/v1/products/:id              삭제 (soft)

-- 재고
GET    /api/v1/inventory                 재고 현황 목록 (stockStatus: normal|low|critical)
GET    /api/v1/inventory/:productId      상품별 재고 상세
POST   /api/v1/inventory/adjust          재고 실사/수정

-- 입출고
GET    /api/v1/movements                 이력 조회 (productId, type, from, to)
POST   /api/v1/movements                 입출고 처리

-- AI 예측
POST   /api/v1/forecast/generate         수요 예측 실행 (productId, horizonDays)
GET    /api/v1/forecast/:productId       최신 예측 결과 조회
GET    /api/v1/forecast/recommendations  발주 추천 목록

-- 발주
GET    /api/v1/purchase-orders           발주 목록 (status)
POST   /api/v1/purchase-orders           발주서 생성
GET    /api/v1/purchase-orders/:id       발주 상세
PATCH  /api/v1/purchase-orders/:id/status 발주 상태 변경
POST   /api/v1/purchase-orders/:id/receive 입고 처리
GET    /api/v1/purchase-orders/:id/export  Excel 다운로드
```

### 5.3 AI 예측 로직 (FN-STK-AI)

```typescript
// 수요 예측 알고리즘 (2단계 접근)

// 1단계 (Phase 1 MVP): 통계 기반 예측
//   - 최근 90일 판매 이력 기반 이동평균 + 계절성 조정
//   - 리드타임 + 안전재고를 고려한 발주 권고량 산출
//   ROP(재주문점) = 일평균판매량 × 리드타임 + 안전재고

// 2단계 (Phase 2): Claude API 연동
//   - 판매 이력 + 외부 요인(프로모션, 시즌) 입력
//   - Claude에게 자연어 해석 요청
//   - "이 상품은 다음 달 설 연휴 수요 증가가 예상됩니다. 발주를 앞당기는 것을 권장합니다."

const forecastPrompt = (product: Product, history: SalesHistory[]) => `
You are a supply chain analyst. Analyze this product's sales history and provide:
1. Demand forecast for next ${horizonDays} days
2. Key factors affecting demand
3. Ordering recommendation

Product: ${product.name} (SKU: ${product.sku})
Safety Stock: ${product.safetyQty} units
Lead Time: ${product.leadDays} days
Sales History (last 90 days): ${JSON.stringify(history)}

Respond in JSON format only.
`;
```

---

*Document ID: APPSTORE-FN-1.0.0 | Author: Kim Igyong | 2026-03-27*
