# PLAN-20260519 — Module 2: Quản Lý Chi Phí & Bảo Dưỡng

> **Ngày tạo**: 2026-05-19
> **REQ liên quan**: [REQ-20260519-module2-expense-maintenance.md](../analysis/REQ-20260519-module2-expense-maintenance.md)
> **Estimated effort**: 16-20 giờ (1 dev) | có thể parallel UI ↔ BE từ Phase 3

---

## 1. Hiện Trạng Hệ Thống

### 1.1 Stack đã sẵn sàng
- ✅ Next.js 15 App Router · React 19 · TypeScript 5.7 strict
- ✅ Drizzle ORM + Neon Postgres (3 migrations đã apply)
- ✅ JWT middleware verify AMA token + ent_id helper `withEnt()`
- ✅ next-intl 3 ngôn ngữ vi/en/ko
- ✅ notification.service + email.service + push.service (P4 done)
- ✅ audit-log.service (P1 done)
- ✅ Render deploy đang chạy

### 1.2 Khoảng cách so với TO-BE
Xem [REQ §4](../analysis/REQ-20260519-module2-expense-maintenance.md#4-gap-analysis). Tóm tắt:
- 0% DB expense/maintenance — cần tạo từ đầu
- 0% backend service/action
- 0% frontend functional (chỉ mockup tĩnh)
- S3 SDK chưa có trong package.json — cần thêm `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`

### 1.3 Constraints
- KHÔNG đổi tech stack (CLAUDE.md §2)
- KHÔNG bypass `withEnt()` (CLAUDE.md §4.1)
- KHÔNG modify trip state machine trực tiếp — phải qua service (CLAUDE.md §4.7)
- Migration additive only (không drop column hiện có)
- Mọi expense action phải tạo audit log

---

## 2. Phân Phase Triển Khai

### Phase 0 — Setup (~30 phút)
**Mục tiêu**: cài SDK, env, type definitions.

| Step | Task | File | Side Impact |
|---|---|---|---|
| 0.1 | Add S3 SDK | `apps/web/package.json`, root `package.json` (nếu hoist) | └─ npm install lại |
| 0.2 | Update `.env.example` | `.env.example` | └─ Dev cần re-copy `.env` |
| 0.3 | Thêm S3 config validator | `apps/web/src/lib/env.ts` (nếu có) hoặc tạo mới | └─ Boot fail nếu thiếu env (intentional) |
| 0.4 | Update next.config.mjs CSP | `next.config.mjs` | └─ img-src thêm S3 domain pattern |

### Phase 1 — Database Schema + Migration (~2 giờ)
**Mục tiêu**: schema Drizzle + migration SQL + indexes + ENUMs.

| Step | Task | File | Side Impact |
|---|---|---|---|
| 1.1 | Tạo `expenses.schema.ts` | `packages/db/src/schema/expenses.schema.ts` | └─ Export types `CarExpense*` |
| 1.2 | Tạo `expense-attachments.schema.ts` | `packages/db/src/schema/expense-attachments.schema.ts` | └─ FK → `car_expenses` |
| 1.3 | Tạo `maintenance-alerts.schema.ts` | `packages/db/src/schema/maintenance-alerts.schema.ts` | └─ FK → `car_vehicles` |
| 1.4 | Bổ sung `vehicles.schema.ts` | `packages/db/src/schema/vehicles.schema.ts` | └─ +3 cột inspection — nullable, ko break query hiện có |
| 1.5 | Export trong `index.ts` | `packages/db/src/schema/index.ts` | └─ Tránh duplicate export |
| 1.6 | Generate migration | `npx drizzle-kit generate` → `migrations/0003_*.sql` | └─ Verify SQL trước khi commit |
| 1.7 | Manual edit migration | Thêm partial index `WHERE exp_deleted_at IS NULL`, JSONB GIN index | └─ Drizzle không sinh partial index tự động |
| 1.8 | Test migration trên Neon dev branch | CLI | └─ Rollback nếu lỗi |

**DB Migration SQL preview** (sẽ ở `0003_module2_expenses_maintenance.sql`):
```sql
-- ENUM
CREATE TYPE car_expense_type AS ENUM ('FUEL','OIL','ACCIDENT','MEAL','REPAIR','OTHER');
CREATE TYPE car_expense_status AS ENUM ('RECORDED','VOIDED');
CREATE TYPE car_maintenance_alert_type AS ENUM ('OIL_OVERDUE','OIL_DUE_SOON','INSPECTION_OVERDUE','INSPECTION_DUE_SOON');
CREATE TYPE car_maintenance_alert_severity AS ENUM ('WARNING','CRITICAL');

-- Tables
CREATE TABLE car_expenses (...);
CREATE TABLE car_expense_attachments (...);
CREATE TABLE car_maintenance_alerts (...);

-- Vehicle additions
ALTER TABLE car_vehicles
  ADD COLUMN cvh_last_inspection_at TIMESTAMPTZ NULL,
  ADD COLUMN cvh_next_inspection_at TIMESTAMPTZ NULL,
  ADD COLUMN cvh_inspection_interval_months SMALLINT NOT NULL DEFAULT 12;

-- Indexes (partial WHERE for soft-delete)
CREATE UNIQUE INDEX uniq_car_expenses_ent_ref ON car_expenses (ent_id, exp_ref) WHERE exp_deleted_at IS NULL;
CREATE INDEX idx_car_expenses_ent_vehicle_at ON car_expenses (ent_id, exp_vehicle_id, exp_occurred_at DESC) WHERE exp_deleted_at IS NULL;
CREATE INDEX idx_car_expenses_ent_type_at ON car_expenses (ent_id, exp_type, exp_occurred_at DESC) WHERE exp_deleted_at IS NULL;
CREATE INDEX idx_car_expense_attachments_expense ON car_expense_attachments (eat_expense_id);
CREATE INDEX idx_car_maintenance_alerts_ent_unresolved ON car_maintenance_alerts (ent_id, mal_vehicle_id) WHERE mal_resolved_at IS NULL;
```

### Phase 2 — Zod Schema + Shared Types (~1 giờ)
**Mục tiêu**: discriminated union cho payload theo type; share client/server.

| Step | Task | File | Side Impact |
|---|---|---|---|
| 2.1 | Tạo `expense.zod.ts` | `packages/shared/src/zod/expense.zod.ts` | └─ Export `CreateExpenseSchema`, `UpdateExpenseSchema`, `ExpensePayloadSchema` (discriminated union) |
| 2.2 | Tạo `maintenance-alert.zod.ts` | `packages/shared/src/zod/maintenance-alert.zod.ts` | └─ Ack action schema, manual oil reset schema |
| 2.3 | Re-export trong `packages/shared/src/index.ts` | | └─ Auto |

### Phase 3 — Backend Services (~3 giờ)
**Mục tiêu**: business logic pure (không phụ thuộc Next.js).

| Step | Task | File | Side Impact |
|---|---|---|---|
| 3.1 | `s3.service.ts` — presigned PUT URL generator | `apps/web/src/server/services/s3.service.ts` | └─ Reuse cho mọi attachment future |
| 3.2 | `expense.service.ts` — create/update/void/list logic | `apps/web/src/server/services/expense.service.ts` | └─ Phải atomic OIL update vehicle (db.transaction) |
| 3.3 | `expense-ref.service.ts` — sequence generator `EXP-XXXXXX` | tích hợp trong expense.service hoặc tách file | └─ Tương tự `trip-ref.service.ts` |
| 3.4 | `maintenance-alert.service.ts` — evaluator + ack + manual reset | `apps/web/src/server/services/maintenance-alert.service.ts` | └─ Sẽ gọi từ cron + từ expense.service (resolve alert) |
| 3.5 | `expenses.queries.ts` — RSC queries (list + detail) | `apps/web/src/server/queries/expenses.queries.ts` | └─ Pagination cursor-based |
| 3.6 | `maintenance-alerts.queries.ts` — list unresolved + acknowledged | `apps/web/src/server/queries/maintenance-alerts.queries.ts` | └─ Filter theo ent + vehicle |
| 3.7 | Update `trip-state-machine.service.ts` (nếu chưa có BR-3) | `apps/web/src/server/services/trip-state-machine.service.ts` | └─ Khi trip → COMPLETED + có `trp_end_odometer` → update `cvh_odometer_km` (nếu lớn hơn) |

### Phase 4 — Server Actions + Route Handlers (~2 giờ)
**Mục tiêu**: HTTP layer wrap services + permission check.

| Step | Task | File | Side Impact |
|---|---|---|---|
| 4.1 | `create-expense.action.ts` | `apps/web/src/server/actions/expenses/create-expense.action.ts` | └─ Validate Zod, check role, call service |
| 4.2 | `update-expense.action.ts` | `apps/web/src/server/actions/expenses/update-expense.action.ts` | └─ Check 7-day lock, ownership |
| 4.3 | `void-expense.action.ts` | `apps/web/src/server/actions/expenses/void-expense.action.ts` | └─ Admin only, require reason |
| 4.4 | `presign-attachment.action.ts` | `apps/web/src/server/actions/expenses/presign-attachment.action.ts` | └─ Trả về `{ url, fields, s3Key }`, lifetime 5min |
| 4.5 | `acknowledge-alert.action.ts` | `apps/web/src/server/actions/maintenance/acknowledge-alert.action.ts` | └─ Admin/Manager |
| 4.6 | `reset-oil-change.action.ts` | `apps/web/src/server/actions/maintenance/reset-oil-change.action.ts` | └─ Admin only, manual reset |
| 4.7 | `/api/v1/cron/maintenance-alert/route.ts` | `apps/web/src/app/api/v1/cron/maintenance-alert/route.ts` | └─ Bearer CRON_SECRET, idempotent, return summary |

### Phase 5 — Frontend Components (~5 giờ)
**Mục tiêu**: responsive (mobile-first 390px, desktop ≥768px) UI cho list + form.

| Step | Task | File | Side Impact |
|---|---|---|---|
| 5.1 | **Rewrite** `/costs` page | `apps/web/src/app/(app)/costs/page.tsx` | └─ Xoá toàn bộ mockup `PENDING`, dùng RSC `getExpensesList()` |
| 5.2 | `ExpenseListItem.tsx` | `apps/web/src/components/expenses/ExpenseListItem.tsx` | └─ Row trong list, click → drawer detail |
| 5.3 | `ExpenseDetailDrawer.tsx` | `apps/web/src/components/expenses/ExpenseDetailDrawer.tsx` | └─ Right-side sheet (desktop) / full-screen modal (mobile) |
| 5.4 | `ExpenseFilters.tsx` | `apps/web/src/components/expenses/ExpenseFilters.tsx` | └─ Filter bar (URL state) |
| 5.5 | `ExpenseFormModal.tsx` (orchestrator) | `apps/web/src/components/expenses/ExpenseFormModal.tsx` | └─ Switch type-specific subform |
| 5.6 | `FuelExpenseForm.tsx`, `OilExpenseForm.tsx`, `AccidentExpenseForm.tsx`, `MealExpenseForm.tsx`, `RepairExpenseForm.tsx`, `OtherExpenseForm.tsx` | `apps/web/src/components/expenses/forms/` | └─ React Hook Form + zod resolver |
| 5.7 | `AttachmentUploader.tsx` | `apps/web/src/components/expenses/AttachmentUploader.tsx` | └─ Direct S3 PUT, progress bar, preview thumbnail |
| 5.8 | `AttachmentGrid.tsx` | `apps/web/src/components/expenses/AttachmentGrid.tsx` | └─ Show thumbnail + lightbox click |
| 5.9 | `OilOverdueBanner.tsx` | `apps/web/src/components/maintenance/OilOverdueBanner.tsx` | └─ Sticky top khi CRITICAL |
| 5.10 | `MaintenanceAlertList.tsx` | `apps/web/src/components/maintenance/MaintenanceAlertList.tsx` | └─ Used in Today page |
| 5.11 | `MaintenanceAlertItem.tsx` + `ResetOilChangeModal.tsx` | tương tự | └─ Manual reset form |
| 5.12 | Update Today page (Admin/Manager) | `apps/web/src/app/(app)/today/page.tsx` | └─ Thêm widget MaintenanceAlertList |
| 5.13 | Update Vehicle detail (nếu page có) | `apps/web/src/app/(app)/vehicles/[id]/page.tsx` | └─ Panel "Bảo dưỡng": current km, last oil, next inspection, [Reset] button |

### Phase 6 — i18n (~1 giờ)
**Mục tiêu**: rewrite `costs.*`, add `maintenance.*` cho 3 ngôn ngữ.

| Step | Task | File |
|---|---|---|
| 6.1 | Rewrite `costs.*` namespace (vi/en/ko) | `apps/web/messages/{vi,en,ko}.json` |
| 6.2 | Add `maintenance.*` namespace | tương tự |
| 6.3 | Add email/push templates EN/KO/VI cho `EXPENSE.ACCIDENT_REPORTED`, `MAINTENANCE.OIL_OVERDUE`, `MAINTENANCE.INSPECTION_DUE_SOON` | `apps/web/src/server/services/notification-template.service.ts` |

### Phase 7 — Infra & Render (~30 phút)
| Step | Task | File |
|---|---|---|
| 7.1 | Thêm cron service vào `render.yaml` | `render.yaml` |
| 7.2 | Setup S3 bucket policy + CORS (manual AWS console hoặc Terraform sau) | (external) |
| 7.3 | Update env vars trên Render dashboard (S3, CRON_SECRET) | (external) |

### Phase 8 — Cleanup & Docs (~1 giờ)
| Step | Task | File |
|---|---|---|
| 8.1 | Revise PRD §6.2.2 (bỏ approval) | `PRD.md` |
| 8.2 | Revise CLAUDE.md §4.8 (xoá approval table) + §6 update P2/P4 status | `CLAUDE.md` |
| 8.3 | Update memory `project_car_v2_phase.md` | `~/.claude/.../memory/` |
| 8.4 | Viết RPT-20260519-* sau khi xong | `docs/implementation/` |

---

## 3. Variants File Tổng Hợp

| Khu vực | File | Hành động | Phase |
|---|---|---|---|
| **Backend** | `packages/db/src/schema/expenses.schema.ts` | NEW | 1.1 |
| Backend | `packages/db/src/schema/expense-attachments.schema.ts` | NEW | 1.2 |
| Backend | `packages/db/src/schema/maintenance-alerts.schema.ts` | NEW | 1.3 |
| Backend | `packages/db/src/schema/vehicles.schema.ts` | EDIT | 1.4 |
| Backend | `packages/db/src/schema/index.ts` | EDIT | 1.5 |
| Backend | `packages/db/migrations/0003_*.sql` | NEW | 1.6 |
| Backend | `packages/shared/src/zod/expense.zod.ts` | NEW | 2.1 |
| Backend | `packages/shared/src/zod/maintenance-alert.zod.ts` | NEW | 2.2 |
| Backend | `apps/web/src/server/services/s3.service.ts` | NEW | 3.1 |
| Backend | `apps/web/src/server/services/expense.service.ts` | NEW | 3.2 |
| Backend | `apps/web/src/server/services/maintenance-alert.service.ts` | NEW | 3.4 |
| Backend | `apps/web/src/server/queries/expenses.queries.ts` | NEW | 3.5 |
| Backend | `apps/web/src/server/queries/maintenance-alerts.queries.ts` | NEW | 3.6 |
| Backend | `apps/web/src/server/services/trip-state-machine.service.ts` | EDIT (conditional) | 3.7 |
| Backend | `apps/web/src/server/actions/expenses/*.action.ts` (4 files) | NEW | 4.1-4.4 |
| Backend | `apps/web/src/server/actions/maintenance/*.action.ts` (2 files) | NEW | 4.5-4.6 |
| Backend | `apps/web/src/app/api/v1/cron/maintenance-alert/route.ts` | NEW | 4.7 |
| **Frontend** | `apps/web/src/app/(app)/costs/page.tsx` | **REWRITE** | 5.1 |
| Frontend | `apps/web/src/components/expenses/*` (8-9 files) | NEW | 5.2-5.8 |
| Frontend | `apps/web/src/components/expenses/forms/*` (6 files) | NEW | 5.6 |
| Frontend | `apps/web/src/components/maintenance/*` (3-4 files) | NEW | 5.9-5.11 |
| Frontend | `apps/web/src/app/(app)/today/page.tsx` | EDIT | 5.12 |
| Frontend | `apps/web/src/app/(app)/vehicles/[id]/page.tsx` | EDIT (nếu tồn tại) | 5.13 |
| **i18n** | `apps/web/messages/{vi,en,ko}.json` | EDIT | 6.1-6.2 |
| Notify | `apps/web/src/server/services/notification-template.service.ts` | EDIT | 6.3 |
| **Infra** | `render.yaml` | EDIT | 7.1 |
| Infra | `apps/web/next.config.mjs` | EDIT (CSP) | 0.4 |
| Config | `apps/web/.env.example` | EDIT | 0.2 |
| Config | `apps/web/package.json` | EDIT (+S3 SDK) | 0.1 |
| **Docs** | `PRD.md` | EDIT (§6.2.2) | 8.1 |
| Docs | `CLAUDE.md` (app) | EDIT (§4.8, §6) | 8.2 |
| Docs | `docs/test/TC-20260519-*.md` | NEW | (giữa Phase 4-5) |
| Docs | `docs/implementation/RPT-20260519-*.md` | NEW | 8.4 |

**Tổng**: ~38 file mới + ~10 file edit.

---

## 4. Side Impact Analysis

| Vùng ảnh hưởng | Mức rủi ro | Mô tả | Mitigation |
|---|---|---|---|
| `car_vehicles` table | 🟢 LOW | +3 nullable column — không break query hiện có | Migration additive, default cho `cvh_inspection_interval_months` |
| `trip-state-machine.service.ts` | 🟡 MEDIUM | Thêm side effect update odometer khi COMPLETED — có thể đã tồn tại | Verify trước, nếu đã có thì skip 3.7 |
| `notification.service.ts` | 🟢 LOW | Thêm event types — extension, không break | Append-only event map |
| Reports M3 (`/reports`) | 🟡 MEDIUM | Reports đang group theo 8 type, giờ còn 6 (bỏ PARKING/TOLL/INSPECTION) | Update report aggregation; data cũ (nếu có) không tồn tại nên không vấn đề |
| Dashboard (`/today`) | 🟡 MEDIUM | Thêm MaintenanceAlertList widget — chiếm space | Show có conditional theo role |
| `/costs` page | 🔴 HIGH (intended) | Rewrite hoàn toàn — link cũ vẫn work | Test bottom-tab nav, breadcrumb |
| i18n `costs.*` | 🟡 MEDIUM | Xoá nhiều key — nếu component khác tham chiếu sẽ break | Grep verify trước khi xoá |
| `render.yaml` | 🟡 MEDIUM | +cron service → tăng cost ~$1-3/tháng | Acceptable cho production; có thể skip ở staging tier |
| CSP `next.config.mjs` | 🟢 LOW | Thêm S3 domain vào `img-src` | Test image render |
| Existing trips | 🟢 LOW | Không touch | — |

---

## 5. DB Migration Strategy

### 5.1 Staging
1. Verify migration `0003_*.sql` đúng cú pháp Postgres
2. Run trên Neon dev branch trước (`db_app_car_v2/dev`)
3. Smoke test schema + index
4. Apply trên Neon main branch (staging) qua deploy pipeline

### 5.2 Production
1. **Backup**: tạo Neon branch `prod-before-module2-20260519`
2. **Run migration** trong maintenance window (low traffic ~04:00 ICT)
3. **Verify**: query 3 bảng mới, count = 0, indexes exist
4. **Rollback plan**: drop 3 bảng + 3 cột + 4 enums (script viết sẵn ở Phase 8 RPT)

### 5.3 Drizzle synchronize
- `drizzle.config.ts` đã set `strict: true` — không tự sync trên prod
- Chạy `npx drizzle-kit migrate` thủ công

---

## 6. Test Plan (TC sẽ viết riêng ở Phase 4)

### 6.1 Unit (services)
- `expense.service.ts`: create/update/void với từng type, OIL update vehicle, 7-day lock
- `maintenance-alert.service.ts`: evaluator logic OIL_OVERDUE/DUE_SOON, INSPECTION_*
- `s3.service.ts`: presigned URL TTL + content-type restriction

### 6.2 Integration (server actions)
- Permission matrix: Admin/Manager/Driver mỗi action
- Audit log assertion
- Notification dispatch verify

### 6.3 E2E (Playwright — defer P6 hardening)
- Driver: tạo FUEL → list → edit → ✓ ref EXP-XXXXXX
- Driver: tạo ACCIDENT thiếu ảnh → block
- Admin: ack alert → mất khỏi list unresolved
- Cron: gọi `/api/v1/cron/maintenance-alert` với secret → tạo alert
- 7-day lock: tạo expense → fake `trp_ended_at = 8 ngày trước` → edit fail

### 6.4 Manual (mobile)
- iPhone Safari 390×844: form usability
- Android Chrome: image upload qua S3 presigned
- 3 ngôn ngữ chuyển đổi

---

## 7. Sequencing & Dependencies

```
Phase 0 (setup) ──► Phase 1 (DB) ──► Phase 2 (Zod) ──► Phase 3 (Services)
                                                              │
                                                              ▼
                                                       Phase 4 (Actions + API)
                                                              │
                                            ┌─────────────────┼─────────────────┐
                                            ▼                 ▼                 ▼
                                       Phase 5 (FE)      Phase 6 (i18n)    Phase 7 (Infra)
                                            └─────────────────┴─────────────────┘
                                                              │
                                                              ▼
                                                       Phase 8 (Cleanup + Docs)
```

UI có thể start song song khi Phase 3 service interface đã định nghĩa (mock data trước).

---

## 8. Definition of Done

- [ ] Tất cả file trong §3 đã tạo/sửa
- [ ] Migration `0003_*.sql` apply thành công cả staging + prod
- [ ] Type check `npm run typecheck` pass
- [ ] Lint `npm run lint` pass
- [ ] Manual test 6 type expense (Admin + Driver) trên Chrome desktop
- [ ] Manual test mobile 390px (Safari simulator)
- [ ] Cron job verified bằng manual POST + 1 lần auto-trigger
- [ ] i18n 3 ngôn ngữ verified — không key `t('...')` rỗng
- [ ] PRD + CLAUDE.md đã revise
- [ ] TC + TR + RPT đã viết

---

## 9. Decisions (chốt 2026-05-19)

| # | Decision | **Quyết định** |
|---|---|---|
| D1 | EXPENSE_LOCK_DAYS = 7 cho expense gắn trip hay tất cả? | Gắn trip: 7 ngày từ `trp_ended_at`. Không gắn trip: 7 ngày từ `exp_created_at`. Admin không bị lock. |
| D2 | Driver edit expense của mình trong bao lâu? | 7 ngày từ created (thống nhất D1) |
| D3 | Manager tạo expense? | ✅ **CÓ** giống Driver |
| D4 | Maintenance alert recipient? | Admin + Manager (in-app + email + push) |
| D5 | Inspection due-soon threshold? | 7 ngày |
| D6 | `OilOverdueBanner` scope? | **Sticky top mọi page** cho Admin/Manager khi CRITICAL. Dismissible per session (localStorage) |
| D7 | Toast khi tạo expense thành công? | ✅ Có |
| D8 | S3 path layout? | `expenses/{ent_id}/{exp_id}/{eat_id}-{filename}` |
| D9 | Render Cron deploy? | KHÔNG đăng ký đợt này. Chỉ code endpoint + CLI manual trigger. Defer 1 PR riêng sau verify. → **Phase 7 cắt giảm**: chỉ làm 7.1 (env vars), bỏ 7.2-7.3 |

→ All decisions resolved. Sẵn sàng Phase 0.
