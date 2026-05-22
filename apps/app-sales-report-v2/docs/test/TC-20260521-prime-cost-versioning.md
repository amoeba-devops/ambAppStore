# TC-20260521 — Prime Cost Versioning Test Cases

> **Status:** Draft v1
> **Tracks:** [REQ-20260521](../analysis/REQ-20260521-prime-cost-versioning.md) · [PLAN-20260521](../plan/PLAN-20260521-prime-cost-versioning.md)
> **Date:** 2026-05-21
> **Execution mode:** Manual smoke + automated unit tests (vitest) where feasible

## Notation
- **Pre:** preconditions
- **Steps:** ordered actions
- **Expected:** observable result
- **Pri:** P0 (blocker) / P1 (must) / P2 (should)
- **Type:** UNIT / INTEGRATION / E2E / MIGRATION

---

## TC-1 · Migration & backfill

### TC-1.1 — Backfill row count matches active master rows  · P0 · MIGRATION
**Pre:** `sal_prime_costs` has N active rows (`pcs_deleted_at IS NULL`).
**Steps:**
1. Apply migration `0005_prime_cost_versions.sql` on dev branch.
2. `SELECT COUNT(*) FROM sal_prime_cost_versions` → return M.
3. `SELECT COUNT(*) FROM sal_prime_costs WHERE pcs_deleted_at IS NULL` → return N.

**Expected:** `M == N`. Every active master row produced exactly 1 version row with `effective_from = '2020-01-01'`.

### TC-1.2 — Soft-deleted master rows NOT backfilled · P1 · MIGRATION
**Pre:** ≥1 `sal_prime_costs` row with `pcs_deleted_at IS NOT NULL`.
**Steps:**
1. Apply migration.
2. `SELECT pcs_id FROM sal_prime_costs WHERE pcs_deleted_at IS NOT NULL` → set S.
3. `SELECT pcs_id FROM sal_prime_cost_versions WHERE pcs_id = ANY(S)` → must be empty.

**Expected:** No version rows for soft-deleted SKUs.

### TC-1.3 — Backfill prime_cost values match · P0 · MIGRATION
**Steps:**
1. Pick 3 random active SKUs.
2. Compare `sal_prime_costs.pcs_prime_cost_vnd` vs `sal_prime_cost_versions.pcv_prime_cost_vnd` for the backfilled version.

**Expected:** Values identical for all 3.

### TC-1.4 — Rollback safe · P1 · MIGRATION
**Steps:**
1. Apply migration.
2. `DROP TABLE sal_prime_cost_versions CASCADE`.
3. Inspect `sal_prime_costs` — schema + data intact?

**Expected:** Master table untouched. App with flag OFF still works.

---

## TC-2 · Calculator: per-row date lookup

### TC-2.1 — `findPrimeCost`: returns matching version when in range · P0 · UNIT
**Input:** versions = `[{effFrom:'2026-04-01',cost:300},{effFrom:'2026-03-15',cost:285},{effFrom:'2020-01-01',cost:280}]` (DESC); orderDate = `'2026-04-15'`.
**Expected:** Returns `300`.

### TC-2.2 — `findPrimeCost`: returns oldest version when orderDate < all newer · P0 · UNIT
**Input:** same versions; orderDate = `'2024-12-01'`.
**Expected:** Returns `280` (the 2020-01-01 sentinel).

### TC-2.3 — `findPrimeCost`: empty orderDate → latest version · P1 · UNIT
**Input:** versions = same; orderDate = `''`.
**Expected:** Returns `300` (latest). Comment in code documents this fallback path for legacy uploads without "Ngày đặt hàng".

### TC-2.4 — `findPrimeCost`: no versions → 0 · P1 · UNIT
**Input:** versions = `[]`; orderDate = any.
**Expected:** Returns `0`. Caller's row contributes 0 prime cost (no master).

### TC-2.5 — Shopee calculator: mixed-date period applies correct cost per row · P0 · INTEGRATION
**Pre:** SKU `TEST-A` has 2 versions: `2026-04-01 → 100,000`, `2026-04-20 → 120,000`.
**Steps:** Build synthetic ShopeeSaleRow list:
- 1 row, sku=TEST-A, qty=2, orderDate=`'2026-04-10'`
- 1 row, sku=TEST-A, qty=3, orderDate=`'2026-04-25'`
Call `computeShopeeMetrics(rows, master)`.
**Expected:** `totalPrimeCost = 2*100000 + 3*120000 = 560,000`.

### TC-2.6 — TikTok calculator: same as TC-2.5 · P0 · INTEGRATION
Same setup adapted to TikTokSaleRow. Expected: `560,000`.

### TC-2.7 — Feature flag OFF → flat fallback identical · P0 · INTEGRATION
**Pre:** flag `NEXT_PUBLIC_PRIME_COST_VERSIONING=off`. SKU has 3 versions; current `pcs_prime_cost_vnd = 100`.
**Steps:** Run calculator on any rows.
**Expected:** All rows use cost `100` regardless of orderDate. (Loader returns synthetic 1-version array.)

---

## TC-3 · Parser: orderDate extraction

### TC-3.1 — Shopee Sales: "Ngày đặt hàng" extracted as YYYY-MM-DD · P0 · UNIT
**Input:** Synthetic xlsx with header `Ngày đặt hàng` and a cell `2026-04-24 10:23:45`.
**Expected:** `ShopeeSaleRow.orderDate === '2026-04-24'`.

### TC-3.2 — Shopee Sales: missing column → orderDate = '' · P1 · UNIT
**Input:** Old-format xlsx without "Ngày đặt hàng".
**Expected:** Parse succeeds; every row has `orderDate === ''`. (Document log warning.)

### TC-3.3 — TikTok Sales: "Created Time" extracted · P0 · UNIT
**Input:** xlsx row 3 cell value `2026-04-25 14:00:01`.
**Expected:** `TikTokSaleRow.orderDate === '2026-04-25'`.

### TC-3.4 — TikTok Sales: missing column → '' fallback · P1 · UNIT
Same as TC-3.2 for TikTok.

### TC-3.5 — Excel-typed Date cell handled · P1 · UNIT
**Input:** Cell where ExcelJS returns a JS `Date` object (not a string).
**Expected:** Parser converts via `.toISOString().slice(0,10)`. Round-trips to correct local YYYY-MM-DD.

---

## TC-4 · Version CRUD actions

### TC-4.1 — Add new version → row inserted + ActivityLog entry · P0 · INTEGRATION
**Steps:**
1. Call `addPrimeCostVersionAction({pcsId, effectiveFrom:'2026-05-20', primeCostVnd:295000, sourceNote:'Batch X'})`
2. Query `sal_prime_cost_versions WHERE pcs_id = ...`
3. Query `sal_action_logs WHERE act_verb = 'ADD_VERSION'`

**Expected:** New row exists with given values. ActionLog entry with `targetLabel = SKU code`, `summary` includes Δ from previous version.

### TC-4.2 — Add duplicate effective_from for same SKU → 409 · P0 · INTEGRATION
**Pre:** SKU X has version eff_from = `2026-05-20`.
**Steps:** Add another with same eff_from.
**Expected:** Error code `SAL-E0409` (conflict). Unique constraint enforced.

### TC-4.3 — Add version with effective_from > today + 30 days → reject · P1 · INTEGRATION
**Expected:** Error `SAL-E0400` "effective_from too far in future".

### TC-4.4 — Add version with non-existent pcsId → 404 · P1 · INTEGRATION
**Expected:** Error `SAL-E0404` "SKU not found".

### TC-4.5 — Soft-delete version → not returned by loader · P0 · INTEGRATION
**Steps:**
1. Add version V2 (eff_from `2026-05-01`).
2. `softDeletePrimeCostVersionAction(V2)`.
3. Call `loadPrimeCostMaster(entId)`.
**Expected:** versions array for this SKU does NOT include V2.

### TC-4.6 — Soft-delete the last active version → reject · P1 · INTEGRATION
**Pre:** SKU has only 1 active version.
**Expected:** Error `SAL-E0409` "Cannot delete the only active version of a SKU".

### TC-4.7 — Master cache sync: latest version mutated when added · P1 · INTEGRATION
**Steps:** Add a new version with eff_from later than current latest.
**Expected:** `sal_prime_costs.pcs_prime_cost_vnd` is updated to new value. `pcs_updated_at` advances.

### TC-4.8 — Master cache NOT mutated when retro version added · P2 · INTEGRATION
**Pre:** SKU has versions [`2020-01-01`, `2026-05-01`]; latest cost = 300.
**Steps:** Add version with eff_from = `2025-06-01`, cost = 200 (retro between sentinel and current latest).
**Expected:** `sal_prime_costs.pcs_prime_cost_vnd` stays 300 (not mutated). Latest-effective-on-today logic preserved.

---

## TC-5 · CSV import / export

### TC-5.1 — CSV with Effective From column → adds version per row · P0 · INTEGRATION
**Input file:**
```
SKU,Product (VI),Prime Cost (VND),Effective From
A,X,100000,2026-05-01
A,X,120000,2026-05-15
B,Y,80000,2026-05-10
```
**Expected summary:** `{ skusInserted: 2, skusUpdated: 0, versionsAdded: 3, errors: 0 }`. Verify rows.

### TC-5.2 — CSV without Effective From → defaults to today · P0 · INTEGRATION
**Input file:** old-format (no date col).
**Expected:** Each row → version with eff_from = today's date. summary reports `versionsAdded`.

### TC-5.3 — CSV with future Effective From > +30 days → row error · P1 · INTEGRATION
**Input:** `effectiveFrom = '2027-12-01'`.
**Expected:** Row skipped, `errors: [{row: N, msg: "Effective From > +30 days"}]`.

### TC-5.4 — Export `mode=latest` (default) → 1 row per SKU · P0 · INTEGRATION
**Expected:** Header unchanged from current. Each SKU appears once, with its latest cost.

### TC-5.5 — Export `mode=all-versions` → 1 row per version · P1 · INTEGRATION
**Expected:** New `Effective From` column populated; SKU metadata duplicated across rows.

---

## TC-6 · UI flows

### TC-6.1 — Expand row shows version history · P0 · E2E
**Steps:**
1. Open Settings → Prime Cost Master.
2. Click chevron on SKU A row.
3. Inline panel renders.
**Expected:** Sub-table with N versions sorted DESC by eff_from. Each row shows date, cost (VND + KRW), breakdown, source note, created_by, created_at, Delete button.

### TC-6.2 — Add new version modal · P0 · E2E
**Steps:**
1. Expand row.
2. Click "Add new version".
3. Modal opens with `Effective From` pre-set to today, empty primeCost.
4. Fill date `2026-05-25`, cost `300000`, source note `Batch BL-...`. Save.
**Expected:** Modal closes; sub-table refreshes with new version at top; toast confirmation; ActivityLog shows entry.

### TC-6.3 — Edit metadata modal does NOT show primeCost field · P1 · E2E
**Steps:** Click "Edit" on row.
**Expected:** Modal opens with name/sku/listing fields; NO primeCost input. Helper text: "To change prime cost, use the version history."

### TC-6.4 — Delete version → soft-delete, refresh history · P0 · E2E
**Steps:** In sub-table, click Delete on a non-last version.
**Expected:** Confirm dialog; on confirm, version disappears from sub-table; main row's "Latest cost" possibly updates if deleted version WAS latest.

### TC-6.5 — Cannot delete last active version (UI) · P1 · E2E
**Pre:** SKU has only 1 active version.
**Expected:** Delete button is disabled / hidden; hover tooltip: "Cannot delete the only version. Add a replacement first."

### TC-6.6 — Feature flag OFF → version UI hidden · P1 · E2E
**Pre:** `NEXT_PUBLIC_PRIME_COST_VERSIONING=off`.
**Expected:** No chevron column. "Edit" modal shows the OLD form (with primeCost editable in-place). App behaves identically to pre-Phase-1.

### TC-6.7 — i18n: KO + EN labels for all new strings · P2 · E2E
**Steps:** Switch language between EN ↔ KO. All version-related UI text translates correctly.

---

## TC-7 · End-to-end ingest scenarios

### TC-7.1 — Re-ingest Draft period: new costs applied per orderDate · P0 · E2E
**Pre:** Period W21 (15-21 May 2026) in Draft status. SKU `SAFG47U` has versions [`2020-01-01 → 280k`, `2026-05-18 → 295k`].
**Steps:**
1. Re-upload W21 Shopee Sales file (orders dated 15-21 May).
2. Compute snapshot.
**Expected:**
- Orders dated 15-17 May → 280k/unit
- Orders dated 18-21 May → 295k/unit
- `totalPrimeCost` reflects mix.

### TC-7.2 — Finalized period: re-ingest blocked OR snapshot unchanged · P0 · E2E
**Pre:** Period W20 (8-14 May 2026) is Finalized. Original snapshot computed with version 280k.
**Steps:**
1. Operator (in dev/test) attempts to re-ingest W20.
**Expected:** Either ingest rejected (Status Finalized) OR if allowed by Admin override, snapshot for W20 NOT replaced. NFR-08 preserved.

### TC-7.3 — Adding retro version after Finalize → does NOT mutate Finalized snapshot · P0 · E2E
**Pre:** W20 Finalized at 8-14 May with cost 280k.
**Steps:** Operator adds new version with eff_from `2026-05-09` cost 290k.
**Expected:** W20 snapshot in `sal_period_snapshots` unchanged (cost still 280k). Verify by querying `psp_metrics->'shopee'->'totalPrimeCost'`.

### TC-7.4 — Legacy file (no "Ngày đặt hàng") re-ingested while flag ON · P1 · E2E
**Pre:** Old archive file from before Phase 1 (no orderDate column). Flag ON.
**Steps:** Re-trigger ingest.
**Expected:** Parser fills `orderDate = ''` → calculator picks latest version for all rows. Snapshot computes successfully. Warning logged.

---

## TC-8 · Performance & data integrity

### TC-8.1 — Loader perf: 100 SKUs × 5 versions each · P2 · INTEGRATION
**Steps:** Seed 100 SKUs each with 5 versions. Call `loadPrimeCostMaster`. Measure latency.
**Expected:** < 200ms (HTTP driver to Neon includes round-trip).

### TC-8.2 — Calculator perf: 10k rows with date lookup · P2 · INTEGRATION
**Steps:** Synth 10,000 Shopee rows with random orderDates. Call `computeShopeeMetrics`.
**Expected:** < 500ms total. (Per-row lookup adds < 1ms each.)

### TC-8.3 — Concurrent version inserts for same SKU → unique constraint protects · P1 · INTEGRATION
**Steps:** Fire 2 parallel `addPrimeCostVersionAction` with same eff_from for the same SKU.
**Expected:** One succeeds, one returns conflict. No duplicate rows.

---

## TC-9 · Activity log coverage

### TC-9.1 — Add version → log entry present · P1 · INTEGRATION
**Expected:** `sal_action_logs` row with `category='MASTER_DATA'`, `verb='ADD_VERSION'`, `target_type='prime-cost-version'`, summary includes SKU + Δ%.

### TC-9.2 — Soft-delete version → log entry · P1 · INTEGRATION
Similar to TC-9.1 with `verb='DELETE_VERSION'`.

### TC-9.3 — CSV bulk import → 1 log entry summarizing batch · P2 · INTEGRATION
**Expected:** Single entry with `verb='BULK_IMPORT'`, summary includes counts.

---

## Test execution plan

| Phase (from PLAN) | Run these TCs |
|--------|---------------|
| A — Schema/backfill | TC-1.* |
| B — Backend parser/calc | TC-2.*, TC-3.* |
| C — Server actions/CSV | TC-4.*, TC-5.*, TC-9.* |
| D — Frontend | TC-6.* |
| E — Staging soak | TC-7.*, TC-8.* |

**Definition of done for Phase 1 cutover:** All P0 + P1 cases pass on staging. P2 may be deferred to Phase 1.1 or backlog.

---

**Next:** implement per PLAN, then write TR-20260521 + RPT-20260521 capturing actual test results.
