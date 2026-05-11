# Consistency Check — All docs aligned, ready for technical implementation

> Audit ngày 2026-05-11. Scan 25 markdown files + 14 CSV resources + prototype HTML.
> Mục đích: đảm bảo SRD ↔ REQ ↔ DATA-MODEL ↔ Skills ↔ Memory không mâu thuẫn trước khi viết technical doc.

## 1. Issues found & resolved

### 🚨 #1 — FX rate notation error (1000x)

| File | Trước | Sau |
|---|---|---|
| CLAUDE.md | `17,543 VND/KRW`, `KRW = VND / 17543` | `17.543 VND/KRW`, `KRW = VND / 17.543` |
| DATA-MODEL.md `sal_fx_rates` | `DECIMAL(18,4)` default `17,543` | `DECIMAL(10,4)` default `17.5430` |
| ARCH-overview.md | `17,543` | `17.543` |
| REQ-20260511 | `17,543` × 3 occurrences | `17.543` |
| cm-calculator SKILL | `vndPerKrw = 17543` | `vndPerKrw = 17.543` |
| open-fx-rate.md | `17,543` × 4 | `17.543` |

**Root cause**: SRD client gửi ghi `17543` không có decimal — đây là VN locale (dấu `.` cho thousand separator). Khi quote thành `17,543` (US/EN style với dấu `,` thousand) → 1000x error.

**Verification**: Math từ `resources/FINAL REPORT.csv`:
```
Net GMV (VND)         Net GMV (KRW)        Ratio
1,682,035,200    ÷    95,876,006     =     17.544 VND/KRW
1,176,630,200    ÷    67,067,921     =     17.544 (Shopee)
```
Confirmed rate **~17.5 VND per KRW**, not 17,543.

### 🚨 #2 — Free Gift detection rule

| File | Trước | Sau |
|---|---|---|
| cm-calculator SKILL | Shopee: `nmv === 0`; TikTok: `[GIFT]` prefix + complex | **Cả 2**: `productName.startsWith('[GIFT]')` primary, fallback NMV=0 / NetGMV=0 |
| REQ §3.6 | Shopee `NMV=0` only | **Cả 2** dùng `[GIFT]` prefix |

**Root cause**: SRD viết khác nhau cho 2 platform. Real data (`FINAL REPORT.csv` row 56 Shopee + 102/103 TikTok) chứng minh **cả 2 đều dùng `[GIFT]` prefix làm signal**.

### 🚨 #3 — Raw tables count chưa nhất quán

| File | Trước | Sau |
|---|---|---|
| CLAUDE.md | "9 raw tables", "9 parsers" | "11 sub-section tables (9 actively parsed)", "Section splitter + 9 active sub-parsers" |
| REQ R1 | "Upload + parse 9 raw report types (Shopee 6 + TikTok 3)" | "Upload 2 consolidated CSV (Shopee 6 sections + TikTok 5 sections); parse 9 active" |
| REQ Module diagram | `shopee/← 6 parsers`, `tiktok/← 3 parsers` | thêm `section-splitter/`, `tiktok/← 3 active (skip ADS + Platform Fee per Q-B)` |
| ARCH-overview module list | same | same fix |

**Clarification**: Reality has **11 sections** (Shopee 6 + TikTok 5), but **9 actively parsed** (Q-B: skip TT ADS + Platform Fee, dùng manual input giữ SRD).

### 🚨 #4 — Allocation logic chưa update với 2-cấp

| File | Trước | Sau |
|---|---|---|
| cm-calculator SKILL §6 | Single function `allocateByNmv` | 2 functions: `allocateByGmv` (cấp 1 cross-platform) + `allocateByNmv` (cấp 2 intra-platform) + bảng áp dụng per metric |

**Root cause**: Real data `BOOKING FEE.csv` chứng minh cross-platform allocation theo GMV (Shopee 73.32% / TikTok 26.68%), không phải NMV. Update memory `allocation-hierarchy.md` đã đúng nhưng skill chưa được sync.

### ⚠️ #5 — Outdated "open questions" markers

| File | Trước | Sau |
|---|---|---|
| ARCH-overview §6 | `[ ] Sample raw CSV chưa có` + 4 open issues | `[x]` ✅ Sample đã có (resources/), OI-001~004 đã resolved |
| REQ §7 Next steps | `⏳ Sample CSV cần Truc Hoang`, `⏳ Update DATA-MODEL` | `✅` đã có / đã update |

## 2. Prototype HTML — không thể verify từ CLI

`FIRGI Sales Ops _standalone_.html` (2.2MB):
- Line 170: 2.2MB gzip+base64 encoded asset bundle (`{"...":{"mime":"text/javascript","compressed":true,"data":"H4sIAAA..."}}`)
- Line 178: 68KB inline HTML wrapper với escape JS strings
- Grep keyword search trả về 0 match (strings minified/encoded)

**Implication**: KHÔNG thể auto-verify prototype UI khớp với REQ pages từ CLI.

**Recommendation**:
1. Bạn mở prototype trong browser local (`file:///c:/Github/ambAppStore/apps/app-sales-report-v2/FIRGI Sales Ops _standalone_.html`)
2. Screenshot từng page chính
3. Verify checklist (xem §3 dưới)

## 3. Prototype verification checklist (visual)

Khi mở prototype trong browser, confirm có các page sau (theo [ARCH-overview §4](../architecture/ARCH-overview.md)):

### Sidebar navigation
- [ ] Dashboard
- [ ] Upload (1 page với 2 file input slot + date range)
- [ ] Manual Input (5 main + 7 TikTok platform subitems + FX rate)
- [ ] Cost Master → Prime Cost
- [ ] Cost Master → COGS (Phase 2 — có thể chưa có)
- [ ] Reports → Weekly
- [ ] Reports → Monthly (Phase 2)
- [ ] Reports → Trending (Phase 2, 4 tabs)
- [ ] Activity Log → Login / Action / Download (3 sub-pages)
- [ ] Admin → User Management
- [ ] Admin → Formula Configuration (Phase 2)
- [ ] Settings

### Weekly Report page structure (FR-08)
- [ ] Period filter (week selector top)
- [ ] Overview Performance card (Net GMV / Discount / Promo / Prime Cost / Platform Fee / CM) — VND + KRW columns
- [ ] Side metrics: Item Sold / Orders / AOV / AD ROAS / AD GMV / Page View / Conversion
- [ ] Discount Costs breakdown (Seller Voucher / Seller Discount / Free Gift / **Total Platform Discount Rfr**)
- [ ] Promotional Costs breakdown (AD Spend / Brand Ads / Off-Platform Ads / Affiliate Commission / Affiliate Booking Fee / Livestream)
- [ ] Product breakdown table (per SKU rows)
- [ ] Export button (Excel + CSV)
- [ ] WoW % change indicators (▲ green / ▼ red / `----` first / `N/A` zero)

### Color legend (prototype phải có)
- 🔵 Blue: sourced from original report
- 🟠 Orange: calculated
- 🟢 Green: manual input

### Trending Report (FR-15~18) — Phase 2
- [ ] 4 tabs: Shopee WoW / TikTok WoW / Shopee MoM / TikTok MoM
- [ ] Metrics table (weeks/months as columns)
- [ ] Bar chart Net GMV by period
- [ ] Line chart CM by period
- [ ] Date range selector (4w / 13w / custom)
- [ ] Export với chart embedded

## 4. Cross-check matrix — facts must be identical

Bảng dưới đây liệt kê các "fact" critical và file nào chứa. Sau fix, tất cả 1 giá trị duy nhất.

| Fact | Value (sau fix) | Files chứa |
|---|---|---|
| FX rate default | `17.543 VND per 1 KRW` | CLAUDE.md, DATA-MODEL.md, ARCH-overview.md, REQ, cm-calculator skill, open-fx-rate memory |
| Free Gift signal | `productName.startsWith('[GIFT]')` (primary), NMV=0 / NetGMV=0 (fallback) | cm-calculator skill, REQ §3.6 |
| Raw section count | 11 detected, **9 actively parsed** (Shopee 6 + TikTok 3; skip TT ADS + Platform Fee) | CLAUDE.md, REQ R1+§3.2, ARCH-overview, excel-parser skill |
| Upload UX | 2 file input slot (Shopee consolidated + TikTok consolidated) | final-decisions Q-A, REQ §4.4, ARCH-overview |
| Allocation hierarchy | Cấp 1: GMV cross-platform; Cấp 2: NMV intra-platform | allocation-hierarchy memory, cm-calculator §6, REQ §3.6 |
| Role names | Operator / Manager / Admin | SRD §2.3, REQ §3.4, CLAUDE.md §4.6 |
| AMA role mapping | OWNER+MASTER → ADMIN; MANAGER → MANAGER; MEMBER → OPERATOR | CLAUDE.md §4.6, REQ §3.4 |
| Number of FRs | 23 | SRD §3 (FR-01~23), REQ §1 |
| Number of NFRs | 15 | SRD §4 (NFR-01~15), REQ §1 |
| Number of formula params | 48 across 7 groups | SRD §6, formula-config-approach memory |
| Activity log retention | Indefinite (no archive cron) | final-decisions Q-F, MEMORY.md |
| User account model | Pure AMA passthrough | final-decisions Q-E, INTEGRATION-amb |
| OI-001 | Overwrite (archive cũ vào S3) | oi-resolutions, REQ §4.3 |
| OI-002 | Hybrid: auto on download + Admin unfinalize | oi-resolutions, REQ §4.3 |
| Currency precision | VND `DECIMAL(15,2)`, KRW display computed | DATA-MODEL, cm-calculator |
| Error code prefix | `SAL-E{4}` | CLAUDE.md §4.4 |

## 5. Out-of-scope sanity check (giữ MVP gọn)

✅ Phase 1 MVP (≤6 tuần):
- FR-01,02,03,04,05,07,08,09,10 (9/23 FRs)
- Auth AMA passthrough
- 3 activity logs

❌ NOT in MVP (Phase 2+):
- FR-06 COGS riêng (chỉ Prime Cost trong MVP)
- FR-11~14 Monthly Report
- FR-15~18 Trending Reports (4 views)
- FR-22 User Management UI (passthrough only, no CRUD)
- FR-23 Formula Configuration UI (hard-code formula vào code)
- TikTok ADS + Platform Fee section parsing

Tất cả deferred features có schema `sal_formula_configs`, `sal_cogs`, `sal_reports.rep_type` enum đã prep sẵn → no DB migration cần Phase 2.

## 6. Memory files audit — đầy đủ và không trùng

| Memory file | Status | Purpose |
|---|---|---|
| client-context.md | ✅ | Socialbean / Truc Hoang / FIRGI |
| tech-stack.md | ✅ | Turbo + Next.js + Neon + Drizzle + S3 |
| workspace-mode.md | ✅ | Standalone Turborepo |
| orm-choice.md | ✅ | Drizzle |
| formula-config-approach.md | ✅ | 48 params DB-driven |
| file-structure-reality.md | ✅ | Consolidated CSV |
| allocation-hierarchy.md | ✅ | GMV + NMV 2-cấp |
| oi-resolutions.md | ✅ | OI-001 + OI-002 |
| final-decisions.md | ⭐ | All 6 Q-A~Q-F |
| open-fx-rate.md | ✅ | 17.543 (resolved + verified) |
| open-data-migration.md | OPEN | Phase 2 |
| open-hosting.md | OPEN | Pre-launch |
| MEMORY.md | ✅ | Index |

## 7. Tài liệu kỹ thuật đã sẵn sàng được viết

Sau khi sync xong (tất cả issues §1 đã fix), các technical doc sau có thể start ngay:

1. **PLAN-20260511** — work breakdown 4 phases × 1-2 sprints each
2. **API-SPEC** — REST/Server Action endpoints theo `/api/v1/*`
3. **UI-SPEC** — sau khi xem prototype browser
4. **TEST-PLAN** — TC từng FR

## 8. Recommended next action

1. **(bạn)** Mở [prototype HTML](../../FIRGI%20Sales%20Ops%20_standalone_.html) trong browser, kiểm tra checklist §3 → screenshot bất kỳ page nào KHÔNG khớp REQ
2. **(mình)** Sau khi xác nhận prototype match: viết PLAN-20260511 (work breakdown) + API-SPEC dựa trên DATA-MODEL
3. **(mình)** Scaffold Next.js + Drizzle theo PLAN
