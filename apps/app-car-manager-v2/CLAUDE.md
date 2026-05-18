# app-car-manager-v2 — Claude Code Context

> **Standalone Turborepo** inside `apps/app-car-manager-v2/`. KHÔNG phụ thuộc root `ambAppStore` workspaces. Mọi command (`npm install`, `npm run dev`, `drizzle-kit migrate`) chạy được khi `cd` vào folder này.

## 1. Mục tiêu & Source of truth

Build **Company Car Management System (CCMS)** — phân hệ Quản lý Điều Xe & Kiểm soát Chi phí Nội bộ.

### 1.1 Hệ thống tài liệu (đọc theo thứ tự ưu tiên)

| # | File | Vai trò | Khi nào đọc |
|---|---|---|---|
| 1 | **[PRD.md](PRD.md)** | ⭐ **SOURCE OF TRUTH** (MVP đã go-live 2026-05-17, hiện ở **Post-MVP / Comprehensive phase**). Consolidated SRS+PRD+Personas+Flows+Logic. Mọi quyết định scope/business logic bám file này — bao gồm các revision R3+ post-MVP. | Trước khi code bất kỳ feature nào |
| 2 | [resources/claude-design/](resources/claude-design/) | **Design reference** (24 màn HTML/JSX prototype). Tham khảo cho **visual + interaction patterns**. **KHÔNG phải spec** — feature có trong prototype mà PRD không yêu cầu → KHÔNG implement | Khi build UI component / port screen |
| 3 | [resources/claude-design/uploads/COMPANY CAR MANAGEMENT SYSTEM.docx](resources/claude-design/uploads/) | **SRS gốc khách hàng** (147 dòng tiếng Việt). Để hiểu context/intent gốc. **KHÔNG phải spec MVP** — PRD đã tổng hợp + mở rộng | Khi PRD ambiguous, cần hiểu intent KH |
| 4 | [docs/analysis/REQ-20260512-prd-srs-audit.md](docs/analysis/REQ-20260512-prd-srs-audit.md) | Audit ghi nhận các divergence giữa PRD ↔ SRS ↔ Prototype + resolution | Khi gặp mâu thuẫn 3 nguồn |

### 1.2 Nguyên tắc khi 3 nguồn mâu thuẫn

**Bám PRD.md cho MVP.** Cụ thể:

- Prototype có UI nhưng PRD không list → KHÔNG implement (vd: turn-by-turn GPS navigation, Driver Performance Card, AI Insight panel — xem audit §C)
- SRS gốc yêu cầu nhưng PRD đổi → theo PRD (vd: Driver/Vehicle optional khi tạo Trip theo PRD, không phải mandatory như SRS — xem audit §B)
- PRD thêm so với SRS → implement (vd: Parking/Toll/Inspection vào MVP, retention 5 năm — xem audit §C/D)

**MVP đã go-live (2026-05-17).** Hiện đang ở **Post-MVP / Comprehensive phase** — các divergence R2 đã bỏ (vd: schedule conflict, email/push transport) được kéo trở lại theo PRD R3+. Vẫn bám PRD làm SOT; prototype/SRS chỉ tham khảo cho intent/visual.

### 1.3 Nghiệp vụ tóm tắt

3 xe công ty phục vụ Manager/Director. 3 personas: Admin (web), Manager/Director (PWA + web), Driver (PWA only). 3 modules: Trip Management · Expense + Maintenance Alert · Reports/Dashboard. **8 loại chi phí MVP** (Fuel, Oil, Accident, Meal, Repair theo SRS + Parking, Toll, Inspection theo PRD extension). State machines theo PRD §9.1 + §9.2. i18n EN/KO/VI. Audit log NFR-9, retention 5 năm NFR-10.

## 2. Tech Stack (fixed — KHÔNG đổi)

> Stack tối giản để giảm bề mặt hallucination. Mỗi item là **core, không có alternative trong v2**. Versions khoá theo `app-sales-report-v2` để monorepo nhất quán.

| Layer | Tool | Version | Note |
|---|---|---|---|
| Monorepo | **Turborepo** | ^2.3.3 | standalone trong v2/ |
| Framework | **Next.js 15 App Router** | ^15.1.3 | fullstack — RSC + Server Actions + Route Handlers |
| Runtime | **React** | ^19.0.0 | |
| Language | **TypeScript** | ^5.7.2 | strict, `noUncheckedIndexedAccess` |
| DB | **Neon Postgres** | — | serverless, branching cho dev/staging. Free tier ban đầu. |
| DB driver | **@neondatabase/serverless** | ^0.10.4 | HTTP driver |
| ORM | **Drizzle** | ^0.38.3 | + `drizzle-kit` ^0.30.1 |
| Storage | **AWS S3** | — | presigned URL direct upload (NFR-11 chứng từ ảnh+PDF) |
| Auth | **jose** | ^5.9.6 | verify AMA JWT, shared `JWT_SECRET` |
| Validation | **Zod** | ^3.24.1 | share schema client/server |
| UI | **Tailwind 3** | ^3.4.17 | + shadcn/ui patterns (add khi cần) |
| Icons | **lucide-react** | ^0.469.0 | |
| Forms | **React Hook Form** | ^7.54.2 | + `@hookform/resolvers` ^3.9.1 |
| i18n | **next-intl** | ^3.26.3 | App Router compatible, default `vi` |
| Test | **Vitest + Playwright** | — | thêm khi cần (P6 hardening) |
| PWA | **next-pwa** hoặc service worker manual | — | thêm ở P5 cho Driver mobile experience |
| **Deploy** | **Render.com** | Starter plan | 1 Web Service. Cron Job thêm ở P4 cho maintenance alerts. |

**KHÔNG dùng** trong v2:
- ❌ Vercel (Render.com)
- ❌ Inngest / Trigger.dev (DB queue khi cần)
- ❌ Sentry (Render logs)
- ❌ Redis / BullMQ
- ❌ Prisma (Drizzle chốt)
- ❌ tRPC, SWR, React Query (Server Actions + RSC đủ)
- ❌ NextAuth (passthrough JWT từ AMA, không tự issue token)

## 3. Cấu trúc folder

```
app-car-manager-v2/
├── CLAUDE.md                    ← bạn đang đọc
├── PRD.md                       ← ⭐ MVP source of truth
├── README.md                    ← first-time setup
├── car-management-standalone.html ← legacy Figma Make bundle (24MB) — same content as resources/
├── .env.example
├── .gitignore, .prettierrc.json
├── package.json, turbo.json     ← workspace root
├── tsconfig.base.json
├── render.yaml                  ← Render Blueprint (1 web service)
│
├── apps/
│   └── web/                     ← Next.js 15 fullstack
│       └── src/                  (xem chi tiết khi cần)
│
├── packages/
│   ├── db/                      ← Drizzle + Neon
│   ├── shared/                  ← Zod + types + errors
│   └── ui/                      ← cn() Tailwind util
│
├── resources/                   ← ❗gitignored, không sync git — design reference
│   └── claude-design/           ← Claude Design export (handoff bundle)
│       ├── README.md            ← handoff instructions from Claude Design
│       ├── index.html           ← Figma-style canvas entry (load 22 jsx)
│       ├── tokens.jsx           ← design tokens (Toss blue, Pretendard)
│       ├── ui.jsx               ← primitive components
│       ├── app.jsx              ← DesignCanvas orchestrator
│       ├── screens/             ← 16 .jsx files, 24+ screens
│       └── uploads/             ← ❗ SRS gốc khách hàng (.docx)
│
└── docs/
    ├── analysis/                ← REQ-YYYYMMDD-* (gồm prd-srs audit)
    ├── plan/                    ← PLAN-YYYYMMDD-*
    ├── test/                    ← TC-*, TR-*
    ├── implementation/          ← RPT-*
    └── log/                     ← daily conversation log (gitignored)
```

## 4. Nguyên tắc kiến trúc (MUST)

### 4.1 Multi-tenancy bắt buộc
Mọi bảng business data có `ent_id CHAR(36) NOT NULL`. Wrap mọi query Drizzle bằng helper `withEnt(entIdColumn, entId)` — không cho phép query raw không có `ent_id`.

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

### 4.3 DB naming convention
- Neon project: logical name `db_app_car_v2` (label trong tài liệu). Physical DB name trong project = **`neondb`** (Neon default — không đổi vì free tier 1 project là đủ; isolation thực sự đến từ table prefix + `ent_id`, không phải DB name)
- Table: `car_*` prefix snake_case plural — `car_vehicles`, `car_drivers`, `car_trips`, `car_trip_stopovers`, `car_expenses`, `car_expense_attachments`, `car_inspections`, `car_notifications`, `car_audit_logs`, `car_approval_rules`
- PK: `{prefix}_id` UUID — `cvh_id`, `drv_id`, `trp_id`, `exp_id`
- Column prefix mỗi domain (3 chữ):
  - `cvh_` Vehicle · `drv_` Driver · `trp_` Trip · `tst_` TripStopover
  - `exp_` Expense · `eat_` ExpenseAttachment · `ins_` Inspection
  - `ntf_` Notification · `aud_` AuditLog · `apr_` ApprovalRule · `usr_` User
- Cột: `{prefix}_{name}` — `cvh_plate_number`, `trp_pickup_address`
- Boolean: `{prefix}_is_{name}` — `cvh_is_active`
- Timestamps: `{prefix}_created_at`, `{prefix}_updated_at`, `{prefix}_deleted_at` (soft delete) — Postgres `TIMESTAMPTZ`
- ENUM: SCREAMING_SNAKE_CASE — `AVAILABLE`, `IN_USE`, `MAINTENANCE`, `RETIRED`
- Index: `idx_{table}_{col}` — `idx_car_vehicles_ent_status`

### 4.4 API convention
- Route Handler path: `/api/v1/*`
- Request body: snake_case · Response body: camelCase · Path param: camelCase · Resource segment: kebab-case
- Standard response: `{ success, data, error?, timestamp }`
- Error code: `CAR-E{4 digits}` — ví dụ `CAR-E0001` (invalid input), `CAR-E0403` (forbidden), `CAR-E0404` (not found), `CAR-E1001` (trip state invalid transition)

### 4.5 File naming
| Type | Pattern | Example |
|---|---|---|
| Page | `page.tsx` (App Router) | `app/(web)/trips/page.tsx` |
| Component | PascalCase | `TripCard.tsx` |
| Server Action | kebab-case `.action.ts` | `create-trip.action.ts` |
| Service | kebab-case `.service.ts` | `trip-state-machine.service.ts` |
| Drizzle schema | kebab-case `.schema.ts` | `trip.schema.ts` |
| Zod schema | kebab-case `.zod.ts` | `trip.zod.ts` |

### 4.6 Role mapping (AMA → app local)

PRD §4 yêu cầu 3 role: **Admin / Manager / Driver**. AMA chỉ có OWNER/MASTER/MANAGER/MEMBER. Map khi user lần đầu vào app:

| AMA role | App role |
|---|---|
| `OWNER`, `MASTER` | `ADMIN` |
| `MANAGER` | `MANAGER` |
| `MEMBER` | `DRIVER` |

Lưu cache trong `car_users.usr_local_role`. Admin có thể đổi role local nhưng AMA role là nguồn cuối — đồng bộ lại mỗi lần login.

### 4.7 Trip State Machine (PRD §9.1)

```
PENDING_ASSIGNMENT
  └─ Admin gán driver+vehicle ─►  PENDING_DRIVER_CONFIRMATION
                                    ├─ Driver Accept ─►  CONFIRMED
                                    │                      └─ Driver Start ─►  IN_PROGRESS
                                    │                                            └─ Driver End ─►  COMPLETED
                                    ├─ Driver Reject ─►  REJECTED_BY_DRIVER
                                    │                      └─ Admin re-assign ─►  PENDING_DRIVER_CONFIRMATION
                                    └─ Manager Cancel ─►  CANCELLED
```

Service `trip-state-machine.service.ts` là single source of truth cho transitions. Mọi mutation qua đây — KHÔNG cho phép set `trp_status` trực tiếp từ controller.

### 4.8 Expense approval policy (PRD §6.2.2 — chốt từ Q1)

Cấu hình theo loại + ngưỡng auto-approve. Lưu trong `car_approval_rules` (per `ent_id`). Default seed:

| Loại | requires_approval | auto_approve_threshold (VND) |
|---|---|---|
| `FUEL`, `OIL`, `PARKING`, `TOLL` | false | — |
| `MEAL` | false | cảnh báo nếu > 500,000 |
| `ACCIDENT` | true | — (luôn cần Admin) |
| `REPAIR` | true | 1,000,000 (dưới → auto APPROVED) |
| `INSPECTION` | false | — |

## 5. Tích hợp với ambManagement

1. **JWT Passthrough**: AMA issue JWT chứa `entId`, `userId`, `role` → app verify bằng shared `JWT_SECRET` (env). Middleware Next.js đọc `?ama_token=` lần đầu → set HttpOnly cookie → verify mọi request sau.
2. **Đăng ký**: admin AMA tạo record `amb_entity_custom_apps` với `eca_code=car-manager-v2`, `eca_url=<deploy_url>`, `eca_auth_mode=jwt`, `eca_open_mode=iframe`.
3. **iframe sandbox**: app phải work trong iframe. CSP `frame-ancestors` cho phép domain AMA (set trong `next.config.ts`).
4. **Locale**: nhận `?locale=ko|en|vi` từ AMA → init i18n (default `vi`).

## 6. Roadmap (phased delivery)

| Phase | Scope | Status |
|---|---|---|
| **P0 Foundation** | Bootstrap Turborepo, Next.js, Drizzle+Neon, S3 client, JWT middleware, i18n 3 ngôn ngữ, port Sidebar+AppFrame+LoginScreen, deploy "hello" lên Render | ✅ done |
| **P1 Trip MVP** | Vehicle CRUD, Driver CRUD, User+Roles, NewTripForm, TripsList, TripDetail, full state machine + audit log + notification stub (DB queue only) | ✅ done |
| **P2 Expense MVP** | 8 loại expense (5 PRD + 3 prototype), S3 presigned upload, approval queue, auto-approve threshold, expense lock 7 ngày | ✅ done |
| **P3 Reports + Dashboard** | DashboardA+B, CalendarView+Month, ReportsScreen, export Excel+PDF | ✅ done |
| **P4 Comprehensive (Notify + Conflict + Maintenance)** | (1) Email transport (Resend hoặc SES) + Web Push (VAPID + service worker) wire vào `notification.service` thay stub. (2) Schedule conflict **soft-warning** cho vehicle + driver overlap (PRD R-1/R-2 R3). (3) Render Cron Job (maintenance alert daily), OilOverdueAlert UI. | 🚧 **in progress** (current) |
| **P5 Mobile PWA** | Driver tab routes, installable PWA, offline cache cho expense (E5), camera + nén client-side | pending |
| **P6 Hardening** | Playwright suite từ PRD §11, accessibility (NFR-8), perf (NFR-1), 5-năm retention policy | pending |

### 6.1 P4 Comprehensive breakdown (current focus)

**Gap A — Notification transport** (PRD FR-1.2):
- Email: Resend (ưu tiên — DX tốt) hoặc AWS SES (giá rẻ hơn ở scale). Template VI/EN/KO theo locale của recipient.
- Web Push: VAPID keys (env `WEB_PUSH_VAPID_PUBLIC`, `WEB_PUSH_VAPID_PRIVATE`), service worker (`apps/web/public/sw.js`), subscription endpoint mới `/api/v1/push/subscribe`, lưu subscription vào table mới `car_push_subscriptions` (per `usr_id`).
- `notification.service.ts` mở rộng: sau khi insert `car_notifications`, fan-out qua Email + Push dựa trên `ntf_event` whitelist + user preference (sau này — MVP P4 gửi tất cả).

**Gap B — Schedule conflict soft-warning** (PRD R-1, R-2 + FR-1.2 R3):
- Service mới `trip-conflict.service.ts` (pure, no `next/*` import). Hàm `findVehicleConflicts(entId, vehicleId, start, end, excludeTripId?)` và `findDriverConflicts(entId, driverId, start, end, excludeTripId?)`.
- Quét trên `car_trips` với status ∈ {`PENDING_DRIVER_CONFIRMATION`, `CONFIRMED`, `IN_PROGRESS`}, soft-deleted excluded.
- Server actions `createTripAction`, `assignTripAction`, `updateTripAction` gọi service → trả về `{ conflicts: ConflictSummary[] }` cùng với `data` thay vì chặn.
- UI: banner màu warning trên `new-trip-form`, `edit-trip-form`, và `AssignDialog` — list tối đa 3 conflict với link tới trip detail. Nếu admin save anyway → audit log `TRIP.CONFLICT_OVERRIDDEN` với payload `{ overriddenConflicts: trpIds[] }`.

## 7. Workflow yêu cầu mới

Theo root [CLAUDE.md](../../CLAUDE.md), khi tag `[요구사항]` / `[requirement]`:
1. `docs/analysis/REQ-YYYYMMDD-*.md`
2. `docs/plan/PLAN-YYYYMMDD-*.md`
3. `docs/test/TC-YYYYMMDD-*.md`
4. Implement
5. `docs/test/TR-YYYYMMDD-*.md`
6. `docs/implementation/RPT-YYYYMMDD-*.md`

## 8. Cấm

- ❌ Hard-code text UI → phải qua i18n (vi/en/ko)
- ❌ Direct DB call từ Client Component → phải qua Server Action
- ❌ Query không có `ent_id` filter (multi-tenancy bypass)
- ❌ Set `trp_status` trực tiếp — phải qua `trip-state-machine.service`
- ❌ Push prod trước khi staging xanh
- ❌ Lưu file ảnh chứng từ vào DB (BLOB) → phải vào S3, DB chỉ giữ key
- ❌ Commit `.env*` (chỉ commit `.env.example`)
- ❌ UPDATE/DELETE trên `car_audit_logs` — DB chỉ cho INSERT
- ❌ Hard-code ngưỡng auto-approve — phải đọc từ `car_approval_rules` (theo `ent_id`)
- ❌ Xoá cứng (DELETE) bản ghi Trip/Expense/Vehicle/Driver — soft delete via `*_deleted_at`
- ❌ Implement feature có trong prototype nhưng PRD không yêu cầu (xem §9 divergence table)
- ❌ Triển khai logic theo SRS gốc nếu PRD đã override (xem §9)
- ❌ Gọi `notifyUser()` rồi giả định email/push đã gửi — phải verify đường truyền (Resend/SES + Web Push) thật sự queue và acknowledge (P4)
- ❌ Block save khi conflict detected — soft-warning chỉ cảnh báo, admin có quyền save anyway (PRD R-1/R-2 R3)

## 9. PRD ↔ SRS ↔ Prototype divergences

Audit chính thức: [docs/analysis/REQ-20260512-prd-srs-audit.md](docs/analysis/REQ-20260512-prd-srs-audit.md).

**Quy tắc giải quyết**: bám PRD. 6 divergence dưới đây đã chốt (D3 được revisit ở R3 Post-MVP):

| # | Item | SRS gốc | Prototype | PRD | MVP follow | File hash check |
|---|---|---|---|---|---|---|
| D1 | Trip Driver field | bắt buộc | required UI | **tùy chọn** (Admin gán sau) | **PRD = tùy chọn** | `car_trips.trp_driver_id NULLABLE` |
| D2 | Trip Vehicle field | bắt buộc | required UI | **tùy chọn** (Admin gán sau) | **PRD = tùy chọn** | `car_trips.trp_vehicle_id NULLABLE` |
| D3 | Schedule conflict check | có (warn, block) | UI banner + calendar pill | **R3 (2026-05-18): soft-warning, không block** | **Implement Post-MVP P4** — soft-warning mode | `trip-conflict.service.ts` + UI banner |
| D4 | Ngôn ngữ | EN + KR | EN+KR+VI | **EN+KR+VI** | **3 ngôn ngữ** | `messages/{vi,en,ko}.json` |
| D5 | Cost categories | 5 (Fuel/Oil/Accident/Meal/Repair) | 8 | **8** (5 SRS + 3 PRD: Parking/Toll/Inspection) | **8 trong MVP** | `car_expense_type` enum: 8 values |
| D6 | GPS turn-by-turn navigation | không | **CÓ** (6 màn driver-trip-nav) | **Won't-have §1.3** | **KHÔNG implement** | (design-only, ignore prototype này) |
| D7 | Driver Performance Card · AI Insight · Driver Availability toggle | không | có | không nhấn mạnh | **KHÔNG implement MVP** | (defer) |

**Nguyên tắc áp dụng:**

1. Khi code Server Action / schema / API: bám **PRD §6 (Functional)** + **PRD §9 (Business rules)** — không phải SRS gốc, không phải prototype.
2. Khi port UI: tham khảo prototype cho **visual + interaction** (Tailwind tokens, layout, components). Bỏ qua các screen trong divergence D6/D7.
3. Khi gặp ambiguity trong PRD: đọc SRS gốc ở [resources/.../uploads/](resources/claude-design/uploads/) để hiểu intent KH, rồi quyết định + log vào `docs/analysis/REQ-YYYYMMDD-*.md`.
4. Nếu KH yêu cầu mở rộng scope MVP → tạo `[요구사항]` workflow mới (REQ → PLAN → TC → ...).
