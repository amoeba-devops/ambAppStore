# PLAN-20260521 — Prime Cost Versioning Implementation

> **Status:** Draft v1
> **Author:** Truc Hoang (with Claude)
> **Date:** 2026-05-21
> **Tracks:** [REQ-20260521-prime-cost-versioning](../analysis/REQ-20260521-prime-cost-versioning.md)
> **Estimated effort:** 2-3 days (1 dev) — backend ~1.5 days, frontend ~1 day

## 1. 시스템 개발 현황 분석

### 1.1 Directory baseline
- **Backend pipeline (current):** `parser → calculator(master) → snapshot`. `master` is a flat `Map<sku, {primeCost, sellingPrice, listingPrice, productNameEn}>` loaded once per ingest.
- **Frontend:** `PrimeCostTable` (list/CRUD) + `PrimeCostFormModal` (single edit), all under `apps/web/src/components/prime-cost/`. Actions in `apps/web/src/server/actions/prime-cost.actions.ts`.
- **DB:** Neon Postgres, Drizzle ORM, manual SQL migrations in `packages/db/migrations/`. Last migration: `0004_user_status_fields.sql`.

### 1.2 Technical constraints carried over
- `'server-only'` in service files — must remain
- Multi-tenancy enforced via `withEnt(...)` helper — every new query MUST use it
- ENUM/varchar widths from MEMORY: MIME col was once 64 chars → silent insert fail → use `varchar(255)` for any new string-ish columns
- Drizzle schema sync: `synchronize` is OFF in staging/prod → migration must be hand-rolled SQL

### 1.3 Existing patterns reused
- **Soft delete:** `pcv_deleted_at TIMESTAMPTZ` (matches `pcs_deleted_at`)
- **Activity log:** `appendActionLog(...)` already wraps server-side action writes
- **Feature flag:** existing `DEMO_AUTO_LOGIN` env pattern → introduce `NEXT_PUBLIC_PRIME_COST_VERSIONING`

## 2. 단계별 구현 계획

### Phase A — Schema + backfill (Day 1 morning)

**A1. Drizzle schema for new table**
- File: `packages/db/src/schema/prime-cost-versions.schema.ts` (new)
- Define `salPrimeCostVersions` table matching REQ §3.2
- Export from `packages/db/src/schema/index.ts`
- └─ 사이드 임팩트: none yet (table not in DB)

**A2. Manual SQL migration**
- File: `packages/db/migrations/0005_prime_cost_versions.sql` (new)
- CREATE TABLE + 2 indexes + backfill INSERT…SELECT (sentinel date `2020-01-01`)
- Update `packages/db/migrations/meta/_journal.json` + new snapshot
- └─ 사이드 임팩트: `sal_prime_costs` row count = `sal_prime_cost_versions` row count post-backfill — must verify before flipping flag

**A3. Verify on dev branch**
- Apply migration to dev Neon branch
- SELECT row count match: `(SELECT COUNT(*) FROM sal_prime_costs WHERE pcs_deleted_at IS NULL) == (SELECT COUNT(*) FROM sal_prime_cost_versions)`
- └─ 사이드 임팩트: none (read-only check)

### Phase B — Backend: parser + loader + calculator (Day 1 afternoon)

**B1. Parser: add `orderDate` to Shopee Sales**
- File: `apps/web/src/server/services/shopee-sales-parser.service.ts`
- `HEADER_MAP.orderDate = 'Ngày đặt hàng'`
- `ShopeeSaleRow` gains `orderDate: string` (ISO `YYYY-MM-DD`)
- Extract cell value via ExcelJS; if Excel-typed Date → `toISOString().slice(0,10)`; if string → `parseShopeeDate()` helper (Shopee format is usually `YYYY-MM-DD HH:mm`)
- └─ 사이드 임팩트: existing files without column → MISSING_COLUMN error → upload fails. Mitigation: feature-flag the parser change too OR make the column optional with `orderDate = ''` fallback. Pick **optional fallback** so existing flows don't break for users mid-rollout.

**B2. Parser: add `orderDate` to TikTok Sales**
- File: `apps/web/src/server/services/tiktok-sales-parser.service.ts`
- `HEADER_MAP.orderDate = 'Created Time'`
- Same pattern as B1
- └─ 사이드 임팩트: same as B1 — optional fallback

**B3. New service: `prime-cost-version.service.ts`**
- File: `apps/web/src/server/services/prime-cost-version.service.ts` (new)
- Functions:
  - `listVersionsForSku(entId, pcsId): Promise<PrimeCostVersionRow[]>` (DESC by effective_from)
  - `addVersion(input): Promise<{pcvId}>` — inserts new row, returns id
  - `softDeleteVersion(entId, pcvId, userId): Promise<void>` — sets `pcv_deleted_at`
- └─ 사이드 임팩트: none — pure CRUD

**B4. Loader: return versions instead of flat cost**
- File: `apps/web/src/server/services/prime-cost-master.service.ts`
- Change `PrimeCostMaster` interface:
  - Remove `primeCost: number`
  - Add `versions: Array<{ effectiveFrom: string; primeCost: number; breakdown: object | null }>` (sorted DESC)
- Change query: LEFT JOIN `sal_prime_cost_versions` filtered by `pcv_deleted_at IS NULL`
- Add helper `findPrimeCost(versions, orderDate): number` exported alongside
- └─ 사이드 임팩트: **all callers break.** Callers: gmv-calculator, tiktok-metrics-calculator, ingest.actions, preview-calc.actions. Must update in same commit. **Feature flag check inside loader:** if `PRIME_COST_VERSIONING !== 'on'`, return a 1-element versions array `[{effectiveFrom: '2020-01-01', primeCost: pcs_prime_cost_vnd}]` for backward compat → calculators always work, just degrade to flat behavior.

**B5. Calculator: per-row date lookup (Shopee)**
- File: `apps/web/src/server/services/gmv-calculator.service.ts`
- Line ~324 — replace `primeCosts.get(row.varSku)?.primeCost ?? 0` with:
  ```ts
  const m = primeCosts.get(row.varSku);
  const primeCost = m ? findPrimeCost(m.versions, row.orderDate) : 0;
  ```
- Same change for `sellingPrice`: still `m?.sellingPrice ?? 0` (not versioned in Phase 1)
- └─ 사이드 임팩트: orderDate empty string from B1 fallback path → `findPrimeCost` returns the OLDEST version (effectiveFrom '2020-01-01' always ≤ '') — wait that's wrong. **Fix:** in `findPrimeCost`, when `orderDate === ''`, return latest version (treat as "today"). Document in comment.

**B6. Calculator: per-row date lookup (TikTok)**
- File: `apps/web/src/server/services/tiktok-metrics-calculator.service.ts`
- Same pattern as B5
- └─ 사이드 임팩트: same as B5

**B7. Verify ingest still works on test data**
- Manual: re-ingest one existing Draft period locally → snapshot should produce identical numbers vs pre-change (because feature flag off → flat fallback)
- └─ 사이드 임팩트: none if numbers match

### Phase C — Backend: server actions + CSV (Day 2 morning)

**C1. New server actions for version CRUD**
- File: `apps/web/src/server/actions/prime-cost.actions.ts` (extend)
- New actions:
  - `addPrimeCostVersionAction({ pcsId, effectiveFrom, primeCostVnd, breakdown?, sourceNote? })`
  - `listPrimeCostVersionsAction({ pcsId })` (called when row expanded in UI)
  - `softDeletePrimeCostVersionAction({ pcvId })`
- Each writes ActionLog entry (`category: MASTER_DATA`)
- Validate: `effectiveFrom` is valid ISO date; `primeCostVnd > 0`; SKU exists & belongs to ent
- └─ 사이드 임팩트: existing `updatePrimeCostAction` — keep for non-cost metadata edits (name, sku, listing price). Document split in JSDoc.

**C2. CSV import: handle Effective From column**
- File: `apps/web/src/server/actions/prime-cost.actions.ts` (importPrimeCostsAction line ~347)
- CSV_HEADER constant adds `Effective From`
- For each row:
  - Upsert master row (sku metadata) — same as before
  - INSERT version (effective_from = parsed date OR today)
- Reject rows where effective_from is in future > +30 days (safety)
- Output summary now reports `versionsAdded` count (separate from `skusInserted`/`skusUpdated`)
- └─ 사이드 임팩트: old CSV (no Effective From col) — auto-default to today. Backward compat preserved.

**C3. CSV export: 1 row per version (toggle "latest-only")**
- File: same action file, `exportPrimeCostsAction`
- Param `mode: 'latest' | 'all-versions'` (default `'latest'` for backward compat)
- `'all-versions'`: JOIN versions, emit 1 row per version with all SKU metadata duplicated
- └─ 사이드 임팩트: default behavior unchanged — existing automated CSV pulls still work.

### Phase D — Frontend (Day 2 afternoon + Day 3 morning)

**D1. UI: expandable rows in PrimeCostTable**
- File: `apps/web/src/components/prime-cost/PrimeCostTable.tsx`
- Add chevron column; click → fetch versions via `listPrimeCostVersionsAction` + render inline `<VersionHistoryRow>`
- Caching: load on expand only, refresh after add/delete
- └─ 사이드 임팩트: row height changes when expanded → may affect existing table CSS. Test scroll + pagination.

**D2. New component: VersionHistoryRow**
- File: `apps/web/src/components/prime-cost/VersionHistoryRow.tsx` (new)
- Sub-table with cols: Effective From | Prime Cost (VND) | KRW | Breakdown (expandable) | Source Note | Created By | Created At | Delete
- "Add new version" button at top
- └─ 사이드 임팩트: none — purely additive

**D3. Modal split: AddVersionModal vs EditMetadataModal**
- File: `apps/web/src/components/prime-cost/PrimeCostFormModal.tsx`
- Add new prop `mode: 'create-sku' | 'add-version' | 'edit-metadata'`
- `add-version` mode: only effective_from + primeCost + breakdown + sourceNote fields
- `create-sku` mode: existing fields (name/sku/listing/selling) + effective_from + primeCost (creates master + initial version atomically)
- `edit-metadata` mode: existing fields MINUS primeCost (since versioned)
- └─ 사이드 임팩트: modal logic branches. Risk medium — test each mode.

**D4. Wire actions: PrimeCostTable buttons**
- "Add Row" → `mode='create-sku'`
- "Edit" (on row) → `mode='edit-metadata'`
- "Add new version" (inside expanded version history) → `mode='add-version'` with pcsId pre-filled
- └─ 사이드 임팩트: existing "Edit" UX changes — Operator no longer sees Prime Cost field there. Add helper text: "To change Prime Cost, expand the row and click 'Add new version'."

**D5. i18n keys**
- File: `apps/web/messages/{en,ko}.json`
- New namespace `primeCost.version.*`: `add`, `effectiveFrom`, `effectiveFromDesc`, `sourceNote`, `breakdown.cogs`, `breakdown.logistic`, `breakdown.warehouse`, `breakdown.fulfillment`, `history.title`, `history.empty`, `delete.confirm`, `delete.lastWarning`, `flag.disabledNotice`
- └─ 사이드 임팩트: none — additive translations

### Phase E — Feature flag flip + staging verify (Day 3 afternoon)

**E1. Add feature flag check**
- File: `apps/web/src/lib/feature-flags.ts` (new — tiny helper)
- Export `isPrimeCostVersioningEnabled()` reading `process.env.NEXT_PUBLIC_PRIME_COST_VERSIONING === 'on'`
- Used in loader (B4) + UI (hide "Add new version" UI when off, show legacy edit)
- └─ 사이드 임팩트: flag off → app behaves identically to pre-change

**E2. Staging rollout**
- Deploy with flag OFF
- Run migration A2
- Verify backfill row counts (A3)
- Flip flag ON for staging env only
- Smoke test: re-ingest a Draft period → numbers stable
- Add a test version with future effective_from → re-ingest same period → numbers unchanged (because effective_from > orderDates)
- Add version with past effective_from → re-ingest Draft → numbers update where applicable
- └─ 사이드 임팩트: production unchanged until step E3

**E3. Production rollout**
- After 1 week of staging soak → run migration → flip flag ON
- Communicate to Operators: training note on new "Add new version" workflow
- └─ 사이드 임팩트: see §4

## 3. 변경 파일 목록

| Layer | File | Type | Phase |
|-------|------|------|-------|
| DB schema | `packages/db/src/schema/prime-cost-versions.schema.ts` | NEW | A1 |
| DB schema | `packages/db/src/schema/index.ts` | MODIFY (add export) | A1 |
| DB migration | `packages/db/migrations/0005_prime_cost_versions.sql` | NEW | A2 |
| DB migration | `packages/db/migrations/meta/0005_snapshot.json` | NEW (Drizzle artefact) | A1 |
| DB migration | `packages/db/migrations/meta/_journal.json` | MODIFY | A1 |
| Backend service | `apps/web/src/server/services/prime-cost-master.service.ts` | MODIFY | B4 |
| Backend service | `apps/web/src/server/services/prime-cost-version.service.ts` | NEW | B3 |
| Backend service | `apps/web/src/server/services/shopee-sales-parser.service.ts` | MODIFY (+orderDate) | B1 |
| Backend service | `apps/web/src/server/services/tiktok-sales-parser.service.ts` | MODIFY (+orderDate) | B2 |
| Backend service | `apps/web/src/server/services/gmv-calculator.service.ts` | MODIFY (date-aware lookup) | B5 |
| Backend service | `apps/web/src/server/services/tiktok-metrics-calculator.service.ts` | MODIFY (date-aware lookup) | B6 |
| Backend action | `apps/web/src/server/actions/prime-cost.actions.ts` | MODIFY (+ version CRUD + CSV cols) | C1, C2, C3 |
| Frontend | `apps/web/src/components/prime-cost/PrimeCostTable.tsx` | MODIFY (+expand row) | D1 |
| Frontend | `apps/web/src/components/prime-cost/VersionHistoryRow.tsx` | NEW | D2 |
| Frontend | `apps/web/src/components/prime-cost/PrimeCostFormModal.tsx` | MODIFY (mode prop) | D3 |
| Frontend | `apps/web/src/lib/feature-flags.ts` | NEW | E1 |
| i18n | `apps/web/messages/en.json` | MODIFY | D5 |
| i18n | `apps/web/messages/ko.json` | MODIFY | D5 |
| Env | `apps/web/.env.example` | MODIFY (add `NEXT_PUBLIC_PRIME_COST_VERSIONING=off`) | E1 |

**Total:** 14 modify / 6 new = 20 files

## 4. 사이드 임팩트 분석

| Scope | Risk | Description |
|-------|------|-------------|
| Existing ingest pipeline | **Medium** | Calculator signature unchanged but inner lookup now date-aware. Feature flag off → flat fallback identical to current → mitigates. Must regress-test by re-ingesting a real Draft period and diffing snapshots. |
| Old uploaded Shopee Sales files | **Low** | Parser change adds `orderDate` as optional fallback. Old files without "Ngày đặt hàng" still parse — fall back to empty string → calculator uses latest version (today's effective). Acceptable for legacy ingests during rollout. |
| Old uploaded TikTok Sales files | **Low** | Same as Shopee. |
| Master CSV import workflow | **Low** | New column optional; missing → today. Existing CSV files keep working unchanged. |
| Master CSV export | **Low** | Default mode `latest` keeps old shape. New `all-versions` mode opt-in. |
| Master CRUD UI for Admins | **Medium** | "Edit Prime Cost" button → no longer edits cost (becomes "Edit metadata"). Training note needed; in-app help tooltip mitigates. |
| Finalized period snapshots | **None** | NFR-08 already enforced by snapshot pattern. Adding versions cannot mutate `psp_metrics`. |
| Draft period snapshots | **By design** | Re-ingest pulls fresh versions → numbers may change. Documented behavior — Operator should not re-ingest unless intending to recompute. |
| `sal_prime_costs.pcs_prime_cost_vnd` column | **Low** | KEEP for now as denormalized "latest" cache. Phase 2 may drop it. Avoid `UPDATE pcs_prime_cost_vnd` on version add to keep cache truthful → trigger or app-side sync. **Decision:** sync app-side in `addVersion` action — `UPDATE sal_prime_costs SET pcs_prime_cost_vnd = newCost, pcs_updated_at = NOW() WHERE pcs_id = ... AND no future-effective version exists`. |
| Audit trail | **None** | New action types logged; existing log entries untouched. |
| Multi-tenancy | **None** | All new queries use `withEnt()`. Unique constraint scoped by `ent_id`. |
| Performance | **Negligible** | Per-row lookup O(V) where V ≤ ~10 versions/SKU in foreseeable future. Loader does 1 extra SELECT (or LEFT JOIN) per ingest — adds <100ms on a 100-SKU master. |
| Rollback | **Medium** | Schema rollback = DROP TABLE — safe if `sal_prime_costs.pcs_prime_cost_vnd` is still in sync. Code rollback = redeploy previous build with flag OFF. Need 1 deployment that supports BOTH paths simultaneously (the feature-flag implementation) before flipping. |

## 5. DB 마이그레이션

### 5.1 Migration file (0005_prime_cost_versions.sql)

```sql
-- 0005_prime_cost_versions.sql
-- Adds versioned prime cost support. Backfills 1 sentinel version per existing SKU.

BEGIN;

CREATE TABLE sal_prime_cost_versions (
  pcv_id              CHAR(36) PRIMARY KEY,
  ent_id              CHAR(36) NOT NULL,
  pcs_id              CHAR(36) NOT NULL REFERENCES sal_prime_costs(pcs_id) ON DELETE CASCADE,
  pcv_effective_from  DATE NOT NULL,
  pcv_prime_cost_vnd  NUMERIC(18,2) NOT NULL CHECK (pcv_prime_cost_vnd >= 0),
  pcv_breakdown       JSONB,
  pcv_source_note     VARCHAR(255),
  pcv_created_by      CHAR(36) NOT NULL,
  pcv_created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pcv_updated_at      TIMESTAMPTZ,
  pcv_deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX uniq_sal_pcv_ent_sku_date
  ON sal_prime_cost_versions(ent_id, pcs_id, pcv_effective_from)
  WHERE pcv_deleted_at IS NULL;

CREATE INDEX idx_sal_pcv_ent_sku_date
  ON sal_prime_cost_versions(ent_id, pcs_id, pcv_effective_from DESC);

CREATE INDEX idx_sal_pcv_ent_eff
  ON sal_prime_cost_versions(ent_id, pcv_effective_from DESC);

-- Backfill
INSERT INTO sal_prime_cost_versions
  (pcv_id, ent_id, pcs_id, pcv_effective_from, pcv_prime_cost_vnd,
   pcv_source_note, pcv_created_by, pcv_created_at)
SELECT
  gen_random_uuid()::text,
  ent_id, pcs_id,
  DATE '2020-01-01',
  pcs_prime_cost_vnd,
  'Backfilled from sal_prime_costs migration 0005',
  pcs_created_by,
  pcs_created_at
FROM sal_prime_costs
WHERE pcs_deleted_at IS NULL;

-- Verification (run separately, not in tx):
-- SELECT (SELECT COUNT(*) FROM sal_prime_costs WHERE pcs_deleted_at IS NULL) AS master_active,
--        (SELECT COUNT(*) FROM sal_prime_cost_versions) AS versions_total;

COMMIT;
```

### 5.2 Rollout sequence

| Env | Step | Owner |
|-----|------|-------|
| Local dev | Apply migration via `drizzle-kit migrate` → dev Neon branch | Truc |
| Local dev | Code change → `git push branch/prime-cost-versioning` | Truc |
| Staging | Merge → auto deploy with flag OFF | Truc |
| Staging | SSH → run migration manually: `psql $DATABASE_URL -f 0005_prime_cost_versions.sql` | Truc |
| Staging | Verify backfill counts | Truc |
| Staging | Flip flag: `NEXT_PUBLIC_PRIME_COST_VERSIONING=on` → re-deploy | Truc |
| Staging | Smoke test (see PLAN E2) | Truc + Manager |
| Production | Merge `main` → `production` PR | Truc |
| Production | Run migration | Truc |
| Production | Flip flag ON | Truc |

### 5.3 Rollback

If any phase fails:
1. **Flag flip ON breaks:** set `NEXT_PUBLIC_PRIME_COST_VERSIONING=off` → re-deploy. App reverts to flat behavior. `sal_prime_cost_versions` table stays — harmless.
2. **Migration corrupted:** `DROP TABLE sal_prime_cost_versions CASCADE` (only safe if flag is OFF first — loader stops querying it). Master table untouched.

---

**Next step:** TC-20260521-prime-cost-versioning.md — concrete test cases covering schema, calculator, parser, UI, migration.
