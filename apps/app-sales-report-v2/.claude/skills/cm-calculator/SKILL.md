---
name: cm-calculator
description: Tính Contribution Margin (CM) và 48 formulas theo SRD v2.0. Khác biệt rõ Shopee vs TikTok. NMV-based allocation. Order exclusion.
---

# Skill: cm-calculator

> Tài liệu nguồn:
> - [SRD §5 + §6](../../../docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md). Implement EXACTLY — deviation cần client sign-off.
> - **[REAL-DATA-FINDINGS-20260511.md](../../../docs/analysis/REAL-DATA-FINDINGS-20260511.md)** ⚠️ — Allocation 2 cấp + Free Gift `[GIFT]` prefix cả 2 platform
> - [Allocation hierarchy memory](../../memory/allocation-hierarchy.md)

## Khi nào dùng
- Implement `server/services/calculation/*`
- Tính per-SKU metrics + platform aggregation
- WoW / MoM trending
- Loss alert
- Debug discrepancy giữa kết quả app và Google Sheet RFR của client

## 1. Pipeline tổng quát

```
1. Apply order exclusion (cancelled / returned) + Free Gift detect ([GIFT] prefix) — §2
2. Compute product-level (per SKU) — §3 Shopee, §4 TikTok
3. Snapshot Prime Cost từ sal_prime_cost_versions tại period start
4. Allocate 2-cấp:
   - Cấp 1 (cross-platform metrics — vd Booking Fee tổng): chia Shopee/TikTok theo GMV contribution
   - Cấp 2 (intra-platform): chia về SKU theo NMV contribution — §6
5. Free Gift: aggregate Prime Cost of [GIFT] rows → Total Free Gift; allocate về SKU non-gift theo NMV
6. Compute CM per SKU — §3.5 (Shopee), §4.5 (TikTok)
7. Aggregate platform-level metrics
8. Compute trending WoW / MoM — §7
9. Convert KRW for display (rate 17.543) — §8
10. Snapshot vào sal_product_metrics + sal_platform_metrics + sal_reports (rep_fx_rate_snapshot, prm_prime_cost_snapshot_pcv_id)
```

## 2. Order exclusion + Free Gift detection (§5.6 SRD + REAL-DATA-FINDINGS §2.4)

**⚠️ Updated rule** (sau khi scan real data): BOTH Shopee và TikTok đều dùng prefix `[GIFT]` trong product name làm signal chính. Rule cũ chỉ NMV=0 (Shopee) không đủ — conflict với 100% discount.

```ts
// Free Gift detection — đồng nhất cả 2 platform
// Signal mạnh: product name starts with '[GIFT]'
// Verified từ FINAL REPORT.csv row 56 (Shopee), row 102/103 (TikTok)
function isFreeGift(productName: string | null | undefined): boolean {
  return productName?.startsWith('[GIFT]') ?? false;
}

// Shopee
function isShopeeExcluded(row: ShopeeRawSale): { excluded: boolean; reason?: string } {
  if (row.orderStatus === 'Đã hủy') return { excluded: true, reason: 'CANCELLED' };
  // GMV = 0 sau khi tính (original_price × item_sold = 0 khi quantity_returned = quantity)
  if (row.gmv === 0) return { excluded: true, reason: 'RETURNED' };
  return { excluded: false };
}

// TikTok
function isTiktokExcluded(row: TiktokRawSale): { excluded: boolean; reason?: string } {
  if (row.orderStatus === 'Đã hủy' && row.orderSubstatus === 'Đã hủy')
    return { excluded: true, reason: 'CANCELLED' };
  // Return: net_gmv = 0 NHƯNG không phải Free Gift (Free Gift cũng có net_gmv = 0)
  if (row.netGmv === 0 && !isFreeGift(row.productName))
    return { excluded: true, reason: 'RETURNED' };
  return { excluded: false };
}

// Free Gift treatment (cả 2 platform):
// - KHÔNG exclude khỏi raw
// - Revenue (Net GMV, NMV) của Free Gift row = 0 (đã đúng)
// - Prime Cost của Free Gift row → cộng vào Total Free Gift platform-level
// - Total Free Gift cấp 1 (cross-platform): KHÔNG split (mỗi platform riêng)
// - Total Free Gift cấp 2: allocate về SKU non-gift theo NMV contribution
```

**Fallback rule** (nếu name không có `[GIFT]` prefix nhưng vẫn là free gift):
- Shopee: `nmv === 0 && original_price > 0` (loại trừ trường hợp return)
- TikTok: `netGmv === 0 && originalPrice === 0` per SRD

→ Khuyến nghị: hỏi client confirm prefix `[GIFT]` là convention chính thức (có quy định nội bộ?), nếu không thì fallback rule áp dụng.

## 3. Product-level — Shopee (per SKU)

| Metric | Formula | Source |
|---|---|---|
| `original_price` | `Value(Giá gốc)` | `rss_original_price` field map |
| `selling_price` | `XLOOKUP(SKU, prime_cost.sku, prime_cost.selling_price, 0)` | join `sal_prime_costs` |
| `item_sold` | `Số lượng − Số lượng hoàn trả` | `rss_quantity − rss_quantity_returned` |
| `gmv` | `original_price × item_sold` | computed |
| `net_gmv` | `selling_price × item_sold` | computed |
| `nmv` | `Tổng số tiền Người mua thanh toán` | `rss_nmv` field map |
| `seller_discount` | `IF(Net NMV − NMV < 0, 0, Net NMV − NMV)` ⚠️ "Net NMV" trong RFR client = giá trị tính được, cần làm rõ |
| `voucher_shop` + `combo_shop` | sum of `Mã giảm giá của Shop` + `Giảm giá từ Combo của Shop` | platform-level total |
| `prime_cost` | `XLOOKUP(SKU, prime_cost.sku, prime_cost.prime_cost, 0) × item_sold` | snapshot version |
| `page_view` | `Lượt xem trang sản phẩm` từ Traffic CSV theo product_id | join `sal_raw_shopee_traffic` |
| `conversion_rate` | `item_sold / page_view` | computed |
| `ad_spending` | từ Shopee Ads CSV, join theo product/sku | `rsa_ad_spending` |

**Allocated metrics** (từ platform-level total, allocate theo NMV contribution):
- `seller_vouchers (line)` = `Total Seller Vouchers Shopee × (line_nmv / total_nmv)`
- `free_gift (line)` = `Total Free Gift Shopee × (line_nmv / total_nmv)`
- `brand_ads (line)` = `Total Brand Ads × (line_nmv / total_nmv)`
- `off_platform_ads (line)` = `Total Off-Platform × (line_nmv / total_nmv)`
- `affiliate_commission (line)` = `Total Affiliate Commission × (line_nmv / total_nmv)`
- `affiliate_booking_fee (line)` = `Total Affiliate Booking (manual) × (line_nmv / total_nmv)`
- `livestream_fee (line)` = `Total Livestream (manual) × (line_nmv / total_nmv)`
- `platform_fee (line)` = `Total Platform Fee × (line_nmv / total_nmv)`

**Contribution Margin (Shopee)**:
```
CM = Net GMV
   − Seller Discount
   − Prime Cost
   − Ad Spending
   − Brand Ads
   − Platform Fee
   − Seller Vouchers
   − Livestream Fee
   − Off-Platform Ads
   − Free Gift
   − Affiliate Booking Fee
   − Affiliate Commission

CM % = CM / Net GMV
```

## 4. Product-level — TikTok (per SKU)

| Metric | Formula | Note |
|---|---|---|
| `original_price` | `IF(Quantity = SKU Quantity of return, 0, SKU Unit Original Price)` | Return → 0 |
| `listing_price` | `XLOOKUP(Seller SKU, prime_cost.sku, prime_cost.new_listing_price, 0)` | |
| `page_view` | **sum of 4 sources**: `Tab Cửa hàng + Live + Video + Thẻ sản phẩm` | TikTok traffic 4 cột |
| `item_sold` | `IF(Quantity = SKU Quantity of return, 0, Quantity)` | |
| `gmv` | `listing_price × item_sold` | KHÁC Shopee — TT dùng listing |
| `net_gmv` | `original_price × item_sold` | KHÁC Shopee — TT dùng original |
| `seller_discount` | `IF(Q=return, 0, MAX(0, SKU Seller Discount − (GMV − Net GMV)))` | |
| `nmv` | `net_gmv − seller_discount` | KHÁC Shopee (Shopee có field riêng) |
| `prime_cost` | `XLOOKUP(Seller SKU, prime_cost.sku, prime_cost.prime_cost, 0) × item_sold` | |

**Allocated** (TikTok có ÍT HƠN Shopee):
- `free_gift` từ `Total Free Gift TikTok × NMV contribution`
- `ad_spending` từ manual `TikTok Ad Spending × NMV contribution`
- `affiliate_commission` per SKU = lookup theo Tên sản phẩm trong `tiktok.affiliateCostByProductName` (merged từ 3 file: Creator + Partner + Non-collab); NMV-split nội bộ giữa các variation cùng tên. Tên không khớp Sales breakdown → row "Others" với `isOthers: true` để giữ Total chính xác.
- `affiliate_booking_fee` từ `Total Affiliate Booking (manual) × NMV contribution` (CHIA với Shopee)
- `livestream_fee` từ `Total Livestream TikTok (manual) × NMV contribution`
- `platform_fee` từ `Total Platform Fee TikTok × NMV contribution` (xem §5)

**Contribution Margin (TikTok)** — KHÔNG có Brand Ads / Off-Platform / Seller Vouchers:
```
CM = Net GMV
   − Seller Discount
   − Prime Cost
   − Ad Spending
   − Platform Fee
   − Livestream Fee
   − Free Gift
   − Affiliate Booking Fee
   − Affiliate Commission

CM % = CM / Net GMV
```

## 5. TikTok Platform Fee — đặc biệt

**Vấn đề**: TikTok chỉ cung cấp 7 fee components ở mức **monthly** (manual input). Nhưng weekly report cần.

**Giải pháp SRD (§Group 3, item 17)**:
- **Monthly**: `Total Platform Fee = sum(7 manual components)` (Phí giao dịch + Commission + Shipping + Exclusive + Voucher Xtra + Order Processing + SFR)
- **Weekly**: `Total Platform Fee = avg(Platform Fee Rate of last 4 weeks) × Total Net GMV (current week)`
- `Platform Fee Rate = monthly_total_platform_fee / monthly_total_net_gmv`

**Edge case**: ít hơn 4 tuần dữ liệu lịch sử (đầu go-live):
- Đề xuất: dùng avg of available weeks; nếu = 0 → đặt rate = 0 + warning
- Hỏi client trước khi implement

## 6. Allocation engine — 2 cấp (GMV + NMV)

**Cấp 1 — Cross-platform** (vd Total Booking Fee):
```ts
// Verified từ BOOKING FEE.csv: Total 51,700,000 → Shopee 73.32% / TikTok 26.68% theo GMV
function allocateByGmv(totalCost: number, platforms: Array<{ platform: 'SHOPEE' | 'TIKTOK'; gmv: number }>): Map<string, number> {
  const totalGmv = platforms.reduce((s, p) => s + p.gmv, 0);
  if (totalGmv === 0) return new Map(platforms.map(p => [p.platform, 0]));
  return new Map(platforms.map(p => [p.platform, totalCost * (p.gmv / totalGmv)]));
}
```

**Cấp 2 — Intra-platform per SKU** (mọi cost trong 1 sàn):
```ts
function allocateByNmv(
  totalCost: number,
  lines: Array<{ sku: string; nmv: number }>,
): Map<string, number> {
  const totalNmv = lines.reduce((s, l) => s + l.nmv, 0);
  if (totalNmv === 0) {
    // Edge case: kỳ chỉ toàn return/cancel
    // → return Map với value=0 cho all + log warning
    return new Map(lines.map(l => [l.sku, 0]));
  }
  return new Map(
    lines.map(l => [l.sku, totalCost * (l.nmv / totalNmv)]),
  );
}
```

**Áp dụng**:
| Metric | Cấp 1 | Cấp 2 |
|---|---|---|
| Total Affiliate Booking Fee (manual, cross-platform) | GMV | NMV |
| Total Free Gift | N/A (per platform) | NMV |
| Brand Ads (Shopee only) | N/A | NMV |
| Off-Platform Ads (Shopee, per-product) | N/A | KHÔNG allocate (direct join) |
| Platform Fee (per-platform total) | N/A | NMV |
| Livestream Fee (per-platform manual) | N/A | NMV |
| Ad Spending Shopee (per-product) | N/A | KHÔNG allocate (direct join) |
| Ad Spending TikTok (manual) | N/A | NMV |
| Affiliate Commission (per-product/order) | N/A | direct hoặc NMV nếu bulk |

**Rounding**: lưu DECIMAL(15,2) → rounding errors cộng dồn có thể không khớp tổng. Khắc phục: row cuối = `total − sum(previous rows)` (residual method).

## 7. WoW / MoM (§Group 6 SRD)

```ts
function periodOverPeriod(current: number, previous: number | null): string {
  if (previous === null || previous === undefined) return '----';  // first period
  if (previous === 0) return 'N/A';                                // div by zero
  const pct = (current - previous) / Math.abs(previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}
```

UI: ▲ green nếu pct > 0, ▼ red nếu pct < 0, ─ nếu = 0.

## 8. Currency conversion (KRW)

```ts
// Default exchange rate: 17.543 VND per 1 KRW (§Group 6 SRD + verified từ FINAL REPORT.csv)
// 1,682,035,200 VND / 95,876,006 KRW = 17.544 → rate ≈ 17.543
function vndToKrw(vnd: number, vndPerKrw: number = 17.543): number {
  return vnd / vndPerKrw;
}
```

⚠️ Quan trọng: **rate là VND per KRW** (mẫu số), KHÔNG phải KRW per VND. Label trong UI: `Exchange Rate (1 KRW = ? VND)` → default **17.543** (KHÔNG phải 17,543 — notation gotcha do VN locale).

## 9. Snapshot rule (NFR-08, NFR-09)

Khi calc:
- Lưu `prime_cost_snapshot_pcv_id` vào `sal_product_metrics` (FK tới `sal_prime_cost_versions`)
- Lưu `rep_fx_rate_snapshot` vào `sal_reports`
- Lưu `rep_formula_config_snapshot` JSONB vào report (toàn bộ 48 params dùng)

Khi user finalize report (download lần đầu):
- Set `rep_finalized_at`
- KHÔNG cho phép recalc → snapshot lock vĩnh viễn
- Regen test: replay với snapshot → kết quả giống (NFR-09)

## 10. Performance

| Stage | Budget | Strategy |
|---|---|---|
| Read raw (9 tables) | < 1s | Batch query với JOIN trên ent+ups |
| Exclusion + product-level | < 1s | In-memory map by SKU |
| Allocation | < 0.5s | Vectorized over Map |
| Snapshot insert | < 1s | `db.insert().values(rows)` batch 500 |
| **Total weekly calc** | < 3s | NFR-03 budget 5s |

→ Chạy trong Inngest worker, không trong request.

## 11. Test cases

- [ ] Cancelled order Shopee excluded
- [ ] Cancelled order TikTok (status + substatus) excluded
- [ ] Return order Shopee (gmv=0) excluded
- [ ] Return order TikTok (net_gmv=0) excluded
- [ ] Free Gift Shopee (nmv=0): prime cost vào `Total Free Gift` (NOT `Total Prime Cost`), revenue excluded
- [ ] Free Gift TikTok (net_gmv=0 + Normal + [GIFT]): same treatment
- [ ] `Total Prime Cost` chỉ gồm `kept rows`; CM trừ `Total Prime Cost` + `Total Free Gift` riêng biệt — không double-subtract
- [ ] CM Shopee == manual recalc với Google Sheet RFR (cần fixture)
- [ ] CM TikTok == manual recalc với RFR
- [ ] NMV contribution allocation tổng = total cost (rounding residual)
- [ ] TikTok Platform Fee weekly = avg(last 4) × Net GMV
- [ ] TikTok Platform Fee monthly = sum(7 components)
- [ ] WoW first period: `----`
- [ ] WoW previous=0: `N/A`
- [ ] KRW = VND / 17543
- [ ] Snapshot: thay Prime Cost master → finalized report không đổi
- [ ] Regen historical: produce identical numbers

## 12. Anti-patterns ❌

- ❌ Dùng prime_cost current (không snapshot) cho report cũ
- ❌ Allocate trước khi exclude orders cancelled/returned
- ❌ Apply CM Shopee formula cho TikTok (khác Brand Ads, Off-Platform, Seller Vouchers)
- ❌ Quên check NMV=0 trong allocation → division by zero
- ❌ Cộng Free Gift PC vào `Total Prime Cost` — phải để riêng ở `Total Free Gift`, tránh double-subtract trong CM (CM đã trừ cả 2 line)
- ❌ Calc inline trong Server Action (>5s) — phải qua Inngest
- ❌ Hard-code 48 params trong code → phải đọc từ `sal_formula_configs`
