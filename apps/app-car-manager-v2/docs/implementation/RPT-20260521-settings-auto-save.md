# RPT-20260521 — Admin Settings Auto-Save (Implementation Report)

| Phase | Doc |
|---|---|
| Analysis | [REQ-20260521-settings-auto-save.md](../analysis/REQ-20260521-settings-auto-save.md) |
| Plan | [PLAN-20260521-settings-auto-save.md](../plan/PLAN-20260521-settings-auto-save.md) |
| Test cases | [TC-20260521-settings-auto-save.md](../test/TC-20260521-settings-auto-save.md) |
| Test results | [TR-20260521-settings-auto-save.md](../test/TR-20260521-settings-auto-save.md) |

## Goal

Trang admin Settings (`/settings`) auto-save khi user thay đổi, **không cần nút Lưu**. Mỗi field tự gọi server action — match với hành vi `/settings/me`.

## Changes summary

### Backend (8 new + 3 modified)

**New schema + migration**
- [`packages/db/src/schema/tenant-settings.schema.ts`](../../packages/db/src/schema/tenant-settings.schema.ts) — Drizzle table `car_tenant_settings` (1 row / tenant). Columns: tenantName, currency (enum), timezone, 3 notif booleans, 2 retention integers, updated_at/by.
- [`packages/db/migrations/0006_tenant_settings.sql`](../../packages/db/migrations/0006_tenant_settings.sql) — DDL: `CREATE TYPE car_currency`, `CREATE TABLE car_tenant_settings`, UNIQUE index, FK to `car_users`.
- [`packages/db/migrations/meta/_journal.json`](../../packages/db/migrations/meta/_journal.json) — manual journal entry idx=6.
- [`packages/db/src/schema/index.ts`](../../packages/db/src/schema/index.ts) — added export.

**New Zod schemas**
- [`packages/shared/src/zod/tenant-settings.zod.ts`](../../packages/shared/src/zod/tenant-settings.zod.ts) — `updateTenantName/Currency/Timezone/NotifPref/Retention` schemas.
- [`packages/shared/src/zod/index.ts`](../../packages/shared/src/zod/index.ts) — added export.

**New service + actions**
- [`apps/web/src/server/queries/tenant-settings.queries.ts`](../../apps/web/src/server/queries/tenant-settings.queries.ts) — `getTenantSettings(entId)`.
- [`apps/web/src/server/services/tenant-settings.service.ts`](../../apps/web/src/server/services/tenant-settings.service.ts) — `getOrSeedTenantSettings()` (race-safe via `onConflictDoNothing` + re-SELECT) + `assert*` allowlist guards.
- [`apps/web/src/server/actions/settings/tenant-settings.actions.ts`](../../apps/web/src/server/actions/settings/tenant-settings.actions.ts) — 5 actions: `updateTenantName/Currency/Timezone/NotifPref/Retention`. Each: `requireRole(ADMIN)` → Zod parse → service guard → UPDATE → `logAudit('SETTINGS.UPDATE')` → `revalidatePath('/settings')`.

### Frontend (5 new + 1 major refactor)

**New client subcomponents (`apps/web/src/app/(app)/settings/_components/`)**
- `tenant-name-input.tsx` — debounce 500ms, optimistic value, Loader2/Check inline indicator.
- `currency-select.tsx` — immediate save, optimistic+revert on error, toast.
- `timezone-select.tsx` — allowlist matches service.
- `notif-pref-toggle.tsx` — generic Switch wrapper (inapp/email/digest).
- `retention-select.tsx` — generic Select, encodes NULL = `__indefinite__`.

**Refactor**
- [`apps/web/src/app/(app)/settings/page.tsx`](../../apps/web/src/app/(app)/settings/page.tsx)
  - Removed: Save button (Phase A earlier in this branch), `APPROVAL_RULES` constant, full Approval Rules `<Card>`.
  - Added: `getOrSeedTenantSettings()` call + Role gate (Manager/Driver → read-only banner via `Alert variant="info"` + all controls `disabled`).
  - Replaced: `<Input>`, `<Select>`, `<ToggleRow>` mocks → 5 client subcomponents.

### i18n (3 modified)

`messages/{vi,en,ko}.json`:
- ✅ Added: `settings.viewOnlyNotice`, `settings.saveStatus.{saving,saved,error}`.
- ❌ Removed: `settings.approval`, `approvalDesc`, `approvalThreshold`, `approvalRequired`, `autoApproved` (approval flow gone per `expense-approval.service.ts:5-15`).

## Scope decisions (logged from REQ §7 + new in PLAN)

| # | Question | Decision | Rationale |
|---|---|---|---|
| Q1 | Propagate currency/timezone downstream? | **NO** — persist-only | Keep PR small; downstream wiring (expense display, date formatter) deferred to separate REQ |
| Q2 | Retention cleanup job? | **NO** | P6 hardening task per CLAUDE.md §6 |
| Q3 | Notif preferences scope? | **Tenant-level** | Matches scope of admin Settings page (per-user prefs would live in `/settings/me`) |
| Q4 | Approval threshold UI? | **n/a** | See Q6 |
| Q5 | Approval seed strategy? | **n/a** | See Q6 |
| Q6 | Approval Rules card (new) | **REMOVED entirely** | Admin approval flow already gone (commit `51460ad`); wiring UI to dormant table = dead read-path |

## Outcomes

### Goals achieved

- ✅ Save button removed from admin Settings.
- ✅ 8 functional fields auto-save: tenantName, language (locale cookie — pre-existing), currency, timezone, notif inapp/email/digest, push (pre-existing), retention trip/audit.
- ✅ Behavior parity with `/settings/me` (debounce for text, immediate for Select/Switch, toast feedback).
- ✅ Authz enforced: action throws `CAR-E0102` for non-Admin; UI disables all controls + shows read-only banner.
- ✅ Audit log: every mutation appends 1 row with `action='SETTINGS.UPDATE'`, `aud_before`, `aud_after` carrying `{field, value}`.
- ✅ Multi-tenant: every query filters by `ent_id` (passed via `getCurrentUser()`).

### Verification

- ✅ Typecheck: 4/4 packages green
- ✅ Lint: 0 warnings
- ✅ Production build: green, `/settings` route 3.35 kB / 312 kB First Load JS
- ⏳ Live DB tests: pending migration 0006 apply on Neon dev/staging branch

### Deferred / Out of scope

- Currency display propagation (expense screens still hardcode VND)
- Timezone propagation (date formatters still use request locale)
- Retention cleanup cron (no row deletion job exists yet)
- Per-user notification preferences (different layer, future REQ if needed)
- Vitest coverage (P6)

## Deployment notes

1. **Migration**: run `packages/db/migrations/0006_tenant_settings.sql` against staging Neon DB before merging to `main`. Drizzle journal updated so subsequent `drizzle-kit` runs won't try to regenerate.
2. **No backfill required** — existing tenants get lazy-seeded on first `/settings` access by Admin.
3. **Rollback** — `DROP TABLE car_tenant_settings; DROP TYPE car_currency;` (Settings page will throw until app reverts; acceptable for MVP scope).
4. **Staging → Prod** — follow standard CLAUDE.md branching flow (`main` → staging → test → PR to `production`).

## Files changed (final inventory)

| Type | File | Status |
|---|---|---|
| Schema | `packages/db/src/schema/tenant-settings.schema.ts` | new |
| Schema export | `packages/db/src/schema/index.ts` | edit |
| Migration | `packages/db/migrations/0006_tenant_settings.sql` | new |
| Migration journal | `packages/db/migrations/meta/_journal.json` | edit |
| Zod | `packages/shared/src/zod/tenant-settings.zod.ts` | new |
| Zod export | `packages/shared/src/zod/index.ts` | edit |
| Query | `apps/web/src/server/queries/tenant-settings.queries.ts` | new |
| Service | `apps/web/src/server/services/tenant-settings.service.ts` | new |
| Action | `apps/web/src/server/actions/settings/tenant-settings.actions.ts` | new |
| Client | `apps/web/src/app/(app)/settings/_components/tenant-name-input.tsx` | new |
| Client | `apps/web/src/app/(app)/settings/_components/currency-select.tsx` | new |
| Client | `apps/web/src/app/(app)/settings/_components/timezone-select.tsx` | new |
| Client | `apps/web/src/app/(app)/settings/_components/notif-pref-toggle.tsx` | new |
| Client | `apps/web/src/app/(app)/settings/_components/retention-select.tsx` | new |
| Page | `apps/web/src/app/(app)/settings/page.tsx` | refactor (Save button removed earlier; Approval card removed; mock controls replaced) |
| i18n | `apps/web/messages/vi.json` | edit |
| i18n | `apps/web/messages/en.json` | edit |
| i18n | `apps/web/messages/ko.json` | edit |
| Docs | `docs/analysis/REQ-20260521-settings-auto-save.md` | new |
| Docs | `docs/plan/PLAN-20260521-settings-auto-save.md` | new |
| Docs | `docs/test/TC-20260521-settings-auto-save.md` | new |
| Docs | `docs/test/TR-20260521-settings-auto-save.md` | new |
| Docs | `docs/implementation/RPT-20260521-settings-auto-save.md` | new (this file) |

**Total**: 14 new + 8 modified.
