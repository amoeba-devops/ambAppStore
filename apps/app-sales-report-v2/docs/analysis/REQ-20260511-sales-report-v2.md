# REQ-20260511 — Sales Report v2 (FIRGI / Socialbean) Requirements Analysis

> **Source of truth**: [SRD-20260506-FIRGI-SalesReport-v2.md](SRD-20260506-FIRGI-SalesReport-v2.md) — client spec v2.0 from Truc Hoang (Socialbean Vietnam, 2026-05-06).
> **Real data findings** (must-read): [REAL-DATA-FINDINGS-20260511.md](REAL-DATA-FINDINGS-20260511.md) — phân tích 14 file CSV client cung cấp; có nhiều discrepancy so với SRD.
> **Cross-ref**: [PRD.md](../../PRD.md) (earlier draft, superseded), [v1 codebase](../../../app-sales-report/), [Prototype FIRGI](../../FIRGI%20Sales%20Ops%20_standalone_.html).

## 1. Tóm tắt yêu cầu

| # | Yêu cầu | FR / NFR | Ưu tiên |
|---|---|---|---|
| R1 | Upload 2 consolidated CSV (Shopee 6 sections + TikTok 5 sections); parse 9 active (skip TT ADS + Platform Fee per Q-B) | FR-02, FR-03 | P0 |
| R2 | Manual cost input (5 items + 7 TikTok platform fee subitems + FX rate) | FR-04 | P0 |
| R3 | Prime Cost master, versioned, không retro thay đổi report cũ | FR-05, NFR-08 | P0 |
| R4 | COGS master với "date update" lookup logic | FR-06 | P0 |
| R5 | Weekly Report (Summary + Product Breakdown + Export) | FR-07~10 | P0 |
| R6 | Monthly Report (Summary + Product Breakdown + Export) | FR-11~14 | P0 |
| R7 | Trending Reports — 4 views (Shopee/TikTok × WoW/MoM) | FR-15~18 | P0 |
| R8 | Activity Logs — Login + Action + Download (immutable) | FR-19~21, NFR-13 | P0 |
| R9 | User Management (Admin) | FR-22 | P0 |
| R10 | Formula Configuration (48 parameters, Admin UI) | FR-23, NFR-07 | P0 |
| R11 | Role-based access (Operator / Manager / Admin) | NFR-10 | P0 |
| R12 | Original raw file preserved unmodified | NFR-06 | P0 |
| R13 | Audit log immutable kể cả cho Admin | NFR-13 | P0 |
| R14 | Historical report regeneration từ raw data | NFR-09 | P0 |
| R15 | Multi-tenancy (`ent_id` từ AMA) | — | P0 |
| R16 | JWT SSO Passthrough từ AMA | — | P0 |
| R17 | KRW conversion với rate 17.543 default | §5.5 | P0 |
| R18 | Order exclusion rules (cancelled/return/freegift) | §5.6 | P0 |
| R19 | Browser support (Chrome, Edge, Firefox) | NFR-15 | P0 |
| R20 | i18n ko/en/vi (theo AMA convention) | — | P1 |

## 2. AS-IS — Phân tích nghiệp vụ hiện tại

### 2.1 Quy trình thủ công (6 bước)
Client (Socialbean) hiện làm thủ công 100% trên Google Sheet:
1. Download raw CSV/Excel từ Shopee + TikTok dashboard
2. Customize & recalc trong Google Sheet theo business rule riêng
3. Extract metrics chính sang report template
4. Input manual costs (Affiliate Booking, Livestream, Ads, TikTok Platform Fee components)
5. Consolidate Shopee + TikTok + manual + tính WoW/MoM
6. Format + distribute weekly/monthly

### 2.2 Risks (lý do automate)
- Data accuracy: copy thủ công sai
- Latency: tốn nhiều giờ mỗi tuần/tháng
- Auditability: không có ai đã đổi cái gì khi nào
- Scalability: thêm sàn = thêm work tay không tỷ lệ

### 2.3 V1 codebase (`apps/app-sales-report`)
NestJS + Vite + MySQL. 10 domain modules, 19 pages. **Không đủ** so với SRD v2.0:
- Thiếu các raw report types (v1 chỉ có 1 generic "raw-order", v2 cần 9 active: Shopee 6 + TikTok 3)
- Thiếu formula configuration Admin UI (48 params)
- Thiếu COGS với "date update" logic riêng
- Thiếu trending report (WoW/MoM × 4 views)
- Thiếu version control cho Prime Cost
- Activity log có nhưng chưa rõ immutable

→ V2 là rewrite, không phải refactor.

## 3. TO-BE — v2 design

### 3.1 Mapping AS-IS → TO-BE

| AS-IS (v1 / Google Sheet) | TO-BE (v2) |
|---|---|
| NestJS BE + Vite FE + MySQL | Next.js 15 fullstack + Neon Postgres + Drizzle |
| Multer sync upload | S3 presigned URL direct upload |
| Sync parse trong request | Render Background Worker + DB queue (async) |
| Hard-code cost rules trong code | Formula Configuration table (48 params) |
| 1 raw_order generic | 9 active raw_*_reports (Shopee 6 + TikTok 3); +2 placeholder cho TT ADS/Platform Fee nếu cần Phase 2 |
| Prime Cost flat | Prime Cost versioned + history |
| Auth tự build | AMA JWT passthrough (Operator/Manager/Admin map sang AMA roles) |
| Google Sheet XLOOKUP | DB JOIN qua SKU |
| Manual Excel export | Native xlsx generation với chart embed |

### 3.2 Domain modules v2

```
src/server/services/
├── auth/              ← JWT verify, role check (FR-22, NFR-10)
├── upload/            ← Upload session (FR-01), file ingest
│   ├── section-splitter/ ← detect row 1 markers → tách sections từ 1 CSV consolidated
│   ├── shopee/        ← 6 sub-parsers (FR-02): sales, ads, brand-ads, off-platform, traffic, affiliate
│   └── tiktok/        ← 3 active sub-parsers (FR-03): sales, traffic, affiliate (skip ADS + Platform Fee per Q-B)
├── manual-input/      ← FR-04: 5 cost items + 7 TikTok platform subitems + FX rate
├── cost-master/
│   ├── prime-cost/    ← FR-05, versioned
│   └── cogs/          ← FR-06, date-based lookup
├── calculation/       ← Section 5 SRD formulas
│   ├── product-level/ ← per-SKU metrics, Shopee + TikTok
│   ├── platform-level/← aggregations
│   ├── allocation/    ← NMV contribution allocation engine
│   ├── exclusion/     ← cancelled / returned / free gift rules
│   ├── currency/      ← VND ↔ KRW
│   └── trending/      ← WoW / MoM
├── report/
│   ├── weekly/        ← FR-07~10
│   ├── monthly/       ← FR-11~14
│   ├── trending/      ← FR-15~18 (4 views)
│   └── export/        ← xlsx + chart embed
├── activity-log/      ← FR-19, FR-20, FR-21
│   ├── login/
│   ├── action/
│   └── download/
├── user-management/   ← FR-22
├── formula-config/    ← FR-23, 48 params, 7 groups
└── integration/       ← AMA JWT passthrough
```

### 3.3 Page structure v2

```
/                           ← redirect /dashboard
/dashboard                  ← landing, latest week summary
/upload                     ← FR-01 + FR-02 + FR-03 (date range + 9 upload slots)
/manual-input               ← FR-04 (manual costs + FX rate)
/cost-master/prime-cost     ← FR-05
/cost-master/cogs           ← FR-06
/reports/weekly             ← FR-07~10
/reports/monthly            ← FR-11~14
/reports/trending           ← FR-15~18 (4 tabs)
/activity-log/login         ← FR-19 (Manager+, Admin full)
/activity-log/action        ← FR-20
/activity-log/download      ← FR-21
/admin/users                ← FR-22
/admin/formula-config       ← FR-23 (Admin only)
/settings                   ← profile, locale
```

### 3.4 Role permission matrix

| Page / Action | Operator | Manager | Admin |
|---|---|---|---|
| Upload files | ✅ | ❌ | ✅ |
| Manual input CRUD | ✅ | ❌ | ✅ |
| Cost Master CRUD | ✅ | ❌ | ✅ |
| FX rate edit | ✅ | ❌ | ✅ |
| View reports | ✅ | ✅ | ✅ |
| Download reports | ✅ | ✅ | ✅ |
| Activity Log read | ❌ | ✅ (read-only) | ✅ (full) |
| User Management | ❌ | ❌ | ✅ |
| Formula Configuration | ❌ | ❌ | ✅ |

**AMA role mapping** (xem [INTEGRATION-amb.md](../architecture/INTEGRATION-amb.md)):
- AMA `OWNER` / `MASTER` → app `Admin`
- AMA `MANAGER` → app `Manager`
- AMA `MEMBER` → app `Operator`

(Mapping cụ thể chốt sau với client.)

### 3.5 Data model

Xem [DATA-MODEL.md](../architecture/DATA-MODEL.md) — cần update theo SRD:
- 9 bảng `sal_raw_*_reports` thay vì 1 `sal_raw_orders` generic
- `sal_prime_costs` + `sal_prime_cost_versions` (versioned)
- `sal_cogs` + `sal_cogs_updates` (date-based)
- `sal_manual_inputs` (5 items + 7 subitems + FX rate)
- `sal_formula_configs` (48 params, history table)
- `sal_activity_logs` chia 3 loại: `login`, `action`, `download`
- `sal_upload_sessions` (FR-01 date range)

### 3.6 Business logic core (xem [.claude/skills/cm-calculator/SKILL.md](../../.claude/skills/cm-calculator/SKILL.md))

**Shopee CM formula**:
```
CM = Net GMV
   − Seller Discount − Prime Cost
   − Ad Spending − Brand Ads − Off-Platform Ads
   − Platform Fee − Seller Vouchers − Livestream Fee
   − Free Gift − Affiliate Booking − Affiliate Commission
```

**TikTok CM formula** (KHÁC: không có Brand Ads, Off-Platform Ads, Seller Vouchers):
```
CM = Net GMV
   − Seller Discount − Prime Cost
   − Ad Spending − Platform Fee − Livestream Fee
   − Free Gift − Affiliate Booking − Affiliate Commission
```

**Allocation engine** (quan trọng): nhiều chi phí ở mức tổng → phân bổ về line-level theo **NMV contribution**:
```
line_cost = total_cost × (line_NMV / total_NMV)
```

**TikTok Platform Fee** (đặc biệt):
- Weekly: `avg(rate of last 4 weeks) × Total Net GMV` (chỉ có monthly raw)
- Monthly: sum of 7 manual-input components

**Currency**:
- Default: 17.543 VND per 1 KRW (verify từ real data: `1,682,035,200 / 95,876,006 = 17.544`)
- Formula: `KRW = VND / 17.543`

**Order exclusion** (loại bỏ khỏi mọi tính toán):
- Cancelled — Shopee: `Order Status = Đã hủy`; TikTok: `Status=Đã hủy AND Substatus=Đã hủy`
- Returned — Shopee: `GMV = 0`; TikTok: `Net GMV = 0`
- Free Gift — **Cả 2 platform**: `productName.startsWith('[GIFT]')` (primary signal — verified từ FINAL REPORT.csv). Fallback nếu thiếu prefix: Shopee `NMV=0`, TikTok `Net GMV=0 AND Normal`. Treatment: exclude revenue, ADD Prime Cost vào Total Free Gift (sau đó allocate về SKU non-gift theo NMV contribution).

## 4. Gap Analysis

### 4.1 Phạm vi thay đổi vs v1

| Khu vực | v1 | v2 (SRD) | Tác động |
|---|---|---|---|
| Raw types | 1 generic | 9 active (6 SP + 3 TT) + section splitter | High — section splitter + 9 sub-parsers |
| Cost master | Flat | Versioned + COGS update date | Medium |
| Manual input | Không rõ | 5 items + 7 TT subitems + FX | Medium |
| Formula config | Hard-code | 48 params Admin UI | **High** |
| Reports | Daily/Weekly/Monthly | Weekly/Monthly/Trending (4 views) | Medium |
| Activity Log | Có (1 type?) | 3 loại immutable | Medium |
| Allocation engine | Không có | NMV-based phân bổ line-level | High |
| Order exclusion | Không có | 6 rule cụ thể | Medium |
| User Management | Có | Admin-only UI | Low |
| KRW rate | 0.057 hard-code | 17.543 configurable | Low |
| Roles | Không rõ | Operator/Manager/Admin | Medium |

### 4.2 NFR ràng buộc

| NFR | Implication kỹ thuật |
|---|---|
| NFR-04: parse 10MB CSV < 5s | Stream parse (exceljs/csv-parse), Render Worker async |
| NFR-06: raw file preserved | S3 store + hash verify, never overwrite |
| NFR-07: formula configurable no-code | Formula stored as DB rows, interpreter pattern |
| NFR-08: versioned, no retro change | Snapshot prime_cost vào order record tại thời điểm tính |
| NFR-09: regen historical from raw | Re-run calculation engine với raw + cost master snapshot |
| NFR-12: log within 1s | Sync write trước response, không async |
| NFR-13: log immutable even Admin | DB trigger DENY UPDATE/DELETE on log tables, hoặc append-only via app layer |
| NFR-14: 99% uptime business hours | Healthcheck + Render/Neon SLA |

### 4.3 Open issues — resolved & remaining

**Resolved sau khi user trả lời + scan real data (2026-05-11)**:
- ✅ **OI-001**: Upload trùng → **OVERWRITE** (archive bản cũ vào S3, warning dialog). Detail: [oi-resolutions.md](../../.claude/memory/oi-resolutions.md).
- ✅ **OI-002**: Finalized = **Hybrid D**: auto on download + Admin unfinalize (kèm log). Detail: [oi-resolutions.md](../../.claude/memory/oi-resolutions.md).
- ✅ **Q5 Brand Ads**: 1 row tổng shop-level per period → allocate theo NMV. (Confirmed từ file thật)
- ✅ **Q6 Off-Platform Ads**: per product (direct join) — KHÔNG cần allocate. (Confirmed)
- ✅ **Q7 TikTok Page View**: 4 cột riêng (tab Cửa hàng + LIVE + video + thẻ sản phẩm) → parser sum. (Confirmed)
- ✅ **Q8 Free Gift Shopee**: dùng prefix `[GIFT]` giống TikTok (KHÔNG chỉ NMV=0). (Confirmed từ file thật row 56 FINAL REPORT)
- ✅ **Allocation algorithm**: 2 cấp — cross-platform theo GMV, within-platform theo NMV. Detail: [allocation-hierarchy.md](../../.claude/memory/allocation-hierarchy.md).

### 4.4 ✅ ALL RESOLVED (2026-05-11, user chốt "ít behavior, nhiều hiệu quả")

Tất cả 6 questions đã chốt theo nguyên tắc Occam's Razor. Chi tiết: [final-decisions.md](../../.claude/memory/final-decisions.md).

| # | Question | Decision |
|---|---|---|
| Q-A | Upload UX | **Smart Drop Zone (Option C — Hybrid)** — 1 zone accept consolidated + individual + mix. Auto-detect via row 1 markers + column heuristic. Lenient skip default. Behaviors = 4 (Pick period, Add file, Remove, Continue). Detail: [UPLOAD-FLOW-20260511.md](UPLOAD-FLOW-20260511.md) |
| Q-B | TikTok Ads + Platform Fee | **Manual input giữ nguyên SRD** (placeholder sections trong export thường rỗng, parsing không đáng tin) |
| Q-C | "Total Platform Discount (Rfr)" | **Auto-include**, định nghĩa = SUM of `SKU Platform Discount` từ raw. Hiển thị trong Discount Costs breakdown, KHÔNG nằm trong CM formula |
| Q-D | TikTok Platform Fee Rate <4 tuần | **avg of available weeks**; nếu 0 week → fallback 16% (≈ rate thực April 2026) + warning banner |
| Q-E | User model | **Pure AMA passthrough**. User Management UI chỉ assign role local, KHÔNG có CRUD user |
| Q-F | Activity Log retention | **Indefinite, không archive cron**. Volume nhỏ (~36k rows/year/table), cost negligible. Revisit Phase 2 nếu cần |

### 4.5 Old questions section (archived, để tham khảo)

(Trước đây) Remaining open questions:

> Đọc kèm: [REAL-DATA-FINDINGS-20260511.md](REAL-DATA-FINDINGS-20260511.md)

#### Q-A: Upload format — 1 file consolidated hay 6/5 file riêng?

**Real data**: client export 1 CSV consolidated với 6 sections (Shopee) / 5 sections (TikTok) stacked horizontally.

**SRD**: spec 6+3 file riêng.

**Hỏi client**:
- Option 1: User upload **1 file consolidated** (như đang làm) → app tự split 6/5 sections
- Option 2: App yêu cầu **6+5 = 11 file riêng** → client tự tách trước khi upload
- Option 3: Hỗ trợ cả 2 — auto-detect bằng row 1 markers

**Block**: parser strategy.

#### Q-B: TikTok có thêm 2 sections ADS + PLATFORM FEE trong export — vẫn manual input?

**Real data**: `10. TIKTOK DOWNLOAD.csv` row 1 có sections `ADS REPORT` và `PLATFORM FEE` — TikTok thực tế export 5 sections.

**SRD**: TikTok Ad Spending + Platform Fee = manual input (FR-04).

**Hỏi client**:
- Option 1: Parse từ file (auto, không cần nhập tay)
- Option 2: Vẫn manual input như SRD (vì file export không đầy đủ?)
- Option 3: Hybrid — parse được thì auto, fallback manual

**Block**: FR-04 design + DATA-MODEL.

#### Q-C: "Total Platform Discount (Rfr)" — metric mới ngoài SRD

**Real data**: `FINAL REPORT.csv` row 21 có `Total Platform Discount (Rfr) = 249,414,868 (14.83%)`.

**SRD**: không nhắc.

**Hỏi client**:
- Định nghĩa chính xác metric này là gì?
- Công thức tính?
- Hiển thị trong Discount Costs section của report — vai trò gì?
- "(Rfr)" có phải Reference Report?

**Block**: FR-08 output template.

#### Q-D: TikTok Platform Fee Rate weekly khi <4 tuần history (đầu go-live)

**SRD §Group 3 item 17**: weekly = avg(last 4 weeks) × Net GMV. Nhưng tuần 1-3 sau khi go-live không có đủ.

**Hỏi client**:
- Option 1: Dùng avg of available (1-3 weeks) + warning
- Option 2: User nhập rate ước lượng tay vào setting
- Option 3: Default cứng (vd 16%) cho đến khi đủ
- Option 4: Block weekly report → chỉ cho monthly cho đến khi đủ history

**Block**: FR-15 (Shopee WoW Trending) + monthly calc.

#### Q-E: User account model — local vs AMA passthrough?

**Bối cảnh**: app sẽ tích hợp với ambManagement qua JWT SSO.

**Hỏi client**:
- Option A (Recommend): Pure passthrough. User vào qua AMA. `sal_users` chỉ cache. User Management (FR-22) chỉ assign role local (Operator/Manager/Admin).
- Option B: Cho phép tạo user local không qua AMA (cho vendor/contractor).

**Block**: FR-22 + auth flow.

#### Q-F: Activity Log retention — Action + Download (Login đã 12mo SRD)

**SRD**: Login ≥12 tháng (FR-19 AC-05). Action (FR-20) + Download (FR-21) chưa specify.

**Hỏi client**:
- Action Log retention: bao nhiêu tháng? (Đề xuất 24mo cho audit kế toán)
- Download Log retention: bao nhiêu tháng? (Đề xuất 12mo)
- Sau retention: archive S3 hay xóa hẳn? (Đề xuất archive S3 — read-only, low-cost)

**Block**: DATA-MODEL.md final + cron job design.

### 4.6 MVP path (ready to start)

Với 6 decisions đã chốt, có thể bắt đầu Phase 1 MVP ngay:

1. **Upload page**: Smart Drop Zone (1 zone, auto-detect, lenient skip). Cover consolidated/individual/mix per [UPLOAD-FLOW-20260511.md](UPLOAD-FLOW-20260511.md).
2. **Detect 11 sections, parse 9 active** (Shopee 6 + TikTok 3; skip TT ADS/Platform Fee per Q-B), distribute vào 9 raw tables như DATA-MODEL.md
3. **Manual input page**: 12 fields (5 main + 7 TikTok platform subitems) + FX rate
4. **Calc engine**: SRD §5 formulas + 2-cấp allocation (GMV cross-platform, NMV intra-platform) + Free Gift `[GIFT]` prefix
5. **Weekly Report**: Summary (incl. Total Platform Discount Rfr) + Product Breakdown + Export Excel
6. **Auth**: AMA JWT passthrough, role map OWNER/MASTER→ADMIN, MANAGER→MANAGER, MEMBER→OPERATOR
7. **Activity log**: 3 tables append-only, indefinite retention

**Out of MVP** (Phase 2):
- Monthly Report (FR-11~14)
- 4 Trending views (FR-15~18)
- COGS Master separate (FR-06) — chỉ có Prime Cost trong MVP
- Formula Configuration UI (FR-23) — Phase 1 hard-code formula vào code, Phase 2 chuyển ra DB
- User Management UI (FR-22) — Phase 1 dùng AMA role mapping cứng
- TikTok Platform Fee Rate fallback logic (Q-D) — Phase 1 require ≥1 week history

→ **MVP scope** = 5/23 FRs core (FR-01,02,03,04,05,07,08,09,10) + auth + log = đủ deliver weekly report flow end-to-end.

## 5. User flow

### 5.1 Weekly closing workflow (Operator)

```
1. Operator vào /upload, chọn date range (FR-01)
2. Upload 6 Shopee files + 3 TikTok files vào 9 slots (FR-02, FR-03)
   → S3 store raw + hash + log upload action
3. Background Worker picks up PENDING job → section-split + parse 9 active sections → 9 raw_*_reports tables
   → Log row count, errors, status
4. Operator vào /manual-input
   → Nhập Affiliate Booking Fee total, Livestream Shopee/TikTok, TikTok Ads, 7 TikTok Platform Fee subitems
   → FX rate nếu thay đổi
5. Calculation engine chạy:
   - Apply order exclusion (cancelled/returned/freegift)
   - Per-SKU metrics (Original Price, GMV, Net GMV, NMV...)
   - XLOOKUP Prime Cost từ master
   - Allocate platform-level costs về SKU theo NMV contribution
   - Compute CM line-level
   - Aggregate platform-level
6. Operator vào /reports/weekly → chọn tuần → review
7. Operator download Excel → log download action (FR-21)
   → Mark report "finalized" → Prime Cost snapshot lock vào record
8. Manager vào xem trending report (4 views) cho insights
```

### 5.2 Admin formula tuning

```
1. Admin vào /admin/formula-config
2. Xem 48 params, 7 groups, value hiện tại + history button
3. Edit ví dụ "Shopee Brand Ads" field map → đổi sang column khác trong CSV
4. Save → log change (param name, old, new, user, timestamp)
5. Tất cả calc tương lai dùng config mới
6. Reports đã finalized KHÔNG bị thay đổi (snapshot rule)
```

### 5.3 Onboarding (AMA passthrough)

```
1. AMA admin tạo record amb_entity_custom_apps cho sales-report-v2
2. User của entity vào AMA sidebar, click app
3. AMA issue JWT { ent_id, user_id, role: 'OWNER'|'MASTER'|'MANAGER'|'MEMBER' }
4. v2 verify JWT, map AMA role → local role (Admin/Manager/Operator)
5. v2 upsert sal_users record local (cache role)
6. Redirect dashboard
```

## 6. Constraints

| Loại | Constraint |
|---|---|
| Performance | NFR-02/03/04 — all < 5s |
| Browser | Chrome, Edge, Firefox (NFR-15) — không cần Safari |
| Concurrent users | 1–5 (small team) |
| Data volume | ~52 weeks/year × 2 platforms |
| Currency | VND primary, KRW secondary only |
| Uptime | 99% business hours Mon-Fri 8-18 ICT |
| Compliance | Audit log immutable, raw file unchanged |

## 7. Next steps

1. ✅ Save SRD as authoritative source ([SRD-20260506-FIRGI-SalesReport-v2.md](SRD-20260506-FIRGI-SalesReport-v2.md))
2. ✅ Update REQ (this doc)
3. ✅ Update [DATA-MODEL.md](../architecture/DATA-MODEL.md) — 9 raw tables (Shopee 6 + TikTok 3), formula config, activity logs split, versioning
4. ⏳ Update [cm-calculator skill](../../.claude/skills/cm-calculator/SKILL.md) — exact formulas
5. ⏳ Update [excel-parser skill](../../.claude/skills/excel-parser/SKILL.md) — 9 platform file types
6. ⏳ User chốt 8 open questions (§4.4) + 2 open issues SRD
7. ✅ Sample CSV files đã có trong `resources/` (14 file April 2026)
8. ⏳ Viết PLAN-20260511 — work breakdown theo phase (MVP: upload + weekly report; Phase 2: trending + admin; Phase 3: formula config UI)
