---
title: PLAN — TikTok Affiliate 3 files
description: Kế hoạch triển khai cho REQ-20260528-tiktok-affiliate-3-files
load-when: Khi implement TikTok affiliate 3-file feature; tra Phase + side-impact trước khi sửa parser hoặc upload UI.
status: ready
---

# PLAN-20260528 — TikTok Affiliate 3 files

## 1. 시스템 개발 현황 분석

### 1.1 Files liên quan

```
apps/app-sales-report-v2/
├── apps/web/src/
│   ├── lib/
│   │   ├── xlsx-reader.util.ts                   ← NEW (fflate + inline/shared strings)
│   │   └── snapshot-to-report.ts                 ← MODIFY (TikTok block)
│   ├── server/services/
│   │   ├── tiktok-affiliate-parser.service.ts    ← MODIFY (deprecate)
│   │   ├── tiktok-affiliate-creator-parser.service.ts     ← NEW
│   │   ├── tiktok-affiliate-partner-parser.service.ts     ← NEW
│   │   ├── tiktok-affiliate-noncollab-parser.service.ts   ← NEW
│   │   ├── tiktok-metrics-calculator.service.ts  ← MODIFY (accept 3 maps)
│   │   └── period-snapshot.service.ts            ← MODIFY (add field)
│   ├── server/actions/
│   │   └── ingest.actions.ts                     ← MODIFY (3 slots + merge)
│   ├── components/upload/
│   │   └── UploadReportsClient.tsx               ← MODIFY (split slot)
│   └── messages/{en,ko}.json                     ← MODIFY (labels)
└── .claude/skills/cm-calculator/SKILL.md          ← MODIFY (doc flow)
```

### 1.2 제약사항
- KHÔNG add SheetJS/xlsx dependency → tự parse XML
- ExcelJS tiếp tục dùng cho file shared-strings (NonCollab) nhưng KHÔNG đảm bảo (vì cũng có thể fail) → safest: tự đọc XML cả 3
- Pattern fflate đã có sẵn (qua `fflate` package + `xlsx-grid.util.ts`)

## 2. 단계별 구현 계획

### Phase 1 — Tái sử dụng `xlsx-grid.util.ts` (foundational)

**Đã có sẵn**: [server/services/xlsx-grid.util.ts](apps/app-sales-report-v2/apps/web/src/server/services/xlsx-grid.util.ts) có:
- `readXlsxGrid` (fflate + inline-string + shared-strings — đã verify support TikTok format)
- `findHeaderRowByLabels(grid, labels, minMatch)` — robust khi Note prefix
- `resolveHeaderColumns(row, headerMap)` — handle alias
- `cellText / cellNumber` helpers

| Step | Action |
|------|--------|
| 1.1 | Verify `readXlsxGrid` đọc được file Creator + Partner (inline-string). | Test script |
| 1.2 | (Không tạo file mới — dùng util sẵn có) |
└─ **사이드 임팩트**: Util đang được Shopee parser dùng. Không sửa, chỉ thêm consumer mới.

### Phase 2 — 3 TikTok affiliate parsers

| Step | Action | File |
|------|--------|------|
| 2.1 | `tiktok-affiliate-creator-parser.service.ts`: parse, find cols (Tên sản phẩm, Thanh toán hoa hồng tiêu chuẩn ước tính, Thanh toán hoa hồng Quảng cáo cửa hàng ước tính), per row sum 2 cols, group by name. Return `{ costByProductName, totalCost, rowCount }`. | NEW |
| 2.2 | `tiktok-affiliate-partner-parser.service.ts`: same shape, header row = 2 (auto), single column `Thanh toán hoa hồng Quảng cáo cửa hàng ước tính`. | NEW |
| 2.3 | `tiktok-affiliate-noncollab-parser.service.ts`: same shape, single column. | NEW |
| 2.4 | Mỗi parser dùng `readXlsxRows` + `findHeaderRow`. Validate required cols, throw typed error `TikTokAffiliateParseError('MISSING_COLUMN' \| 'NO_HEADER' \| 'EMPTY_FILE' \| 'READ_FAILED')`. | (same) |
| 2.5 | **Xóa** `tiktok-affiliate-parser.service.ts` sau khi rewire ingest (cùng commit). | DELETE |
| 2.6 | Filter rule chung trong mỗi parser: skip row nếu `Trạng thái đơn hàng = "Đã hủy"` OR `Đã trả hàng hoặc hoàn tiền đầy đủ = "Có"`. | (parser logic) |
└─ **사이드 임팩트**: 3 file parser độc lập, có thể test riêng. Side-effect = chỉ pipeline TikTok ingest.

### Phase 3 — Calculator + Snapshot

| Step | Action | File |
|------|--------|------|
| 3.1 | `tiktok-metrics-calculator.service.ts`: extend `TikTokMetricsResult` interface với `affiliateCostByProductName: Record<string, number>`. Accept 3 maps as optional input → merge: `merged[name] = (creator[name] ?? 0) + (partner[name] ?? 0) + (nonCollab[name] ?? 0)`. Compute `totalAffiliateCommission = sum(merged)`. | MODIFY |
| 3.2 | `period-snapshot.service.ts`: extend `tiktok` block với `affiliateCostByProductName: Record<string, number>`. | MODIFY |
└─ **사이드 임팩트**: Type change + serialize change. Snapshot cũ thiếu field → handle với `?? {}` ở consumer. Drizzle JSON column → nested object thêm key OK, không break SQL.

### Phase 4 — Server Action ingest

| Step | Action | File |
|------|--------|------|
| 4.1 | `ingest.actions.ts` Zod schema: thêm 3 fields `tiktok_affiliate_creator?`, `tiktok_affiliate_partner?`, `tiktok_affiliate_noncollab?` (all optional File). Bỏ `tiktok_affiliate` cũ (hoặc keep làm alias cho Creator backward compat 1 release). | MODIFY |
| 4.2 | Parse 3 files (Promise.all). | (same) |
| 4.3 | Pass 3 maps vào `computeTikTokMetrics` (hoặc merge before passing). | (same) |
| 4.4 | Empty snapshot defaults: `affiliateCostByProductName: {}`. | (same) |
└─ **사이드 임팩트**: API contract của action thay đổi → UI phải update cùng release để gửi đúng key. Backward compat: keep old key alias 1 release để tránh in-flight session vỡ.

### Phase 5 — Upload UI

| Step | Action | File |
|------|--------|------|
| 5.1 | `UploadReportsClient.tsx`: thêm 2 slot mới ở step TikTok Shop. Update "0/5 selected" indicator. | MODIFY |
| 5.2 | Update i18n keys: `uploadWizard.tiktok.affiliate.creator`, `.partner`, `.nonCollaboration`. | MODIFY |
| 5.3 | Drag & drop FormData key đặt đúng tên action expect. | (same) |
└─ **사이드 임팩트**: User flow tăng số click. Tooltip / mô tả mỗi slot để Operator phân biệt 3 loại file.

### Phase 6 — snapshot-to-report TikTok block

| Step | Action | File |
|------|--------|------|
| 6.1 | TikTok block trong `snapshot-to-report.ts`: replace NMV-allocation cho affComm bằng productName-lookup + intra-product NMV split (copy logic Shopee đã làm). | MODIFY |
| 6.2 | Append Others row khi có affiliate cost unmatched. | (same) |
└─ **사이드 임팩트**: TikTok per-SKU affComm thay đổi (chính xác hơn, không còn allocate dàn đều). CM per-SKU thay đổi tương ứng. Total CM TikTok có thể thay đổi nhỏ.

### Phase 7 — Docs + Skill update

| Step | Action |
|------|--------|
| 7.1 | Update `cm-calculator/SKILL.md` §4 — TikTok per-SKU affComm: replace "từ NMV contribution" bằng "lookup theo Tên sản phẩm + intra-product NMV split + Others" |
| 7.2 | Write TR + RPT sau implement |

## 3. 변경 파일 목록 (recap)

| 구분 | 파일 | 변경 | LOC |
|------|------|------|-----|
| Util | `lib/xlsx-reader.util.ts` | 신규 | ~200 |
| Parser | `tiktok-affiliate-creator-parser.service.ts` | 신규 | ~90 |
| Parser | `tiktok-affiliate-partner-parser.service.ts` | 신규 | ~80 |
| Parser | `tiktok-affiliate-noncollab-parser.service.ts` | 신규 | ~80 |
| Parser | `tiktok-affiliate-parser.service.ts` | 수정 (deprecate) | +2 |
| Calc | `tiktok-metrics-calculator.service.ts` | 수정 | +20 |
| Snapshot | `period-snapshot.service.ts` | 수정 | +3 |
| Action | `ingest.actions.ts` | 수정 | +40 |
| UI | `UploadReportsClient.tsx` | 수정 | +40 |
| Report | `snapshot-to-report.ts` | 수정 | +50 |
| i18n | `messages/en.json`, `ko.json` | 수정 | +12 |
| Skill | `.claude/skills/cm-calculator/SKILL.md` | 수정 | +5 |

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 |
|------|--------|------|
| Old `tiktok-affiliate-parser.service.ts` consumers | **Low** | Mark deprecated; chỉ ingest.actions.ts dùng → cùng PR sẽ rewire |
| TikTok CM per-SKU values | **Medium** | Sau change, per-SKU affComm chính xác hơn nhưng khác cũ. Cần TC verify. CM total cũng thay đổi nhẹ. |
| Snapshot schema | **Low** | Field additive, default `{}` an toàn |
| Upload UI flow | **Low** | Thêm 2 slot, Operator phải biết phân biệt → cần label rõ |
| Performance | **Low** | 3 file thay 1 → parse song song, < 2s/file |
| ExcelJS dep | **Zero** | Vẫn dùng cho parser cũ + Shopee. Không remove. |

## 5. DB Migration

**Không cần migration mới**. `sal_period_snapshots.psp_metrics_json` JSONB — chỉ thêm key vào nested object Drizzle. Existing rows không có key sẽ trả `undefined` → consumer handle.

## 6. Rollback plan

| Phase | Rollback |
|-------|----------|
| 1 (util) | Delete file; 3 parser fallback ExcelJS hoặc throw |
| 2 (parsers) | Delete 3 file mới; ingest action revert dùng old parser |
| 3 (calc + snapshot) | Revert type change |
| 4 (action) | Revert FormData keys |
| 5 (UI) | Revert 2 slot — chỉ giữ 1 |
| 6 (report) | Revert TikTok block snapshot-to-report |

Full rollback = revert toàn bộ commit (target: tách 2 commit per Phase 1+2 và Phase 3-6 cho dễ rollback từng phần).

## 7. Estimated effort

- Phase 1 (util): 1.5h (incl. regex XML edge cases)
- Phase 2 (3 parsers): 1.5h
- Phase 3 (calc + snapshot): 30 min
- Phase 4 (action): 30 min
- Phase 5 (UI): 1h
- Phase 6 (report logic): 30 min
- Phase 7 (skill doc + verify): 30 min

**Tổng: ~6h** (bao gồm typecheck + manual test).
