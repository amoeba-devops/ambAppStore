# REQ-20260519 — Module 2: Quản Lý Chi Phí & Bảo Dưỡng (Post-MVP rework)

> **Ngày tạo**: 2026-05-19
> **Người tạo**: dev@amoeba.group
> **Trạng thái**: Draft — chờ confirm trước khi sang PLAN/Implement
> **Liên quan**: PRD §6.2, CLAUDE.md §4.8, divergence D5

---

## 1. Yêu cầu Tóm Tắt

| # | Yêu cầu | Loại |
|---|---|---|
| R1 | Ghi nhận 6 loại chi phí vận hành (FUEL, OIL, ACCIDENT, MEAL, REPAIR, OTHER) theo từng xe, có/không gắn chuyến đi | Functional |
| R2 | **Bỏ hoàn toàn workflow phê duyệt** — chi phí ghi nhận → trạng thái `RECORDED` ngay, không cần Admin duyệt | Functional (override PRD §6.2.2) |
| R3 | Upload ảnh chứng từ qua S3 presigned URL (≥0 ảnh, ACCIDENT bắt buộc ≥1 ảnh) | Functional + NFR-11 |
| R4 | Cảnh báo bảo dưỡng (Maintenance Alert) tự động hàng ngày dựa trên km + thời gian | Functional |
| R5 | Cron Job (Render) chạy daily 06:00 ICT để evaluate maintenance alert + fan-out notification | Infra |
| R6 | UI list + form expense cho Driver (mobile-first) và Admin (web) | UI/UX |
| R7 | Lock expense 7 ngày sau khi trip COMPLETED (theo PRD §10) | Business rule |
| R8 | Audit log mọi action: create/update/delete expense, oil-change reset | NFR-9 |
| R9 | i18n 3 ngôn ngữ vi/en/ko cho toàn bộ UI text mới | NFR |

**Không nằm trong scope đợt này** (defer):
- ❌ PWA offline draft + background sync (defer P5)
- ❌ Camera + client-side image compression (defer P5)
- ❌ Approval queue UI (xoá hoàn toàn, không "hidden")
- ❌ INSPECTION expense type (đã defer — quản lý qua Maintenance Alert thay vì expense)

---

## 2. AS-IS Hiện Trạng

### 2.1 Database Layer
| Bảng | Trạng thái | Note |
|---|---|---|
| `car_expenses` | ❌ **CHƯA TỒN TẠI** | [packages/db/src/schema/index.ts](../../packages/db/src/schema/index.ts) không export |
| `car_expense_attachments` | ❌ CHƯA TỒN TẠI | |
| `car_approval_rules` | ❌ CHƯA TỒN TẠI | Theo R2 sẽ KHÔNG cần |
| `car_vehicles.cvh_odometer_km` | ✅ TỒN TẠI | [vehicles.schema.ts:46](../../packages/db/src/schema/vehicles.schema.ts#L46) |
| `car_vehicles.cvh_last_oil_change_km/at` | ✅ TỒN TẠI | [vehicles.schema.ts:47-48](../../packages/db/src/schema/vehicles.schema.ts#L47-L48) |
| `car_vehicles.cvh_oil_interval_km/months` | ✅ TỒN TẠI (default 5000km/3 tháng) | [vehicles.schema.ts:49-50](../../packages/db/src/schema/vehicles.schema.ts#L49-L50) |
| `car_vehicles.cvh_last_inspection_at` | ❌ CHƯA TỒN TẠI | cần bổ sung cho Maintenance Alert |
| `car_vehicles.cvh_next_inspection_at` | ❌ CHƯA TỒN TẠI | cần bổ sung |
| `car_trips.trp_end_odometer` | ✅ TỒN TẠI | có thể auto-update `cvh_odometer_km` khi trip COMPLETED |
| Migration files | 3 files: `0000_new_earthquake.sql`, `0001_serious_maginty.sql`, `0002_purple_guardsmen.sql` | Sẽ thêm `0003_*.sql` |

### 2.2 Backend Layer
| Thành phần | Trạng thái |
|---|---|
| `server/services/expense.service.ts` | ❌ KHÔNG TỒN TẠI |
| `server/services/maintenance-alert.service.ts` | ❌ KHÔNG TỒN TẠI |
| `server/services/s3.service.ts` (presigned URL) | ❌ KHÔNG TỒN TẠI |
| `server/actions/expenses/*.action.ts` | ❌ KHÔNG TỒN TẠI |
| `server/queries/expenses.queries.ts` | ❌ KHÔNG TỒN TẠI |
| `/api/v1/expenses/*` | ❌ KHÔNG TỒN TẠI |
| `/api/v1/uploads/presign` | ❌ KHÔNG TỒN TẠI |
| `/api/v1/cron/maintenance-alert` | ❌ KHÔNG TỒN TẠI |
| `notification.service.ts` | ✅ TỒN TẠI ([server/services/notification.service.ts](../../apps/web/src/server/services/notification.service.ts)) — reuse cho maintenance alert |
| `audit-log.service.ts` | ✅ TỒN TẠI — reuse |
| `email.service.ts` + `push.service.ts` | ✅ TỒN TẠI (P4) — reuse |

### 2.3 Frontend Layer
| Trang/Component | Trạng thái |
|---|---|
| `/costs` page | ⚠️ MOCKUP TĨNH — [apps/web/src/app/(app)/costs/page.tsx](../../apps/web/src/app/(app)/costs/page.tsx) hard-code 4 dòng `PENDING` với UI approval queue. Sẽ **rewrite hoàn toàn**. |
| Bottom tab "expenses" → `/costs` | ✅ Đã wire ([bottom-tab-nav.tsx:23](../../apps/web/src/components/layout/bottom-tab-nav.tsx#L23)) |
| Form ghi nhận expense | ❌ KHÔNG TỒN TẠI |
| Upload component cho chứng từ | ❌ KHÔNG TỒN TẠI |
| OilOverdueAlert / InspectionDueAlert UI | ❌ KHÔNG TỒN TẠI |
| Vehicle detail "Last oil change" panel | ❌ Cần check (chưa scan) |

### 2.4 i18n
| Namespace | Trạng thái |
|---|---|
| `costs.*` (vi/en/ko) | ⚠️ Tồn tại nhưng phục vụ approval UI (approvalTitle, pendingReview, needsYou, Approve/Reject...). **Phần lớn sẽ xoá**, viết lại bộ key mới cho list + form. |
| `costs.types.*` | ✅ Có 8 keys (FUEL, OIL, REPAIR, PARKING, TOLL, MEAL, ACCIDENT, INSPECTION) → reduce còn 6 (5 + OTHER), xoá PARKING/TOLL/INSPECTION. |
| `maintenance.*` | ❌ CHƯA CÓ namespace |

### 2.5 Infra/Cron
| Mục | Trạng thái |
|---|---|
| Render Cron Job | ❌ KHÔNG có trong [render.yaml](../../render.yaml) — sẽ thêm 1 cron job daily 06:00 ICT (= 23:00 UTC hôm trước) |
| S3 bucket + IAM | ⚠️ Cần verify env vars `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (đã có trong `.env.example` hay chưa?) |

### 2.6 Vấn đề chính
- **CLAUDE.md §6 đánh dấu P2 là "✅ done" nhưng thực tế 0% backend/DB** — tài liệu sai lệch nghiêm trọng. Sẽ cập nhật roadmap thành "🚧 in progress" trong implementation report cuối cùng.
- **PRD §6.2.2 quy định approval policy** — yêu cầu mới override, cần ghi nhận vào REQ này để PRD revise R4.

---

## 3. TO-BE Yêu Cầu

### 3.1 Cost Type ENUM
```
car_expense_type:
  - FUEL      (Đổ xăng)
  - OIL       (Thay dầu nhớt) — đồng thời cập nhật cvh_last_oil_change_*
  - ACCIDENT  (Tai nạn) — bắt buộc ≥1 ảnh
  - MEAL      (Ăn uống)
  - REPAIR    (Sửa chữa)
  - OTHER     (Chi phí khác — parking/toll/v.v.)
```

### 3.2 Expense Status (đơn giản hoá)
```
car_expense_status:
  - RECORDED  (mặc định khi tạo — KHÔNG còn PENDING)
  - VOIDED    (xoá mềm — chỉ Admin, lý do bắt buộc)
```
Không có `APPROVED` / `REJECTED` / `PENDING` nữa.

### 3.3 Bảng `car_expenses`
| Column | Type | Note |
|---|---|---|
| `exp_id` | CHAR(36) PK | UUID |
| `ent_id` | CHAR(36) NOT NULL | Multi-tenancy |
| `exp_ref` | VARCHAR(20) UNIQUE per ent | `EXP-000123` (sequence per ent_id) |
| `exp_type` | car_expense_type NOT NULL | |
| `exp_vehicle_id` | CHAR(36) NOT NULL FK → car_vehicles | xe phát sinh chi phí |
| `exp_trip_id` | CHAR(36) NULL FK → car_trips | gắn chuyến (tùy chọn) |
| `exp_driver_id` | CHAR(36) NULL FK → car_drivers | người ghi (nếu Driver) |
| `exp_creator_id` | CHAR(36) NOT NULL FK → car_users | user thao tác (Admin hoặc Driver) |
| `exp_amount_vnd` | BIGINT NOT NULL | Số tiền VND (integer, không decimal) |
| `exp_occurred_at` | TIMESTAMPTZ NOT NULL | ngày phát sinh |
| `exp_odometer_km` | INTEGER NULL | km tại thời điểm (mandatory cho FUEL/OIL) |
| `exp_status` | car_expense_status NOT NULL default 'RECORDED' | |
| `exp_notes` | TEXT NULL | ghi chú chung |
| `exp_payload` | JSONB NULL | trường đặc thù theo type — xem §3.4 |
| `exp_void_reason` | TEXT NULL | lý do void |
| `exp_voided_at` | TIMESTAMPTZ NULL | |
| `exp_voided_by` | CHAR(36) NULL | |
| `exp_created_at` | TIMESTAMPTZ NOT NULL | |
| `exp_updated_at` | TIMESTAMPTZ NULL | |
| `exp_deleted_at` | TIMESTAMPTZ NULL | soft delete (giữ tương thích chuẩn) |

**Index**:
- `uniq_car_expenses_ent_ref` ON (ent_id, exp_ref) WHERE exp_deleted_at IS NULL
- `idx_car_expenses_ent_vehicle_at` ON (ent_id, exp_vehicle_id, exp_occurred_at DESC)
- `idx_car_expenses_ent_type_at` ON (ent_id, exp_type, exp_occurred_at DESC)
- `idx_car_expenses_trip` ON (exp_trip_id) WHERE exp_trip_id IS NOT NULL

### 3.4 Payload JSONB theo type
| Type | Schema Zod |
|---|---|
| FUEL | `{ liters: number, unitPriceVnd: number, station: string }` |
| OIL | `{ oilBrand: string, oilGrade?: string }` (đồng thời update `cvh_last_oil_change_km/at`) |
| ACCIDENT | `{ description: string, severity: 'MINOR'\|'MAJOR' }` — bắt buộc ≥1 attachment |
| MEAL | `{ peopleCount: number }` |
| REPAIR | `{ itemName: string, vendor: string }` |
| OTHER | `{ subType?: string }` (free text, vd "Đỗ xe", "Phí cầu đường") |

### 3.5 Bảng `car_expense_attachments`
| Column | Type | Note |
|---|---|---|
| `eat_id` | CHAR(36) PK | |
| `ent_id` | CHAR(36) NOT NULL | |
| `eat_expense_id` | CHAR(36) NOT NULL FK → car_expenses | |
| `eat_s3_key` | VARCHAR(500) NOT NULL | S3 object key |
| `eat_file_name` | VARCHAR(255) NOT NULL | tên gốc client |
| `eat_mime_type` | VARCHAR(100) NOT NULL | image/* hoặc application/pdf |
| `eat_size_bytes` | INTEGER NOT NULL | tối đa 10MB |
| `eat_uploaded_by` | CHAR(36) NOT NULL FK → car_users | |
| `eat_created_at` | TIMESTAMPTZ NOT NULL | |

**Index**: `idx_car_expense_attachments_expense ON (eat_expense_id)`

### 3.6 Bổ sung `car_vehicles` (Maintenance Alert)
```sql
ALTER TABLE car_vehicles
  ADD COLUMN cvh_last_inspection_at      TIMESTAMPTZ NULL,
  ADD COLUMN cvh_next_inspection_at      TIMESTAMPTZ NULL,
  ADD COLUMN cvh_inspection_interval_months SMALLINT NOT NULL DEFAULT 12;
```

### 3.7 Bảng `car_maintenance_alerts` (snapshot cảnh báo)
| Column | Type | Note |
|---|---|---|
| `mal_id` | CHAR(36) PK | |
| `ent_id` | CHAR(36) NOT NULL | |
| `mal_vehicle_id` | CHAR(36) NOT NULL FK → car_vehicles | |
| `mal_type` | ENUM('OIL_OVERDUE','OIL_DUE_SOON','INSPECTION_OVERDUE','INSPECTION_DUE_SOON') | |
| `mal_severity` | ENUM('WARNING','CRITICAL') | DUE_SOON=WARNING, OVERDUE=CRITICAL |
| `mal_due_at` | TIMESTAMPTZ NULL | |
| `mal_due_km` | INTEGER NULL | |
| `mal_current_odometer_km` | INTEGER NULL | snapshot |
| `mal_acknowledged_at` | TIMESTAMPTZ NULL | Admin click "đã ghi nhận" |
| `mal_acknowledged_by` | CHAR(36) NULL | |
| `mal_resolved_at` | TIMESTAMPTZ NULL | tự resolve khi OIL expense được tạo |
| `mal_created_at` | TIMESTAMPTZ NOT NULL | |

**Index**: `idx_car_maintenance_alerts_ent_unresolved ON (ent_id) WHERE mal_resolved_at IS NULL`

### 3.8 Business Rules
| ID | Rule | Note |
|---|---|---|
| BR-1 | Khi expense type=`OIL` tạo thành công → service auto update `cvh_last_oil_change_km = exp_odometer_km`, `cvh_last_oil_change_at = exp_occurred_at` | side effect trong transaction |
| BR-2 | Khi expense type=`OIL` tạo thành công → auto resolve alert `OIL_*` cho xe đó | |
| BR-3 | Trip COMPLETED có `trp_end_odometer` lớn hơn `cvh_odometer_km` → auto update `cvh_odometer_km = trp_end_odometer` | đã có hay chưa cần verify trong `trip-state-machine.service.ts` |
| BR-4 | Expense gắn vào trip → check trip status ∈ {CONFIRMED, IN_PROGRESS, COMPLETED} — KHÔNG cho gắn vào trip PENDING* hoặc REJECTED/CANCELLED | |
| BR-5 | Sau 7 ngày kể từ `trp_ended_at`, expense không cho create/edit/void với `exp_trip_id` đó | "expense lock" theo PRD §10 |
| BR-6 | ACCIDENT bắt buộc ≥1 attachment | validate tại server action |
| BR-7 | Driver chỉ tạo/sửa expense của xe mình lái (vehicle_id ∈ trips của driver) | role check |
| BR-8 | Admin có thể tạo/sửa/void mọi expense | |
| BR-9 | Soft-delete: void → set `exp_status=VOIDED`, `exp_voided_at/by` (KHÔNG dùng `exp_deleted_at`) | giữ trace; reports filter `status=RECORDED` |
| BR-10 | Maintenance Alert evaluator chạy daily cron: với mỗi xe live, check oil overdue (km hoặc tháng) và inspection due — tạo `car_maintenance_alerts` row mới nếu chưa có alert chưa-resolved trong 24h qua | tránh spam |

### 3.9 Permission Matrix
| Action | Admin | Manager | Driver |
|---|---|---|---|
| Create expense | ✅ mọi xe | ❌ | ✅ chỉ xe mình lái + chuyến mình |
| List expenses (toàn ent) | ✅ | ✅ readonly | ❌ chỉ thấy của mình |
| Edit expense | ✅ | ❌ | ✅ chỉ của mình + chưa qua 7 ngày |
| Void expense | ✅ | ❌ | ❌ |
| Ack maintenance alert | ✅ | ✅ | ❌ |
| Reset oil change (manual) | ✅ | ❌ | ❌ |

---

## 4. Gap Analysis

| Area | AS-IS | TO-BE | Impact |
|---|---|---|---|
| DB schema | 8 bảng | +3 bảng (`car_expenses`, `car_expense_attachments`, `car_maintenance_alerts`) + 3 cột `car_vehicles` | High |
| Migration | `0002` mới nhất | `+0003_module2_expenses_maintenance.sql` | Medium |
| Drizzle ENUM | 7 enums hiện có | +3 (`car_expense_type`, `car_expense_status`, `car_maintenance_alert_type`, `car_maintenance_alert_severity`) | Low |
| Backend service | 9 services | +3 (`expense.service`, `maintenance-alert.service`, `s3.service`) | High |
| Backend action | 5 folders | +1 (`expenses/`: create, update, void, list, presign) | High |
| Route handler | 4 endpoints | +2 (`/api/v1/expenses/presign`, `/api/v1/cron/maintenance-alert`) | Medium |
| Frontend page | `/costs` mockup | **REWRITE** thành list + responsive | High |
| Frontend form | KHÔNG | +`ExpenseFormModal` (6 type-specific layouts) | High |
| Frontend component | — | +`ExpenseListItem`, `ExpenseFilters`, `AttachmentGrid`, `OilOverdueBanner`, `MaintenanceAlertList`, `AcknowledgeButton` | High |
| i18n keys | `costs.*` (approval-style), `costs.types.*` 8 keys | rewrite `costs.*` (list+form), reduce types xuống 6, +`maintenance.*` namespace | Medium |
| Infra | render.yaml 1 web service | +1 cron service (daily) | Low |
| Env vars | hiện có VAPID, JWT | +`AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `EXPENSE_LOCK_DAYS=7` | Low |

### 4.1 File Change List (preview — chi tiết ở PLAN)
| Loại | Path | Action |
|---|---|---|
| DB | `packages/db/src/schema/expenses.schema.ts` | NEW |
| DB | `packages/db/src/schema/expense-attachments.schema.ts` | NEW |
| DB | `packages/db/src/schema/maintenance-alerts.schema.ts` | NEW |
| DB | `packages/db/src/schema/vehicles.schema.ts` | EDIT (+3 cột) |
| DB | `packages/db/src/schema/index.ts` | EDIT (+3 exports) |
| DB | `packages/db/migrations/0003_module2_expenses_maintenance.sql` | NEW |
| Shared | `packages/shared/src/zod/expense.zod.ts` | NEW |
| Shared | `packages/shared/src/zod/maintenance-alert.zod.ts` | NEW |
| BE | `apps/web/src/server/services/expense.service.ts` | NEW |
| BE | `apps/web/src/server/services/maintenance-alert.service.ts` | NEW |
| BE | `apps/web/src/server/services/s3.service.ts` | NEW |
| BE | `apps/web/src/server/queries/expenses.queries.ts` | NEW |
| BE | `apps/web/src/server/queries/maintenance-alerts.queries.ts` | NEW |
| BE | `apps/web/src/server/actions/expenses/create-expense.action.ts` | NEW |
| BE | `apps/web/src/server/actions/expenses/update-expense.action.ts` | NEW |
| BE | `apps/web/src/server/actions/expenses/void-expense.action.ts` | NEW |
| BE | `apps/web/src/server/actions/expenses/presign-attachment.action.ts` | NEW |
| BE | `apps/web/src/server/actions/maintenance/acknowledge-alert.action.ts` | NEW |
| BE | `apps/web/src/server/actions/maintenance/reset-oil-change.action.ts` | NEW |
| BE | `apps/web/src/app/api/v1/cron/maintenance-alert/route.ts` | NEW |
| BE | `apps/web/src/server/services/trip-state-machine.service.ts` | EDIT (BR-3 odometer sync nếu chưa có) |
| FE | `apps/web/src/app/(app)/costs/page.tsx` | **REWRITE hoàn toàn** |
| FE | `apps/web/src/components/expenses/ExpenseListItem.tsx` | NEW |
| FE | `apps/web/src/components/expenses/ExpenseFormModal.tsx` | NEW |
| FE | `apps/web/src/components/expenses/ExpenseFilters.tsx` | NEW |
| FE | `apps/web/src/components/expenses/AttachmentGrid.tsx` | NEW |
| FE | `apps/web/src/components/expenses/AttachmentUploader.tsx` | NEW |
| FE | `apps/web/src/components/maintenance/OilOverdueBanner.tsx` | NEW |
| FE | `apps/web/src/components/maintenance/MaintenanceAlertList.tsx` | NEW |
| FE | `apps/web/src/app/(app)/today/page.tsx` | EDIT (show MaintenanceAlertList nếu Admin) |
| FE | `apps/web/src/app/(app)/vehicles/[id]/page.tsx` | EDIT (panel "Bảo dưỡng" + reset oil) — nếu trang đã có |
| i18n | `apps/web/messages/{vi,en,ko}.json` | EDIT (rewrite `costs.*`, +`maintenance.*`) |
| Infra | `render.yaml` | EDIT (+cron service) |
| Infra | `apps/web/.env.example` | EDIT (+S3 + EXPENSE_LOCK_DAYS) |
| Config | `apps/app-car-manager-v2/CLAUDE.md` | EDIT (§4.8 revise — no approval, §6 update P2 status) |
| Config | `apps/app-car-manager-v2/PRD.md` | EDIT (revise §6.2.2 — R4 no approval) |

---

## 5. User Flow

### 5.1 Driver — ghi nhận đổ xăng (FUEL)
```
[Tab "Chi phí"] → tap [+ Thêm chi phí]
  → Chọn loại: FUEL
  → Form: chọn xe (auto fill nếu đang trong trip)
        ngày (default now)
        số lít (number, > 0)
        đơn giá VND (number, > 0)
        → auto tính total = lít × đơn giá
        trạm xăng (text)
        số km hiện tại (mandatory)
        ghi chú (optional)
        ảnh chứng từ (optional, ≤10 ảnh, ≤10MB/ảnh)
  → [Lưu]
      ↓
   Server action createExpenseAction
      ├─ validate Zod (type-specific schema)
      ├─ check permission (driver chỉ xe + chuyến mình)
      ├─ check BR-5 (7-day lock nếu có trip)
      ├─ INSERT car_expenses + car_expense_attachments
      ├─ BR-3 nếu odometer > cvh_odometer_km → UPDATE
      └─ audit log EXPENSE.CREATED
      ↓
   Toast "Đã ghi nhận EXP-000123" → quay về list
```

### 5.2 Driver — ghi nhận thay dầu (OIL)
Tương tự FUEL nhưng:
- Bắt buộc `exp_odometer_km`
- Sau khi INSERT, service:
  - UPDATE `car_vehicles.cvh_last_oil_change_km/at`
  - Resolve mọi `car_maintenance_alerts` type `OIL_*` chưa resolved cho xe
- Audit log `EXPENSE.CREATED` + `VEHICLE.OIL_CHANGED`

### 5.3 Driver — ghi nhận tai nạn (ACCIDENT)
- Bắt buộc ≥1 attachment (ảnh hiện trường)
- Severity: MINOR/MAJOR
- Notification fan-out tới Admin ngay khi tạo (notification.service `EXPENSE.ACCIDENT_REPORTED`)

### 5.4 Admin — duyệt list
```
[Web /costs] → list paginated (default 20/page)
  Filter: vehicle, type, dateRange, driver, status
  Sort: occurredAt DESC default
  Mỗi row: type icon · ref · vehicle · driver · amount · date · attachment count
  Click row → Detail drawer (right side panel)
    → Edit / Void / Download attachments
```

### 5.5 Admin — Maintenance Alert
```
[Today] page (Admin/Manager) → MaintenanceAlertList widget
  → list các xe đến hạn/quá hạn:
     "30A-556.07 — Quá hạn thay dầu (5,200 km > ngưỡng 5,000 km)"
     "51F-712.34 — Đăng kiểm còn 7 ngày"
  → [Đã xử lý] → ack alert (set mal_acknowledged_at/by)
  → [Reset thay dầu] → mở modal nhập km + ngày (manual reset, ko cần expense)
```

### 5.6 Cron Job — daily maintenance evaluator
```
06:00 ICT (cron) → POST /api/v1/cron/maintenance-alert (Bearer CRON_SECRET)
  → maintenance-alert.service.evaluateAll()
     For each ent_id, for each active vehicle:
        - OIL: nếu (cvh_odometer_km - cvh_last_oil_change_km) >= cvh_oil_interval_km × 0.95 → DUE_SOON
                                                            >= cvh_oil_interval_km        → OVERDUE
                 (cũng check tháng từ cvh_last_oil_change_at)
        - INSPECTION: cvh_next_inspection_at - now <= 7 days → DUE_SOON
                                              < 0           → OVERDUE
     Nếu chưa có alert cùng type chưa resolved trong 24h:
        INSERT car_maintenance_alerts
        notification.service.notify (admins + managers in ent)
```

---

## 6. Tech Constraints

- **TypeScript strict + noUncheckedIndexedAccess** — tất cả zod schema phải declare đầy đủ
- **S3 presigned URL**: lifetime 5 phút, content-type restrict `image/*` + `application/pdf`, size ≤ 10MB (enforce in presigned policy)
- **JSONB validation**: dùng zod `discriminatedUnion` theo `type`, validate cả khi insert lẫn khi read (defense in depth)
- **i18n**: mọi text mới phải có vi/en/ko, không hard-code
- **CSP**: S3 image URL phải allow trong `img-src` của next.config.mjs
- **Cron auth**: bearer token `CRON_SECRET` env, request từ Render Cron có header `X-Render-Cron: true`
- **Idempotency**: cron có thể chạy 2 lần (retry) — dùng index để tránh tạo trùng alert trong 24h
- **Transaction**: createExpense type=OIL phải atomic (expense + vehicle update + alert resolve) — dùng `db.transaction()`

---

## 7. Decisions (chốt 2026-05-19)

| # | Câu hỏi | **Quyết định** |
|---|---|---|
| Q1 | EXPENSE_LOCK_DAYS = 7 áp dụng cho? | Expense **gắn trip**: 7 ngày từ `trp_ended_at`. Expense không gắn trip: 7 ngày từ `exp_created_at` (Driver/Manager). Admin không bị lock. |
| Q2 | Driver edit expense của mình? | ✅ Có — 7 ngày từ created |
| Q3 | Manager có quyền tạo expense? | ✅ **CÓ** — Manager tạo expense giống Driver (override default ban đầu) |
| Q4 | Inspection due-soon ngưỡng? | 7 ngày trước hạn |
| Q5 | Maintenance Alert gửi email/push/in-app? | Cả 3 — recipient = Admin + Manager |
| Q6 | Driver nhận maintenance alert? | ❌ Không |
| Q7 | OilOverdueBanner hiển thị ở đâu? | **Sticky top mọi page** cho Admin/Manager khi có CRITICAL. Dismissible/page (localStorage per session). |
| Q8 | Cron deploy chiến lược? | Code `/api/v1/cron/maintenance-alert` + CLI manual trigger. **KHÔNG đăng ký Render cron** đợt này — defer 1 PR riêng sau verify. |

**Cập nhật Permission Matrix:**

| Action | Admin | Manager | Driver |
|---|---|---|---|
| Create expense | ✅ mọi xe | ✅ **mọi xe** | ✅ chỉ xe đang lái / trip mình |
| List expenses (toàn ent) | ✅ | ✅ readonly | ❌ chỉ của mình |
| Edit own expense | ✅ (no limit) | ✅ 7 ngày | ✅ 7 ngày |
| Edit other's expense | ✅ | ❌ | ❌ |
| Void expense | ✅ | ❌ | ❌ |
| Ack maintenance alert | ✅ | ✅ | ❌ |
| Reset oil change manual | ✅ | ❌ | ❌ |

---

## 8. Acceptance Criteria

### 8.1 Functional
- [ ] Driver tạo được expense FUEL/OIL/ACCIDENT/MEAL/REPAIR/OTHER với type-specific form
- [ ] Driver upload ≥1 ảnh khi tạo ACCIDENT — block submit nếu thiếu
- [ ] Admin list được tất cả expenses của tenant, filter theo vehicle/type/date/driver
- [ ] Tạo expense OIL → tự động cập nhật vehicle's last oil change + resolve alert
- [ ] Cron daily tạo alert OIL_DUE_SOON/OIL_OVERDUE/INSPECTION_* đúng logic
- [ ] Admin click "Đã xử lý" trên alert → alert đánh dấu acknowledged
- [ ] Admin có thể manual reset oil change qua vehicle detail
- [ ] 7-day lock: expense gắn trip không edit/void được sau 7 ngày từ `trp_ended_at`
- [ ] Email + Push gửi đúng locale recipient (vi/en/ko)

### 8.2 Non-functional
- [ ] Mọi text UI có vi/en/ko translation
- [ ] List expense load p95 < 500ms cho 1000 rows (đã có index)
- [ ] Audit log: mọi action ghi vào `car_audit_logs`
- [ ] Mobile (390px): form 1-column, list 1-column với card-style; bottom-sheet modal
- [ ] Desktop (≥768px): list 2-pane (list left, detail right), form modal centered
- [ ] Image upload tới S3 trực tiếp từ browser (presigned PUT), không proxy qua server

### 8.3 Documentation
- [ ] PRD.md §6.2.2 revise: bỏ approval policy
- [ ] CLAUDE.md §4.8 revise: bỏ approval rules; §6 update P2 status
- [ ] TC-20260519-module2-expense-maintenance.md tạo trước khi code
- [ ] TR-20260519-* sau test
- [ ] RPT-20260519-* sau implement

---

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| S3 IAM chưa setup trong Render | Block presigned URL | Verify env trước khi merge; provide fallback dummy bucket cho dev |
| CSP block S3 image URL | Image không hiển thị | Update `next.config.mjs` `img-src` + S3 bucket CORS |
| Cron job miss khi Render down | Alert delay 1 ngày | Acceptable — không phải critical path; có thể manual trigger từ admin UI |
| `cvh_odometer_km` lệch khi driver nhập sai | Alert sai | UI warning nếu odometer giảm; require confirm |
| JSONB schema drift theo time | Old records validate fail | Zod schema versioning — store `exp_payload_version` (defer nếu chưa cần) |
| Migration trên prod fail | Down 1 phần | Migration đơn giản, additive only, no breaking — chạy staging trước |

---

**Next**: viết PLAN-20260519-module2-expense-maintenance.md với phase/step chi tiết và side-impact analysis.
