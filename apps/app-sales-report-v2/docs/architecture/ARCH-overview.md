# ARCH-overview — Sales Report v2 (FIRGI / Socialbean)

> Tham chiếu spec gốc: [SRD-20260506-FIRGI-SalesReport-v2.md](../analysis/SRD-20260506-FIRGI-SalesReport-v2.md)

## 1. Bức tranh tổng

```
┌─────────────────────────────────────────────────────────────────┐
│                    ambManagement (AMA)                          │
│  - Issue JWT (shared JWT_SECRET)                                │
│  - Sidebar render iframe → app v2                               │
└──────────────────┬──────────────────────────────────────────────┘
                   │ ?ama_token=<jwt>&locale=ko
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│           Next.js 15 App Router (apps/web)                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ middleware.ts → verify JWT → inject ent context           │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ app/(dashboard)/* — RSC, fetch via Server Action          │ │
│  │ app/api/v1/* — Route Handlers (webhook, S3 callback)      │ │
│  │ server/actions/* — "use server", validate Zod             │ │
│  │ server/services/* — pure business logic                   │ │
│  └────────┬──────────────────────────────────┬───────────────┘ │
└───────────┼──────────────────────────────────┼─────────────────┘
            │                                  │
            ▼                                  ▼
   ┌──────────────────┐                ┌──────────────────┐
   │ Neon Postgres    │                │ AWS S3           │
   │ Drizzle ORM      │                │ Excel raw + exp  │
   │ ent_id isolation │                │ presigned URL    │
   └──────────────────┘                └──────────────────┘
            ▲                                  ▲
            │                                  │
            └──────────┬───────────────────────┘
                       │
              ┌────────┴──────────┐
              │ Render Worker     │
              │ (DB queue poll)   │
              │ parse Excel async │
              └───────────────────┘
```

Deploy: 3 Render services per env — Web Service (Next.js) + Background Worker (parse + calc) + Cron Job. Detail: [DEPLOYMENT.md](DEPLOYMENT.md).

## 2. Request flow điển hình

### 2.1 User mở dashboard
1. AMA iframe load `https://sales-v2.app/?ama_token=eyJ...&locale=ko`
2. `middleware.ts` thấy `ama_token` query → verify bằng `JWT_SECRET` → set HttpOnly cookie `amb_session` → 302 redirect bỏ query
3. RSC layout render → đọc cookie → `getCurrentUser()` → trả về `{ entId, userId, role }`
4. Dashboard page gọi Server Action `getDashboardSummary()` → service tính từ `sal_reports` filter theo `entId`
5. Render Server Component với data → client hydrate cho Recharts

### 2.2 Upload Excel báo cáo Shopee
1. User chọn file → client gọi `requestUploadUrl()` Server Action → trả về presigned S3 URL
2. Browser PUT trực tiếp lên S3 (không qua server)
3. Client gọi `confirmUpload(s3Key, channel, period)` → tạo record `sal_upload_history` status=`PENDING`
4. Render Worker polls DB → claims job (FOR UPDATE SKIP LOCKED) → download từ S3 → parse → insert `sal_raw_*_reports` (batch) → tính CM → update status=`DONE`
5. UI poll status hoặc dùng SWR mutate

## 3. Domain modules (theo SRD v2.0 — 23 FRs)

```
server/services/
├── auth/               ← AMA JWT verify + role check (FR-22, NFR-10)
├── upload/             ← Upload session (FR-01) — Smart Drop Zone
│   ├── upload-session/ ← state machine (EMPTY → UPLOADED → DETECTED → READY → PROCESSING → FINISHED)
│   ├── section-detector/ ← row 1 markers (consolidated) + column heuristic (individual) + AMBIGUOUS warn
│   ├── file-archiver/  ← S3 archive bản cũ khi overwrite (OI-001)
│   ├── shopee/         ← 6 sub-parsers (FR-02): SALES, ADS, BRAND_ADS, OFF_PLATFORM_ADS, TRAFFIC, AFFILIATE
│   └── tiktok/         ← 3 active sub-parsers (FR-03): SALES, TRAFFIC, AFFILIATE (skip ADS + Platform Fee per Q-B)
├── manual-input/       ← FR-04: 5 items + 7 TT platform subitems + FX rate
├── cost-master/
│   ├── prime-cost/     ← FR-05, versioned (NFR-08)
│   └── cogs/           ← FR-06, date-based lookup
├── calculation/        ← SRD §5 formulas
│   ├── product-level/  ← per-SKU Shopee/TikTok (khác nhau)
│   ├── platform-level/ ← aggregations
│   ├── allocation/     ← NMV contribution engine
│   ├── exclusion/      ← cancelled / returned / free gift
│   ├── currency/       ← VND ↔ KRW (default 17.543)
│   └── trending/       ← WoW / MoM
├── report/
│   ├── weekly/         ← FR-07~10
│   ├── monthly/        ← FR-11~14
│   ├── trending/       ← FR-15~18 (4 views)
│   └── export/         ← xlsx + chart embed (FR-10, FR-15 AC-06)
├── activity-log/       ← Immutable (NFR-13)
│   ├── login/          ← FR-19
│   ├── action/         ← FR-20
│   └── download/       ← FR-21
├── user-management/    ← FR-22 (Admin)
├── formula-config/     ← FR-23 (48 params, 7 groups, NFR-07)
└── integration/        ← AMA passthrough
```

## 4. Page layout (theo SRD FR-07~21)

```
Sidebar nav:
  📊 Dashboard                    (landing, latest week summary)
  ⬆️ Upload                        (FR-01 date range + Smart Drop Zone, xem [UPLOAD-FLOW](../analysis/UPLOAD-FLOW-20260511.md))
  ✏️ Manual Input                 (FR-04: 5 items + 7 subitems + FX rate)
  📦 Cost Master
    ├─ Prime Cost                 (FR-05, versioned)
    └─ COGS                       (FR-06, date update)
  📈 Reports
    ├─ Weekly                     (FR-07~10)
    ├─ Monthly                    (FR-11~14)
    └─ Trending                   (FR-15~18, 4 tabs)
  📜 Activity Log                 (Manager+ read-only, Admin full)
    ├─ Login History              (FR-19)
    ├─ Action History             (FR-20)
    └─ Download History           (FR-21)
  ⚙️  Admin (Admin only)
    ├─ User Management            (FR-22)
    └─ Formula Configuration      (FR-23, 48 params)
  Settings                        (profile, locale)
```

## 4b. Role visibility

| Page | Operator | Manager | Admin |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ |
| Upload | ✅ | ❌ | ✅ |
| Manual Input | ✅ | ❌ | ✅ |
| Cost Master | ✅ | ❌ | ✅ |
| Reports view + download | ✅ | ✅ | ✅ |
| Activity Log | ❌ | ✅ (read) | ✅ (full) |
| User Management | ❌ | ❌ | ✅ |
| Formula Configuration | ❌ | ❌ | ✅ |

## 5. Non-functional → cách đạt

| NFR | Yêu cầu | Cách đạt |
|---|---|---|
| NFR-02/03/04 | All actions/pages < 5s | Render Worker async cho parse + calc heavy; RSC streaming; Drizzle batch 500 |
| NFR-06 | Raw file unmodified | S3 với versioning bật + sha256 hash; re-upload archive bản cũ |
| NFR-07 | Formula configurable no-code | `sal_formula_configs` DB-driven (xem [formula-config-approach](../../.claude/memory/formula-config-approach.md)) |
| NFR-08 | Versioned cost, no retro change | `sal_prime_cost_versions` append-only; `sal_product_metrics` snapshot `pcv_id` |
| NFR-09 | Regen historical | Replay engine với snapshot version + raw file → identical output |
| NFR-12 | Log within 1s | Sync write trong transaction trước response |
| NFR-13 | Log immutable kể cả Admin | Postgres trigger DENY UPDATE/DELETE trên 3 log tables; app DB user không có quyền |
| NFR-14 | 99% uptime business hours | Render + Neon SLA, Render auto health check `/api/v1/health` |
| NFR-15 | Chrome/Edge/Firefox | Cross-browser test (Playwright) |
| iframe-safe | CSP `frame-ancestors` cho AMA domain; KHÔNG set `X-Frame-Options` | |

## 6. Quyết định mở (open decisions)

- [ ] **i18n lib**: next-intl vs i18next (đề xuất next-intl cho App Router)
- [x] ✅ **Background job**: Render Background Worker + DB queue (chốt)
- [ ] **Test DB**: Neon branch per PR vs Testcontainers (đề xuất Neon branch)
- [ ] **Biome vs ESLint+Prettier**: chốt sau setup
- [ ] **Formula interpreter**: AST evaluator hay rule-engine library (`json-rules-engine`)?
- [x] ✅ **Sample raw CSV**: 14 file trong `resources/` (April 2026)
- [x] ✅ **OI-001**: Upload trùng → Overwrite (xem [oi-resolutions](../../.claude/memory/oi-resolutions.md))
- [x] ✅ **OI-002**: Finalized = hybrid auto-on-download + Admin unfinalize
- [x] ✅ **OI-003**: Brand Ads = shop-level 1 row → allocate NMV; Off-Platform Ads = per product direct; Affiliate có 2 cột (Hoa hồng + Phí cố định)
- [x] ✅ **OI-004**: TikTok Platform Fee Rate <4 tuần → avg of available + fallback 16% (xem [final-decisions Q-D](../../.claude/memory/final-decisions.md))
