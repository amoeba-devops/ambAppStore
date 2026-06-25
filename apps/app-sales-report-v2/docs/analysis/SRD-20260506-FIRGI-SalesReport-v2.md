# SRD v2.0 — FIRGI Sales Report Application

> **Document ID**: FIRGI-SRS-SALESREPORT-001
> **Version**: v2.0 · **Date**: 2026-05-06 · **Status**: Draft
> **Prepared by**: Truc Hoang · **Client**: Socialbean Vietnam Co., Ltd.
> **Source**: Provided by client to dev team 2026-05-11. Persisted here as authoritative spec — KHÔNG modify content gốc.

> ## ⚠️ Errata sau khi audit real data (2026-05-11)
>
> Có 1 notation discrepancy giữa SRD và real data — implementation phải dùng giá trị verified, không phải SRD raw:
>
> **Exchange Rate**: SRD ghi `17,543` (VN locale với `.` thousand → `17543` no decimal).
> - **Verified từ `resources/FINAL REPORT.csv`**: rate thực tế là **17.543 VND per 1 KRW** (≈ 17.5)
> - Math: `1,682,035,200 VND ÷ 95,876,006 KRW = 17.544`
> - **Implementation dùng `17.543`** (decimal), KHÔNG phải `17,543` (mười bảy nghìn) → tránh 1000x error
> - Xem [CONSISTENCY-CHECK-20260511 §1](CONSISTENCY-CHECK-20260511.md) chi tiết
>
> Mọi values khác trong SRD giữ nguyên (đã verify).

## 1. Introduction

### 1.1 Purpose
Replace Socialbean Vietnam's manual Google Sheets reporting workflow (Shopee + TikTok Shop) with an automated, auditable, reproducible web application.

### 1.2 Problem
Current manual process: download CSV → recalc in Google Sheet → extract metrics → enter manual costs → consolidate → format & distribute. Risks: data error, latency, no audit trail, không scale.

### 1.3 Scope

**IN scope (v2.0)**:
- Upload + parse raw CSV/Excel from Shopee (6 reports) + TikTok Shop (3 reports)
- Manual input UI for off-platform costs
- Automated calculation: GMV, Net GMV, NMV, CM, WoW, MoM
- Weekly + Monthly Reports (Summary + Product Breakdown)
- Trending Reports (WoW + MoM) per platform
- Prime Cost + COGS master management (versioned)
- Role-based access (Operator / Manager / Admin)
- Activity Log (login, manual input, download)
- Admin Formula Configuration (48 parameters across 7 groups)

**OUT of scope**:
- Direct API integration with Shopee/TikTok
- Automated FOB/logistics cost
- Weight-based logistics allocation (Phase 2)
- Currency beyond VND + KRW

### 1.4 Glossary

| Term | Meaning |
|---|---|
| GMV | Gross Merchandise Value — total sales pre-deductions |
| Net GMV | GMV after platform discounts/vouchers |
| NMV | Net Merchandise Value — GMV after seller-side deductions |
| CM | Contribution Margin — revenue − all direct costs |
| Prime Cost | Fully-loaded landed cost per unit (production + logistics + fulfillment) |
| COGS | Cost of Goods Sold |
| WoW / MoM | Week/Month-over-period comparison |
| RFR | Reference Report (Google Sheet templates from client) |

## 2. Overall Description

### 2.1 Current Manual Process (6 steps to automate)

1. **Download Raw Reports** — operator fetches CSV/Excel từ Shopee + TikTok dashboards
2. **Customize & Recalculate** — adjust in Google Sheet (Original Price, NMV, GMV, Seller Discount, ...)
3. **Extract Metrics** — copy key numbers vào report template
4. **Input Manual Costs** — Affiliate Booking Fee, Livestream Fee, Ads Spending, TikTok Platform Fee components
5. **Consolidate** — merge Shopee + TikTok + manual, compute WoW/MoM
6. **Format & Distribute** — match client template, send weekly/monthly

### 2.2 User Classes

| Role | Permissions |
|---|---|
| **Operator** | Upload files; create/edit/delete manual data; manage cost masters; download reports |
| **Manager** | View all reports; download; view activity log (read-only) |
| **Admin** | All Operator + Manager perms + manage users + configure system parameters + full activity log |

### 2.3 4-Layer Architecture

```
1. Data Ingestion  → CSV/Excel upload, manual input forms, validation, FX rate input
2. Data Storage    → raw file store, processed data, cost master (PrimeCost + COGS), manual input, activity log
3. Calculation     → Net GMV calc, discount/promo aggregation, CM, WoW/MoM, KRW conversion
4. Reporting       → Weekly, Monthly, Trending views, Activity Log view, Export
```

### 2.4 Operating Environment

- Web-based, desktop browsers (Chrome, Edge, Firefox)
- Non-technical users → UI must be self-serve
- Currency: VND primary, KRW secondary (configurable rate)
- Concurrent users: 1–5
- Data volume: up to 12 months × weekly = ~52 week-periods per platform

## 3. Functional Requirements (23 FRs)

> Priority: **Must Have** | Should Have | Nice to Have. All listed FRs are Must Have unless noted.

### FR-01 — Date Range Selection for Upload Session
Mandatory date-range picker before upload. Validates start ≤ end. Prompt overwrite/append if data exists for that period.

### FR-02 — Upload Raw Reports — Shopee (6 types)
1. Sales Report
2. Ads Report
3. Brand Ads Report
4. Off-Platform Ads Report
5. Traffic Report
6. Affiliate Report

Each has dedicated upload slot. Output: file name, timestamp, file size, row count. CSV + Excel only. Re-upload replaces existing. Original raw file preserved unmodified for audit.

### FR-03 — Upload Raw Reports — TikTok Shop (3 types)
1. Sales Report (includes TikTok commission, Order processing fees fields)
2. Traffic Report
3. Affiliate Report

Same structure as FR-02. TikTok data isolated from Shopee at all times.

### FR-04 — Manual Cost Data Input
5 manual cost items + FX rate:
1. **Affiliate Booking Fee** (Shopee + TikTok combined total) — weekly
2. **Shopee Livestream Fee** — weekly
3. **TikTok Livestream Fee** — weekly
4. **TikTok Ads Spending** — weekly
5. **TikTok Platform Fee components** (7 sub-items): Transaction fees, Commission, Seller shipping fees, Exclusive benefit access fees, Voucher Xtra service fees, Order processing fees, SFR service fees — weekly
6. **Exchange Rate** (1 KRW = ? VND), positive numeric. Default 17,543. Changes trigger recalc.

Empty/null defaults to 0. Edits logged (FR-20).

### FR-05 — Prime Cost Master (versioned)
Columns: Product ID | Variation ID | Product Name (VI) | Product Name (EN) | SKU | Prime Cost (VND) | Prime Cost (KRW) | Selling Price | Listing Price.

Features: search by name/SKU (debounce <300ms), inline add/edit/delete, CSV/Excel bulk upload, CSV/Excel download, **version control** (new record on change, historical reports use snapshot at time of generation), KRW auto-calc read-only.

### FR-06 — COGS Master
Columns: Product ID | Variation ID | Product Name (VI/EN) | SKU | Prime Cost | Prime Cost [date] Update.

Same features as FR-05 + "Prime Cost [date] Update" column. **Lookup rule**: when multiple COGS records for same SKU, use most recent update date ≤ report period.

### FR-07 — Weekly Report — Period Filter
Week selector lists only weeks with uploaded data. Selection updates all sections within 3s. Persistent in session.

### FR-08 — Weekly Report — Overview Performance Summary
Display in VND + % of Net GMV:
- Net GMV (also shows KRW)
- Total Discount Costs
- Total Promotional Costs
- Prime Cost
- Platform Fee
- **Total Contribution Margin** (bold)

Breakdowns:
- Discount: Seller Voucher | Seller Discount | Free Gift
- Promotional: AD Spend | Brand Ads | Off-Platform Ads | Affiliate Commission | Affiliate Booking Fee | Livestream Fee
- Traffic: Page Views | Conversion Rate

WoW % displayed per metric with ▲ green / ▼ red. Edge cases: no prev data → `----`; prev=0 → `N/A`.

### FR-09 — Weekly Report — Product Breakdown Table
1 row per SKU. Columns match RFR. Sort/filter/search by product name or SKU. Visual flag (orange) + warning when SKU has no Prime Cost record. Totals row at bottom.

### FR-10 — Weekly Report — Export
Excel + CSV, exact match to screen. Filename `Weekly_Report_W{WW}_{YYYY}.xlsx`. Logged in Download History (FR-21). <5s for standard volume.

### FR-11 to FR-14 — Monthly Report (mirror Weekly)
Same structure, month aggregation. WoW → **MoM**. Aggregation: sum for value, weighted average for ratio (e.g. Conversion Rate). Filename `Monthly_Report_{MMM}_{YYYY}.xlsx`.

### FR-15 — WoW Trending — Shopee
Multi-week table: Net GMV | Discount Costs | Promotional Costs | Prime Cost | Platform Fee | Total CM — in VND + % of Net GMV. WoW % column between consecutive weeks. Bar chart Net GMV, line chart CM. Export Excel + embedded chart image. Date range selector (4w / 13w / custom).

### FR-16 to FR-18 — Trending variants
- FR-16: WoW TikTok
- FR-17: MoM Shopee
- FR-18: MoM TikTok

4 views accessible via tabs. Platforms always isolated.

### FR-19 — Login History Log
Every successful + failed login recorded: username, timestamp, IP. Filterable by date + username. Read-only. Retention ≥ 12 months.

### FR-20 — Manual Input & Upload Action Tracking
Every upload, manual input create/edit/delete: username, action type, record ID, before value, after value, timestamp. Filterable by action type + date. Read-only, immutable.

### FR-21 — Download History
Every download: username, report type, generated filename, timestamp. Read-only.

### FR-22 — User Management
(Admin) Manage user accounts. Detail not specified in v2.0 — assume CRUD + role assignment.

### FR-23 — Formula Configuration (Admin)
48 configurable parameters across 7 groups (see §6). Each parameter: name, description, data source, current value (editable), unit, history button. Inline edit. Every change logged + versioned per parameter. Changes do NOT retroactively affect finalized historical reports. 4 control types:

| Type | UI |
|---|---|
| Field Map | Dropdown populated from uploaded file headers |
| Calculated | Read-only monospace |
| Select | Dropdown predefined |
| Number | Numeric input with validation |

## 4. Non-Functional Requirements (15 NFRs)

| ID | Category | Requirement | Measure |
|---|---|---|---|
| NFR-01 | Usability | Operable by non-technical operator | UAT no-support |
| NFR-02 | Performance | Upload/input/edit feedback < 5s | Perf test |
| NFR-03 | Performance | Report pages < 5s for 12mo data | Load test |
| NFR-04 | Performance | CSV parse < 5s for 10MB files | 10MB tested |
| NFR-05 | Usability | Specific actionable error msgs | UX review |
| NFR-06 | Data Integrity | Raw files stored unmodified, retrievable | Hash compare |
| NFR-07 | Data Integrity | All cost calc rules Admin-configurable, no code | Admin UI |
| NFR-08 | Data Integrity | PrimeCost/COGS changes create versions, no retro change | Regression |
| NFR-09 | Data Integrity | Regenerate any historical report from raw | UAT verify |
| NFR-10 | Security | RBAC enforced for 3 roles | Pen test |
| NFR-11 | Security | No secrets in frontend | Code review |
| NFR-12 | Auditability | Log within 1s of action | Auto test |
| NFR-13 | Auditability | Log immutable for ALL roles incl Admin | Edit/delete attempt |
| NFR-14 | Availability | ≥99% uptime business hours (Mon-Fri 8-18 ICT) | 3mo monitoring |
| NFR-15 | Browser | Chrome, Edge, Firefox fully functional | Cross-browser test |

## 5. Calculation Engine — Formula Reference

> Implement EXACTLY as below. Deviation requires client sign-off.

### 5.1 Product-level (per SKU) — Shopee

| Metric | Formula |
|---|---|
| Original Price | `Value(Giá gốc)` |
| Selling Price | `XLOOKUP(SKU phân loại hàng, PRIME COST!SKU, PRIME COST!SELLINGPRICE, 0)` |
| Item Sold | `Value(Số lượng) − Value(Số lượng sản phẩm được hoàn trả)` |
| GMV | `Original Price × Item Sold` |
| Net GMV | `Selling Price × Item Sold` |
| NMV | `Value(Tổng số tiền Người mua thanh toán)` |
| Seller Discount | `IF(Net NMV − NMV < 0, 0, Net NMV − NMV)` |
| Prime Cost | `XLOOKUP(SKU phân loại hàng, PRIME COST!SKU, PRIME COST!Primecost, 0)` |
| Voucher Shop | `Value(Mã giảm giá của Shop)` |
| Combo Shop | `Value(Giảm giá từ Combo của Shop)` |
| Vouchers | `Voucher Shop + Combo Shop` (allocated) |
| Seller Vouchers (line) | Allocate by `Total Seller Vouchers - Shopee` × `NMV contribution` |
| Free Gift (line) | Allocate by `Total Free Gift - Shopee` × `NMV contribution` |
| Ad Spending | `Value(Chi phí)` from Shopee Ads CSV |
| Brand Ads (line) | Allocate by `Total Brand Ads × NMV contribution` |
| Off-Platform Ads (line) | Allocate by `Total Off-Platform Fee × NMV contribution` |
| Affiliate Commission (line) | Allocate by `Total Affliate Commission × NMV contribution` |
| Affiliate Booking Fee (line) | Allocate by `Total Affiliate Booking Fee × NMV contribution` (manual input total) |
| Livestream Fee (line) | Allocate by `Total Livestream Fee × NMV contribution` (manual input total) |
| Platform Fee (line) | Allocate by `Total Platform Fee × NMV contribution` |
| Contribution Margin | `Net GMV − Seller Discount − Prime Cost − Ad Spending − Brand Ads − Platform Fee − Seller Vouchers − Livestream Fee − Off-Platform Ads − Free Gift − Affiliate Booking − Affiliate Commission` |
| CM % | `Contribution Margin / Net GMV` |

### 5.2 Product-level (per SKU) — TikTok

| Metric | Formula |
|---|---|
| Original Price | `IF(Quantity = SKU Quantity of return, 0, SKU Unit Original Price)` |
| Listing Price | `XLOOKUP(Seller SKU, PRIME COST!SKU, PRIME COST!NEWLISTINGPRICE, 0)` |
| Page View | `Tab Cửa hàng + Live + Video + Thẻ sản phẩm` |
| Item Sold | `IF(Quantity = SKU Quantity of return, 0, Quantity)` |
| GMV | `Listing Price × Item Sold` |
| Net GMV | `Original Price × Item Sold` |
| Seller Discount | `IF(Quantity = SKU Quantity of return, 0, MAX(0, SKU Seller Discount − (GMV − Net GMV)))` |
| NMV | `Net GMV − Seller Discount` |
| Prime Cost | `XLOOKUP(Seller SKU, PRIME COST!SKU, PRIME COST!Primecost, 0)` |
| Free Gift (line) | Allocate by `Total Free Gift - TikTok × NMV contribution` |
| Ad Spending (line) | Allocate from manual `Ad Spending - TikTok` |
| Affiliate Commission | Allocate by `Total Affliate Commission × NMV contribution` |
| Affiliate Booking Fee | Allocate by `Total Affiliate Booking Fee × NMV contribution` (manual) |
| Livestream Fee | Allocate by `Total Livestream Fee × NMV contribution` (manual) |
| Platform Fee | Allocate by `Total Platform Fee × NMV` (manual or estimated, see §5.4) |
| Contribution Margin | `Net GMV − Seller Discount − Prime Cost − Ad Spending − Platform Fee − Livestream Fee − Free Gift − Affiliate Booking − Affiliate Commission` (note: no Brand Ads / Off-Platform / Seller Vouchers vs Shopee) |
| CM % | `Contribution Margin / Net GMV` |

### 5.3 Platform-level aggregation — Shopee
21 parameters (sum of product-level or field-map). See §6 Group 1.

### 5.4 Platform-level aggregation — TikTok
20 parameters. **Special case**:
- **Total Platform Fee - TikTok (weekly)** = `Avg(Platform Fee Rate of last 4 weeks) × Total Net GMV - TikTok` (because exact only available monthly via manual input)
- **Total Platform Fee - TikTok (monthly)** = sum of 7 fee components manually entered

### 5.5 Currency & Period Comparison

| Parameter | Default | Notes |
|---|---|---|
| KRW Conversion | `KRW = VND ÷ Exchange Rate` | Rate is VND per 1 KRW |
| Default Exchange Rate | **17,543** | Overridable per session |
| WoW % | `(Current − Previous) / abs(Previous) × 100` | |
| MoM % | `(Current − Previous) / abs(Previous) × 100` | |
| Previous = 0 display | `N/A` | |
| Previous = null display | `----` | First period |

### 5.6 Order Exclusion Rules

| Rule | Shopee | TikTok |
|---|---|---|
| Cancelled | `Order Status = Đã hủy` | `Order Status = Đã hủy AND Order Substatus = Đã hủy` |
| Returned | `GMV = 0` | `Net GMV = 0` |
| Free Gift | `NMV = 0` → exclude revenue + platform discount from Net GMV, ADD Prime Cost to Total Prime Cost | `Net GMV = 0 AND Normal/Pre-order = Normal AND Product Name starts with [GIFT]` → same handling |

Cancelled + Returned: **excluded from all metric calculations**.

### 5.7 Cost Master Defaults

| Param | Default | Notes |
|---|---|---|
| HQ Margin % | 5 | Added on top of ex-VAT production cost |
| VAT Rate | 10 | Applied to strip VAT from HQ cost |
| Fulfillment Fee / unit | 14,000 VND | Fixed per dispatched unit (Amoeba) |

## 6. Formula Configuration — 48 Parameters

Grouped into 7 categories, each parameter editable by Admin (FR-23). 4 types: Field Map, Calculated, Select, Number.

**Color legend**: Blue = sourced from original report. Orange = calculated. Green = manual input.

### Group 1 — Platform-Level: Shopee (21 params)
Total Page View, Conversion Rate, Total Item Sold, Total GMV, Total Net GMV, Total NMV, Total Seller Vouchers, Total Seller Discount, Total Free Gift, Total Ad Spending, Brand Ads, Total Off-Platform Ads Fee, Total Affiliate Commission, Total Affiliate Booking Fee, Total Livestream Fee, Total Platform Fee, Total Prime Cost, Total Contribution Margin, Total CM %, AD GMV, AD ROAS.

### Group 2 — Product-Level: Shopee (21 params)
Original Price, Selling/Listing Price, Page View, Conversion Rate, Item Sold, GMV, Net GMV, NMV, Seller Vouchers, Seller Discount, Free Gift, Ad Spending, Brand Ads, Off-Platform Ads, Affiliate Commission, Affiliate Booking Fee, Livestream Fee, Platform Fee, Prime Cost, CM, CM %.

### Group 3 — Platform-Level: TikTok (~20 params)
Total Page View, Conversion Rate, Total Item Sold, Total GMV, Total Net GMV, Total NMV, Total Seller Discount, Total Free Gift, Total Ad Spending (manual), Total Affiliate Commission, Total Affiliate Booking Fee, Total Livestream Fee (manual), Total Platform Fee (weekly est / monthly manual), Total Prime Cost, Total CM, Total CM %.

### Group 4 — Product-Level: TikTok (18 params)
Original Price, Listing Price, Page View (4-source sum), Conversion Rate, Item Sold, GMV, Net GMV, NMV, Seller Discount, Free Gift, Ad Spending, Affiliate Commission, Affiliate Booking Fee, Livestream Fee, Platform Fee, Prime Cost, CM, CM %.

### Group 5 — Aggregated Both Platforms
Total Affiliate Booking Fee (single manual input cho cả 2 sàn — chia bằng GMV contribution).

### Group 6 — Currency & Period Comparison (6 params)
KRW Conversion, Default Exchange Rate (17,543), WoW %, MoM %, WoW/MoM zero display (`N/A`), WoW/MoM null display (`----`).

### Group 6b — Order Exclusion (6 params)
Cancelled Shopee, Cancelled TikTok, Return Shopee, Return TikTok, Free Gift Shopee, Free Gift TikTok.

### Group 7 — Cost Master (3 params)
HQ Margin % (5), VAT Rate (10), Fulfillment Fee / unit (14,000).

## 7. Open Issues (từ SRD)

- **OI-001**: Behavior khi upload trùng date range — overwrite hay append? Ảnh hưởng FR-01 AC-05.
- **OI-002**: Định nghĩa "finalized" report cho version control PrimeCost — assumed = "downloaded at least once".

## 8. References (from client)

- IT Vendor Briefing Document v1.0 — March 2026
- Weekly Report RFR (Google Sheet)
- Weekly Trending Report RFR
- Monthly Trending Report RFR
- Full Test Cases — TCR-260412
- Manual Reporting Process Guide (internal, Truc Hoang)

---

**Note**: Đây là bản trích xuất từ SRD v2.0 client gửi. Bản gốc có thêm chi tiết về AC, edge cases mà message bị truncate ở 50k chars (mục 5 formula reference). Cần lấy bản đầy đủ cuối cùng từ Truc Hoang nếu có discrepancy.
