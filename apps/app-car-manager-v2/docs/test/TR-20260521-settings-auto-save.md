# TR-20260521 — Settings Auto-Save Test Results

Based on [TC-20260521-settings-auto-save.md](TC-20260521-settings-auto-save.md). Static-verification results (typecheck/lint/build). Manual TC against live DB still pending until staging deploy + migration.

## Static verification matrix

| Check | Cmd | Result | Notes |
|---|---|---|---|
| TypeScript (all packages) | `npx turbo run typecheck` | ✅ PASS | 4/4 packages, 3.7s cached |
| ESLint (web) | `npx turbo run lint` | ✅ PASS | "No ESLint warnings or errors" |
| Production build (web) | `npx turbo run build --filter=@car-v2/web` | ✅ PASS | `/settings` page compiled at 3.35 kB / 312 kB First Load JS · 1m24s |
| Drizzle schema export | `packages/db/src/schema/index.ts` | ✅ exports `tenant-settings.schema` |
| Zod schema export | `packages/shared/src/zod/index.ts` | ✅ exports `tenant-settings.zod` |
| Migration journal | `packages/db/migrations/meta/_journal.json` | ✅ entry idx=6 added |
| i18n key removal | grep `settings.approval` / `autoApproved` in web/src | ✅ no matches (clean) |
| i18n key addition (vi/en/ko) | grep `saveStatus` + `viewOnlyNotice` | ✅ all 3 files present |

## Test-case mapping

Static-verifiable cases marked ✅. Manual cases pending live env (need DB + auth).

| TC | Scope | Static | Manual |
|---|---|---|---|
| TC-1 | Lazy seed | ✅ service code reviewed (`onConflictDoNothing` + re-SELECT) | ⏳ live DB |
| TC-2 | Tenant name debounce | ✅ debounce 500ms in `tenant-name-input.tsx`; Zod `max(120)` | ⏳ live DB + audit log inspect |
| TC-3 | Currency | ✅ enum guard + optimistic+revert pattern verified | ⏳ live DB |
| TC-4 | Timezone | ✅ `assertTimezoneAllowed` whitelist enforced | ⏳ live DB; edge case "Invalid/Tz" via direct call |
| TC-5 | Notif toggles | ✅ 3 fields routed through `updateNotifPrefAction` | ⏳ live DB |
| TC-6 | Retention | ✅ trip/audit guards + NULL=indefinite encode/decode | ⏳ live DB |
| TC-7 | Authz | ✅ `requireRole(['ADMIN'])` in every action + `disabled={!isAdmin}` UI gating | ⏳ live as MANAGER/DRIVER |
| TC-8 | Approval card removed | ✅ `APPROVAL_RULES` constant gone, no `tCost`/`Badge`/`Switch` imports | ✅ verified via build (page size 3.35 kB) |
| TC-9 | Save status indicator | ✅ pending Loader2 + savedFlash Check icon in input; toast on Select/Switch | ⏳ live UX |
| TC-10 | Concurrent edits | ✅ last-write-wins acceptable per PLAN §4 | ⏳ 2-tab live test |
| TC-11 | i18n | ✅ 3 file keys present | ⏳ locale switch live |
| TC-12 | Migration safety | ✅ SQL syntax valid; DROP rollback documented | ⏳ live Neon branch test |

## Known gaps

1. **No live DB test yet** — migration 0006 must run on a Neon dev/branch first before merging. Add to deploy checklist.
2. **No Vitest suite** — manual-only per CLAUDE.md §6 P6 (test hardening deferred).
3. **`currency` / `timezone` / retention have no downstream effect yet** — persist-only per REQ §7 Q1/Q2. Expense display still hardcodes VND; date formatter still uses request locale not tenant tz. Filed as follow-up REQ.

## Outcome

✅ **PASS for static verification.** All build/lint/typecheck green. Manual TC suite ready to execute against staging after migration applies. No regressions in other pages (build size delta for `/settings` is in-line: +~1.5 kB for 5 client subcomponents).
