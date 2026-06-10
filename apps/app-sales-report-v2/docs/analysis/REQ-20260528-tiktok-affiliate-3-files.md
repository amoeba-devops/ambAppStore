---
title: REQ — TikTok Affiliate: 1 file → 3 files (exact per-product attribution)
description: Thay 1 file Affiliate (creator-aggregated) bằng 3 file order-level (Creator / Affiliate Partner / Non-collaboration). Match theo Tên sản phẩm, Others bucket cho phần dư. Mirror pattern Shopee.
load-when: Khi đụng TikTok affiliate ingest, upload wizard step TikTok, hoặc tính `tiktok.totalAffiliateCommission`.
status: ready
---

# REQ-20260528 — TikTok Affiliate 3 files

## 1. 요구사항 요약

| # | Yêu cầu | Loại |
|---|---------|------|
| FR-01 | Upload UI TikTok có 3 slot affiliate riêng (Creator / Affiliate Partner / Non-collaboration), mỗi slot **optional** | UI |
| FR-02 | Parser Creator: per row affComm = `Thanh toán hoa hồng tiêu chuẩn ước tính` + `Thanh toán hoa hồng Quảng cáo cửa hàng ước tính`; group by `Tên sản phẩm` | Backend |
| FR-03 | Parser Affiliate Partner: per row affComm = `Thanh toán hoa hồng Quảng cáo cửa hàng ước tính`; header ở row 2 (row 1 = Note); group by `Tên sản phẩm` | Backend |
| FR-04 | Parser Non-collaboration: per row affComm = `Thanh toán hoa hồng Quảng cáo cửa hàng ước tính`; shared-strings xlsx; group by `Tên sản phẩm` | Backend |
| FR-05 | Merge 3 maps thành `tiktok.affiliateCostByProductName: Record<normalizedName, sum>` | Backend |
| FR-06 | `tiktok.totalAffiliateCommission = SUM(merged map)` — exact, không bị leak | Backend |
| FR-07 | snapshot-to-report TikTok: per-SKU affComm = lookup theo Tên sản phẩm + NMV-split nội bộ giữa các variation; phần không match → row "Others" | Frontend |
| FR-08 | Mỗi file optional; thiếu loại nào → contribution của loại đó = 0 | Backend |
| FR-09 | i18n keys mới cho 3 slot labels (en/ko) | i18n |
| NFR-01 | Parser phải đọc được **inline-string xlsx** (TikTok xuất với `<dimension ref="A1">`, ExcelJS fail) | Compat |
| NFR-02 | Header row autodetect: 1 hoặc 2 tùy file có Note prefix | Robustness |
| NFR-03 | Backward compat: snapshot cũ thiếu `affiliateCostByProductName` → default `{}` → tất cả vào Others (an toàn, exact total bằng 0 vì legacy không gửi data) | Compat |
| NFR-04 | Old `parseTikTokAffiliate` (creator-aggregated) **xóa file + import** sau khi ingest đã rewire | Cleanup |
| NFR-05 | Filter rows ở cả 3 parser: bỏ `Trạng thái đơn hàng = Đã hủy` và `Đã trả hàng hoặc hoàn tiền đầy đủ = Có` (refunded) | Business |

## 2. AS-IS 현황 분석

### 2.1 Upload UI hiện tại
- Step TikTok Shop: 3 slot — Sales / Traffic / Affiliate ([upload component](apps/app-sales-report-v2/apps/web/src/components/upload/UploadReportsClient.tsx))
- "0/3 selected" indicator

### 2.2 Parser hiện tại
- File: [tiktok-affiliate-parser.service.ts](apps/app-sales-report-v2/apps/web/src/server/services/tiktok-affiliate-parser.service.ts)
- Input: 1 file *creator-aggregated* (1 row / creator) với cols `Tên người dùng của nhà sáng tạo`, `GMV liên kết`, `Hoa hồng ước tính`, …
- Output: `{ totalCommission, totalGmv, creatorCount, … }` — chỉ có **1 con số tổng**, không có per-SKU
- Library: ExcelJS

### 2.3 Pipeline
- [ingest.actions.ts:277](apps/app-sales-report-v2/apps/web/src/server/actions/ingest.actions.ts#L277): `totalAffiliateCommission = r.affiliate?.totalCommission ?? 0`
- [snapshot-to-report.ts:432](apps/app-sales-report-v2/apps/web/src/lib/snapshot-to-report.ts#L432): per-SKU = `tiktok.totalAffiliateCommission × (sku.nmv / total_nmv)` — NMV allocation

### 2.4 Sample files đã verify
| File | Header row | Match key (col) | affComm cols |
|------|-----------|-----------------|--------------|
| Creator (`affiliate_orders_*0449.xlsx`) | 1 | C: "Tên sản phẩm" | U: "Thanh toán hoa hồng tiêu chuẩn ước tính" + Y: "Thanh toán hoa hồng Quảng cáo cửa hàng ước tính" |
| Affiliate Partner (`affiliate_orders_*6833.xlsx`) | 2 (row 1 = Note tiếng Anh) | C: "Tên sản phẩm" | R: "Thanh toán hoa hồng Quảng cáo cửa hàng ước tính" |
| Non-collab (`creator_order_all_*.xlsx`) | 1 | C[3]: "Tên sản phẩm" | [26]: "Thanh toán hoa hồng Quảng cáo cửa hàng ước tính" |

### 2.5 Format quirk
- Creator + Affiliate Partner xlsx: **inline-string** (cell có `<c t="str"><v>...</v></c>`), `<dimension ref="A1">` (bug: chỉ ghi cell đầu) → ExcelJS xác định 0 worksheets vì lookup dimension không thấy data
- Non-collab xlsx: **shared-strings** (`<c t="s"><v>57</v></c>` trỏ sang `sharedStrings.xml`) — ExcelJS đọc OK

## 3. TO-BE 요구사항

### 3.1 AS-IS → TO-BE Mapping

| Area | AS-IS | TO-BE |
|------|-------|-------|
| Upload UI | 1 slot Affiliate | 3 slot: Affiliate — Creator / Affiliate — Partner / Affiliate — Non-collaboration. "0/5 selected" |
| Parser | 1 (creator-aggregated, ExcelJS) | 3 (order-level) + 1 chung xlsx reader (fflate-based, handle inline-string + shared-strings) |
| Data shape | 1 number total | Map<productName, cost> per file → merged |
| Pipeline | NMV allocation | Lookup-by-name + NMV split intra-product + Others row |
| Snapshot field | `tiktok.totalAffiliateCommission` (number) | Giữ + thêm `tiktok.affiliateCostByProductName: Record<string, number>` |

### 3.2 New parser interface

```ts
// tiktok-affiliate-creator-parser.service.ts
export async function parseTikTokAffiliateCreator(buffer: ArrayBuffer): Promise<{
  costByProductName: Record<string, number>;  // already normalized
  totalCost: number;
  rowCount: number;
}>;

// tiktok-affiliate-partner-parser.service.ts (same signature)
// tiktok-affiliate-noncollab-parser.service.ts (same signature)
```

### 3.3 Snapshot block update

```ts
tiktok: {
  ...
  totalAffiliateCommission: number;  // = sum of merged map
  affiliateCostByProductName: Record<string, number>;  // merged 3 files, normalized name keys
}
```

### 3.4 Helper shared

```ts
// lib/xlsx-reader.util.ts  (mới, layer = server-side utility)
export function readXlsxRows(buffer: ArrayBuffer, opts?: {
  headerRowDetector?: (firstRows: string[][]) => number;  // returns row index of header
}): { headers: string[]; rows: Map<string, string>[]; };
// Handles BOTH inline-string and shared-strings formats via fflate + raw XML.
```

## 4. 갭 분석

### 4.1 변경 범위

| Area | 현재 | 변경 | 영향도 |
|------|------|------|--------|
| Upload UI step TikTok | 3 slot | 5 slot (thêm 2 affiliate slot) | **Low** (additive) |
| TikTok parsers | 1 file (tiktok-affiliate-parser) | + 3 file mới | **Medium** |
| xlsx reader util | dùng ExcelJS | Mới util cho inline-string | **Medium** (foundational) |
| ingest.actions | 1 affiliate field | 3 affiliate slots, merge map | **Medium** |
| period-snapshot.service | snapshot tiktok block | + affiliateCostByProductName | **Low** (additive) |
| snapshot-to-report TikTok block | NMV allocation | Lookup + Others (mirror Shopee FR vừa làm) | **Medium** |
| i18n | 1 label "Affiliate" | 3 labels | **Low** |
| Tests | — | + unit tests cho 3 parsers + edge cases inline-string | **Medium** |

### 4.2 File 변경 목록

| 구분 | 파일 | 신규/수정 |
|------|------|-----------|
| Backend util | `apps/web/src/lib/xlsx-reader.util.ts` | 신규 |
| Backend parser | `apps/web/src/server/services/tiktok-affiliate-creator-parser.service.ts` | 신규 |
| Backend parser | `apps/web/src/server/services/tiktok-affiliate-partner-parser.service.ts` | 신규 |
| Backend parser | `apps/web/src/server/services/tiktok-affiliate-noncollab-parser.service.ts` | 신규 |
| Backend parser | `apps/web/src/server/services/tiktok-affiliate-parser.service.ts` | 수정 (mark `@deprecated`) |
| Backend service | `apps/web/src/server/services/tiktok-metrics-calculator.service.ts` | 수정 (add affiliateCostByProductName merge) |
| Backend service | `apps/web/src/server/services/period-snapshot.service.ts` | 수정 (add field to tiktok block) |
| Backend action | `apps/web/src/server/actions/ingest.actions.ts` | 수정 (accept 3 file slots, merge maps) |
| Frontend | `apps/web/src/components/upload/UploadReportsClient.tsx` | 수정 (split affiliate slot → 3) |
| Frontend | `apps/web/src/lib/snapshot-to-report.ts` | 수정 (TikTok block: lookup + Others) |
| i18n | `apps/web/messages/en.json` + `ko.json` | 수정 |
| Skill | `.claude/skills/cm-calculator/SKILL.md` | 수정 (mô tả flow mới) |
| Docs | `docs/plan/PLAN-…`, `docs/test/TC-…` | 신규 |

### 4.3 Backward compat

- Snapshot cũ trước feature này: thiếu `affiliateCostByProductName` → fallback `{}` → tất cả affComm rớt vào Others row (= 0 vì map rỗng). `totalAffiliateCommission` cũ vẫn được giữ là legacy field cho hiển thị tham khảo. **No data loss; report just shows 0 affiliate.** Để hiện thực affiliate cho period cũ, Admin phải re-ingest với 3 file mới.

## 5. 사용자 플로우

### 5.1 Upload (Operator)

```
Operator
  └─→ Upload wizard → Step "TikTok Shop"
        └─→ Slots: Sales / Traffic / Affiliate—Creator / Affiliate—Partner / Affiliate—Non-collab
              (mỗi slot optional, drag & drop, .xlsx)
        └─→ Click "Compute preview"
        └─→ Server parse từng file (3 parser khác nhau)
              ├─ Creator   → Map<name, U+Y>
              ├─ Partner   → Map<name, R>
              └─ Non-collab→ Map<name, [col26]>
        └─→ Merge 3 maps theo Tên sản phẩm (cộng dồn)
        └─→ Snapshot: tiktok.affiliateCostByProductName + totalAffiliateCommission
```

### 5.2 Report rendering

```
Weekly Report → reads snapshot.tiktok.affiliateCostByProductName
  └─→ For each productBreakdown row:
        affComm_perSKU = cost[productName] × (row.nmv / sum_nmv_in_product)
  └─→ Build Others row from unmatched names
  └─→ Total Affiliate Commission (TikTok) = exact, no leak
```

### 5.3 Edge cases

| Case | Behavior |
|------|----------|
| Cả 3 file đều thiếu | tiktok.totalAffiliateCommission = 0, không Others row, không error |
| 1 file empty (0 data row) | Parser trả empty map, không error |
| Header không nhận diện được (file đổi format) | Throw rõ ràng: "Cột 'Tên sản phẩm' không tìm thấy ở row 1-3" |
| Cancelled / refunded rows | **Filter ra**: bỏ `Trạng thái đơn hàng = Đã hủy` và `Đã trả hàng hoặc hoàn tiền đầy đủ = Có`. Commission ghi nhận trong file nhưng không tính vào tổng. |
| Product name không match Sales breakdown | Cộng vào Others row, exact total bảo toàn |
| File 2 có Note ở row 1 | Auto-detect header tại row 2 |

## 6. 기술 제약사항

| Mục | Ràng buộc |
|-----|-----------|
| Lib | KHÔNG add SheetJS/xlsx package. Dùng fflate (đã có) + raw XML regex. |
| Format support | Inline-string + shared-strings. Bỏ qua các định dạng khác (xlsm, ods). |
| Performance | Mỗi file ~1MB / 5K rows. Parse phải < 2s/file trên dev. |
| Memory | Đọc full file vào memory OK (NFR cũ giới hạn 100MB upload). |
| Header detect | Scan top 5 rows tìm cell chứa "Tên sản phẩm" + "Thanh toán hoa hồng" — robust với Note prefix. |
| Tên sản phẩm normalization | NFC + collapse whitespace + trim (đồng nhất Shopee). |
| Activity log | Mỗi sync ingest ghi log type `UPLOAD` với metadata gồm số file affiliate. |
| i18n | EN + KO. VI defer. |

## 7. References

- [Shopee FR vừa làm](docs/analysis/) — pattern Others row, lookup theo Tên sản phẩm
- [cm-calculator skill](.claude/skills/cm-calculator/SKILL.md) — sẽ cần update
- Sample files đã inspect: `affiliate_orders_*0449.xlsx`, `affiliate_orders_*6833.xlsx`, `creator_order_all_*.xlsx`
