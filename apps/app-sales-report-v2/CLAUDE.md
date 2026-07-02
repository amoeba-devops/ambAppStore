# app-sales-report-v2 — Claude Code Context

> **Standalone Turborepo** inside `apps/app-sales-report-v2/`. KHÔNG phụ thuộc root `ambAppStore` workspaces. Mọi command (`npm install`, `npm run dev`, `drizzle-kit migrate`) phải chạy được khi `cd` vào folder này.

## 1. Mục tiêu

Rebuild app **FIRGI Sales Report Application** cho khách hàng **Socialbean Vietnam Co., Ltd.** (FIRGI là nhãn nội bộ). Thay thế [v1](../app-sales-report/) (NestJS + Vite + MySQL).

**Spec gốc (source of truth)**: [docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md](docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md) — Document ID `FIRGI-SRS-SALESREPORT-001 v2.0`, prepared by Truc Hoang, 2026-05-06.

Tham chiếu phụ:
- [PRD.md](PRD.md) — bản tóm tắt nghiệp vụ ban đầu (giờ đã được superseded bởi SRD v2.0)
- [docs/analysis/REQ-20260511-sales-report-v2.md](docs/analysis/REQ-20260511-sales-report-v2.md) — phân tích AS-IS → TO-BE từ SRD
- [FIRGI Sales Ops _standalone_.html](FIRGI%20Sales%20Ops%20_standalone_.html) — Figma Make bundle UI prototype (mở browser xem, không đọc raw)

**Nghiệp vụ tóm tắt**: Automate báo cáo Shopee Vietnam (1 consolidated CSV, 6 sections) + TikTok Shop Vietnam (1 consolidated CSV, 5 sections — 3 sections active per FR-04 Q-B decision). Tính GMV, Net GMV, NMV, Contribution Margin (per SKU + per platform). 4 trending views (WoW/MoM × Shopee/TikTok). Cost master versioned. FX VND ↔ KRW (default **17.543 VND per 1 KRW**, tức `1 VND ≈ 0.057 KRW`). 48 formula parameters Admin configurable.

## 2. Tech Stack (fixed — KHÔNG đổi)

> Stack tối giản để giảm bề mặt hallucination. Mỗi item là **core, không có alternative trong v2**.

| Layer | Tool | Note |
|---|---|---|
| Monorepo | **Turborepo** | standalone trong v2/ |
| Framework | **Next.js 15 App Router** | fullstack — RSC + Server Actions + Route Handlers |
| Language | **TypeScript 5 strict** | |
| DB | **Neon Postgres** | serverless, branching cho dev/staging |
| ORM | **Drizzle** | `@neondatabase/serverless` HTTP driver |
| Storage | **AWS S3** | presigned URL direct upload |
| Auth | **jose** | verify AMA JWT, shared `JWT_SECRET` |
| Validation | **Zod** | share schema client/server |
| UI | **Tailwind 3 + shadcn/ui + Recharts** | |
| Forms | **React Hook Form** | |
| i18n | **next-intl** | App Router compatible |
| Test | **Vitest + Playwright** | |
| **Deploy** | **Render.com** | Web Service + Background Worker + Cron Jobs |

**KHÔNG dùng** trong v2 (tránh hallucinate features):
- ❌ Vercel (thay bằng Render.com)
- ❌ Inngest / Trigger.dev (thay bằng Render Background Worker + DB queue)
- ❌ Sentry (dùng Render logs + alerts built-in)
- ❌ Axiom / Datadog / external observability
- ❌ Redis / BullMQ (DB-based queue đủ cho scale v2)
- ❌ Vercel Cron / external cron (dùng Render Cron Jobs)
- ❌ Prisma (đã chốt Drizzle)
- ❌ tRPC, SWR, React Query (Server Actions + RSC đủ)
- ❌ NextAuth (passthrough JWT từ AMA, không tự issue token)

## 3. Cấu trúc folder (target)

```
app-sales-report-v2/
├── CLAUDE.md                    ← bạn đang đọc
├── PRD.md                       ← nghiệp vụ gốc
├── .claude/
│   ├── skills/                  ← skill chuyên domain
│   │   ├── excel-parser/SKILL.md
│   │   ├── cm-calculator/SKILL.md
│   │   ├── amb-integration/SKILL.md
│   │   └── drizzle-neon/SKILL.md
│   └── memory/
│       ├── MEMORY.md            ← index
│       └── *.md                 ← per-decision memory
├── apps/web/                    ← Next.js fullstack (chưa scaffold)
├── packages/
│   ├── db/                      ← Drizzle schema + migrations
│   ├── shared/                  ← Zod + types
│   └── ui/                      ← shared shadcn
├── docs/
│   ├── architecture/            ← ARCH-overview, DATA-MODEL, INTEGRATION-amb, DEPLOYMENT
│   ├── analysis/                ← REQ-YYYYMMDD-*
│   ├── plan/                    ← PLAN-YYYYMMDD-*
│   ├── test/                    ← TC-* + TR-*
│   ├── implementation/          ← RPT-*
│   └── log/                     ← daily conversation log (gitignore)
├── turbo.json
└── package.json
```

## 4. Nguyên tắc kiến trúc (MUST)

### 4.1 Multi-tenancy bắt buộc
Mọi bảng business data phải có `ent_id CHAR(36) NOT NULL`. Wrap mọi query Drizzle bằng helper `withEnt(entId)` — không cho phép query raw không có `ent_id`. Tham chiếu [docs/architecture/INTEGRATION-amb.md](docs/architecture/INTEGRATION-amb.md).

### 4.2 Layer separation (Next.js App Router)
```
app/(routes)             ← UI components + page.tsx (Server Component default)
       ↓
server/actions           ← Server Actions, "use server", input validate bằng Zod
       ↓
server/services          ← business logic, không biết Next.js
       ↓
packages/db (Drizzle)    ← persistence
```
- UI Component KHÔNG được import trực tiếp Drizzle / S3 client → phải qua Server Action.
- Service layer KHÔNG được import `next/*` → giữ pure để test.

### 4.3 DB naming convention (kế thừa root CLAUDE.md)
- Database: `db_app_sales_v2` (Neon project)
- Table: `sal_*` prefix snake_case plural — `sal_skus`, `sal_raw_orders`, `sal_reports`
- PK: `{prefix}_id` CHAR(36) UUID — `sku_id`, `ord_id`, `rep_id`
- Cột: `{prefix}_{name}` snake_case — `sku_code`, `ord_net_gmv`
- Boolean: `{prefix}_is_{name}` — `sku_is_active`
- Timestamps: `{prefix}_created_at`, `{prefix}_updated_at`, `{prefix}_deleted_at` (soft delete)
- ENUM: SCREAMING_SNAKE_CASE — `AVAILABLE`, `IN_USE`
- Index: `idx_{table}_{col}` — `idx_sal_orders_ent_status`

### 4.4 API convention
- Route Handler path: `/api/v1/*`
- Server Action: snake_case input → camelCase output
- Standard response: `{ success, data, error?, timestamp }`
- Error code: `SAL-E{4 digits}` — ví dụ `SAL-E0001` (invalid SKU), `SAL-E0403` (forbidden)

### 4.6 Role mapping (AMA → app local)

Theo SRD client cần 3 role: **Operator / Manager / Admin**. AMA chỉ có OWNER/MASTER/MANAGER/MEMBER. Map khi user lần đầu vào app:

| AMA role | App role |
|---|---|
| `OWNER`, `MASTER` | `ADMIN` |
| `MANAGER` | `MANAGER` |
| `MEMBER` | `OPERATOR` |

Lưu cache trong `sal_users.usr_local_role`. Admin có thể đổi role local (FR-22) nhưng AMA role là nguồn cuối cùng — đồng bộ lại mỗi lần login.

### 4.7 Currency & comparison (theo SRD §5.5)

- Mọi giá trị tiền lưu **VND** (`*_vnd` suffix)
- KRW chỉ display: `KRW = VND / 17.543` (rate là VND per KRW, configurable trong `sal_fx_rates`). Verify từ FINAL REPORT.csv: 1,682,035,200 VND / 95,876,006 KRW = 17.544
- WoW/MoM: `(current − prev) / abs(prev) × 100`; prev=0 → `N/A`; prev=null → `----`

### 4.5 File naming
| Type | Pattern | Example |
|---|---|---|
| Page | `page.tsx` (App Router) | `app/(dashboard)/skus/page.tsx` |
| Component | PascalCase | `SkuCard.tsx` |
| Server Action | kebab-case `.action.ts` | `create-sku.action.ts` |
| Service | kebab-case `.service.ts` | `cm-calculator.service.ts` |
| Drizzle schema | kebab-case `.schema.ts` | `sku.schema.ts` |
| Zod schema | kebab-case `.zod.ts` | `sku.zod.ts` |

## 5. Tích hợp với ambManagement

Tóm tắt — chi tiết ở [docs/architecture/INTEGRATION-amb.md](docs/architecture/INTEGRATION-amb.md):

1. **JWT Passthrough**: ambManagement issue JWT chứa `entId`, `userId`, `role` → app verify bằng shared `JWT_SECRET` (env). Middleware Next.js đọc `?ama_token=` lần đầu → set HttpOnly cookie → verify mọi request sau.
2. **Đăng ký**: admin AMA tạo record `amb_entity_custom_apps` với `eca_code=sales-report-v2`, `eca_url=<deploy_url>`, `eca_auth_mode=jwt`, `eca_open_mode=iframe`.
3. **iframe sandbox**: app phải work trong iframe. Cấm `X-Frame-Options: DENY`. CSP `frame-ancestors` cho phép domain AMA.
4. **Locale**: nhận `?locale=ko|en|vi` từ AMA → init i18n.

## 6. Tham chiếu

> Pattern: **Hub-and-spoke**. CLAUDE.md → `_NAV.md` → folder `_INDEX.md` → individual files. Lazy-load.

### 6.1 Entry points (đọc trước)

| File | Khi nào |
|---|---|
| **[docs/_NAV.md](docs/_NAV.md)** | ⭐ Master navigation — đọc khi không biết tìm doc ở đâu |
| **[docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md](docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md)** | SOURCE OF TRUTH — client spec, 23 FR + 15 NFR + 48 formula |

### 6.2 Domain folders (mỗi folder có `_INDEX.md`)

| Folder | Nội dung |
|---|---|
| [docs/analysis/](docs/analysis/) | Requirements, SRD, audits, findings (REQ, UPLOAD-FLOW, REAL-DATA, PROTOTYPE, CONSISTENCY) |
| [docs/architecture/](docs/architecture/_INDEX.md) | System design — ARCH-overview, DATA-MODEL, INTEGRATION-amb, DEPLOYMENT, LAYERS, REQUEST-LIFECYCLE, ERROR-HANDLING |
| [docs/component-style/](docs/component-style/_INDEX.md) | UI patterns — design-tokens, page-template, form, table, chart, modal, states |
| [docs/system-design/](docs/system-design/_INDEX.md) | Backend patterns — Server Actions, API routes, background jobs (Render Worker), S3 |
| [docs/mcp/](docs/mcp/_INDEX.md) | MCP Neon DB integration — setup, safety rules |

### 6.3 Skills (auto-loadable, khác docs)

| Skill | Khi nào |
|---|---|
| [.claude/skills/excel-parser/SKILL.md](.claude/skills/excel-parser/SKILL.md) | Section splitter + 9 sub-parsers (Shopee 6 + TikTok 3) |
| [.claude/skills/cm-calculator/SKILL.md](.claude/skills/cm-calculator/SKILL.md) | CM formulas exact, 2-cấp allocation, exclusion rules |
| [.claude/skills/amb-integration/SKILL.md](.claude/skills/amb-integration/SKILL.md) | JWT / iframe / ent_id cheat-sheet |
| [.claude/skills/drizzle-neon/SKILL.md](.claude/skills/drizzle-neon/SKILL.md) | Query Drizzle patterns |

### 6.4 Memory (project decisions — không phải docs)

| Memory | Nội dung |
|---|---|
| [.claude/memory/MEMORY.md](.claude/memory/MEMORY.md) | Index of all decisions |
| [.claude/memory/final-decisions.md](.claude/memory/final-decisions.md) | ⭐ Q-A → Q-F resolutions |

### 6.5 Doc convention (cho người viết doc mới)

- File size: < 300 lines, single concern
- Frontmatter: `title`, `description` (1-line for relevance), `load-when` (trigger), `status` (skeleton/draft/ready)
- Cross-link aggressively trong "See also" section
- Examples > prose, ❌ anti-patterns explicit
- **No big-bang single doc** — split by concern

## 7. Workflow yêu cầu mới

Theo root [CLAUDE.md](../../CLAUDE.md), khi tag `[요구사항]` / `[requirement]`:
1. `docs/analysis/REQ-YYYYMMDD-*.md` (requirements)
2. `docs/plan/PLAN-YYYYMMDD-*.md` (plan)
3. `docs/test/TC-YYYYMMDD-*.md` (test cases)
4. Implement code
5. `docs/test/TR-YYYYMMDD-*.md` (test report)
6. `docs/implementation/RPT-YYYYMMDD-*.md` (completion report)

## 8. Quy ước log

`docs/log/YYYY-MM-DD/HH_NN_<topic>.md` — ghi session, không commit (gitignore).

## 9. Cấm

- ❌ Hard-code text UI → phải qua i18n (ko/en/vi)
- ❌ Direct DB call từ Client Component → phải qua Server Action
- ❌ Query không có `ent_id` filter
- ❌ Push prod trước khi staging xanh
- ❌ Lưu file Excel raw vào DB (BLOB) → phải vào S3, DB chỉ giữ key
- ❌ Commit `.env*` (chỉ commit `.env.example`)
- ❌ **Overwrite hoặc modify raw upload file** (NFR-06) — re-upload phải archive bản cũ
- ❌ **UPDATE/DELETE trên 3 bảng activity log** (NFR-13) — DB trigger DENY, kể cả Admin
- ❌ **Retro thay đổi finalized report** (NFR-08) — Prime Cost master đổi không được tác động report đã download
- ❌ **Hard-code formula params được khai báo trong `FORMULA_PARAM_REGISTRY`** — phải đọc từ `sal_formula_configs` qua `loadFormulaConfig()`. Registry là single source of truth; thêm param mới = thêm entry registry + seed default migration. (FR-23 implemented Phase 1+2 commit `e7db124`.)
- ❌ **Apply Shopee CM formula cho TikTok** — TikTok không có Brand Ads, Off-Platform, Seller Vouchers
- ❌ Quên `Item Sold = Quantity − Quantity Returned` cho Shopee, hoặc `IF(Q=return, 0, Q)` cho TikTok
- ❌ Cộng Free Gift Prime Cost vào `Total Prime Cost` — Free Gift PC phải track riêng ở `primeCostFreeGift` và được trừ trong CM như một dòng tách biệt (tránh double-subtract). `Total Prime Cost` chỉ gồm `kept rows`; revenue của Free Gift vẫn exclude.
