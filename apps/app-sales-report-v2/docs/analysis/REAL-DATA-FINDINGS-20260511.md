# Real Data Findings — 14 file CSV April 2026

> Nguồn: `resources/APRIL - SALES REPORT - *.csv` (14 file, client cung cấp 2026-05-11)
> Mục đích: ghi lại sự khác biệt giữa SRD spec và file thật để parser & schema design đúng.

## 1. File inventory

| # | File | Loại | Mô tả |
|---|---|---|---|
| 1 | `1. SHOPEE DOWNLOAD.csv` (5.8MB) | **Raw consolidated** | Shopee dashboard export — **1 file chứa 6 sections stacked HORIZONTALLY** |
| 2 | `2. SHOPEE DOWNLOAD - CUSTOM.csv` (3.9MB) | Custom (manual derive) | Shopee Sales section + 15 cột derived (Selling Price, NMV, GMV, Vouchers, Fees...) |
| 3 | `3. SC - SALES.csv` (8KB) | Pivot summary | SC = Shopee Consolidated. SUM theo Product Name |
| 4 | `9. SHOPEE REPORT.csv` (36KB) | Intermediate report | Per-SKU full metrics + 4 zones (TRAFFIC/SALES/AFFILIATE/ADS) |
| 5 | `10. TIKTOK DOWNLOAD.csv` (2.7MB) | **Raw consolidated** | **5 sections** (Sales/Traffic/Affiliate/Ads/Platform Fee) |
| 6 | `11. TIKTOK DOWNLOAD - CUSTOM.csv` (2.0MB) | Custom | TikTok Sales + 8 cột derived |
| 7 | `12. TC - SALES.csv` (7KB) | Pivot | TC = TikTok Consolidated. SUM theo Product Name |
| 8 | `14. TC - SUCCESSFUL ORDERS.csv` (29KB) | Pivot | Per-order item count |
| 9 | `20. TIKTOK REPORT.csv` (46KB) | Intermediate | Per-product full metrics (Korean labels: 공헌이익, 판매량...) |
| 10 | `BOOKING FEE.csv` (191B) | Manual input | Total + Shopee% + TikTok% allocation |
| 11 | `TC - PLATFORM DISCOUNT.csv` (31KB) | Lookup | Per-Order ID → SUM of SKU Platform Discount |
| 12 | `FINAL REPORT.csv` (35KB) | Output | All platforms combined (target FR-08~10 output) |
| 13 | `FINAL REPORT (SHOPEE).csv` (22KB) | Output | Shopee only |
| 14 | `FINAL REPORT (TIKTOK).csv` (15KB) | Output | TikTok only |

## 2. CRITICAL DIFFERENCE vs SRD

### 2.1 Shopee không phải 6 files riêng mà là **1 file chứa 6 sections horizontally stacked**

File `1. SHOPEE DOWNLOAD.csv` row 1 (section markers):
```
SALE REPORT,,,,...(65 cols),,, ADS REPORT,,...(35 cols),,, BRAND ADS,,...(15 cols),,, OFF PLATFORM ADS,,...(18 cols),,, TRAFFIC REPORT,,...(45 cols),,, AFFILIATE REPORT,,...(40 cols)
```

Row 2 = column headers cho từng section. Row 3+ = data (mỗi section có granularity khác nhau: order-line cho SALES, product-day cho ADS, shop-period cho BRAND ADS, product cho TRAFFIC...).

→ **Implication**: SRD nói 6 file riêng nhưng thực tế client copy-paste 6 exports vào 1 Google Sheet rồi save 1 CSV. 

**2 options cho parser**:
- **A**. App yêu cầu user upload 6 file riêng (như SRD), client tự tách trước khi upload
- **B**. App nhận 1 CSV consolidated, parser split 6 sections theo row 1 markers

→ **Cần hỏi client**: muốn workflow nào?

### 2.2 TikTok có **5 sections** (không phải 3 như SRD)

File `10. TIKTOK DOWNLOAD.csv` row 1:
```
SALE REPORT,,...,TRAFFIC REPORT,,...,AFFILIATE REPORT,,...,ADS REPORT,,...,PLATFORM FEE,,...
```

SRD ghi TikTok có 3 reports (Sales/Traffic/Affiliate) + Ad Spending / Platform Fee là **manual input** (FR-04). Nhưng file thật có **TikTok ADS section + PLATFORM FEE section trong export**.

→ **Discrepancy**: TikTok Ads + Platform Fee có thể parse được TỪ FILE, không nhất thiết manual nữa. Hỏi client: muốn parse hay vẫn manual input?

### 2.3 Booking Fee allocate theo **GMV** (không phải NMV)

File `BOOKING FEE.csv`:
```
SHOPEE GMV: 1,390,405,000 (73.32%)
TIKTOK GMV:   505,915,000 (26.68%)
TOTAL BOOKING FEE: 51,700,000
→ Shopee = 51.7M × 73.32% = 37,907,072
→ TikTok = 51.7M × 26.68% = 13,792,928
```

SRD §3.5 Group 5 ghi "Total Affiliate Booking Fee" là single manual input cho cả 2 sàn. Nhưng allocation **giữa 2 platform** dùng **GMV contribution**, không phải NMV. Trong từng platform mới dùng NMV contribution per SKU.

→ **Resolved**: Allocation hierarchy 2 cấp:
- **Cấp 1**: Total Booking Fee → Shopee + TikTok theo **GMV contribution**
- **Cấp 2**: Platform booking fee → SKU theo **NMV contribution**

### 2.4 Free Gift trong cả 2 sàn dùng prefix `[GIFT]`

File `FINAL REPORT.csv`:
- Row 56 (Shopee): `[GIFT] Combo 2 Wipes Max Clean` — Net GMV empty, Prime Cost = 4,145,400
- Row 102 (TikTok): `[GIFT] Khăn Ướt Cao Cấp 100 Tờ Max Clean` — same pattern
- Row 103 (TikTok): `[GIFT] Khăn Ướt Cao Cấp Max Clean 500gr`

→ **Resolved**: BOTH Shopee và TikTok đều dùng prefix `[GIFT]` để đánh dấu free gift. SRD chỉ ghi rule này cho TikTok — cần update Shopee rule cũng dùng `[GIFT]` prefix làm signal mạnh, không chỉ `NMV=0`.

**Detection rule mới đề xuất**:
```
isFreeGift = productName.startsWith('[GIFT]') OR (platform-specific signal: NMV=0 Shopee, NetGMV=0 TikTok)
```

### 2.5 "Total Platform Discount (Rfr)" — metric mới ngoài SRD

File `FINAL REPORT.csv` row 21:
```
ㄴ Total Platform Discount (Rfr) — 249,414,868 VND (14.83%)
```

SRD KHÔNG đề cập metric này. Là tổng platform discount tham chiếu (Rfr = Reference Report). Có lẽ dùng cho audit so sánh với raw report của sàn.

→ **Cần hỏi client**: định nghĩa chính xác + công thức.

### 2.6 TikTok Page View — 4 cột riêng đã CONFIRMED

File `10. TIKTOK DOWNLOAD.csv` row 2 (Traffic section):
- "Lượt xem trang từ tab Cửa hàng"
- "Lượt xem trang từ LIVE"
- "Lượt xem trang từ video"
- "Lượt xem trang từ thẻ sản phẩm"

→ Q7 RESOLVED: parser PHẢI sum 4 cột này thành 1 `page_view`.

### 2.7 Number format đa dạng

File 1 (Shopee Download) chứa **CẢ HAI** dạng số trong cùng file:
- `"1,390,405,000"` — comma thousands (EN locale)
- `477.888.983` — dot thousands (VN locale)

→ Parser cần robust detect locale per **cell**, không chỉ per **file**.

### 2.8 TikTok có Korean column headers

File `20. TIKTOK REPORT.csv` có headers Korean:
- `공헌이익 CM` = Contribution Margin
- `판매량 Items Sold`
- `판매액 GMV`
- `순결제액 NMV`
- `상품원가 Prime Cost`
- `공헌이익율 Profit Rate`
- `원가율 Cost Ratio`
- `할인율 Discount Rate`

→ Đây là **internal reference report** (chuẩn bị cho đối tác HQ). KHÔNG phải raw export.

## 3. Cấu trúc FINAL REPORT — target output (FR-08~10)

```
Section 1: HEADER
  - Platform filter (ALL / SHOPEE / TIKTOK)
  - Month filter (Apr/...)
  - Exchange rate display "1 vnd = 0.057 krw"

Section 2: 📍 OVERVIEW PERFORMANCE (left VND, right KRW)
  - 🔵 Net GMV
  - 🔵 Total Discount Costs (with % of Net GMV)
  - 🔵 Total Promotional Costs (with %)
  - 🔵 Prime Cost (with %)
  - 🔵 Platform Fee (with %)
  - 🔵 Total Contribution Margin (with %)
  
  Side panel:
  - 🔵 Item Sold
  - 🔵 Orders
  - 🔵 AOV
  - 🔵 AD ROAS
  - 🔵 AD GMV
  - 🔵 Total Page View
  - 🔵 Conversion rate

Section 3: 📍 Total Discount Costs breakdown
  - ㄴ Total Seller Voucher
  - ㄴ Total Seller Discount
  - ㄴ Total Free Gift
  - ㄴ Total Platform Discount (Rfr)  ← KHÔNG có trong SRD

Section 4: 📍 Total Promotional Cost breakdown
  - ㄴ Total AD Spend
  - ㄴ Total Brand Ads
  - ㄴ Total Off-Platform Ads
  - ㄴ Total Affiliate Commission
  - ㄴ Total Affiliate Booking Fee
  - ㄴ Total Livestream Fee

Section 5: PRODUCT BREAKDOWN TABLE
  Columns: No | Product ID | Product Name (VI/EN) | Platform | Page View | Conversion Rate | Items Sold | GMV | Net GMV | NMV | Seller Voucher | Seller Discount | Free Gift | AD Spending | Brand Ads | Off-Platform Ads | Affiliate Commission | Affiliate Booking Fee | Livestream Fee | Platform Fee | Prime Cost | Contribution Margin | CM %
```

## 4. Brand Ads + Off-Platform Ads — granularity confirmed

### Brand Ads (file 1 BRAND ADS section)
- Row 1: shop-level data (Shop Name = "Firgi Chính Hãng", Shop ID, Period, Impressions, Clicks, GMV, Chi phí, ROI...)
- **1 row per period** (toàn shop, không per product)
- → Allocation needed: theo NMV per product

### Off-Platform Ads (file 1 OFF PLATFORM ADS section + file 9 ADS ZONE OFF PLATFORM)
- File 9 ADS ZONE - OFF PLATFORM: **PER PRODUCT** (Product ID, GMV, OP COST)
- → Direct join by Product ID, không cần allocate

→ Q5 (Brand Ads): **shop-level 1 row tổng** → allocate.
→ Q6 (Off-Platform Ads): **per product** → direct join.

## 5. Affiliate có 2 metric riêng

File 10 (TikTok Affiliate section):
- `Hoa hồng ước tính` (estimated commission earned by affiliate)
- `Phí cố định ước tính` (estimated fixed booking fee)

→ 2 metric khác nhau cùng từ file Affiliate. Parser cần lưu cả 2.

## 6. Free Gift impact lên CM

Trong FINAL REPORT row 64 (Shopee SKU "Bộ Muỗng Ăn Dặm Hai Giai Đoạn"):
- Free Gift cost: 2,805,100 (large!)
- Net GMV: 2,239,200
- Prime Cost: 928,000
- CM: -2,544,258 (negative)
- CM%: -113.62%

→ Free Gift COST của SKU này = 2.8M (lớn hơn cả prime cost). Nghĩa là khi SKU bán kèm free gift, **CM của SKU đó hấp thụ giá vốn free gift**. Cần hiểu rule allocation Free Gift về parent SKU vs allocate đều theo NMV.

→ **Cần clarify**: Free Gift `2,805,100` ở row 64 đến từ đâu?
- Free Gift product riêng (vd `[GIFT] Combo 2 Wipes` ở row 56) có prime cost 4,145,400
- Phân bổ về các SKU đã bán kèm free gift theo NMV?

## 7. Order exclusion trong file thật

Chưa thấy explicit "Đã hủy" row trong sample (vì file là CUSTOM đã filter). Cần file raw chưa filter để verify exclusion rule.

## 8. Tóm tắt updates cần làm cho v2 docs

| File | Update | Why |
|---|---|---|
| SRD doc | Note discrepancies | TikTok có 5 sections (không 3), Shopee có thể là 1 consolidated file |
| DATA-MODEL.md | Đơn giản hóa 9 tables → 2 master raw files | Reflect thực tế: Shopee Download + TikTok Download |
| Excel-parser skill | Section splitter logic | 1 file = N sections horizontally |
| CM-calculator skill | Allocation hierarchy 2 cấp | Booking Fee chia GMV trước, NMV sau; Free Gift treatment |
| REQ doc | Add "Total Platform Discount (Rfr)" requirement | Metric ngoài SRD |
