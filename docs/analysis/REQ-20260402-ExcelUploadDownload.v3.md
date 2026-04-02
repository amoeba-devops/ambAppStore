# Excel Upload/Download — Requirements Analysis v3.0 (엑셀 업로드/다운로드 요구사항 분석서)

---
document_id: AMA-SAL-ANALYSIS-3.0.0
version: 3.0.0
status: Draft
created: 2026-04-02
app: app-sales-report
based_on: Actual Shopee/TikTok sample file analysis (2026-04-02)
previous_version: AMA-SAL-ANALYSIS-2.0.0
---

## 1. Requirements Summary (요구사항 요약)

| # | Requirement (요구사항) | Type | Priority |
|---|----------------------|------|----------|
| R-001 | Product Master Excel upload — UPSERT by WMS code (상품마스터 업로드) | Functional | P0 |
| R-002 | Product Master Excel download — current data export (상품마스터 다운로드) | Functional | P0 |
| R-003 | Product Master upload sample template (샘플 엑셀 템플릿 다운로드) | Functional | P0 |
| R-004 | Shopee order report upload & parsing — `Order_report.xlsx` (쇼피 판매리포트 업로드) | Functional | P0 |
| R-005 | TikTok order report upload & parsing — `tiktok-sales_report.xlsx` (틱톡 판매리포트 업로드) | Functional | P0 |
| R-006 | Shopee traffic report upload — `traffice_report.xlsx` (쇼피 트래픽리포트) | Functional | P1 |
| R-007 | TikTok traffic report upload — `tiktok-traffic-product_list.xlsx` (틱톡 트래픽리포트) | Functional | P1 |
| R-008 | Shopee ad report upload — `ad_report.csv` (쇼피 광고리포트) | Functional | P1 |
| R-009 | TikTok ad product report upload — `tiktok-ad-creative...xlsx` (틱톡 상품광고리포트) | Functional | P1 |
| R-010 | TikTok ad live report upload — `tiktok-ad-livestream...xlsx` (틱톡 라이브광고리포트) | Functional | P1 |
| R-011 | Shopee seller/affiliate report upload — `seller_report.csv` (쇼피 셀러/제휴리포트) | Functional | P2 |
| R-012 | Upload history tracking & management (업로드 이력 관리) | Functional | P1 |
| R-013 | SKU auto-matching from order imports (주문 업로드 시 SKU 자동매칭) | Functional | P0 |

---

## 2. AS-IS Analysis (현황 분석)

### 2.1 Backend (백엔드 현황)

| Item | Current State |
|------|--------------|
| **Framework** | NestJS 11 + TypeORM 0.3.20 + MySQL 8.0 |
| **Domains** | 6 modules: `spu-master`, `sku-master`, `channel-master`, `channel-product-mapping`, `sku-cost-history`, `raw-order` |
| **API Base** | `GET/POST/PATCH/DELETE /api/v1/{resource}` — standard CRUD |
| **File upload** | `@nestjs/platform-express` installed (includes multer), **but no upload endpoints implemented** |
| **Excel library** | `xlsx@^0.18.5` (SheetJS) already installed |
| **Raw Order tables** | `drd_raw_orders` + `drd_raw_order_items` entities exist, **module registered but no controller/service** |
| **Auth** | `@Auth()` decorator → JWT + ent_id extraction, fully working |

**Key existing files:**
- [raw-order.entity.ts](../../apps/app-sales-report/backend/src/domain/raw-order/entity/raw-order.entity.ts) — 40+ columns (order-level: dates, fees, status, shipping)
- [raw-order-item.entity.ts](../../apps/app-sales-report/backend/src/domain/raw-order/entity/raw-order-item.entity.ts) — 20+ columns (SKU, price, quantity, match status)
- [raw-order.module.ts](../../apps/app-sales-report/backend/src/domain/raw-order/raw-order.module.ts) — Entity registered, **no controller/service**

**Raw Order Entity schema (already designed for Shopee import):**

`drd_raw_orders`:
- PK: `ord_id` (UUID), `ent_id`, `chn_code` (channel)
- Order: `ord_channel_order_id`, `ord_package_id`, `ord_order_date`, `ord_status`, `ord_status_raw`
- Shipping: `ord_tracking_no`, `ord_carrier`, `ord_delivery_method`, `ord_ship_date`, `ord_delivery_time`
- Financial: `ord_total_vnd`, `ord_total_buyer_payment`, `ord_commission_fee`, `ord_service_fee`, `ord_payment_fee`, `ord_deposit`
- Discounts: `ord_shop_voucher`, `ord_coin_cashback`, `ord_shopee_voucher`, `ord_promo_combo`, `ord_shopee_combo_discount`, `ord_shop_combo_discount`, `ord_shopee_coin_rebate`, `ord_card_discount`, `ord_trade_in_discount`, `ord_trade_in_bonus`, `ord_seller_trade_in_bonus`
- Shipping fees: `ord_shipping_fee_est`, `ord_buyer_shipping_fee`, `ord_shopee_shipping_subsidy`, `ord_return_shipping_fee`
- Geo: `ord_province`, `ord_district`, `ord_country`
- Import: `ord_import_batch_id`
- Unique: `(ent_id, chn_code, ord_channel_order_id)`

`drd_raw_order_items`:
- PK: `oli_id` (UUID), `ent_id`, FK `ord_id` → drd_raw_orders
- FK: `sku_id` → drd_sku_masters (nullable, for matching)
- SKU: `oli_product_sku`, `oli_product_name`, `oli_variant_sku`, `oli_variant_name`, `oli_is_bestseller`
- Price: `oli_original_price`, `oli_seller_discount`, `oli_shopee_discount`, `oli_total_seller_subsidy`, `oli_deal_price`, `oli_buyer_paid`
- Qty: `oli_quantity`, `oli_return_quantity`
- Status: `oli_return_status`, `oli_sku_match_status` (default: UNMATCHED)

### 2.2 Frontend (프론트엔드 현황)

| Item | Current State |
|------|--------------|
| **Pages** | 4 pages: Dashboard, SPU List, SKU List, Channel Mapping |
| **Routing** | `/`, `/spu`, `/sku`, `/channel-mapping` |
| **Excel handling** | **Not implemented** — no upload UI components |
| **Charts** | `recharts@^2.12.7` installed |
| **i18n** | `sales` namespace, 3 languages (ko/en/vi) |
| **State** | Zustand (auth/toast), React Query 5 (server) |

### 2.3 Database (DB 현황)

| Table | Rows | Status |
|-------|------|--------|
| `drd_spu_masters` | 44 | Seeded |
| `drd_sku_masters` | 178 | Seeded |
| `drd_channel_masters` | 5 | Seeded (SHOPEE, TIKTOK, INFLUENCER, B2B, OTHER) |
| `drd_channel_product_mappings` | 0 | Empty |
| `drd_sku_cost_histories` | 0 | Empty |
| `drd_raw_orders` | ~4,977 | Seeded from Shopee Order_report.xlsx |
| `drd_raw_order_items` | ~4,977+ | Seeded from Shopee Order_report.xlsx |

### 2.4 Problems (문제점)

1. **No upload API endpoints** — raw-order module has entity only, no controller/service for file upload
2. **raw-order entity designed for Shopee only** — TikTok order format uses different columns (English headers, different field structure)
3. **No reference report tables** — traffic/ad/affiliate report data cannot be stored
4. **No upload history** — no tracking of upload attempts, success/failure counts
5. **No frontend upload UI** — no file upload components, no upload result display
6. **SKU matching not implemented** — `oli_sku_match_status` field exists but no matching logic

---

## 3. TO-BE Requirements (TO-BE 요구사항)

### 3.1 AS-IS → TO-BE Mapping

| Area | AS-IS | TO-BE |
|------|-------|-------|
| Product Master | SQL seed only | Excel upload (UPSERT by WMS code) + download + template |
| Order Import (Shopee) | raw-order entity exists, data seeded via SQL | Upload API + Excel parser (68 cols Vietnamese) |
| Order Import (TikTok) | Not supported | Upload API + Excel parser (54 cols English, Row 2=description to skip) |
| Traffic Report (Shopee) | Not exist | New entity + parser (7 sheets, 30-40 cols Vietnamese) |
| Traffic Report (TikTok) | Not exist | New entity + parser (38 cols, header at Row 3) |
| Ad Report (Shopee) | Not exist | New entity + CSV parser (metadata rows 1-7, 20 cols) |
| Ad Report (TikTok Product) | Not exist | New entity + parser (26 cols Vietnamese) |
| Ad Report (TikTok Live) | Not exist | New entity + parser (19 cols Vietnamese) |
| Seller/Affiliate (Shopee) | Not exist | New entity + CSV parser (38 cols Vietnamese) |
| Upload History | Not exist | New entity `drd_upload_histories` |
| SKU Matching | Field exists, no logic | Implement matching: variant_sku → sku_wms_code |
| Frontend | No upload UI | Upload pages, modals, result display |

### 3.2 Sample File Specifications (실제 샘플 파일 분석 결과)

#### 3.2.1 Shopee Order Report — `Order_report.xlsx`

| Attribute | Value |
|-----------|-------|
| Format | XLSX |
| Sheet | `orders` |
| Total columns | **68** |
| Data rows (sample) | ~4,977 |
| Header language | Vietnamese |
| Header row | Row 1 |
| Data start | Row 2 |

**Key column mapping → `drd_raw_orders` + `drd_raw_order_items`:**

| Excel Col# | Vietnamese Header | Maps To | Entity |
|------------|------------------|---------|--------|
| C01 | Mã đơn hàng | `ord_channel_order_id` | raw_orders |
| C02 | Mã Kiện Hàng | `ord_package_id` | raw_orders |
| C03 | Ngày đặt hàng | `ord_order_date` | raw_orders |
| C04 | Trạng Thái Đơn Hàng | `ord_status_raw` → normalize to `ord_status` | raw_orders |
| C05 | Sản Phẩm Bán Chạy | `oli_is_bestseller` | raw_order_items |
| C06 | Lý do hủy | `ord_cancel_reason` | raw_orders |
| C08 | Mã vận đơn | `ord_tracking_no` | raw_orders |
| C09 | Đơn Vị Vận Chuyển | `ord_carrier` | raw_orders |
| C10 | Phương thức giao hàng | `ord_delivery_method` | raw_orders |
| C11 | Loại đơn hàng | `ord_order_type` | raw_orders |
| C12 | Ngày giao hàng dự kiến | `ord_est_delivery_date` | raw_orders |
| C13 | Ngày gửi hàng | `ord_ship_date` | raw_orders |
| C14 | Thời gian giao hàng | `ord_delivery_time` | raw_orders |
| C15 | Trạng thái Trả hàng/Hoàn tiền | `oli_return_status` | raw_order_items |
| C16 | SKU sản phẩm | `oli_product_sku` | raw_order_items |
| C17 | Tên sản phẩm | `oli_product_name` | raw_order_items |
| C18 | Cân nặng sản phẩm | `oli_weight_kg` | raw_order_items |
| C19 | Tổng cân nặng | `ord_total_weight_kg` | raw_orders |
| **C20** | **SKU phân loại hàng** | **`oli_variant_sku`** → **SKU matching key** (WMS code) | raw_order_items |
| C21 | Tên phân loại hàng | `oli_variant_name` | raw_order_items |
| C22 | Giá gốc | `oli_original_price` | raw_order_items |
| C23 | Người bán trợ giá | `oli_seller_discount` | raw_order_items |
| C24 | Được Shopee trợ giá | `oli_shopee_discount` | raw_order_items |
| C25 | Tổng số tiền được người bán trợ giá | `oli_total_seller_subsidy` | raw_order_items |
| C26 | Giá ưu đãi | `oli_deal_price` | raw_order_items |
| C27 | Số lượng | `oli_quantity` | raw_order_items |
| C28 | Số lượng sản phẩm được hoàn trả | `oli_return_quantity` | raw_order_items |
| C29 | Tổng số tiền Người mua thanh toán | `oli_buyer_paid` | raw_order_items |
| C30 | Tổng giá trị đơn hàng (VND) | `ord_total_vnd` | raw_orders |
| C31 | Mã giảm giá của Shop | `ord_shop_voucher` | raw_orders |
| C32 | Hoàn Xu | `ord_coin_cashback` | raw_orders |
| C33 | Mã giảm giá của Shopee | `ord_shopee_voucher` | raw_orders |
| C34 | Chỉ tiêu Combo Khuyến Mãi | `ord_promo_combo` | raw_orders |
| C35 | Giảm giá từ combo Shopee | `ord_shopee_combo_discount` | raw_orders |
| C36 | Giảm giá từ Combo của Shop | `ord_shop_combo_discount` | raw_orders |
| C37 | Shopee Xu được hoàn | `ord_shopee_coin_rebate` | raw_orders |
| C38 | Số tiền được giảm khi thanh toán bằng thẻ Ghi nợ | `ord_card_discount` | raw_orders |
| C39 | Trade-in Discount | `ord_trade_in_discount` | raw_orders |
| C40 | Trade-in Bonus | `ord_trade_in_bonus` | raw_orders |
| C41 | Phí vận chuyển (dự kiến) | `ord_shipping_fee_est` | raw_orders |
| C42 | Trade-in Bonus by Seller | `ord_seller_trade_in_bonus` | raw_orders |
| C43 | Phí vận chuyển mà người mua trả | `ord_buyer_shipping_fee` | raw_orders |
| C44 | Phí vận chuyển tài trợ bởi Shopee (dự kiến) | `ord_shopee_shipping_subsidy` | raw_orders |
| C45 | Phí vận chuyển trả hàng | `ord_return_shipping_fee` | raw_orders |
| C46 | Tổng số tiền người mua thanh toán | `ord_total_buyer_payment` | raw_orders |
| C47 | Thời gian hoàn thành đơn hàng | `ord_completed_at` | raw_orders |
| C48 | Thời gian đơn hàng được thanh toán | `ord_paid_at` | raw_orders |
| C49 | Phương thức thanh toán | `ord_payment_method` | raw_orders |
| C50 | Phí cố định | `ord_commission_fee` | raw_orders |
| C51 | Phí Dịch Vụ | `ord_service_fee` | raw_orders |
| C52 | Phí thanh toán | `ord_payment_fee` | raw_orders |
| C53 | Tiền ký quỹ | `ord_deposit` | raw_orders |
| C57 | Tỉnh/Thành phố | `ord_province` | raw_orders |
| C58 | TP / Quận / Huyện | `ord_district` | raw_orders |
| C61 | Quốc gia | `ord_country` | raw_orders |
| C54-C56,C59-C60,C62-C68 | Buyer info/Invoice | **Excluded** (PII — not stored) | — |

**Order status normalization:**

| Raw Vietnamese Status | Normalized Status |
|----------------------|-------------------|
| Hoàn thành | COMPLETED |
| Đã giao | DELIVERED |
| Đang giao | SHIPPING |
| Đã hủy | CANCELLED |
| Đã nhận được hàng | RECEIVED |
| Người mua xác nhận... (반품가능기간) | RETURN_PENDING |

**SKU Matching logic:**
- C20 (`SKU phân loại hàng`) contains WMS codes (e.g., `SAFG20U0003`, `SALC40U0001`)
- Match against `drd_sku_masters.sku_wms_code` + `ent_id`
- If matched → set `oli_sku_match_status = 'MATCHED'`, populate `sku_id`
- If unmatched → set `oli_sku_match_status = 'UNMATCHED'`, `sku_id = NULL`

**Duplicate detection:**
- Unique constraint: `(ent_id, chn_code, ord_channel_order_id)`
- Same order ID with multiple items → 1 order record + N item records
- Re-upload: UPSERT (update existing order, add/update items)

---

#### 3.2.2 TikTok Sales Report — `tiktok-sales_report.xlsx`

| Attribute | Value |
|-----------|-------|
| Format | XLSX |
| Sheet | `OrderSKUList` |
| Total columns | **54** |
| Data rows (sample) | ~1,422 |
| Header language | **English** |
| Header row | Row 1 |
| **Description row** | **Row 2** (column descriptions — MUST skip) |
| Data start | **Row 3** |

**Key column mapping → `drd_raw_orders` + `drd_raw_order_items`:**

| Excel Col# | English Header | Maps To | Entity |
|------------|---------------|---------|--------|
| C01 | Order ID | `ord_channel_order_id` | raw_orders |
| C02 | Order Status | `ord_status_raw` → normalize | raw_orders |
| C03 | Order Substatus | (reference only) | — |
| C04 | Cancelation/Return Type | `ord_cancel_reason` | raw_orders |
| C05 | Normal or Pre-order | `ord_order_type` | raw_orders |
| C06 | SKU ID | `oli_product_sku` (platform SKU ID) | raw_order_items |
| **C07** | **Seller SKU** | **`oli_variant_sku`** → **SKU matching key** (WMS code) | raw_order_items |
| C08 | Product Name | `oli_product_name` | raw_order_items |
| C09 | Variation | `oli_variant_name` | raw_order_items |
| C10 | Quantity | `oli_quantity` | raw_order_items |
| C11 | Sku Quantity of return | `oli_return_quantity` | raw_order_items |
| C12 | SKU Unit Original Price | `oli_original_price` | raw_order_items |
| C13 | SKU Subtotal Before Discount | (reference) | — |
| C14 | SKU Platform Discount | `oli_shopee_discount` (reuse field for platform discount) | raw_order_items |
| C15 | SKU Seller Discount | `oli_seller_discount` | raw_order_items |
| C16 | SKU Subtotal After Discount | `oli_deal_price` | raw_order_items |
| C17 | Shipping Fee After Discount | (order-level) | raw_orders |
| C18 | Original Shipping Fee | `ord_shipping_fee_est` | raw_orders |
| C19 | Shipping Fee Seller Discount | (calculated) | — |
| C20 | Shipping Fee Platform Discount | `ord_shopee_shipping_subsidy` (reuse) | raw_orders |
| C21 | Payment platform discount | `ord_card_discount` (reuse) | raw_orders |
| C22 | Taxes | (store in memo or new field) | — |
| C23 | Order Amount | `ord_total_vnd` | raw_orders |
| C24 | Order Refund Amount | (store in memo or new field) | — |
| C25 | Created Time | `ord_order_date` | raw_orders |
| C26 | Paid Time | `ord_paid_at` | raw_orders |
| C27 | RTS Time | `ord_ship_date` | raw_orders |
| C28 | Shipped Time | (supplementary) | — |
| C29 | Delivered Time | `ord_delivery_time` | raw_orders |
| C30 | Cancelled Time | (cancel timestamp) | — |
| C31 | Cancel By | (supplementary) | — |
| C32 | Cancel Reason | `ord_cancel_reason` (detail) | raw_orders |
| C33 | Fulfillment Type | `ord_delivery_method` | raw_orders |
| C34 | Warehouse Name | (reference) | — |
| C35 | Tracking ID | `ord_tracking_no` | raw_orders |
| C36 | Delivery Option | (supplementary) | — |
| C37 | Shipping Provider Name | `ord_carrier` | raw_orders |
| C42 | Country | `ord_country` | raw_orders |
| C43 | Province | `ord_province` | raw_orders |
| C44 | District | `ord_district` | raw_orders |
| C48 | Payment Method | `ord_payment_method` | raw_orders |
| C49 | Weight(kg) | `ord_total_weight_kg` / `oli_weight_kg` | both |
| C50 | Product Category | (reference) | — |
| C51 | Package ID | `ord_package_id` | raw_orders |
| C38-C41,C45-C47,C52-C54 | Buyer info/notes | **Excluded** (PII) | — |

**TikTok order status normalization:**

| Raw TikTok Status | Normalized Status |
|-------------------|-------------------|
| Đã hủy | CANCELLED |
| Đã vận chuyển / Đã giao | DELIVERED |
| Hoàn thành | COMPLETED |
| Chờ thanh toán | PENDING_PAYMENT |
| Chờ giao hàng | SHIPPING |

**TikTok-specific differences from Shopee:**
- Row 2 contains **column descriptions in English** → must skip during parsing
- Data starts at **Row 3** (not Row 2)
- `Seller SKU` (C07) is the WMS code equivalent (e.g., `SAFG20U0004`, `GIFT_KHANUOT...`)
- Multiple items per order share same Order ID in C01
- Prices use numeric format (not Vietnamese locale string)

---

#### 3.2.3 Shopee Traffic Report — `traffice_report.xlsx`

| Attribute | Value |
|-----------|-------|
| Format | XLSX |
| Sheets | **7 sheets** (see below) |
| Header language | Vietnamese |
| Data rows (first sheet) | ~249 products |

**Sheets:**

| # | Sheet Name | Col Count | Data Rows | Key Focus |
|---|-----------|-----------|-----------|-----------|
| 1 | Sản Phẩm Hiệu Quả Tốt (Top Performance) | **40** | 249 | Full metrics with variant-level data |
| 2 | Sản Phẩm Mới (New Products) | 36 | 2 | New product performance |
| 3 | Uncompetitive price | 36 | 0 | Price competitiveness |
| 4 | Competitive Price | 36 | 1 | Price competitiveness |
| 5 | Tăng trưởng cùng DVHT | 30 | 1 | Growth with platform services |
| 6 | Tối ưu chiến dịch DVHT | 30 | 3 | Campaign optimization |
| 7 | Theo dõi hiệu quả chiến dịc... | 30 | 3 | Campaign performance tracking |

**Primary sheet (1st) key columns — `drd_shopee_traffic` (new entity):**

| Col# | Vietnamese Header | English | DB Column |
|------|------------------|---------|-----------|
| C01 | Mã sản phẩm | Product ID | `stf_product_id` |
| C02 | Sản phẩm | Product Name | `stf_product_name` |
| C03 | Tình trạng sản phẩm hiện tại | Product Status | `stf_product_status` |
| C04 | Mã phân loại hàng | Variant ID | `stf_variant_id` |
| C05 | Tên Phân Loại | Variant Name | `stf_variant_name` |
| C07 | **SKU phân loại** | **Variant SKU** | `stf_variant_sku` → **SKU matching key** |
| C08 | SKU sản phẩm | Product SKU | `stf_product_sku` |
| C09 | Doanh số (Đơn đã đặt) (VND) | Revenue (Placed) | `stf_revenue_placed` |
| C10 | Doanh số (Đơn đã xác nhận) (VND) | Revenue (Confirmed) | `stf_revenue_confirmed` |
| C11 | Lượt xem sản phẩm | Product Views | `stf_views` |
| C12 | Lượt nhấp vào sản phẩm | Product Clicks | `stf_clicks` |
| C13 | CTR | Click-Through Rate | `stf_ctr` |
| C14 | Tỷ lệ chuyển đổi đơn (Đơn đã đặt) | Conv Rate (Placed) | `stf_conv_rate_placed` |
| C15 | Tỷ lệ chuyển đổi đơn (Đơn đã xác nhận) | Conv Rate (Confirmed) | `stf_conv_rate_confirmed` |
| C16 | Đơn hàng đã đặt | Orders Placed | `stf_orders_placed` |
| C17 | Đơn đã xác nhận | Orders Confirmed | `stf_orders_confirmed` |
| C18 | Sản phẩm (Đơn đã đặt) | Units Placed | `stf_units_placed` |
| C19 | Sản phẩm (Đơn đã xác nhận) | Units Confirmed | `stf_units_confirmed` |
| C26 | Lượt hiển thị sản phẩm duy nhất | Unique Impressions | `stf_unique_impressions` |
| C27 | Lượt nhấp sản phẩm duy nhất | Unique Clicks | `stf_unique_clicks` |
| C32 | Lượt click từ Trang tìm kiếm | Search Clicks | `stf_search_clicks` |
| C34 | Lượt truy cập sản phẩm (Thêm vào giỏ hàng) | Add to Cart Visits | `stf_add_to_cart_visits` |
| C35 | Sản phẩm (Thêm vào giỏ hàng) | Add to Cart Units | `stf_add_to_cart_units` |
| C36 | Tỷ lệ chuyển đổi (theo lượt thêm vào giỏ hàng) | Cart Conv Rate | `stf_cart_conv_rate` |

**Data format notes:**
- Revenue values: Vietnamese format with dots as thousand separators (e.g., `565.063.917`)
- Percentage values: Comma as decimal separator (e.g., `1,77%`)
- First sheet has product-level + variant-level rows (variant rows have C04-C07 filled)
- Product-level rows (C04=`-`): aggregate metrics
- Variant-level rows: per-SKU metrics

---

#### 3.2.4 TikTok Traffic Report — `tiktok-traffic-product_list.xlsx`

| Attribute | Value |
|-----------|-------|
| Format | XLSX |
| Sheet | `Sheet1` |
| Total columns | **38** |
| Data rows | ~205 products |
| Header language | Vietnamese |
| **Row 1** | Date range label (e.g., `2026-03-01 ~ 2026-03-31`) — **SKIP** |
| **Row 2** | Empty — **SKIP** |
| **Row 3 (header)** | Actual column headers |
| Data start | **Row 4** |

**Key column mapping → `drd_tiktok_traffic` (new entity):**

| Col# | Vietnamese Header | English | DB Column |
|------|------------------|---------|-----------|
| C01 | ID | Product ID | `ttf_product_id` |
| C02 | Sản phẩm | Product Name | `ttf_product_name` |
| C03 | Trạng thái | Status | `ttf_status` |
| C04 | GMV | Total GMV | `ttf_gmv_total` |
| C05 | Số món bán ra | Units Sold | `ttf_units_sold` |
| C06 | Đơn hàng | Orders | `ttf_orders` |
| C07-C14 | GMV/Units/Impressions/Views/CTR/Conv — **tab Cửa hàng** | Shop Tab metrics | `ttf_shop_*` |
| C15-C22 | GMV/Units/Impressions/Views/CTR/Conv — **LIVE** | Live metrics | `ttf_live_*` |
| C23-C30 | GMV/Units/Impressions/Views/CTR/Conv — **video** | Video metrics | `ttf_video_*` |
| C31-C38 | GMV/Units/Impressions/Views/CTR/Conv — **thẻ sản phẩm** | Product Card metrics | `ttf_card_*` |

**Channel sub-metrics (each group of 8 columns):**

| Offset | Vietnamese | English | Suffix |
|--------|-----------|---------|--------|
| +0 | GMV {channel} | GMV | `_gmv` |
| +1 | Số món bán ra qua {channel} | Units sold | `_units` |
| +2 | Lượt hiển thị bài niêm yết | Listing impressions | `_impressions` |
| +3 | Lượt xem trang từ {channel} | Page views | `_page_views` |
| +4 | Lượt xem trang độc nhất | Unique page views | `_unique_views` |
| +5 | Khách hàng mua sản phẩm độc nhất | Unique buyers | `_unique_buyers` |
| +6 | Tỷ lệ nhấp vào {channel} | CTR | `_ctr` |
| +7 | Tỷ lệ chuyển đổi {channel} | Conv rate | `_conv_rate` |

**Data format notes:**
- GMV values: Vietnamese locale with ₫ symbol (e.g., `192.612.578₫`)
- Percentage values: Dot as decimal separator (e.g., `6.87%`) — different from Shopee!
- No variant-level data (product-level only)

---

#### 3.2.5 Shopee Ad Report — `ad_report.csv`

| Attribute | Value |
|-----------|-------|
| Format | **CSV** (UTF-8 with BOM) |
| Metadata rows | **Rows 1-7** (shop info, date range) — **SKIP** |
| Header row | **Row 8** |
| Data start | **Row 9** |
| Total columns | **~25** (varies by ad type) |
| Data rows | ~20 products |
| Header language | Vietnamese |

**Column mapping → `drd_shopee_ads` (new entity):**

| Col# | Vietnamese Header | English | DB Column |
|------|------------------|---------|-----------|
| C01 | Thứ tự | Sequence | (skip — row number) |
| C02 | Tên Dịch vụ Hiển thị | Ad Name | `sad_ad_name` |
| C03 | Trạng thái | Status | `sad_status` |
| C04 | Loại | Ad Type | `sad_ad_type` |
| C05 | Mã sản phẩm | Product ID | `sad_product_id` |
| C06 | Phương thức đấu thầu | Bid Method | `sad_bid_method` |
| C07 | Vị trí | Placement | `sad_placement` |
| C08 | (bid type) | Bid Type | `sad_bid_type` |
| C09 | Ngày bắt đầu | Start Date | `sad_start_date` |
| C10 | Ngày kết thúc | End Date | `sad_end_date` |
| C11 | Số lượt xem | Impressions | `sad_impressions` |
| C12 | Số lượt click | Clicks | `sad_clicks` |
| C13 | Tỷ Lệ Click | CTR | `sad_ctr` |
| C14 | Lượt chuyển đổi | Conversions | `sad_conversions` |
| C15 | (direct conv) | Direct Conversions | `sad_direct_conversions` |
| C16 | Tỷ lệ chuyển đổi | Conv Rate | `sad_conv_rate` |
| C17 | (direct conv rate) | Direct Conv Rate | `sad_direct_conv_rate` |
| C18 | Chi phí cho mỗi lượt chuyển đổi | Cost per Conv | `sad_cost_per_conversion` |
| C19 | (cost per direct) | Cost per Direct Conv | `sad_cost_per_direct` |
| C20 | Sản phẩm đã bán | Products Sold | `sad_products_sold` |
| C21 | (direct sold) | Direct Products Sold | `sad_direct_products_sold` |
| C22 | (total sales) | Total Sales VND | `sad_total_sales` |
| C23 | (direct sales) | Direct Sales VND | `sad_direct_sales` |
| C24 | (total cost) | Total Cost | `sad_total_cost` |
| C25 | ROAS | ROAS | `sad_roas` |

**Note:** Last row may be "Shop Ads" type with different column structure. Parser must handle gracefully.

---

#### 3.2.6 TikTok Ad Product Campaigns — `tiktok-ad-creative...xlsx`

| Attribute | Value |
|-----------|-------|
| Format | XLSX |
| Sheet | `Data` |
| Total columns | **26** |
| Data rows | ~1,121 (creative-level data) |
| Header language | Vietnamese |
| Data start | Row 2 |

**Column mapping → `drd_tiktok_ads` (new entity):**

| Col# | Vietnamese Header | English | DB Column |
|------|------------------|---------|-----------|
| C01 | Tên chiến dịch | Campaign Name | `tad_campaign_name` |
| C02 | ID chiến dịch | Campaign ID | `tad_campaign_id` |
| C03 | ID sản phẩm | Product ID | `tad_product_id` |
| C04 | Loại nội dung sáng tạo | Creative Type | `tad_creative_type` |
| C05 | Tiêu đề video | Video Title | `tad_video_title` |
| C06 | ID video | Video ID | `tad_video_id` |
| C07 | Tài khoản TikTok | TikTok Account | `tad_account` |
| C08 | Thời gian đăng | Post Time | `tad_post_time` |
| C09 | Trạng thái | Status | `tad_status` |
| C10 | Loại ủy quyền | Auth Type | `tad_auth_type` |
| C11 | Chi phí | Cost | `tad_cost` |
| C12 | Số lượng đơn hàng SKU | SKU Orders | `tad_sku_orders` |
| C13 | Chi phí cho mỗi đơn hàng | Cost per Order | `tad_cost_per_order` |
| C14 | Doanh thu gộp | Gross Revenue | `tad_gross_revenue` |
| C15 | ROI | ROI | `tad_roi` |
| C16 | Số lượt hiển thị quảng cáo | Ad Impressions | `tad_impressions` |
| C17 | Số lượt nhấp vào quảng cáo | Ad Clicks | `tad_clicks` |
| C18 | Tỷ lệ nhấp vào quảng cáo | Ad CTR | `tad_ctr` |
| C19 | Tỷ lệ chuyển đổi quảng cáo | Ad Conv Rate | `tad_conv_rate` |
| C20 | Tỷ lệ xem video 2 giây | 2s View Rate | `tad_view_2s_rate` |
| C21 | Tỷ lệ xem video 6 giây | 6s View Rate | `tad_view_6s_rate` |
| C22 | Tỷ lệ xem 25% | 25% View Rate | `tad_view_25_rate` |
| C23 | Tỷ lệ xem 50% | 50% View Rate | `tad_view_50_rate` |
| C24 | Tỷ lệ xem 75% | 75% View Rate | `tad_view_75_rate` |
| C25 | Tỷ lệ xem 100% | 100% View Rate | `tad_view_100_rate` |
| C26 | Đơn vị tiền tệ | Currency | `tad_currency` |

---

#### 3.2.7 TikTok Ad Live Campaigns — `tiktok-ad-livestream...xlsx`

| Attribute | Value |
|-----------|-------|
| Format | XLSX |
| Sheet | `Data` |
| Total columns | **19** |
| Data rows | ~16 live sessions |
| Header language | Vietnamese |
| Data start | Row 2 |

**Column mapping → `drd_tiktok_ad_lives` (new entity):**

| Col# | Vietnamese Header | English | DB Column |
|------|------------------|---------|-----------|
| C01 | Tên phiên LIVE | Live Session Name | `tal_live_name` |
| C02 | Thời gian ra mắt | Launch Time | `tal_launch_time` |
| C03 | Trạng thái | Status | `tal_status` |
| C04 | Tên chiến dịch | Campaign Name | `tal_campaign_name` |
| C05 | ID chiến dịch | Campaign ID | `tal_campaign_id` |
| C06 | Chi phí | Cost | `tal_cost` |
| C07 | Chi phí ròng | Net Cost | `tal_net_cost` |
| C08 | Số lượng đơn hàng SKU | SKU Orders | `tal_sku_orders` |
| C09 | SKU Orders (Current Shop) | SKU Orders Shop | `tal_sku_orders_shop` |
| C10 | Chi phí mỗi đơn hàng | Cost per Order | `tal_cost_per_order` |
| C11 | Doanh thu gộp | Gross Revenue | `tal_gross_revenue` |
| C12 | Doanh thu gộp (Cửa hàng) | Gross Revenue Shop | `tal_gross_revenue_shop` |
| C13 | ROI (Cửa hàng) | ROI Shop | `tal_roi_shop` |
| C14 | Số lượt xem phiên LIVE | Live Views | `tal_live_views` |
| C15 | Chi phí mỗi lượt xem | Cost per View | `tal_cost_per_view` |
| C16 | Lượt xem 10 giây | 10s Views | `tal_live_views_10s` |
| C17 | Chi phí mỗi lượt xem 10s | Cost per 10s View | `tal_cost_per_10s_view` |
| C18 | Số lượt theo dõi | Live Followers | `tal_live_followers` |
| C19 | Đơn vị tiền tệ | Currency | `tal_currency` |

---

#### 3.2.8 Shopee Seller/Affiliate Report — `seller_report.csv`

| Attribute | Value |
|-----------|-------|
| Format | **CSV** (UTF-8 with BOM) |
| Header row | Row 1 |
| Data start | Row 2 |
| Total columns | **38** |
| Data rows | ~2,830 |
| Header language | Vietnamese |

**Key column mapping → `drd_shopee_affiliates` (new entity):**

| Col# | Vietnamese Header | English | DB Column |
|------|------------------|---------|-----------|
| C01 | Mã đơn hàng | Order ID | `saf_order_id` |
| C02 | Trạng thái | Order Status | `saf_status` |
| C03 | Trạng thái gian lận | Fraud Status | `saf_fraud_status` |
| C04 | Thời gian đặt hàng | Order Time | `saf_order_time` |
| C05 | Mã sản phẩm | Product ID | `saf_product_id` |
| C06 | Tên sản phẩm | Product Name | `saf_product_name` |
| C07 | Model id | Model ID | `saf_model_id` |
| C08-10 | L1/L2/L3 Ngành hàng | Category L1/L2/L3 | `saf_category_l1/l2/l3` |
| C11 | Giá | Price | `saf_price` |
| C12 | Số lượng | Quantity | `saf_quantity` |
| C13 | Tên đối tác | Partner Name | `saf_partner_name` |
| C14 | Tài khoản Tiếp thị liên kết | Affiliate Account | `saf_affiliate_account` |
| C15 | MCN được liên kết | MCN | `saf_mcn` |
| C16-C20 | Commission amounts | Commission details | `saf_commission_*` |
| C21-C25 | Cost breakdown | Cost details | `saf_cost_*` |
| C26 | Trạng thái khấu trừ | Deduction Status | `saf_deduction_status` |
| C27 | Kênh | Channel | `saf_channel` |
| C28-C38 | Additional commission/cost | Extended metrics | `saf_ext_*` |

---

### 3.3 New Entities Summary (신규 엔티티 총괄)

| # | Entity / Table | Purpose | Source File |
|---|---------------|---------|-------------|
| 1 | `drd_upload_histories` | Upload tracking (all types) | All uploads |
| 2 | `drd_shopee_traffic` | Shopee traffic report data | `traffice_report.xlsx` |
| 3 | `drd_tiktok_traffic` | TikTok traffic report data | `tiktok-traffic-product_list.xlsx` |
| 4 | `drd_shopee_ads` | Shopee ad report data | `ad_report.csv` |
| 5 | `drd_tiktok_ads` | TikTok product ad data | `tiktok-ad-creative...xlsx` |
| 6 | `drd_tiktok_ad_lives` | TikTok live ad data | `tiktok-ad-livestream...xlsx` |
| 7 | `drd_shopee_affiliates` | Shopee seller/affiliate data | `seller_report.csv` |

**Existing entities (already implemented, no change needed):**
- `drd_raw_orders` — Order headers (Shopee + TikTok, shared)
- `drd_raw_order_items` — Order line items (Shopee + TikTok, shared)

### 3.4 `drd_upload_histories` Entity

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `uph_id` | CHAR(36) PK | NO | UUID |
| `ent_id` | CHAR(36) | NO | Entity ID |
| `uph_type` | ENUM | NO | Upload type (see below) |
| `uph_channel` | VARCHAR(20) | NO | 'SHOPEE' or 'TIKTOK' |
| `uph_file_name` | VARCHAR(300) | NO | Original filename |
| `uph_file_size` | INT | NO | File size (bytes) |
| `uph_row_count` | INT | YES | Total rows parsed |
| `uph_success_count` | INT | YES | Success count |
| `uph_error_count` | INT | YES | Error count |
| `uph_status` | ENUM | NO | 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED' |
| `uph_error_detail` | TEXT | YES | Error details (JSON) |
| `uph_period_start` | DATE | YES | Report period start |
| `uph_period_end` | DATE | YES | Report period end |
| `uph_batch_id` | VARCHAR(50) | YES | Import batch ID |
| `uph_created_by` | VARCHAR(100) | YES | Uploader user ID |
| `uph_created_at` | DATETIME | NO | Upload timestamp |

**Upload types:** `PRODUCT_MASTER`, `ORDER_REPORT`, `TRAFFIC_REPORT`, `AD_REPORT`, `AFFILIATE_REPORT`

### 3.5 New API Endpoints

#### Product Master Excel
```
GET    /api/v1/product-master/template          # Sample template download
GET    /api/v1/product-master/export             # Current data Excel download
POST   /api/v1/product-master/import             # Excel upload UPSERT
```

#### Order Report Upload
```
POST   /api/v1/raw-orders/import/shopee          # Shopee order XLSX upload
POST   /api/v1/raw-orders/import/tiktok          # TikTok order XLSX upload
GET    /api/v1/raw-orders                         # Order list (paginated)
GET    /api/v1/raw-orders/:ord_id                 # Order detail with items
GET    /api/v1/raw-orders/summary                 # Aggregated summary
POST   /api/v1/raw-orders/match-sku               # Re-trigger SKU matching
```

#### Reference Report Upload
```
POST   /api/v1/reports/traffic/shopee             # Shopee traffic XLSX
POST   /api/v1/reports/traffic/tiktok             # TikTok traffic XLSX
POST   /api/v1/reports/ads/shopee                 # Shopee ad CSV
POST   /api/v1/reports/ads/tiktok-product         # TikTok product ad XLSX
POST   /api/v1/reports/ads/tiktok-live            # TikTok live ad XLSX
POST   /api/v1/reports/affiliate/shopee           # Shopee affiliate CSV
```

#### Upload History
```
GET    /api/v1/upload-histories                    # History list
GET    /api/v1/upload-histories/:uph_id            # History detail
```

### 3.6 New Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/orders` | `RawOrderListPage` | Order data list from imports |
| `/orders/:ord_id` | `RawOrderDetailPage` | Order detail with items |
| `/upload` | `UploadCenterPage` | Central upload hub (all report types) |
| `/upload/history` | `UploadHistoryPage` | Upload history list |

Existing page enhancements:
- `SkuMasterListPage` — Add Excel upload/download/template buttons
- `DashboardPage` — Display summary metrics from orders/traffic

---

## 4. Gap Analysis (갭 분석)

### 4.1 Change Scope Summary

| Area | Current | Change | Impact |
|------|---------|--------|--------|
| BE raw-order module | Entity only | +Controller, +Service, +Parsers (Shopee/TikTok) | High |
| BE new modules | 6 domains | +product-master-excel, +upload-history, +report-upload (3 new) | Medium |
| BE parsers | None | 8 parsers (2 order + 6 reference report) | High |
| DB tables | 7 tables | +7 new tables (1 upload history + 6 report) | High |
| FE pages | 4 pages | +4 new pages | High |
| FE existing | — | SKU page buttons, Dashboard metrics | Medium |
| Dependencies | `xlsx` + `platform-express` exist | No new BE dependencies needed | None |
| i18n | sales namespace | +upload.*, +order.*, +report.* keys | Low |

### 4.2 File Change List

**Backend — New (28 files):**
- `raw-order/raw-order.controller.ts`, `raw-order.service.ts`
- `raw-order/service/shopee-order-parser.service.ts`, `tiktok-order-parser.service.ts`
- `raw-order/dto/request/*.ts`, `dto/response/*.ts`
- `product-master-excel/` (module, controller, service)
- `upload-history/` (entity, module, service, controller)
- `report-upload/` (module, controller, service)
- `report-upload/entity/` (6 new entities)
- `report-upload/service/` (6 parsers)

**Backend — Modified (2 files):**
- `app.module.ts`, `raw-order/raw-order.module.ts`

**Frontend — New (12 files):**
- `domain/raw-order/` (pages, hooks, service, types)
- `domain/upload/` (pages, components, hooks, service, types)

**Frontend — Modified (4 files):**
- `App.tsx`, `AppLayout.tsx`, `SkuMasterListPage.tsx`, `i18n locales`

**Database — New tables (7):**
- `drd_upload_histories`, `drd_shopee_traffic`, `drd_tiktok_traffic`
- `drd_shopee_ads`, `drd_tiktok_ads`, `drd_tiktok_ad_lives`, `drd_shopee_affiliates`

---

## 5. User Flow (사용자 플로우)

### 5.1 Product Master Excel Upload
```
[User] SKU Master (/sku)
  ├─ [Template] → GET template → .xlsx download
  ├─ [Download] → GET export → current data .xlsx
  └─ [Upload] → file select → POST import → result (N total / X new / Y updated / Z errors)
```

### 5.2 Order Report Upload
```
[User] Upload Center (/upload) → [판매리포트] tab
  ├─ Select channel: Shopee / TikTok
  ├─ Upload file (drag & drop)
  │   ├─ Shopee: 68 cols, Row1=header, Row2+=data
  │   └─ TikTok: 54 cols, Row1=header, Row2=desc(skip), Row3+=data
  ├─ Parse → UPSERT orders + items → SKU matching
  └─ Result: N total / X new / Y updated / Z SKU matched / W errors
```

### 5.3 Reference Report Upload
```
[User] Upload Center (/upload)
  ├─ [트래픽] tab → Shopee(xlsx,7sheets) / TikTok(xlsx,Row3=header)
  ├─ [광고] tab → Shopee(csv,skip1-7) / TikTok Product(xlsx,26col) / TikTok Live(xlsx,19col)
  └─ [제휴] tab → Shopee(csv,38col)
  Each: upload → parse → store in dedicated table → record history
```

### 5.4 Order Viewing
```
[User] Orders (/orders)
  ├─ Filters: date range, channel, status, search
  ├─ Table: Order ID, date, channel, status, items, amount, SKU match rate
  └─ Click → Detail (/orders/:id) → order info + item list
```

---

## 6. Technical Constraints (기술 제약사항)

### 6.1 File Size & Memory
- Max upload: **10MB** (multer limit)
- Largest sample: Shopee order ~1.8MB (5K rows), TikTok ad ~160KB (1.1K rows)
- `xlsx` (SheetJS) loads entire file in memory — adequate for expected file sizes

### 6.2 Data Format Parsing
- **Shopee Vietnamese numbers**: `565.063.917` → remove dots, parse as number
- **Shopee percentages**: `1,77%` → remove `%`, replace `,` with `.`
- **TikTok Vietnamese money**: `192.612.578₫` → remove `₫` and dots
- **TikTok percentages**: `6.87%` → remove `%` (dot decimal — differs from Shopee)
- **Dates**: `2026-03-01 00:09` (Shopee), `2026-03-24 11:00:15` (TikTok)

### 6.3 Deduplication
- Orders: UPSERT on `(ent_id, chn_code, ord_channel_order_id)`
- Reports: batch-based — new upload replaces previous batch for same period+channel
- Upload history: always append

### 6.4 Security
- MIME type validation: xlsx/csv only
- File size limit: 10MB
- Files processed in memory, **not stored on disk**
- All endpoints behind `@Auth()` — ent_id isolation enforced
- PII columns excluded (buyer name, phone, address)

### 6.5 Performance
- Bulk INSERT: batch of 100 (orders), 500 (reports)
- SKU matching: load all sku_wms_code for ent_id into Map, in-memory lookup
- Upload history: atomic update after processing
