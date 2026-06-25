# TR-20260521 — Prime Cost Versioning Test Report

> **Status:** Implementation v1 — Phase 1 complete (Phase A-E shipped end-to-end).
> **Tracks:** [REQ](../analysis/REQ-20260521-prime-cost-versioning.md) · [PLAN](../plan/PLAN-20260521-prime-cost-versioning.md) · [TC](TC-20260521-prime-cost-versioning.md)
> **Date:** 2026-05-21
> **Tester:** Truc Hoang (manual + automated `tsc`)

## 1. Summary

| Metric | Value |
|---|---|
| Test cases planned (TC doc) | 40+ |
| P0 cases verified | Most automated via `tsc` + migration script |
| P1 cases verified | Code-path verification (no synthetic dataset run yet) |
| P2 cases verified | Deferred (perf + concurrent inserts) |
| TypeScript compilation | ✓ PASS (`tsc --noEmit` exit 0) |
| Migration applied | ✓ Dev Neon branch — 225 backfilled versions |
| Production deploy | NOT YET — staging soak pending |

## 2. Code-level verifications

### TC-1.* — Migration & backfill
- **TC-1.1** ✓ Backfill verified on dev DB: `master_active = 225, versions_active = 225` (1:1).
- **TC-1.2** ✓ Migration uses `WHERE pc.pcs_deleted_at IS NULL` — soft-deleted master rows excluded.
- **TC-1.3** ✓ Backfill SQL copies `pcs_prime_cost_vnd` 1:1 into `pcv_prime_cost_vnd`. Sentinel `effective_from = '2020-01-01'`.
- **TC-1.4** ✓ Migration is idempotent (`IF NOT EXISTS` + `NOT EXISTS` guard). Rollback via `DROP TABLE` keeps master untouched.

### TC-2.* — Calculator
- **TC-2.1-2.4** ✓ `findPrimeCost()` implemented per spec at [gmv-calculator.service.ts:62](../../apps/web/src/server/services/gmv-calculator.service.ts#L62): DESC-scan, latest-applicable, empty-orderDate → master.primeCost (latest), no versions → master.primeCost.
- **TC-2.5-2.6** Code path: both calculators call `findPrimeCost(master, row.orderDate)` at the per-row prime-cost lookup site ([gmv-calculator.service.ts:364](../../apps/web/src/server/services/gmv-calculator.service.ts#L364), [tiktok-metrics-calculator.service.ts:228](../../apps/web/src/server/services/tiktok-metrics-calculator.service.ts#L228)). Integration test with synthetic dataset **deferred to staging soak**.
- **TC-2.7** ✓ Feature flag OFF → loader synthesizes single-version array with `effectiveFrom='1900-01-01'` ([prime-cost-master.service.ts:75](../../apps/web/src/server/services/prime-cost-master.service.ts#L75)). `findPrimeCost` always returns this single value regardless of orderDate. Behaviour identical to pre-Phase-1.

### TC-3.* — Parser orderDate extraction
- **TC-3.1, 3.5** ✓ Shopee parser parses "Ngày đặt hàng" via `orderDateCell()` helper at [shopee-sales-parser.service.ts:88](../../apps/web/src/server/services/shopee-sales-parser.service.ts#L88). Handles Excel-typed `Date`, ISO-prefix strings, `DD/MM/YYYY`.
- **TC-3.2** ✓ Optional column resolution — when "Ngày đặt hàng" absent, `orderDateCol = -1`, `orderDate = ''` for all rows. Parse succeeds.
- **TC-3.3-3.4** ✓ TikTok parser at [tiktok-sales-parser.service.ts:70](../../apps/web/src/server/services/tiktok-sales-parser.service.ts#L70) — `toIsoDate()` handles string + Excel serial numbers.

### TC-4.* — Version CRUD
- **TC-4.1** ✓ `addPrimeCostVersionAction` inserts row + logs `MASTER_DATA / add_version` with Δ% summary.
- **TC-4.2** ✓ Unique constraint `uniq_sal_pcv_ent_sku_date` enforced; service catches the error message and re-throws as `SAL-E0409`.
- **TC-4.3** ✓ `addVersion` rejects `effectiveFrom > today + 30 days` → `SAL-E0400`.
- **TC-4.4** ✓ Service verifies SKU ownership + soft-delete state → `SAL-E0404` on miss.
- **TC-4.5** ✓ Soft-delete: sets `pcv_deleted_at`. Loader query filters `IS NULL`.
- **TC-4.6** ✓ `softDeleteVersion` counts active versions before deleting → rejects with `SAL-E0409` if only 1 remains.
- **TC-4.7-4.8** ✓ Master cache sync — `addVersion` checks if new version is the latest among existing, then updates `sal_prime_costs.pcs_prime_cost_vnd`. Retro versions don't mutate the cache.

### TC-5.* — CSV import/export
- **TC-5.1-5.2** ✓ Import path: optional 9th column `Effective From` parsed; empty → today's ISO date. Each row → upsert master + INSERT version (unique-conflict swallowed silently for same-date repeats).
- **TC-5.3** ✓ Row-level validation: bad `Effective From` format → row error.
- **TC-5.4-5.5** ✓ Export adds `Effective From` column populated with the **latest** active version's date per SKU. Phase 1 ships with `mode=latest` only (single row per SKU), keeping CSV shape compatible.

### TC-6.* — UI
- **TC-6.1, 6.4-6.5** ✓ "Versions" button on each row (when flag ON) opens `VersionHistoryModal`. Inside: table of versions DESC, "Latest" badge, Delete disabled when only 1 left.
- **TC-6.2** ✓ "Add new version" opens nested `AddVersionModal` with date + cost + optional breakdown + source note.
- **TC-6.3** N/A — Phase 1 keeps existing PrimeCostFormModal intact; cost field still editable there for backward-compat. Future Phase 1.1 may split to "edit metadata" mode.
- **TC-6.6** ✓ `isPrimeCostVersioningEnabled()` gates the "Versions" button + VersionHistoryModal — flag off → versioning UI hidden completely, existing form modal remains.
- **TC-6.7** ✓ All new strings under `primeCost.version.*` in both `en.json` and `ko.json`.

### TC-7.* — End-to-end ingest scenarios
- **TC-7.1** Code path verified by inspection. Manual smoke required on staging with real Draft period after flag flip.
- **TC-7.2-7.3** ✓ NFR-08 enforced by pre-existing snapshot pattern. Adding a version → only `sal_prime_cost_versions` mutated + `sal_prime_costs.pcs_prime_cost_vnd` cache. `sal_period_snapshots.psp_metrics` blob is **never touched** by version actions.
- **TC-7.4** ✓ Empty `orderDate` falls through to latest version in `findPrimeCost`. Legacy files without the column compute correctly (with latest cost — best-effort).

### TC-8.* — Performance
- **TC-8.1-8.3** Deferred to staging soak. Per-row lookup is O(V) with V ≤ ~10 — negligible on 5k-row periods.

### TC-9.* — Activity log
- **TC-9.1** ✓ `add_version` log with Δ% computed against previous-latest.
- **TC-9.2** ✓ `delete_version` log.
- **TC-9.3** ✓ Bulk CSV import emits a single `imported` summary with `versionsAdded` count.

## 3. Outstanding before production flip

| Item | Owner | Notes |
|------|-------|-------|
| Apply migration 0008 on staging Neon | Truc | `psql $DATABASE_URL -f packages/db/migrations/0008_prime_cost_versions.sql` |
| Flip `NEXT_PUBLIC_PRIME_COST_VERSIONING=on` on staging | Truc | Then redeploy |
| Manual smoke TC-7.1 (mixed-cost Draft re-ingest) | Truc + Manager | Use a SKU with 2 versions + a known order date split |
| Manual smoke TC-7.3 (retro version doesn't touch Finalized snapshot) | Truc | Verify by SQL diff on `psp_metrics` JSONB before/after |
| Monitor staging for 1 week | Truc | Watch for `MASTER_DATA / add_version` log noise + ingest error rate |
| Apply migration to production | Truc | After staging soak passes |
| Flip flag on production | Truc | Coordinate w/ Manager (1 week notice for Operator training) |

## 4. Known limitations (Phase 1)

- **`sellingPrice` / `listingPrice` NOT versioned.** Phase 1 only versions `prime_cost`. If Shopee changes a SKU's selling price mid-period, current ingest still uses today's value for all orders — same as pre-versioning. Phase 2 can extend.
- **CSV export defaults to "latest-only"** — no `mode=all-versions` export yet. Users export → 1 row per SKU as before.
- **Effective From cap = +30 days** — Operators cannot pre-schedule a version more than a month ahead. Removable via service constant if needed.
- **PrimeCostFormModal still edits cost in-place** when flag ON. This dual entry point (form OR version-modal) is intentional for Phase 1 — Phase 1.1 may consolidate.
- **No version-comparison view** (diff between versions). Operators see flat table only.
- **Warehouse-per-day NOT auto-prorated** — `breakdown.warehousePerDay` stored verbatim but not applied to total cost. Phase 2 will compute storage-day allocation.

## 5. Sign-off

| Role | Status |
|---|---|
| Implementation (dev) | ✓ Truc — all phases complete |
| Code review | Pending |
| Staging deploy | Pending |
| Manager UAT | Pending |
| Production deploy | Blocked on staging soak |

---

**Next:** RPT-20260521 — completion report with what's shipped, what's deferred.
