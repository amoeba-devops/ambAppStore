---
title: TC — TikTok Affiliate 3 files
description: Test cases cho REQ-20260528-tiktok-affiliate-3-files. Mỗi case map về FR/NFR và Phase trong PLAN.
load-when: Sau khi implement; verify trước khi viết TR.
status: ready
---

# TC-20260528 — TikTok Affiliate 3 files

## 1. xlsx-reader util (Phase 1)

| TC | Mục tiêu | Steps | Expected | FR/NFR |
|----|----------|-------|----------|--------|
| TC-01 | Đọc inline-string xlsx (Creator file mẫu) | `readXlsxRows(buf)` với file `affiliate_orders_*0449.xlsx` | Headers = 33 cols bắt đầu "ID đơn hàng", data rows > 0, không throw | NFR-01 |
| TC-02 | Đọc shared-strings xlsx (NonCollab file mẫu) | `readXlsxRows(buf)` với file `creator_order_all_*.xlsx` | Headers = 39 cols, "Tên sản phẩm" tại index 2 (zero-based) | NFR-01 |
| TC-03 | Auto-detect header row khi Note ở row 1 | `findHeaderRow(rows, ['ID đơn hàng', 'Tên sản phẩm'], 5)` với file Partner | Return index 1 (row 2) | NFR-02 |
| TC-04 | Empty xlsx (chỉ header, không data) | `readXlsxRows` | `rows.length === 0`, không throw | FR-08 |
| TC-05 | Header thiếu cột bắt buộc | call parser | Throw `MISSING_COLUMN` với rõ tên cột | NFR-02 |
| TC-06 | File không phải xlsx (jpg, csv) | call util | Throw `READ_FAILED` | — |

## 2. Creator parser (Phase 2)

| TC | Mục tiêu | Expected | FR |
|----|----------|----------|-----|
| TC-10 | Parse file mẫu Creator → `costByProductName` đúng | Mỗi product name unique trong file → key của map. Value = SUM(col U + col Y) across rows. | FR-02 |
| TC-11 | 1 product, 3 rows → 1 entry map | Value = SUM(3 rows) | FR-02 |
| TC-12 | Cell U hoặc Y rỗng/dash → coi như 0 | Không throw, không NaN | FR-02 |
| TC-13 | "Tên sản phẩm" có double-space hoặc trailing whitespace | Key normalized → same group | NFR-02 |
| TC-14 | Cancelled order (cột "Trạng thái đơn hàng" = "Đã hủy") **bị filter** | Per-row affComm = 0 effective. Total không gồm. | NFR-05 |
| TC-14b | Refunded order (cột "Đã trả hàng hoặc hoàn tiền đầy đủ" = "Có") bị filter | Per-row affComm = 0 effective. Total không gồm. | NFR-05 |
| TC-15 | `totalCost = SUM(values của map) = SUM(col U + col Y across all rows)` | Exact, không leak | FR-06 |

## 3. Affiliate Partner parser (Phase 2)

| TC | Mục tiêu | Expected | FR |
|----|----------|----------|-----|
| TC-20 | Parse file mẫu Partner | Headers ở row 2 (skip Note row 1). Group by "Tên sản phẩm". | FR-03, NFR-02 |
| TC-21 | Lấy đúng cột R = "Thanh toán hoa hồng Quảng cáo cửa hàng ước tính" | Total = SUM(col R across all rows) | FR-03 |
| TC-22 | File không có Note (header ở row 1) | Auto-detect vẫn OK | NFR-02 |

## 4. Non-collab parser (Phase 2)

| TC | Mục tiêu | Expected | FR |
|----|----------|----------|-----|
| TC-30 | Parse file mẫu NonCollab | Headers ở row 1. Group by "Tên sản phẩm" (col C[3]). | FR-04 |
| TC-31 | Lấy đúng col [26] = "Thanh toán hoa hồng Quảng cáo cửa hàng ước tính" | Total = SUM(col [26]) | FR-04 |
| TC-32 | File này có cả cột [22] (Thanh toán hoa hồng tiêu chuẩn) — KHÔNG được dùng | Per-row affComm = chỉ col [26], không cộng [22] | FR-04 |

## 5. Pipeline merge (Phase 3-4)

| TC | Mục tiêu | Steps | Expected | FR |
|----|----------|-------|----------|-----|
| TC-40 | Upload đủ 3 file → merge map | Pre-prepare 3 file fixture; gọi `syncAmaMembersBulk`-style merge | `affiliateCostByProductName[name] = creator[name] + partner[name] + nonCollab[name]` cho mỗi name | FR-05 |
| TC-41 | Upload chỉ Creator | Map = chỉ Creator entries; Partner/NonCollab = 0 | FR-08 |
| TC-42 | Upload chỉ Partner | Map = chỉ Partner entries | FR-08 |
| TC-43 | Upload zero affiliate file | Map = `{}`, `totalAffiliateCommission = 0` | FR-08 |
| TC-44 | Same product name xuất hiện ở 2 file → cộng dồn | `merged[name] = creator + partner` chính xác | FR-05 |
| TC-45 | Total = SUM(merged map) = SUM(all per-row affComm across 3 files) | Exact, không leak qua merge | FR-06 |

## 6. snapshot-to-report TikTok (Phase 6)

| TC | Mục tiêu | Steps | Expected | FR |
|----|----------|-------|----------|-----|
| TC-50 | Per-SKU affComm = `affCost[name] × (sku.nmv / sum_nmv_of_same_name)` | Manual compute với fixture; compare report row | Match | FR-07 |
| TC-51 | Product có 1 SKU duy nhất → 100% affCost vào SKU đó | TikTok product "Mặc định" variation | row.affComm = affCost[name] | FR-07 |
| TC-52 | Product có 3 variations cùng tên + 3 NMV khác → split theo NMV | Verify sum 3 rows = affCost[name] | FR-07 |
| TC-53 | Product trong affiliate file mà KHÔNG có trong Sales breakdown → Others row | UI hiển thị "Others" row với `isOthers: true`, affComm = orphan cost. | FR-07 |
| TC-54 | Total affComm hiển thị ở Promotional Breakdown = SUM(per-SKU rows) + Others | Exact, không leak | FR-06 |
| TC-55 | Sample data: GIFT_KHANUOT_00022026 ([GIFT] Khăn Ướt) → coi như gift, có affComm? | Gift rows hiện được EXCLUDE khỏi NMV split → cost rớt vào Others. Verify behavior. | Edge |
| TC-56 | Snapshot cũ (trước feature) không có `affiliateCostByProductName` → report TikTok block | All affComm = 0 (hoặc fallback). Không crash. | NFR-03 |

## 7. Upload UI (Phase 5)

| TC | Mục tiêu | Expected | FR |
|----|----------|----------|-----|
| TC-60 | Step TikTok Shop hiển thị 5 slot | Sales / Traffic / Affiliate—Creator / Affiliate—Partner / Affiliate—Non-collab. Counter "0/5 selected". | FR-01 |
| TC-61 | Upload 1 file vào 1 slot → counter = "1/5 selected" | UI update | FR-01 |
| TC-62 | Drag & drop file sai format (.txt) | Toast lỗi "Only .xlsx supported" | — |
| TC-63 | Locale ko + en | Slot labels Korean / English | FR-09 |
| TC-64 | Mobile responsive | 5 slot wrap đúng, không overflow | — |

## 8. Backward compat (Phase 3)

| TC | Mục tiêu | Expected |
|----|----------|----------|
| TC-70 | Load report cho period đã ingest TRƯỚC feature này (snapshot.tiktok thiếu field) | Không crash; per-SKU affComm = 0; Others row không xuất hiện. | NFR-03 |
| TC-71 | Re-ingest period cũ với 3 file mới | Snapshot upsert thành công; report hiển thị đúng theo data mới. | NFR-03 |

## 9. Performance + Errors

| TC | Mục tiêu | Expected |
|----|----------|----------|
| TC-80 | Parse 3 file ~1MB / 5K rows tổng | < 6s end-to-end (3 file × 2s) |
| TC-81 | File 100MB (NFR cũ) | Vẫn parse, không OOM |
| TC-82 | Bad zip / corrupted xlsx | Throw `READ_FAILED` rõ ràng |
| TC-83 | Header có double-byte vô hình (zero-width space) | Normalized match vẫn OK |

## 10. Pass criteria

- [ ] Tất cả TC-01 → TC-06 (util) PASS
- [ ] TC-10 → TC-15 (Creator parser) PASS
- [ ] TC-20 → TC-22 (Partner) PASS
- [ ] TC-30 → TC-32 (NonCollab) PASS
- [ ] TC-40 → TC-45 (merge) PASS
- [ ] TC-50 → TC-56 (report) PASS — đặc biệt TC-54 (exact total)
- [ ] TC-60 → TC-64 (UI) PASS
- [ ] TC-70 + TC-71 (backward compat) PASS
- [ ] typecheck clean
- [ ] Manual test với 3 sample file → report số khớp tay đếm

## Fixtures cần

- `__fixtures__/tiktok-affiliate-creator-sample.xlsx` (copy file mẫu user gửi)
- `__fixtures__/tiktok-affiliate-partner-sample.xlsx`
- `__fixtures__/tiktok-affiliate-noncollab-sample.xlsx`
- (Optional) `__fixtures__/tiktok-affiliate-empty.xlsx` — empty data rows
