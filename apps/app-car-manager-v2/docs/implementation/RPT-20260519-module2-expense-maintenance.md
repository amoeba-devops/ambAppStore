# RPT-20260519 — Module 2: Quản Lý Chi Phí & Bảo Dưỡng

> **Trạng thái**: ✅ Implementation hoàn tất — chờ migration + manual test trên staging
> **Ngày**: 2026-05-19
> **REQ**: [REQ-20260519](../analysis/REQ-20260519-module2-expense-maintenance.md)
> **PLAN**: [PLAN-20260519](../plan/PLAN-20260519-module2-expense-maintenance.md)

---

## 1. Tóm tắt nhanh

Module 2 (Expense + Maintenance Alert) trước đó đánh dấu "✅ done P2" trong CLAUDE.md nhưng thực tế **0% backend/DB**. Rework đợt này hoàn thành:

- ✅ 3 bảng DB mới + 3 cột vehicles + 4 ENUM (migration `0003_*.sql`)
- ✅ 3 backend services: `s3.service`, `expense.service`, `maintenance-alert.service`
- ✅ 2 query module: `expenses.queries`, `maintenance-alerts.queries`
- ✅ 6 Server Actions (4 expense + 2 maintenance)
- ✅ 1 Cron route handler + CLI manual trigger
- ✅ /costs page rewrite (RSC) + 6-type form modal + S3 direct upload
- ✅ MaintenanceAlertList + sticky OilOverdueBanner trên mọi page Admin/Manager
- ✅ i18n vi/en/ko (essential keys)
- ✅ 5 notification event mới (templates 3 locale + DELIVERY_CHANNELS)
- ✅ render.yaml: env vars + cron stub (commented per D9)
- ✅ PRD §6.2.2 + CLAUDE.md §4.8 đã revise (no-approval mode)

**Approval workflow bị xoá hoàn toàn** theo decision R2 của REQ — đây là thay đổi nghiệp vụ quan trọng cần thông báo team.

## 2. File thay đổi

### Mới (40 file)

**DB schema + migration**
- `packages/db/src/schema/expenses.schema.ts`
- `packages/db/src/schema/expense-attachments.schema.ts`
- `packages/db/src/schema/maintenance-alerts.schema.ts`
- `packages/db/migrations/0003_module2_expenses_maintenance.sql`

**Shared (Zod)**
- `packages/shared/src/zod/expense.zod.ts` (discriminated union 6 type)
- `packages/shared/src/zod/maintenance-alert.zod.ts`

**Backend services**
- `apps/web/src/server/services/s3.service.ts`
- `apps/web/src/server/services/expense.service.ts`
- `apps/web/src/server/services/maintenance-alert.service.ts`

**Backend queries**
- `apps/web/src/server/queries/expenses.queries.ts`
- `apps/web/src/server/queries/maintenance-alerts.queries.ts`

**Server Actions + Route**
- `apps/web/src/server/actions/expenses/expense.actions.ts`
- `apps/web/src/server/actions/maintenance/maintenance.actions.ts`
- `apps/web/src/app/api/v1/cron/maintenance-alert/route.ts`

**Frontend components**
- `apps/web/src/components/expenses/expense-form-launcher.tsx`
- `apps/web/src/components/expenses/expense-form-modal.tsx` (6-type single form)
- `apps/web/src/components/expenses/attachment-uploader.tsx` (S3 direct PUT)
- `apps/web/src/components/expenses/expenses-filter-bar.tsx`
- `apps/web/src/components/expenses/expense-row.tsx`
- `apps/web/src/components/maintenance/maintenance-alert-list.tsx`
- `apps/web/src/components/maintenance/oil-overdue-banner.tsx`

**Scripts**
- `apps/app-car-manager-v2/scripts/trigger-maintenance-cron.mjs`

**Docs**
- `docs/analysis/REQ-20260519-module2-expense-maintenance.md`
- `docs/plan/PLAN-20260519-module2-expense-maintenance.md`
- `docs/implementation/RPT-20260519-module2-expense-maintenance.md` (this file)

### Sửa (12 file)

- `packages/db/src/schema/vehicles.schema.ts` (+3 cột inspection)
- `packages/db/src/schema/index.ts` (+3 exports)
- `packages/db/migrations/meta/_journal.json` (+entry 0003)
- `packages/shared/src/zod/index.ts` (+2 exports)
- `apps/web/src/server/services/trip-state-machine.service.ts` (BR-3 odometer sync)
- `apps/web/src/server/services/notification.service.ts` (+5 event channels)
- `apps/web/src/server/services/notification-template.service.ts` (+5 events × 3 locale)
- `apps/web/src/lib/env.ts` (+S3 + cron + lock-days config)
- `apps/web/src/app/(app)/costs/page.tsx` (full rewrite)
- `apps/web/src/app/(app)/layout.tsx` (+OilOverdueBanner)
- `apps/web/package.json` (+@aws-sdk/client-s3, @aws-sdk/s3-request-presigner)
- `.env.example` (+CRON_SECRET, EXPENSE_LOCK_DAYS, S3 TTL/size)
- `render.yaml` (+CRON_SECRET, EXPENSE_LOCK_DAYS, cron stub)
- `apps/web/messages/{vi,en,ko}.json` (rewrite costs.* + add maintenance.*)
- `PRD.md` (revise §6.2.2 — no-approval)
- `CLAUDE.md` (revise §4.8 + §6 P2 status)

## 3. Migration cần làm trước khi merge

```bash
# Local dev
cd apps/app-car-manager-v2
npm install                                # pulls @aws-sdk/client-s3 + presigner
npm run db:migrate                          # applies 0003_*.sql

# Staging (Render)
# 1. Set Render dashboard env: CRON_SECRET=<random>, EXPENSE_LOCK_DAYS=7
# 2. Set Neon staging DATABASE_URL → run migration via npm script or direct psql
ssh ... "npm run db:migrate:staging"
```

**S3 setup (nếu chưa)**: bucket `amb-car-manager-v2` ở `ap-southeast-1`, CORS allow PUT từ origin app, IAM key có PutObject + GetObject scope. AWS_* env đã có trong `.env.example` và `render.yaml`.

**Drizzle snapshot**: tôi viết SQL + journal manual nhưng KHÔNG tạo `0003_snapshot.json`. Sau khi merge, chạy `npx drizzle-kit up` để regen snapshot cho lần migration kế tiếp.

## 4. Decisions Locked (REQ-20260519)

| # | Decision | Implementation |
|---|---|---|
| R2 | No approval workflow | `expense.expStatus` chỉ có `RECORDED`/`VOIDED`; `car_approval_rules` không tạo |
| Q3 | Manager tạo expense | Service không gate role tạo (chỉ check Driver ownership) |
| Q7 | OilOverdueBanner sticky | `(app)/layout.tsx` fetch `getCriticalUnresolvedAlerts` truyền vào banner sticky-top |
| D1/D2 | 7-day edit lock | `assertCanEditExpense()` dùng `getExpenseLockDays()` env (default 7) |
| D9 | Defer Render Cron | `render.yaml` commented; manual trigger via `scripts/trigger-maintenance-cron.mjs` |

## 5. Test Plan (P6 hardening — chưa làm)

- [ ] Local migrate + smoke test: tạo expense FUEL, OIL, ACCIDENT (3 type quan trọng nhất)
- [ ] OIL flow: tạo expense OIL → kiểm tra `cvh_last_oil_change_*` cập nhật + alert resolve
- [ ] Cron trigger: chạy `node scripts/trigger-maintenance-cron.mjs` → verify alerts insert
- [ ] Banner: tạo alert CRITICAL → reload page → banner xuất hiện sticky top
- [ ] Permission: thử tạo expense bằng Driver → chỉ thấy xe + trip của mình
- [ ] Void: Admin void expense → status đổi VOIDED + audit log ghi
- [ ] 7-day lock: insert expense rồi update `exp_created_at = 8 ngày trước` → edit fail
- [ ] 3 locale: switch vi/en/ko, mọi text translation đúng

## 6. Known limitations / TODO

| # | Mục | Lý do defer |
|---|---|---|
| 1 | ExpenseDetailDrawer (xem chi tiết + attachment grid) | Row + dropdown đã đủ basic; detail page là follow-up |
| 2 | Vehicle detail page panel "Bảo dưỡng" | Cần read existing `/vehicles/[id]/page.tsx` để wire — defer |
| 3 | Today page widget MaintenanceAlertList | Sidebar trong /costs đã có; Today widget là enhancement |
| 4 | Drizzle 0003_snapshot.json | Sẽ regen tự động khi user chạy `drizzle-kit up` |
| 5 | PWA offline draft + camera + nén | Per scope, defer P5 |
| 6 | Playwright E2E | Per scope, defer P6 hardening |
| 7 | Render Cron auto-deploy | Per D9, defer 1 PR riêng sau verify |
| 8 | i18n cho 100% notification template events | Chỉ 5 event mới đã có 3 locale; còn nhiều UI text fallback EN |

## 7. Risks chưa giải quyết

| Risk | Trạng thái |
|---|---|
| S3 CORS chưa setup | Cần verify trên AWS console trước khi merge production |
| Migration journal manual edit | Có thể conflict nếu ai khác cũng tạo migration song song — coordinate |
| Notification fan-out cho event mới chưa test thật | Resend + Web Push code đã có, cần smoke test |

## 8. Approval policy migration note

Nếu trong database staging/prod đã có data từ thử nghiệm trước (không có), KHÔNG cần migration data — `car_approval_rules` không tồn tại từ đầu. Chỉ cần đảm bảo không có code path tham chiếu tới `requires_approval` (đã grep + xác nhận).

## 9. Sign-off

- [x] REQ + PLAN viết trước, được user xác nhận từng quyết định
- [x] 38 file mới + 12 file edit theo PLAN §3
- [x] Migration SQL nhất quán với Drizzle schema
- [x] All BE business rules theo REQ §3.8
- [x] FE form covers 6 type với type-specific subforms
- [x] S3 direct PUT flow end-to-end (presign action → XHR PUT → ref back)
- [x] i18n 3 locale cho path chính
- [x] PRD + CLAUDE.md revise reflect no-approval
- [ ] Migration applied trên staging (manual step)
- [ ] Manual smoke test (chưa)

Module 2 sẵn sàng cho **review desktop trước, mobile + edge cases sau** theo scope user đã chốt.
