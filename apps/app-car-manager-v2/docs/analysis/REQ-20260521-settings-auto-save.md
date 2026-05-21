# REQ-20260521 — Admin Settings Auto-Save

**Yêu cầu**: trang admin Settings (`/settings`) phải auto-save khi user thay đổi giá trị, **không cần nút "Lưu"**. Đồng bộ hành vi với trang `/settings/me` (đã auto-save sẵn).

**Tag**: `[요구사항]` — workflow REQ → PLAN → TC → Impl → TR → RPT.

---

## 1. 요구사항 요약 (Requirements Summary)

| # | 요구사항 | 유형 |
|---|----------|------|
| R1 | Xoá nút "Lưu" khỏi `PageHeader` của trang admin Settings | UI / cleanup |
| R2 | Mỗi field tự lưu lên DB khi user thay đổi (debounce ~500ms cho text, ngay lập tức cho Select/Switch) | Functional |
| R3 | Hiển thị feedback trạng thái save (saving / saved / error) — toast hoặc inline indicator | UX |
| R4 | Persist `tenantName`, `currency`, `timezone`, retention (`tripRecords`, `auditLog`) cho từng `ent_id` | Backend |
| R5 | Persist toggles notification preferences (`inApp`, `email`, `digest`) cho từng `ent_id` | Backend |
| R6 | Persist approval rules cho từng (`ent_id`, `expense_type`) — đọc/ghi `car_approval_rules` thay vì mảng hardcode | Backend |
| R7 | i18n 3 ngôn ngữ (vi/en/ko) cho text trạng thái save (saving/saved/error) | i18n |
| R8 | Audit log mọi thay đổi setting (`SETTINGS.UPDATED`, `APPROVAL_RULE.UPDATED`, `NOTIF_PREF.UPDATED`) | Compliance |
| R9 | Chỉ Admin (`usr_local_role = 'ADMIN'`) mới có quyền thay đổi — Manager/Driver chỉ đọc | Authz |

---

## 2. AS-IS 현황 분석

### 2.1 Frontend — `apps/web/src/app/(app)/settings/page.tsx`

Trang là **Server Component**, render mock UI. Chi tiết từng field:

| Field | Vị trí | Cơ chế hiện tại | Trạng thái |
|---|---|---|---|
| **Tenant Name** | [page.tsx:67](../../apps/web/src/app/(app)/settings/page.tsx#L67) | `<Input defaultValue={tCo('tenant')} />` — uncontrolled, lấy từ i18n key `company.tenant` cứng | ❌ Không lưu |
| **Default Language** | [page.tsx:71](../../apps/web/src/app/(app)/settings/page.tsx#L71) | `<LocaleSelect>` → `setLocaleAction()` (cookie `NEXT_LOCALE`) | ✅ Đã auto-save |
| **Currency** | [page.tsx:75-82](../../apps/web/src/app/(app)/settings/page.tsx#L75-L82) | `<Select defaultValue="vnd">` — uncontrolled | ❌ Không lưu |
| **Timezone** | [page.tsx:86-92](../../apps/web/src/app/(app)/settings/page.tsx#L86-L92) | `<Select defaultValue="vn">` — uncontrolled | ❌ Không lưu |
| **Approval rules** (8 loại) | [page.tsx:25-34, 108-119](../../apps/web/src/app/(app)/settings/page.tsx#L25-L34) | Mảng `APPROVAL_RULES` **hardcode trong file** — Badge tĩnh, không có UI toggle | ❌ Không lưu, không edit được |
| **Notif in-app** | [page.tsx:135](../../apps/web/src/app/(app)/settings/page.tsx#L135) | `<ToggleRow defaultChecked />` — `<Switch defaultChecked />` uncontrolled | ❌ Không lưu |
| **Notif email** | [page.tsx:136](../../apps/web/src/app/(app)/settings/page.tsx#L136) | Tương tự | ❌ Không lưu |
| **Notif push** | [page.tsx:137-140](../../apps/web/src/app/(app)/settings/page.tsx#L137-L140) | `<PushToggle>` → `/api/v1/push/(un)subscribe` | ✅ Đã auto-save |
| **Notif digest** | [page.tsx:141](../../apps/web/src/app/(app)/settings/page.tsx#L141) | Tương tự ToggleRow | ❌ Không lưu |
| **Retention — Trip records** | [page.tsx:158-166](../../apps/web/src/app/(app)/settings/page.tsx#L158-L166) | `<Select defaultValue="5y">` — uncontrolled | ❌ Không lưu |
| **Retention — Audit log** | [page.tsx:170-177](../../apps/web/src/app/(app)/settings/page.tsx#L170-L177) | `<Select defaultValue="5y">` — uncontrolled | ❌ Không lưu |
| **Nút "Save"** | đã xoá trong PR này (R1) | — | ⚠️ Đã không còn |

### 2.2 Backend

| Khu vực | File | Trạng thái |
|---|---|---|
| Server actions cho settings | (không tồn tại) | ❌ Chưa có — chỉ `setLocaleAction()` cho locale + push subscribe API |
| `car_approval_rules` schema | [expenses.schema.ts:122-139](../../packages/db/src/schema/expenses.schema.ts#L122-L139) | ✅ Đã có (CLAUDE.md §4.8 — lazy seed). Có cột `aprRequiresApproval` (int 0/1), `aprAutoThreshold` (decimal 14,2) |
| Approval rule service | [expense-approval.service.ts](../../apps/web/src/server/services/expense-approval.service.ts) | ✅ Đã đọc rule lúc tạo expense — nhưng **chưa có UI/API để admin sửa rule** |
| `car_tenant_settings` schema | — | ❌ Chưa có |
| `car_notification_preferences` schema | — | ❌ Chưa có |
| Audit log integration | `audit-logs.schema.ts` + `notification.service.ts` | ✅ Có sẵn pattern — append-only insert |

### 2.3 i18n — `apps/web/messages/{vi,en,ko}.json`

Section `settings.*` đã đầy đủ key cho admin settings (general, approval, notifications, retention) — xem [vi.json:499-573](../../apps/web/messages/vi.json#L499-L573).

**Thiếu**: key cho status save (saving / saved / error). Cần thêm:
```json
{
  "settings": {
    "saveStatus": {
      "saving": "Đang lưu…",
      "saved": "Đã lưu",
      "error": "Lưu lỗi: {message}"
    }
  }
}
```

### 2.4 Vấn đề cốt lõi

- Phần lớn UI là **mock/decorative** — không có persistence, không có effect downstream.
- Nút "Save" tồn tại nhưng **không có `onClick`** → gây hiểu lầm cho user (R1 xoá).
- Mâu thuẫn với nguyên tắc `/settings/me` (auto-save) → UX không nhất quán.

---

## 3. TO-BE 요구사항

### 3.1 AS-IS → TO-BE mapping

| Field | AS-IS | TO-BE |
|---|---|---|
| Tenant Name | i18n hardcode `company.tenant` | DB column `tns_tenant_name` per `ent_id`, debounce 500ms, fallback về tên từ AMA nếu null |
| Currency | uncontrolled `defaultValue="vnd"` | DB column `tns_currency` ENUM `VND \| KRW \| USD`, default `VND`. Propagate xuống expense display (label `₫ / ₩ / $`) |
| Timezone | uncontrolled `defaultValue="vn"` | DB column `tns_timezone` VARCHAR(64) IANA tz name (`Asia/Ho_Chi_Minh` default). Propagate xuống date formatter |
| Approval rules | mảng hardcode `APPROVAL_RULES` | Đọc từ `car_approval_rules` (lazy-seed default từ CLAUDE.md §4.8 nếu chưa có row). UI cho phép toggle `requires_approval` + sửa `auto_threshold` |
| Notif in-app/email/digest | `defaultChecked` cứng | DB column `tns_notif_inapp/email/digest` BOOL trong `car_tenant_settings` (per-tenant scope). Default `true` |
| Retention — Trip records | uncontrolled `defaultValue="5y"` | DB column `tns_retention_trip_years` INT (1/3/5/7). Default 5 |
| Retention — Audit log | uncontrolled `defaultValue="5y"` | DB column `tns_retention_audit_years` INT NULLABLE (`null` = indefinite). Default 5 |

### 3.2 Schema mới — `car_tenant_settings`

Single-row-per-tenant (1:1 với `ent_id`). Lazy-seeded khi admin lần đầu mở `/settings`.

```sql
CREATE TABLE car_tenant_settings (
  tns_id                       CHAR(36)     PRIMARY KEY,
  ent_id                       CHAR(36)     NOT NULL,
  tns_tenant_name              VARCHAR(120) NULL,
  tns_currency                 VARCHAR(3)   NOT NULL DEFAULT 'VND',  -- VND | KRW | USD
  tns_timezone                 VARCHAR(64)  NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  tns_notif_inapp              BOOLEAN      NOT NULL DEFAULT TRUE,
  tns_notif_email              BOOLEAN      NOT NULL DEFAULT TRUE,
  tns_notif_digest             BOOLEAN      NOT NULL DEFAULT TRUE,
  tns_retention_trip_years     INTEGER      NOT NULL DEFAULT 5,    -- 1 | 3 | 5 | 7
  tns_retention_audit_years    INTEGER      NULL DEFAULT 5,         -- NULL = indefinite
  tns_updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  tns_updated_by               CHAR(36)     NULL REFERENCES car_users(usr_id),
  CONSTRAINT uniq_car_tenant_settings_ent UNIQUE (ent_id)
);
```

**Không cần soft-delete** — luôn có đúng 1 row per tenant. Update in-place.

### 3.3 Business logic

- **Auto-save cadence**:
  - Text input (`tenantName`): debounce **500ms** sau lần gõ cuối → fire action.
  - Select / Switch / Radio: fire action **ngay lập tức** khi `onValueChange` / `onCheckedChange`.
- **Optimistic update**: UI update giá trị mới ngay, sau đó action background. Nếu action lỗi → revert + toast error.
- **Save indicator**: text "Đang lưu…" → "Đã lưu" (fade 2s) ở header card, hoặc toast `success` cho action select/switch.
- **Concurrent edits**: action dùng `UPDATE car_tenant_settings SET ... WHERE ent_id = $1` (single row) — last-write-wins là chấp nhận được cho single-admin tenant.
- **Authz**: action throw `CAR-E0403` nếu `user.role !== 'ADMIN'`.
- **Audit log**: mỗi action insert 1 row `car_audit_logs` với `aud_action = 'SETTINGS.UPDATED'` (hoặc `APPROVAL_RULE.UPDATED`), `aud_payload = { field, oldValue, newValue }`.

### 3.4 UI thiết kế (theo `settings/page.tsx` hiện tại)

Giữ layout 4 Card (General / Approval / Notifications / Retention). Wrap mỗi field bằng Client Component nhỏ:

- `<TenantNameInput defaultValue={...} />` (Client, debounce 500ms)
- `<CurrencySelect defaultValue={...} />` (Client)
- `<TimezoneSelect defaultValue={...} />` (Client)
- `<ApprovalRuleRow rule={...} />` (Client, mỗi loại 1 row — toggle Switch + Input threshold)
- `<NotifPrefToggle field="inapp" defaultChecked={...} />` (Client)
- `<RetentionSelect field="trip" defaultValue={...} />` (Client)

Trang giữ Server Component, fetch settings ở top → truyền props xuống các Client subtree.

**Save indicator** — toast variant cho hành động nhanh:
- onChange → `toast.loading('Đang lưu…')` → action → `toast.success('Đã lưu')` hoặc `toast.error(...)`.

---

## 4. 갭 분석

### 4.1 Thay đổi tóm tắt

| 영역 | Hiện tại | Thay đổi | 영향도 |
|---|---|---|---|
| DB schema | Không có table tenant settings | Thêm `car_tenant_settings` (1 table, ~10 cột) | Low — table mới, không đụng dữ liệu cũ |
| DB seed | `car_approval_rules` lazy-seed | Giữ nguyên, thêm seed cho `car_tenant_settings` khi admin lần đầu mở `/settings` | Low |
| Drizzle schema | `expenses.schema.ts` chứa `carApprovalRules` | Thêm file `tenant-settings.schema.ts` + export trong `index.ts` | Low |
| Server actions | Chỉ `locale.actions.ts` | Thêm `tenant-settings.actions.ts`, `approval-rules.actions.ts` | Medium |
| Server services | `expense-approval.service.ts` | Thêm `tenant-settings.service.ts` (lazy-seed + update) | Low |
| Frontend | Server Component thuần | Trang vẫn SC, mỗi field wrap thành Client subtree | Medium |
| i18n | `settings.*` đủ | Thêm `settings.saveStatus.*` (saving/saved/error) | Low |
| Audit log | Đã có pattern | Thêm action codes `SETTINGS.UPDATED`, `APPROVAL_RULE.UPDATED` | Low |
| Authz | Middleware đã verify JWT | Thêm role check `ADMIN` trong từng action | Low |

### 4.2 Danh sách file thay đổi (chi tiết sang PLAN)

**Backend (mới):**
- `packages/db/src/schema/tenant-settings.schema.ts`
- `packages/db/src/schema/index.ts` (export)
- `packages/db/migrations/0006_tenant_settings.sql`
- `apps/web/src/server/services/tenant-settings.service.ts`
- `apps/web/src/server/actions/settings/tenant-settings.actions.ts`
- `apps/web/src/server/actions/settings/approval-rules.actions.ts`
- `apps/web/src/server/queries/tenant-settings.queries.ts`
- `apps/web/src/server/queries/approval-rules.queries.ts`

**Frontend (mới):**
- `apps/web/src/app/(app)/settings/_components/tenant-name-input.tsx`
- `apps/web/src/app/(app)/settings/_components/currency-select.tsx`
- `apps/web/src/app/(app)/settings/_components/timezone-select.tsx`
- `apps/web/src/app/(app)/settings/_components/approval-rule-row.tsx`
- `apps/web/src/app/(app)/settings/_components/notif-pref-toggle.tsx`
- `apps/web/src/app/(app)/settings/_components/retention-select.tsx`

**Frontend (sửa):**
- `apps/web/src/app/(app)/settings/page.tsx` (đã xoá Save button + sẽ thay mock UI bằng client subtree wrappers)

**i18n (sửa):**
- `apps/web/messages/vi.json`, `en.json`, `ko.json` (thêm `settings.saveStatus`)

### 4.3 DB migration strategy

- **Dev (Neon branching)**: tạo branch, chạy `drizzle-kit push` để test.
- **Staging/Prod**: viết SQL migration thủ công `0006_tenant_settings.sql`. Tenant existing → KHÔNG seed dữ liệu trước (lazy-seed khi admin lần đầu mở `/settings`).
- **Rollback**: `DROP TABLE car_tenant_settings;` — không ảnh hưởng table khác.

---

## 5. 사용자 플로우

### 5.1 Auto-save flow (Admin đổi tenant name)

```
Admin gõ vào "Tenant Name" input
  ↓ (debounce 500ms sau lần gõ cuối)
Client component gọi tenantSettingsAction({ tenantName: "ABC" })
  ↓
Server action:
  1. Verify role === 'ADMIN' → CAR-E0403 nếu không
  2. Validate Zod schema (max 120 chars)
  3. UPSERT car_tenant_settings WHERE ent_id = $1
  4. INSERT car_audit_logs (action='SETTINGS.UPDATED', payload={field, old, new})
  5. revalidatePath('/settings')
  ↓
Client nhận { success: true } → toast.success("Đã lưu")
  Hoặc { success: false, error } → revert giá trị + toast.error
```

### 5.2 Approval rule toggle flow

```
Admin click Switch "FUEL — Cần duyệt"
  ↓ (immediate, no debounce)
Client gọi approvalRuleAction({ type: 'FUEL', requiresApproval: true })
  ↓
Server action:
  1. Verify ADMIN
  2. UPSERT car_approval_rules WHERE (ent_id, apr_type) = ($1, $2)
  3. Audit log 'APPROVAL_RULE.UPDATED'
  ↓
Toast "Đã lưu — quy tắc duyệt cho Xăng dầu"
```

### 5.3 Phân nhánh

- **Authz fail (role != ADMIN)**: toast.error("Bạn không có quyền sửa cài đặt") + UI revert
- **Validation fail (Zod)**: toast.error(message) + UI revert
- **Network fail**: toast.error("Lưu lỗi: kết nối mạng") + UI giữ giá trị mới (user thử lại bằng cách gõ tiếp)

---

## 6. 기술 제약사항

| Constraint | Mô tả |
|---|---|
| **Next.js 15 RSC** | Trang `page.tsx` giữ Server Component để fetch settings ban đầu — các field wrap thành Client Component nhỏ. Tránh biến cả trang thành `'use client'` (sẽ mất SSR cho phần read). |
| **Drizzle migration** | Phải viết SQL thủ công cho staging/prod (CLAUDE.md cấm `synchronize`). |
| **Multi-tenancy** | `withEnt()` helper bắt buộc cho mọi query — không cho phép raw query không có `ent_id`. |
| **Authz** | Chỉ `ADMIN` được update. Manager/Driver render trang ở chế độ read-only (input/select `disabled`). Cần phân biệt UI state đọc-only vs disabled-due-to-pending. |
| **Audit log append-only** | INSERT thôi, không UPDATE/DELETE (CLAUDE.md §8). |
| **i18n** | Mọi text status save phải qua key `settings.saveStatus.*`, không hardcode. |
| **Soft-effect fields** | `currency`, `timezone`, retention chưa có downstream effect (expense display vẫn cứng VND, không có cleanup job). Vẫn persist để chuẩn bị nhưng đánh dấu trong PLAN là "store-only, no effect yet" để tránh hiểu lầm. |
| **Debounce** | Dùng `setTimeout` + clear trong `useEffect` cleanup — không cần lodash. |
| **Concurrency** | Single-admin tenant → last-write-wins acceptable. Không cần optimistic locking. |

---

## 7. Câu hỏi cần xác nhận trước khi sang PLAN

1. **Scope downstream effect**: Có cần ngay propagate `currency`/`timezone` xuống các nơi hiển thị expense + date (Trip list, Expense list, etc.) **trong cùng PR này**, hay chỉ persist trước (store-only)?
   - **Recommend**: chỉ persist trước → tạo REQ riêng cho downstream wiring sau, để PR này nhỏ + test được độc lập.

2. **Retention cleanup job**: Có cần triển khai background job (Render Cron) để thực sự xoá bản ghi cũ theo `tns_retention_*_years` trong PR này không?
   - **Recommend**: KHÔNG — chỉ persist. Cleanup là task riêng cho P6 hardening (CLAUDE.md §6).

3. **Notification preferences scope**: Tenant-level (1 setting cho cả công ty) hay per-user (mỗi user tự bật/tắt)?
   - **Recommend**: Tenant-level cho admin Settings page (đúng với scope hiện tại). Per-user preference (nếu cần) thì wire ở `/settings/me`.

4. **Approval rule UI edit chi tiết**: Nút edit `auto_threshold` (số tiền) cần Input number trong từng row, hay mở Modal khi click row?
   - **Recommend**: Inline Input number với debounce 500ms để consistent với pattern auto-save.

5. **Approval rule seed**: Lazy seed khi mở `/settings` lần đầu cho `ent_id`, hay batch seed ngay khi tạo migration?
   - **Recommend**: Lazy seed (đã match comment trong `expenses.schema.ts:121-122`).

---

**Status**: ✋ **WAITING FOR APPROVAL** — sau khi user duyệt REQ này (đặc biệt 5 câu hỏi §7), sẽ tiếp tục PLAN-20260521-settings-auto-save.md.
