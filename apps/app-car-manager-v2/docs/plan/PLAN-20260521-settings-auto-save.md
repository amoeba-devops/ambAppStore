# PLAN-20260521 — Admin Settings Auto-Save

> Based on [REQ-20260521-settings-auto-save.md](../analysis/REQ-20260521-settings-auto-save.md). All 5 questions in §7 of the REQ resolved per recommended answers + 1 new scope decision logged below.

## Decision log (after REQ)

| # | Question | Decision |
|---|---|---|
| Q1 | Propagate currency/timezone? | **NO** — persist-only |
| Q2 | Retention cleanup job? | **NO** — persist-only |
| Q3 | Notif preferences scope? | **Tenant-level** |
| Q4 | Approval threshold UI? | n/a — see Q6 |
| Q5 | Approval seed strategy? | n/a — see Q6 |
| **Q6** (new) | Approval Rules card | **REMOVE entirely** — admin approval flow already gone ([expense-approval.service.ts:5-15](../../apps/web/src/server/services/expense-approval.service.ts#L5-L15)). Wiring UI to dormant `car_approval_rules` would create dead read-paths. Card removed from `/settings`. Schema kept for history (per existing comment). |

## 1. 시스템 개발 현황 분석

### 1.1 디렉토리 + 기술 스택

- Monorepo: Turborepo + npm workspaces (standalone in `apps/app-car-manager-v2/`)
- Frontend: Next.js 15 App Router (Server Component default), React 19
- DB: Neon Postgres + Drizzle 0.38 (schema-per-file in [`packages/db/src/schema/`](../../packages/db/src/schema/))
- Auth: AMA JWT passthrough → `getCurrentUser()` reads `x-ent-id`, `x-user-id`, `x-user-role` headers
- Actions: `'use server'` + `runAction()` wrapper from [`_helpers.ts`](../../apps/web/src/server/actions/_helpers.ts)
- Audit: `logAudit()` from [`audit-log.service.ts`](../../apps/web/src/server/services/audit-log.service.ts)
- Toast: `toast.{success,error,loading}` from `@car-v2/ui`
- Switch: Radix-based, accepts `onCheckedChange(boolean)`
- i18n: next-intl with `useTranslations('namespace')` (client) + `getTranslations()` (server)

### 1.2 기존 코드 status

- [`/settings/page.tsx`](../../apps/web/src/app/(app)/settings/page.tsx) — Server Component với mock UI (defaultValue uncontrolled). Save button vừa xoá ở phase A của REQ này.
- [`/settings/me/page.tsx`](../../apps/web/src/app/(app)/settings/me/page.tsx) — auto-save 100%. Pattern reference.
- [`car_approval_rules`](../../packages/db/src/schema/expenses.schema.ts) — dormant table (admin approval removed)
- [`expense-approval.service.ts`](../../apps/web/src/server/services/expense-approval.service.ts) — always returns AUTO_APPROVED

### 1.3 제약사항

- Multi-tenancy: mọi query phải filter `ent_id`
- Authz: chỉ ADMIN được mutate settings
- Audit log append-only
- Migration thủ công cho staging/prod (synchronize off)
- i18n: vi/en/ko 3 files
- Client component pattern: `useTransition` + debounce setTimeout + toast feedback

---

## 2. 단계별 구현 계획

### Phase 1 — DB Schema + Migration

**Step 1.1** — Drizzle schema `tenant-settings.schema.ts`
- Table `car_tenant_settings` (1:1 với `ent_id`)
- Enum mới: `car_currency` (`VND` | `KRW` | `USD`)
- Cột: tns_id (PK), ent_id, tns_tenant_name (varchar 120 nullable), tns_currency (enum, default VND), tns_timezone (varchar 64, default 'Asia/Ho_Chi_Minh'), tns_notif_inapp/email/digest (boolean default true), tns_retention_trip_years (integer default 5), tns_retention_audit_years (integer nullable default 5), tns_updated_at (timestamptz), tns_updated_by (char36 nullable FK car_users.usr_id)
- Constraint: UNIQUE(ent_id)

└─ **사이드 임팩트**: thêm enum mới `car_currency` — không đụng table/code khác. Drizzle schema export → tự động available qua `@car-v2/db/schema`.

**Step 1.2** — SQL migration `0006_tenant_settings.sql`
- CREATE TYPE car_currency
- CREATE TABLE car_tenant_settings (full DDL)
- CREATE UNIQUE INDEX uniq_car_tenant_settings_ent
- FK constraint cho tns_updated_by → car_users.usr_id (ON DELETE SET NULL)

└─ **사이드 임팩트**: Postgres CREATE TYPE block tx, không rollback inline được. Test trên Neon branch trước. Existing tenant chưa có row → lazy seed.

**Step 1.3** — Cập nhật `packages/db/migrations/meta/_journal.json` (thêm entry idx=6)

└─ **사이드 임팩트**: drizzle-kit generate sẽ override file này — nhưng vì viết SQL thủ công nên phải manual update.

### Phase 2 — Backend Service + Actions

**Step 2.1** — `tenant-settings.queries.ts`
- `getTenantSettings(entId)`: SELECT * FROM car_tenant_settings WHERE ent_id = $1 LIMIT 1

**Step 2.2** — `tenant-settings.service.ts`
- `getOrSeedTenantSettings(entId, userId)`: read-or-insert pattern. Nếu chưa có row → INSERT default values, return.

└─ **사이드 임팩트**: lazy seed có race condition giữa 2 ADMIN cùng load — handle bằng `ON CONFLICT (ent_id) DO NOTHING` + re-SELECT.

**Step 2.3** — Zod schemas trong `packages/shared/src/zod/tenant-settings.zod.ts`
- `updateTenantNameSchema`: `{ tenant_name: string().min(1).max(120).nullable() }`
- `updateCurrencySchema`: `{ currency: enum(['VND','KRW','USD']) }`
- `updateTimezoneSchema`: `{ timezone: string().min(1).max(64) }` (IANA tz name — không enum cứng, chỉ allowlist whitelist trong service)
- `updateNotifPrefSchema`: `{ field: enum(['inapp','email','digest']), value: boolean }`
- `updateRetentionSchema`: `{ field: enum(['trip','audit']), years: number().int().nullable() }` — nullable for indefinite audit retention

**Step 2.4** — Server actions `tenant-settings.actions.ts`
- `updateTenantNameAction(input)` → requireRole(ADMIN) → validate → UPDATE → logAudit(`SETTINGS.UPDATE`, field='tenantName') → revalidatePath('/settings')
- `updateCurrencyAction(input)`
- `updateTimezoneAction(input)`
- `updateNotifPrefAction(input)` — single action handle 3 fields qua param
- `updateRetentionAction(input)` — single action handle 2 fields qua param

└─ **사이드 임팩트**: 5 actions, mỗi cái audit log riêng → tăng số row audit khi admin tweak settings nhiều. OK cho admin scope nhỏ.

**Step 2.5** — Timezone allowlist
- Hardcode whitelist trong service: `['Asia/Ho_Chi_Minh', 'Asia/Seoul']` (match prototype). Throw CAR-E0001 nếu khác.

### Phase 3 — Frontend Client Components

**Step 3.1** — `_components/tenant-name-input.tsx` (Client)
- `useState` controlled input + `useRef` debounce timer 500ms + `useTransition`
- onChange → set state ngay + clear timer + setTimeout 500ms → fire action
- Visual: nếu pending → spinner inline bên phải input; success → checkmark fade 1s; error → border red + toast

**Step 3.2** — `_components/currency-select.tsx` (Client)
- `useState` for value, fire action immediately onValueChange
- Pending state disables Select

**Step 3.3** — `_components/timezone-select.tsx` (Client)
- Tương tự currency-select

**Step 3.4** — `_components/notif-pref-toggle.tsx` (Client)
- Generic component: takes `field: 'inapp'|'email'|'digest'`, `defaultChecked`, calls `updateNotifPrefAction({field, value})`
- Optimistic update: setState immediately, fire action, revert on error

**Step 3.5** — `_components/retention-select.tsx` (Client)
- Generic: takes `field: 'trip'|'audit'`, `defaultValue`, options list passed from server (i18n)
- Fire action onValueChange

└─ **사이드 임팩트**: 5 client components mới — tăng JS bundle ~3-5KB. Page vẫn SC ở root.

### Phase 4 — Page Wiring

**Step 4.1** — Refactor [`/settings/page.tsx`](../../apps/web/src/app/(app)/settings/page.tsx)
- Vẫn Server Component
- Fetch: `getCurrentUser()` + `getOrSeedTenantSettings(actor.entId, actor.userId)` + check role
- Nếu role !== ADMIN: render trang ở read-only mode (disabled controls + hint banner "View only")
- **Xoá Approval Rules card hoàn toàn** (CardTitle approval, CardContent với APPROVAL_RULES.map)
- Replace `<Input>`, `<Select>`, `<ToggleRow>` → các Client component mới với props từ DB row

└─ **사이드 임팩트**: trang giờ thực sự DB-driven. Lần đầu load chậm hơn ~50ms (lazy seed insert nếu chưa có row). Lần sau cached.

**Step 4.2** — Xoá biến `APPROVAL_RULES` ở top file + imports `Badge`, `tCost` không còn dùng

**Step 4.3** — Xoá imports `Switch`, `Input`, `Select*`, `Label` không còn cần (page giờ chỉ là layout shell — controls nằm trong client subcomponents).

### Phase 5 — i18n

**Step 5.1** — Thêm namespace `settings.saveStatus` vào `vi.json`, `en.json`, `ko.json`:
```json
"saveStatus": {
  "saving": "...",
  "saved": "...",
  "error": "..."
}
```

**Step 5.2** — Thêm `settings.viewOnlyNotice` cho Manager/Driver
- vi: "Chỉ Quản trị mới có thể thay đổi cài đặt — bạn đang xem ở chế độ chỉ đọc."
- en: "Only Admins can change settings — you are viewing in read-only mode."
- ko: "관리자만 설정을 변경할 수 있습니다 — 읽기 전용 모드입니다."

**Step 5.3** — Xoá keys không còn dùng: `approval`, `approvalDesc`, `approvalThreshold`, `approvalRequired`, `autoApproved` (Approval card đã remove).

└─ **사이드 임팩트**: 3 file vi/en/ko phải sửa đồng bộ. CLAUDE.md rule.

### Phase 6 — Test + Verify

**Step 6.1** — Typecheck: `npm run typecheck` ở web app
**Step 6.2** — Lint: `npm run lint`
**Step 6.3** — Manual test theo TC

---

## 3. 변경 파일 목록

| 구분 | 파일 | 변경 |
|---|---|---|
| **Backend** | `packages/db/src/schema/tenant-settings.schema.ts` | 신규 |
| Backend | `packages/db/src/schema/index.ts` | 수정 (1 dòng export) |
| Backend | `packages/db/migrations/0006_tenant_settings.sql` | 신규 |
| Backend | `packages/db/migrations/meta/_journal.json` | 수정 (thêm entry) |
| Backend | `packages/shared/src/zod/tenant-settings.zod.ts` | 신규 |
| Backend | `packages/shared/src/zod/index.ts` | 수정 (1 dòng) |
| Backend | `apps/web/src/server/queries/tenant-settings.queries.ts` | 신규 |
| Backend | `apps/web/src/server/services/tenant-settings.service.ts` | 신규 |
| Backend | `apps/web/src/server/actions/settings/tenant-settings.actions.ts` | 신규 |
| **Frontend** | `apps/web/src/app/(app)/settings/_components/tenant-name-input.tsx` | 신규 |
| Frontend | `apps/web/src/app/(app)/settings/_components/currency-select.tsx` | 신규 |
| Frontend | `apps/web/src/app/(app)/settings/_components/timezone-select.tsx` | 신규 |
| Frontend | `apps/web/src/app/(app)/settings/_components/notif-pref-toggle.tsx` | 신규 |
| Frontend | `apps/web/src/app/(app)/settings/_components/retention-select.tsx` | 신규 |
| Frontend | `apps/web/src/app/(app)/settings/page.tsx` | 수정 (major refactor) |
| **i18n** | `apps/web/messages/vi.json` | 수정 (add saveStatus + viewOnlyNotice, remove approval keys) |
| i18n | `apps/web/messages/en.json` | 수정 |
| i18n | `apps/web/messages/ko.json` | 수정 |

**Total**: 9 file mới, 8 file sửa.

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 + 완화 |
|---|---|---|
| DB migration (new table) | **Low** | Table mới — không touch existing data. Nếu migration fail, app vẫn run (page sẽ throw khi lazy seed → catch trong try/catch + fallback default values trong UI nếu cần) |
| Lazy seed race condition | Low | 2 admin cùng mở `/settings` → 2 INSERT cùng lúc. Resolve bằng `ON CONFLICT (ent_id) DO NOTHING` + re-SELECT |
| Audit log volume | Low | Mỗi keystroke `tenant_name` debounce 500ms = 1 audit row. Admin scope nhỏ — không lo |
| Removed Approval card | **Medium** | i18n keys `approval*` bị xoá → KHÔNG được reference ở đâu khác. Phải grep verify trước khi xoá |
| `currency`/`timezone` không có effect | Low | Persist-only theo Q1. User có thể đổi mà không thấy gì thay đổi → toast `Đã lưu` đủ feedback |
| Read-only mode cho Manager/Driver | Low | Page check role lúc render → render disabled state. Action vẫn block với 403 nếu user gọi qua route hack |
| Toast spam khi user gõ nhanh | Low | Debounce 500ms ở `tenant-name-input` → 1 toast cho mỗi pause. Acceptable UX |
| Existing tenant load time | Low | Lần đầu mở `/settings` → INSERT default row → ~50ms extra. Lần sau cached |
| Tests for new actions | Low | Không có Vitest setup hiện tại — manual TC theo TC doc |

---

## 5. DB 마이그레이션

### 5.1 Dev / Local

```bash
cd apps/app-car-manager-v2
# Drizzle-kit push (chỉ dev, không stg/prod)
npx drizzle-kit push
```

### 5.2 Staging / Production

```bash
# Connect Neon SQL editor hoặc psql
psql $DATABASE_URL -f packages/db/migrations/0006_tenant_settings.sql
```

### 5.3 SQL preview (`0006_tenant_settings.sql`)

```sql
CREATE TYPE "public"."car_currency" AS ENUM('VND', 'KRW', 'USD');

CREATE TABLE "car_tenant_settings" (
  "tns_id"                       char(36) PRIMARY KEY NOT NULL,
  "ent_id"                       char(36) NOT NULL,
  "tns_tenant_name"              varchar(120),
  "tns_currency"                 "car_currency" DEFAULT 'VND' NOT NULL,
  "tns_timezone"                 varchar(64) DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
  "tns_notif_inapp"              boolean DEFAULT true NOT NULL,
  "tns_notif_email"              boolean DEFAULT true NOT NULL,
  "tns_notif_digest"             boolean DEFAULT true NOT NULL,
  "tns_retention_trip_years"     integer DEFAULT 5 NOT NULL,
  "tns_retention_audit_years"    integer DEFAULT 5,
  "tns_updated_at"               timestamp with time zone DEFAULT now() NOT NULL,
  "tns_updated_by"               char(36)
);

CREATE UNIQUE INDEX "uniq_car_tenant_settings_ent" ON "car_tenant_settings" ("ent_id");

ALTER TABLE "car_tenant_settings"
  ADD CONSTRAINT "car_tenant_settings_tns_updated_by_car_users_usr_id_fk"
  FOREIGN KEY ("tns_updated_by") REFERENCES "public"."car_users"("usr_id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
```

### 5.4 Rollback

```sql
DROP TABLE car_tenant_settings;
DROP TYPE car_currency;
```

Không ảnh hưởng table khác. Settings page sẽ revert to mock UI nếu rollback (page sẽ throw, cần feature flag — chấp nhận do scope MVP).

---

**Status**: ✅ Ready to implement. Next: TC doc + implementation.
