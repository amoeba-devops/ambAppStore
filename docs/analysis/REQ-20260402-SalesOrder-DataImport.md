# Sales Order Data Import — Requirements Analysis (판매주문 데이터 임포트 요구사항 분석서)

---
```
document_id : REQ-20260402-SalesOrder-DataImport
version     : 1.0.0
status      : Draft
created     : 2026-04-02
updated     : 2026-04-02
author      : Amoeba Dev Team
app         : app-sales-report
based_on    : DRD-REQ-2026-001 v3.0, DRD-FDS-2026-001 v3.0
```
---

## 1. Requirements Summary (요구사항 요약)

| # | Requirement (요구사항) | Type (유형) |
|---|----------------------|------------|
| R-01 | Shopee 판매 주문 Excel 파일(`Order.all.*.xlsx`)을 DB에 임포트하는 기능 구현 | Functional |
| R-02 | 주문 원시 데이터를 `drd_raw_orders` 테이블에 저장 | Functional |
| R-03 | 주문 라인 아이템을 `drd_raw_order_items` 테이블에 저장 (주문-아이템 1:N 관계) | Functional |
| R-04 | SKU(variant SKU) 기반으로 기존 `drd_sku_masters`와 자동 매핑 | Functional |
| R-05 | Python `generate-seed.py` 패턴을 활용한 Excel→SQL 변환 스크립트 개발 | Functional |
| R-06 | 중복 임포트 방지 (동일 주문 ID + 기간 중복 체크) | Non-Functional |
| R-07 | 향후 API 업로드 확장 가능한 테이블 구조 설계 | Non-Functional |

---

## 2. AS-IS Current State Analysis (AS-IS 현황 분석)

### 2.1 Backend (백엔드)

**경로**: `apps/app-sales-report/backend/src/`

현재 구현된 도메인 모듈 (5개):

| Module | Entity Table | Purpose |
|--------|-------------|---------|
| `domain/spu-master/` | `drd_spu_masters` | SPU(상품 그룹) CRUD |
| `domain/sku-master/` | `drd_sku_masters` | SKU(품목) CRUD |
| `domain/channel-master/` | `drd_channel_masters` | 채널 마스터 (Read-only) |
| `domain/channel-product-mapping/` | `drd_channel_product_mappings` | SKU↔채널 매핑 |
| `domain/sku-cost-history/` | `drd_sku_cost_histories` | 원가 변경 이력 (Read-only) |

**판매 데이터 관련 기능**: ❌ **미구현**
- `drd_raw_orders` 테이블 미존재
- `drd_raw_order_items` 테이블 미존재
- `drd_daily_summaries` 테이블 미존재
- `drd_product_dailies` 테이블 미존재
- 주문 데이터 수집 모듈 미존재
- 파일 업로드 API 미존재

### 2.2 Database (데이터베이스)

**DB**: `db_app_sales` (MySQL 8.0)

현재 테이블 (5개):
- `drd_spu_masters` — 44 records (시드 데이터)
- `drd_sku_masters` — 178 records (시드 데이터)
- `drd_channel_masters` — Global 채널 목록
- `drd_channel_product_mappings` — SKU↔채널 매핑
- `drd_sku_cost_histories` — 원가 이력

**Entity ID**: `acce6566-8a00-4071-b52b-082b69832510` (Socialbean VN)

### 2.3 Excel Data Source (엑셀 데이터 소스)

**파일**: `reference/appSalesReport/Order.all.20260301_20260331.xlsx`
- **플랫폼**: Shopee Vietnam
- **기간**: 2026-03-01 ~ 2026-03-31 (31일)
- **시트**: `orders`
- **총 행**: 4,977건 (헤더 제외)
- **총 유니크 주문**: 3,600건
- **다중 아이템 주문**: 711건 (최대 11개 아이템/주문)
- **컬럼 수**: 68개
- **언어**: Vietnamese (컬럼 헤더 베트남어)

#### 주문 상태 분포

| Status (Vietnamese) | Count | English Mapping |
|---------------------|-------|----------------|
| Hoàn thành | 2,043 | Completed |
| Đã hủy | 874 | Cancelled |
| Buyer confirmed (refund window) | 1,861 | Delivered (refund period) |
| Đã giao | 201 | Delivered |
| Đang giao | 148 | Shipping |
| Đã nhận được hàng | 5 | Received |

#### 주요 컬럼 매핑 (68컬럼 → DB 필드)

| Col # | Vietnamese Header | English | DB Target | Type |
|-------|------------------|---------|-----------|------|
| 1 | Mã đơn hàng | Order ID | `ord_order_id` | VARCHAR(20) |
| 2 | Mã Kiện Hàng | Package ID | `ord_package_id` | VARCHAR(30) |
| 3 | Ngày đặt hàng | Order Date | `ord_order_date` | DATETIME |
| 4 | Trạng Thái Đơn Hàng | Order Status | `ord_status` | VARCHAR(20) |
| 5 | Sản Phẩm Bán Chạy | Bestseller Flag | `oli_is_bestseller` | BOOLEAN |
| 6 | Lý do hủy | Cancel Reason | `ord_cancel_reason` | VARCHAR(500) |
| 7 | Nhận xét từ Người mua | Buyer Note | `ord_buyer_note` | TEXT |
| 8 | Mã vận đơn | Tracking Number | `ord_tracking_no` | VARCHAR(50) |
| 9 | Đơn Vị Vận Chuyển | Carrier | `ord_carrier` | VARCHAR(100) |
| 10 | Phương thức giao hàng | Delivery Method | `ord_delivery_method` | VARCHAR(50) |
| 11 | Loại đơn hàng | Order Type | `ord_order_type` | VARCHAR(50) |
| 12 | Ngày giao hàng dự kiến | Est. Delivery Date | `ord_est_delivery_date` | DATETIME |
| 13 | Ngày gửi hàng | Ship Date | `ord_ship_date` | DATETIME |
| 14 | Thời gian giao hàng | Delivery Time | `ord_delivery_time` | DATETIME |
| 15 | Trạng thái Trả hàng/Hoàn tiền | Return Status | `oli_return_status` | VARCHAR(50) |
| 16 | SKU sản phẩm | Product SKU | `oli_product_sku` | VARCHAR(50) |
| 17 | Tên sản phẩm | Product Name | `oli_product_name` | VARCHAR(500) |
| 18 | Cân nặng sản phẩm | Item Weight | `oli_weight_kg` | DECIMAL(8,3) |
| 19 | Tổng cân nặng | Total Weight | `ord_total_weight_kg` | DECIMAL(8,3) |
| 20 | SKU phân loại hàng | Variant SKU (WMS) | `oli_variant_sku` | VARCHAR(30) |
| 21 | Tên phân loại hàng | Variant Name | `oli_variant_name` | VARCHAR(200) |
| 22 | Giá gốc | Original Price | `oli_original_price` | DECIMAL(15,2) |
| 23 | Người bán trợ giá | Seller Discount | `oli_seller_discount` | DECIMAL(15,2) |
| 24 | Được Shopee trợ giá | Shopee Discount | `oli_shopee_discount` | DECIMAL(15,2) |
| 25 | Tổng số tiền được người bán trợ giá | Total Seller Subsidy | `oli_total_seller_subsidy` | DECIMAL(15,2) |
| 26 | Giá ưu đãi | Deal Price | `oli_deal_price` | DECIMAL(15,2) |
| 27 | Số lượng | Quantity | `oli_quantity` | INT |
| 28 | Số lượng sản phẩm được hoàn trả | Return Quantity | `oli_return_quantity` | INT |
| 29 | Tổng số tiền Người mua thanh toán | Item Buyer Paid | `oli_buyer_paid` | DECIMAL(15,2) |
| 30 | Tổng giá trị đơn hàng (VND) | Order Total VND | `ord_total_vnd` | DECIMAL(15,2) |
| 31 | Mã giảm giá của Shop | Shop Voucher Code | `ord_shop_voucher` | VARCHAR(100) |
| 32 | Hoàn Xu | Coin Cashback | `ord_coin_cashback` | DECIMAL(15,2) |
| 33 | Mã giảm giá của Shopee | Shopee Voucher Code | `ord_shopee_voucher` | VARCHAR(100) |
| 34 | Chỉ tiêu Combo Khuyến Mãi | Promo Combo Target | `ord_promo_combo` | VARCHAR(200) |
| 35 | Giảm giá từ combo Shopee | Shopee Combo Discount | `ord_shopee_combo_discount` | DECIMAL(15,2) |
| 36 | Giảm giá từ Combo của Shop | Shop Combo Discount | `ord_shop_combo_discount` | DECIMAL(15,2) |
| 37 | Shopee Xu được hoàn | Shopee Coin Rebate | `ord_shopee_coin_rebate` | DECIMAL(15,2) |
| 38 | Số tiền giảm thanh toán bằng thẻ | Card Discount | `ord_card_discount` | DECIMAL(15,2) |
| 39 | Trade-in Discount | Trade-in Discount | `ord_trade_in_discount` | DECIMAL(15,2) |
| 40 | Trade-in Bonus | Trade-in Bonus | `ord_trade_in_bonus` | DECIMAL(15,2) |
| 41 | Phí vận chuyển (dự kiến) | Est. Shipping Fee | `ord_shipping_fee_est` | DECIMAL(15,2) |
| 42 | Trade-in Bonus by Seller | Seller Trade-in Bonus | `ord_seller_trade_in_bonus` | DECIMAL(15,2) |
| 43 | Phí vận chuyển mà người mua trả | Buyer Shipping Fee | `ord_buyer_shipping_fee` | DECIMAL(15,2) |
| 44 | Phí vận chuyển tài trợ bởi Shopee | Shopee Ship Subsidy | `ord_shopee_shipping_subsidy` | DECIMAL(15,2) |
| 45 | Phí vận chuyển trả hàng | Return Shipping Fee | `ord_return_shipping_fee` | DECIMAL(15,2) |
| 46 | Tổng số tiền người mua thanh toán | Total Buyer Payment | `ord_total_buyer_payment` | DECIMAL(15,2) |
| 47 | Thời gian hoàn thành đơn hàng | Completed At | `ord_completed_at` | DATETIME |
| 48 | Thời gian đơn hàng được thanh toán | Paid At | `ord_paid_at` | DATETIME |
| 49 | Phương thức thanh toán | Payment Method | `ord_payment_method` | VARCHAR(100) |
| 50 | Phí cố định | Fixed Fee (Commission) | `ord_commission_fee` | DECIMAL(15,2) |
| 51 | Phí Dịch Vụ | Service Fee | `ord_service_fee` | DECIMAL(15,2) |
| 52 | Phí thanh toán | Payment Fee | `ord_payment_fee` | DECIMAL(15,2) |
| 53 | Tiền ký quỹ | Deposit | `ord_deposit` | DECIMAL(15,2) |
| 54 | Người Mua | Buyer Username | _(not stored — PII)_ |
| 55 | Tên Người nhận | Recipient Name | _(not stored — PII)_ |
| 56 | Số điện thoại | Phone | _(not stored — PII)_ |
| 57 | Tỉnh/Thành phố | Province | `ord_province` | VARCHAR(100) |
| 58 | TP / Quận / Huyện | District | `ord_district` | VARCHAR(100) |
| 59 | Quận | Ward | _(not stored)_ |
| 60 | Địa chỉ nhận hàng | Address | _(not stored — PII)_ |
| 61 | Quốc gia | Country | `ord_country` | VARCHAR(50) |
| 62~68 | Ghi chú, Hóa đơn, Thuế... | Notes, Invoice | _(not stored)_ |

> **PII 정책**: 고객 개인정보(이름, 전화번호, 주소 상세)는 DB에 저장하지 않음 (GDPR/Privacy)

### 2.4 Existing Seed Tool (기존 시드 도구)

**파일**: `apps/app-sales-report/generate-seed.py`
- 기능: Excel 상품 정보 시트 → SPU/SKU INSERT SQL 생성
- 입력: `Socialbean 2026 - STOCK MANAGEMENT.xlsx` (PRODUCT INFORMATION 시트)
- 출력: `seed-product-master.sql`
- 패턴: openpyxl로 Excel 읽기 → UUID 생성 → SQL 출력

### 2.5 Problems (문제점)

1. **판매 데이터 저장 테이블 부재**: Phase 1에서 상품 마스터만 구현, 주문 원시 데이터 저장소 없음
2. **데이터 수집 기능 없음**: FN-01(데이터 수집 배치)이 Phase 2로 미루어져 있음
3. **수동 시드 방식**: 현재 SQL 직접 실행만 가능, API/자동화 없음
4. **주문-아이템 1:N 관계**: 3,600건 주문이 4,977 라인 아이템으로 구성 (multi-item 처리 필요)
5. **SKU 매핑 필요**: `oli_variant_sku`(예: `SAFG20U0003`)를 `drd_sku_masters.sku_wms_code`와 매핑

---

## 3. TO-BE Requirements (TO-BE 요구사항)

### 3.1 AS-IS → TO-BE Mapping

| Area | AS-IS | TO-BE |
|------|-------|-------|
| Order Storage | 없음 | `drd_raw_orders` + `drd_raw_order_items` 2개 테이블 |
| Data Import | 없음 | Python 스크립트 (Excel→SQL) + NestJS API (향후) |
| SKU Matching | 없음 | variant_sku → sku_wms_code 자동 매핑, 미매핑 감지 |
| Duplicate Check | 없음 | order_id + channel 복합 유니크로 중복 방지 |
| Status Mapping | 없음 | Vietnamese status → ENUM 정규화 |

### 3.2 New Entities (신규 엔티티)

#### 3.2.1 `drd_raw_orders` — 주문 원시 데이터 (Order-level)

| Column | Type | Null | Description |
|--------|------|------|-------------|
| `ord_id` | CHAR(36) PK | ❌ | UUID |
| `ent_id` | CHAR(36) | ❌ | 멀티테넌시 법인 ID |
| `chn_code` | VARCHAR(20) | ❌ | 채널 코드 (SHOPEE/TIKTOK) |
| `ord_channel_order_id` | VARCHAR(30) | ❌ | 채널 주문 ID (원본) |
| `ord_package_id` | VARCHAR(30) | ✅ | 채널 패키지 ID |
| `ord_order_date` | DATETIME | ❌ | 주문 일시 |
| `ord_status` | ENUM | ❌ | 정규화된 주문 상태 |
| `ord_status_raw` | VARCHAR(500) | ✅ | 원본 상태 텍스트 (Vietnamese) |
| `ord_cancel_reason` | VARCHAR(500) | ✅ | 취소 사유 |
| `ord_tracking_no` | VARCHAR(50) | ✅ | 운송장 번호 |
| `ord_carrier` | VARCHAR(100) | ✅ | 배송사 |
| `ord_delivery_method` | VARCHAR(50) | ✅ | 배송 방식 |
| `ord_order_type` | VARCHAR(50) | ✅ | 주문 유형 |
| `ord_est_delivery_date` | DATETIME | ✅ | 예상 배송일 |
| `ord_ship_date` | DATETIME | ✅ | 발송일 |
| `ord_delivery_time` | DATETIME | ✅ | 배송 완료 시각 |
| `ord_total_weight_kg` | DECIMAL(8,3) | ✅ | 총 중량 |
| `ord_total_vnd` | DECIMAL(15,2) | ✅ | 주문 총액 VND |
| `ord_shop_voucher` | VARCHAR(100) | ✅ | 샵 바우처 코드 |
| `ord_coin_cashback` | DECIMAL(15,2) | ✅ | 코인 캐시백 |
| `ord_shopee_voucher` | VARCHAR(100) | ✅ | 쇼피 바우처 코드 |
| `ord_promo_combo` | VARCHAR(200) | ✅ | 프로모션 콤보 |
| `ord_shopee_combo_discount` | DECIMAL(15,2) | ✅ | 쇼피 콤보 할인 |
| `ord_shop_combo_discount` | DECIMAL(15,2) | ✅ | 샵 콤보 할인 |
| `ord_shopee_coin_rebate` | DECIMAL(15,2) | ✅ | 쇼피 코인 리베이트 |
| `ord_card_discount` | DECIMAL(15,2) | ✅ | 카드 할인 |
| `ord_trade_in_discount` | DECIMAL(15,2) | ✅ | 트레이드인 할인 |
| `ord_trade_in_bonus` | DECIMAL(15,2) | ✅ | 트레이드인 보너스 |
| `ord_seller_trade_in_bonus` | DECIMAL(15,2) | ✅ | 셀러 트레이드인 보너스 |
| `ord_shipping_fee_est` | DECIMAL(15,2) | ✅ | 예상 배송비 |
| `ord_buyer_shipping_fee` | DECIMAL(15,2) | ✅ | 구매자 배송비 |
| `ord_shopee_shipping_subsidy` | DECIMAL(15,2) | ✅ | 쇼피 배송비 보조 |
| `ord_return_shipping_fee` | DECIMAL(15,2) | ✅ | 반품 배송비 |
| `ord_total_buyer_payment` | DECIMAL(15,2) | ✅ | 총 구매자 결제액 |
| `ord_completed_at` | DATETIME | ✅ | 완료 일시 |
| `ord_paid_at` | DATETIME | ✅ | 결제 일시 |
| `ord_payment_method` | VARCHAR(100) | ✅ | 결제 수단 |
| `ord_commission_fee` | DECIMAL(15,2) | ✅ | 수수료(고정) |
| `ord_service_fee` | DECIMAL(15,2) | ✅ | 서비스 수수료 |
| `ord_payment_fee` | DECIMAL(15,2) | ✅ | 결제 수수료 |
| `ord_deposit` | DECIMAL(15,2) | ✅ | 보증금 |
| `ord_province` | VARCHAR(100) | ✅ | 시/도 |
| `ord_district` | VARCHAR(100) | ✅ | 구/군 |
| `ord_country` | VARCHAR(50) | ✅ | 국가 |
| `ord_import_batch_id` | VARCHAR(50) | ✅ | 임포트 배치 ID |
| `ord_created_at` | DATETIME | ❌ | 생성일시 |
| `ord_updated_at` | DATETIME | ❌ | 수정일시 |

**UNIQUE**: `(ent_id, chn_code, ord_channel_order_id)`
**INDEX**: `(ent_id, ord_order_date)`, `(ent_id, ord_status)`

#### 3.2.2 `drd_raw_order_items` — 주문 라인 아이템 (Item-level)

| Column | Type | Null | Description |
|--------|------|------|-------------|
| `oli_id` | CHAR(36) PK | ❌ | UUID |
| `ent_id` | CHAR(36) | ❌ | 멀티테넌시 법인 ID |
| `ord_id` | CHAR(36) FK | ❌ | → drd_raw_orders.ord_id |
| `sku_id` | CHAR(36) FK | ✅ | → drd_sku_masters.sku_id (매핑 시) |
| `oli_product_sku` | VARCHAR(50) | ✅ | 채널 상품 SKU |
| `oli_product_name` | VARCHAR(500) | ✅ | 채널 상품명 |
| `oli_variant_sku` | VARCHAR(30) | ✅ | 채널 옵션 SKU (= WMS Code) |
| `oli_variant_name` | VARCHAR(200) | ✅ | 채널 옵션명 |
| `oli_is_bestseller` | BOOLEAN | ❌ | 베스트셀러 여부 |
| `oli_weight_kg` | DECIMAL(8,3) | ✅ | 아이템 무게 |
| `oli_original_price` | DECIMAL(15,2) | ✅ | 원래 가격 |
| `oli_seller_discount` | DECIMAL(15,2) | ✅ | 셀러 할인 |
| `oli_shopee_discount` | DECIMAL(15,2) | ✅ | 쇼피 할인 |
| `oli_total_seller_subsidy` | DECIMAL(15,2) | ✅ | 셀러 보조금 총액 |
| `oli_deal_price` | DECIMAL(15,2) | ✅ | 딜 가격 |
| `oli_quantity` | INT | ❌ | 수량 |
| `oli_return_quantity` | INT | ✅ | 반품 수량 |
| `oli_buyer_paid` | DECIMAL(15,2) | ✅ | 구매자 지불액 |
| `oli_return_status` | VARCHAR(50) | ✅ | 반품 상태 |
| `oli_sku_match_status` | ENUM('MATCHED','UNMATCHED','COMBO') | ❌ | SKU 매칭 상태 |
| `oli_created_at` | DATETIME | ❌ | 생성일시 |
| `oli_updated_at` | DATETIME | ❌ | 수정일시 |

**INDEX**: `(ent_id, ord_id)`, `(ent_id, oli_variant_sku)`, `(sku_id)`

### 3.3 Order Status ENUM Mapping (주문 상태 정규화)

| Vietnamese Original | Normalized ENUM | Description |
|---------------------|----------------|-------------|
| `Hoàn thành` | `COMPLETED` | 완료 |
| `Đã hủy` | `CANCELLED` | 취소 |
| `Đã giao` | `DELIVERED` | 배송 완료 |
| `Đang giao` | `SHIPPING` | 배송중 |
| `Đã nhận được hàng` | `RECEIVED` | 수취 완료 |
| `Người mua xác nhận đã nhận...` (refund window) | `DELIVERED_REFUNDABLE` | 배송완료 (환불기간) |

### 3.4 SKU Matching Logic (SKU 매칭 로직)

```
1. Excel Row.col[20] (SKU phân loại hàng) = oli_variant_sku
2. oli_variant_sku → drd_sku_masters.sku_wms_code 매칭
3. 매칭 성공 → oli_sku_match_status = 'MATCHED', sku_id = matched UUID
4. 매칭 실패 → oli_sku_match_status = 'UNMATCHED', sku_id = NULL
5. Combo 상품 (예: 'Combo2_GIFT_KHANUOT') → 'COMBO', sku_id = NULL
```

### 3.5 Business Logic (비즈니스 로직)

1. **주문-아이템 분리**: 동일 `ord_channel_order_id`의 여러 행을 1개 주문 + N개 아이템으로 분리
2. **주문 레벨 데이터**: 주문당 한 번만 저장 (배송비, 바우처, 결제방법 등)
3. **아이템 레벨 데이터**: 행별 저장 (상품, 가격, 수량, 할인)
4. **중복 방지**: `(ent_id, chn_code, ord_channel_order_id)` UNIQUE로 중복 임포트 차단
5. **배치 ID**: 임포트 시점별 배치 식별자 부여 (`import-YYYYMMDD-HHmmss`)

---

## 4. Gap Analysis (갭 분석)

### 4.1 Change Scope Summary (변경 범위 요약)

| Area | Current | Change | Impact |
|------|---------|--------|--------|
| DB Tables | 5개 | +2개 (`drd_raw_orders`, `drd_raw_order_items`) | HIGH |
| Backend Entities | 5개 | +2개 (TypeORM Entity) | MEDIUM |
| Backend Modules | 5개 | +1개 (`domain/raw-order/`) | MEDIUM |
| Python Script | `generate-seed.py` | +1개 (`generate-order-seed.py`) | LOW |
| SQL Output | `seed-product-master.sql` | +1개 (`seed-orders-202603.sql`) | LOW |
| Frontend | 7 pages | 미변경 (Phase 2에서 UI 추가) | NONE |

### 4.2 File Change List (변경 파일 목록)

| Type | File | Change |
|------|------|--------|
| **DB/Entity** | `backend/src/domain/raw-order/entity/raw-order.entity.ts` | 신규 |
| **DB/Entity** | `backend/src/domain/raw-order/entity/raw-order-item.entity.ts` | 신규 |
| **Module** | `backend/src/domain/raw-order/raw-order.module.ts` | 신규 |
| **App Module** | `backend/src/app.module.ts` | 수정 (import 추가) |
| **Script** | `apps/app-sales-report/generate-order-seed.py` | 신규 |
| **SQL** | `apps/app-sales-report/seed-orders-202603.sql` | 신규 (생성 결과) |

### 4.3 DB Migration Strategy (DB 마이그레이션 전략)

스테이징/프로덕션 모두 `DB_SYNC=false`이므로 수동 DDL 필요:

```sql
-- 1단계: drd_raw_orders 테이블 생성
-- 2단계: drd_raw_order_items 테이블 생성
-- 3단계: 인덱스/제약조건 생성
-- 4단계: seed SQL 실행으로 데이터 입력
```

---

## 5. User Flow (사용자 플로우)

### 5.1 Excel → DB Import Flow (Python Script)

```
Step 1: 운영자가 Shopee Admin에서 주문 데이터 Excel 다운로드
         └─ Order.all.{시작일}_{종료일}.xlsx

Step 2: Excel 파일을 reference/appSalesReport/ 에 배치

Step 3: Python 스크립트 실행
         └─ python3 apps/app-sales-report/generate-order-seed.py
         └─ 입력: reference/appSalesReport/Order.all.20260301_20260331.xlsx
         └─ 출력: apps/app-sales-report/seed-orders-202603.sql

Step 4: SKU 매칭 결과 확인
         └─ MATCHED: 기존 SKU 마스터와 매칭 성공
         └─ UNMATCHED: 미등록 SKU (경고 출력)
         └─ COMBO: 콤보 상품 (별도 처리 필요)

Step 5: SQL 실행 (스테이징/프로덕션)
         └─ docker exec mysql-apps mysql -u... db_app_sales < seed-orders-202603.sql

Step 6: 검증
         └─ 총 주문 수, 총 아이템 수, 매칭율 확인
```

### 5.2 Flow Diagram (ASCII)

```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│ Shopee Admin     │───▶│ Excel Download   │───▶│ generate-order-    │
│ (주문 내보내기)    │    │ Order.all.*.xlsx │    │ seed.py            │
└─────────────────┘    └──────────────────┘    └─────────┬──────────┘
                                                          │
                                                          ▼
                                               ┌────────────────────┐
                                               │ seed-orders-       │
                                               │ 202603.sql         │
                                               │ (INSERT statements)│
                                               └─────────┬──────────┘
                                                          │
                                                          ▼
                                    ┌────────────────────────────────────┐
                                    │ MySQL (db_app_sales)               │
                                    │ ┌──────────────────┐               │
                                    │ │ drd_raw_orders   │ 3,600 rows    │
                                    │ └────────┬─────────┘               │
                                    │          │ 1:N                     │
                                    │ ┌────────▼─────────┐               │
                                    │ │ drd_raw_order_   │ 4,977 rows    │
                                    │ │ items            │               │
                                    │ └────────┬─────────┘               │
                                    │          │ JOIN sku_wms_code       │
                                    │ ┌────────▼─────────┐               │
                                    │ │ drd_sku_masters  │ 178 rows      │
                                    │ └──────────────────┘               │
                                    └────────────────────────────────────┘
```

---

## 6. Technical Constraints (기술 제약사항)

### 6.1 Compatibility (호환성)
- MySQL 8.0 (PostgreSQL이 아닌 MySQL — 기존 앱과 동일)
- TypeORM 0.3.x Entity 정의 필수 (TypeORM synchronize로 로컬 개발 시 자동 DDL)
- 기존 `generate-seed.py`의 openpyxl 패턴 활용

### 6.2 Performance (성능)
- 월간 데이터 규모: 약 3,600~5,000 주문, 5,000~8,000 아이템
- SQL INSERT 청크: 500행 단위 분할 (MySQL max_allowed_packet 대비)
- 스크립트 실행시간: 5초 이내 (openpyxl 처리)

### 6.3 Security (보안)
- **PII 미저장**: 고객 이름, 전화번호, 상세 주소는 DB에 저장하지 않음
- Province/District만 지역 통계 목적으로 저장
- SQL Injection 방지: 파라미터 바인딩 (API 개발 시)

### 6.4 Data Type Considerations (데이터 타입 주의)
- TypeORM nullable column에 반드시 `type` 명시 필요 (reflect-metadata 이슈)
  - 예: `@Column({ type: 'varchar', length: 100, nullable: true })`
- DECIMAL 컬럼은 `type: 'decimal', precision: 15, scale: 2` 명시
- DATETIME 문자열 파싱: `'2026-03-01 00:09'` → MySQL DATETIME 변환 시 초 누락 주의

---

## Appendix: Excel Column-to-DB Full Mapping

총 68개 컬럼 중:
- **DB 저장 대상**: 53개 (주문 레벨 35개 + 아이템 레벨 18개)
- **PII 제외**: 7개 (이름, 전화, 주소)
- **미저장**: 8개 (세금 관련, 상세 주소 등)
