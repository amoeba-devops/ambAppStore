---
name: File structure — reality vs SRD
description: File thật client cung cấp khác SRD — Shopee 1 consolidated CSV (6 sections), TikTok 5 sections không 3
type: project
---

**Phát hiện** (từ scan 14 file `resources/*.csv` ngày 2026-05-11):

### Shopee
SRD nói 6 file riêng (Sales, Ads, Brand Ads, Off-Platform Ads, Traffic, Affiliate). **Thực tế**: client export thành **1 file CSV consolidated** với 6 sections stacked horizontally:
- Row 1: section markers (`SALE REPORT,,,..., ADS REPORT,,,..., BRAND ADS,,,..., OFF PLATFORM ADS,,,..., TRAFFIC REPORT,,,..., AFFILIATE REPORT`)
- Row 2: column headers per section
- Row 3+: data (granularity khác nhau: SALE per order line, ADS per product-day, BRAND ADS per shop-period)

### TikTok
SRD nói 3 sections (Sales/Traffic/Affiliate). **Thực tế**: file có **5 sections** — thêm ADS REPORT và PLATFORM FEE. Nghĩa là TikTok cũng export Ads + Platform Fee được, không nhất thiết phải manual như SRD.

### Granularity per section

| Section | Granularity | Allocation needed? |
|---|---|---|
| Shopee Sales | per order line | No (direct) |
| Shopee Ads | per product per day | No (already per product) |
| Shopee Brand Ads | per shop per period (1 row tổng) | **Yes** (NMV contribution) |
| Shopee Off-Platform Ads | per product per period | No (direct join) |
| Shopee Traffic | per product per period | No (direct join) |
| Shopee Affiliate | per order/product line | No (direct) |
| TikTok Sales | per order line | No |
| TikTok Traffic | per product per period, **4 sub-source columns** | Parser sum 4 cột |
| TikTok Affiliate | per creator-order, có 2 metric: Hoa hồng + Phí cố định | No |
| TikTok Ads (mới phát hiện) | per product? | TBD |
| TikTok Platform Fee (mới) | có thể per fee type | TBD |

**Why**: Phát hiện này thay đổi parser strategy. KHÔNG build 9 parser tách rời như SRD ghi mà cần:
- 1 "section splitter" cho Shopee CSV: tách 6 sub-tables theo row 1 markers
- 1 "section splitter" cho TikTok CSV: tách 5 sub-tables
- 11 sub-parser (1 per section, mỗi cái xử lý sub-table tương ứng)

**How to apply**:
- DATA-MODEL.md: giữ 9-11 raw tables nhưng note rằng upload pipeline là 2 file consolidated → split → distribute vào tables
- excel-parser skill: thêm pattern "section splitter" trước khi gọi sub-parser
- Cần hỏi client (xem [REQ-20260511 §4.4 updated](../../docs/analysis/REQ-20260511-sales-report-v2.md)): muốn UI yêu cầu upload 1 file consolidated hay tự tách 6/5 file trước khi upload?
- **Đề xuất**: hỗ trợ CẢ HAI — auto-detect: nếu CSV row 1 có section markers → consolidated mode; nếu không → assume single section.

**Reference**: Chi tiết findings ở [docs/analysis/REAL-DATA-FINDINGS-20260511.md](../../docs/analysis/REAL-DATA-FINDINGS-20260511.md).
