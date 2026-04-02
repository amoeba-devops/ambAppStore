# REQ-20260402 — Sales Order Excel Upload (판매 데이터 엑셀 업로드)

| 항목 | 내용 |
|------|------|
| 문서 ID | REQ-20260402-SalesOrder-ExcelUpload |
| 작성일 | 2026-04-02 |
| 앱 | app-sales-report (매출리포트) |
| 우선순위 | P0 (Phase 2 선행 작업) |

---

## 1. 요구사항 요약 / Requirements Summary

| # | 요구사항 | 유형 |
|---|---------|------|
| R1 | TikTok 판매 데이터(tiktok-sales_report.xlsx)를 기존 drd_raw_orders / drd_raw_order_items 테이블에 임포트 | Data |
| R2 | 채널별(Shopee/TikTok) 엑셀 업로드 페이지 구현 | Frontend |
| R3 | 채널 선택 → 엑셀 파일 업로드 → 채널별 파서로 변환 → DB 저장 API | Backend |
| R4 | 채널별 엑셀 컬럼 구조가 다르므로 각각 독립 파서 구현 | Backend |

---

## 2. AS-IS 현황 분석 / Current State Analysis

### 2.1 Backend

- **Entities**: `RawOrderEntity` (`drd_raw_orders`), `RawOrderItemEntity` (`drd_raw_order_items`) — 이미 생성됨
- **Module**: `RawOrderModule` — AppModule에 이미 등록됨
- **Controller/Service**: 없음 (엔티티만 존재, API 없음)
- **DB**: Shopee 데이터 3,600건 orders / 4,977건 items 이미 임포트 (seed SQL)
- **SKU Master**: `drd_sku_masters` 178개 SKU 등록 완료

### 2.2 Frontend

- **Routes**: `/`, `/spu`, `/sku`, `/channel-mapping` (4개)
- **Sidebar**: 판매 데이터 업로드 메뉴 없음
- **i18n**: ko/en/vi 3개 언어, `sales` 네임스페이스

### 2.3 TikTok Excel 구조 (54 columns, 1,422 rows, 1,165 orders)

| Index | Column | 매핑 대상 | 비고 |
|-------|--------|----------|------|
| 0 | Order ID | `ord_channel_order_id` | |
| 1 | Order Status | `ord_status` | Vietnamese → ENUM |
| 2 | Order Substatus | `ord_status_raw` | |
| 3 | Cancelation/Return Type | (item-level return info) | |
| 4 | Normal or Pre-order | `ord_order_type` | |
| 5 | SKU ID | (platform SKU, skip) | |
| 6 | Seller SKU | `oli_variant_sku` | **SKU 매칭 키** |
| 7 | Product Name | `oli_product_name` | |
| 8 | Variation | `oli_variant_name` | |
| 9 | Quantity | `oli_quantity` | |
| 10 | Sku Quantity of return | `oli_return_quantity` | |
| 11 | SKU Unit Original Price | `oli_original_price` | |
| 12 | SKU Subtotal Before Discount | (computed, skip) | |
| 13 | SKU Platform Discount | `oli_shopee_discount` (reused) | |
| 14 | SKU Seller Discount | `oli_seller_discount` | |
| 15 | SKU Subtotal After Discount | `oli_deal_price` | |
| 16 | Shipping Fee After Discount | `ord_buyer_shipping_fee` | |
| 17 | Original Shipping Fee | `ord_shipping_fee_est` | |
| 18 | Shipping Fee Seller Discount | — | |
| 19 | Shipping Fee Platform Discount | — | |
| 20 | Payment platform discount | `ord_card_discount` | |
| 21 | Taxes | — | 기존 컬럼 없음 |
| 22 | Order Amount | `ord_total_vnd` | |
| 23 | Order Refund Amount | — | 기존 컬럼 없음 |
| 24 | Created Time | `ord_order_date` | DD/MM/YYYY HH:mm:ss |
| 25 | Paid Time | `ord_paid_at` | |
| 26 | RTS Time | `ord_ship_date` | |
| 27 | Shipped Time | — | |
| 28 | Delivered Time | `ord_delivery_time` | |
| 29 | Cancelled Time | `ord_completed_at` (cancelled orders) | |
| 30 | Cancel By | — | |
| 31 | Cancel Reason | `ord_cancel_reason` | |
| 32 | Fulfillment Type | `ord_delivery_method` | |
| 33 | Warehouse Name | — | |
| 34 | Tracking ID | `ord_tracking_no` | |
| 35 | Delivery Option | — | |
| 36 | Shipping Provider Name | `ord_carrier` | |
| 37-40 | Buyer PII | **SKIP** | username, recipient, phone |
| 41 | Country | `ord_country` | |
| 42 | Province | `ord_province` | |
| 43 | District | `ord_district` | |
| 44-46 | Address details | **SKIP** (PII) | |
| 47 | Payment Method | `ord_payment_method` | |
| 48 | Weight(kg) | `oli_weight_kg` (item-level) | |
| 49 | Product Category | — | |
| 50 | Package ID | `ord_package_id` | |
| 51-53 | Admin fields | **SKIP** | |

### 2.4 Shopee Excel 구조 비교 (68 columns)

| 차이점 | Shopee | TikTok |
|--------|--------|--------|
| Columns | 68 | 54 |
| 설명 행 | 없음 | Row 2 (컬럼 설명) |
| Weight | Order-level (col 18) | Item-level (col 48) |
| Discount | 다중 (voucher, combo, coin 등) | 단순 (Platform/Seller) |
| SKU 키 | col 19 (SKU phân loại hàng) | col 6 (Seller SKU) |
| 시간 컬럼 | 다수 (est delivery, ship, delivery) | RTS/Shipped/Delivered/Cancelled |
| 수수료 | Commission/Service/Payment Fee | 없음 (별도 정산 리포트) |

---

## 3. TO-BE 요구사항 / Target State

### 3.1 TikTok Seed Import

- Python 스크립트로 tiktok-sales_report.xlsx → SQL 생성
- Channel code: `TIKTOK` (기존 Shopee: `SHOPEE`)
- Row 2 (설명 행) 스킵
- SKU 매칭: Seller SKU (col 6) → drd_sku_masters.sku_wms_code

### 3.2 Excel Upload API

```
POST /v1/raw-orders/upload
  - multipart/form-data
  - channel: SHOPEE | TIKTOK
  - file: .xlsx
  → Response: { success, data: { ordersCreated, itemsCreated, matchStats } }
```

### 3.3 Channel-Specific Parser

- `ShopeeExcelParser`: 68-col Shopee format → RawOrder + RawOrderItem
- `TikTokExcelParser`: 54-col TikTok format → RawOrder + RawOrderItem
- 공통 인터페이스: `ExcelParser.parse(buffer) → { orders, items }`

### 3.4 Upload Page

- Route: `/upload`
- Channel selector dropdown (SHOPEE / TIKTOK)
- File dropzone (xlsx only)
- Upload button → API call
- Result summary (orders, items, match stats)
- Upload history table (batch list)

---

## 4. 갭 분석 / Gap Analysis

| 영역 | 현재 | 변경 | 영향도 |
|------|------|------|--------|
| Backend Entity | 존재 | 변경 없음 | 없음 |
| Backend Controller | 없음 | **신규** raw-order.controller.ts | 중 |
| Backend Service | 없음 | **신규** raw-order.service.ts | 중 |
| Backend Parsers | 없음 | **신규** shopee-excel.parser.ts, tiktok-excel.parser.ts | 중 |
| Frontend Page | 없음 | **신규** OrderUploadPage.tsx | 중 |
| Frontend Route | 4개 | 5개 (+upload) | 저 |
| Frontend i18n | 없음 | `upload` 키 추가 | 저 |
| Frontend Nav | 없음 | 데이터 입력 섹션에 메뉴 추가 | 저 |

---

## 5. 사용자 플로우 / User Flow

```
1. 사용자가 사이드바 "데이터 입력 > 판매 데이터 업로드" 클릭
2. 업로드 페이지 진입
3. 채널 선택 (Shopee / TikTok)
4. 엑셀 파일 드래그&드롭 또는 파일 선택
5. "업로드" 버튼 클릭
6. API 호출 → 서버에서 채널별 파서로 엑셀 변환
7. 중복 주문 체크 (같은 channel_order_id + ent_id + chn_code)
8. DB 저장
9. 결과 표시 (주문 수, 아이템 수, SKU 매칭률)
```

---

## 6. 기술 제약사항 / Technical Constraints

- 엑셀 파싱: 서버사이드 (xlsx/exceljs 라이브러리)
- 파일 크기 제한: 10MB
- 중복 방지: UNIQUE(ent_id, chn_code, ord_channel_order_id) — UPSERT 또는 skip
- PII 컬럼 수집 금지 (buyer name, phone, address detail)
- TikTok Row 2 (컬럼 설명) 반드시 스킵
