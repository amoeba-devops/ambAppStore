# REQ-20260521 — Prime Cost Versioning

> **Status:** Draft v1
> **Author:** Truc Hoang (with Claude)
> **Date:** 2026-05-21
> **Phase:** Phase 1 of inventory-cost evolution (Phase 2 = FIFO batch tracking, deferred)

## 1. 요구사항 요약

| # | Requirement | Type |
|---|-------------|------|
| R1 | Each SKU's prime cost can have multiple versions, each effective from a specific date | Functional |
| R2 | Sales calculator looks up the correct version based on each order's order-date | Functional |
| R3 | Edit master prime cost = adding a new version (no in-place update of historical cost) | Functional |
| R4 | CSV import accepts an `Effective From` column; missing → defaults to today | Functional |
| R5 | UI shows version history per SKU and lets Admin add / soft-delete a version | Functional |
| R6 | Re-ingest of a **Draft** period uses the new version set; **Finalized/Locked** periods stay frozen (NFR-08) | Functional |
| R7 | Returns of a unit sold in period P keep using the version active at the order's createDate (no special handling) | Functional |
| R8 | Backwards-compatible: existing periods continue to compute correctly until next ingest | Non-functional |
| R9 | Migration: every existing `sal_prime_costs` row maps to one `sal_prime_cost_versions` row with `effective_from = 2020-01-01` (sentinel) | Migration |

## 2. AS-IS 현황 분석

### 2.1 Schema (current)
[packages/db/src/schema/prime-costs.schema.ts](../../packages/db/src/schema/prime-costs.schema.ts) + [packages/db/migrations/0001_prime_costs.sql](../../packages/db/migrations/0001_prime_costs.sql)

```
sal_prime_costs            -- 1 row per (ent, sku_code) — flat, no versioning
  pcs_id char(36) PK
  ent_id char(36) NOT NULL
  pcs_sku_code varchar(128) NOT NULL          ← lookup key
  pcs_prime_cost_vnd numeric(18,2) NOT NULL   ← single, ever-changing
  pcs_selling_price_vnd numeric(18,2)
  pcs_listing_price_vnd numeric(18,2)
  pcs_product_name_vi varchar(512) NOT NULL
  pcs_product_name_en varchar(512)
  pcs_product_id varchar(64)
  pcs_variation_id varchar(64)
  pcs_created_by, pcs_created_at, pcs_updated_at, pcs_deleted_at
  UNIQUE (ent_id, pcs_sku_code) WHERE pcs_deleted_at IS NULL
```

**Problem:** when Operator updates `pcs_prime_cost_vnd` (e.g. new shipment with different COGS), the old value is overwritten. Future re-ingests of past Draft periods would apply the new cost retro — wrong for accounting.

### 2.2 Loader & calculator usage

[prime-cost-master.service.ts:11](../../apps/web/src/server/services/prime-cost-master.service.ts#L11):
```
loadPrimeCostMaster(entId) → Map<skuCode, {
  primeCost, sellingPrice, listingPrice, productNameEn
}>
```

Lookup keys per platform (immutable per ingest):
- Shopee: [gmv-calculator.service.ts:324](../../apps/web/src/server/services/gmv-calculator.service.ts#L324) — `primeCosts.get(row.varSku)`
- TikTok: [tiktok-metrics-calculator.service.ts:226](../../apps/web/src/server/services/tiktok-metrics-calculator.service.ts#L226) — `primeCosts.get(row.sellerSku)`

Both calculators receive `master` once per ingest from [ingest.actions.ts:131](../../apps/web/src/server/actions/ingest.actions.ts#L131).

### 2.3 Parsers — MISSING order-date columns
- [shopee-sales-parser.service.ts](../../apps/web/src/server/services/shopee-sales-parser.service.ts) HEADER_MAP does **NOT** extract `"Ngày đặt hàng"`. `ShopeeSaleRow` has no `orderDate` field.
- [tiktok-sales-parser.service.ts](../../apps/web/src/server/services/tiktok-sales-parser.service.ts) HEADER_MAP does **NOT** extract `"Created Time"`. `TikTokSaleRow` has no `orderDate` field.

→ **Blocker:** version lookup requires order-date per row. Parsers + row types must be extended.

### 2.4 UI
[apps/web/src/components/prime-cost/](../../apps/web/src/components/prime-cost/):
- `PrimeCostTable.tsx` — list/search/filter, Add/Edit/Delete row, CSV import/export
- `PrimeCostFormModal.tsx` — Add/Edit modal, fields: productId, variationId, names (vi/en), sku, primeCost, sellingPrice, listingPrice. **In-place update on save.**
- CSV import header: `Product ID | Variation ID | Product (VI) | Product (EN) | SKU | Prime Cost (VND) | Selling Price (VND) | Listing Price (VND)` — no date column

### 2.5 Snapshot interaction (NFR-08)
[savePeriodSnapshot](../../apps/web/src/server/services/period-snapshot.service.ts#L96) stores computed metrics verbatim in `sal_period_snapshots.psp_metrics` JSONB. Once stored, the metrics blob is the source of truth for display — recomputation only happens on re-ingest. **NFR-08:** Finalized snapshots must not retro-change when downstream master data evolves. Already enforced by the snapshot pattern, but versioned prime cost would otherwise leak into Finalized period recompute if user clicks "Re-ingest" — must explicitly block.

## 3. TO-BE 요구사항

### 3.1 AS-IS → TO-BE mapping

| Area | AS-IS | TO-BE |
|------|-------|-------|
| DB schema | 1 cost per SKU | 1+ versions per SKU, each with `effective_from` |
| Calculator lookup | `map.get(sku)` returns flat record | `versionMap.get(sku)` returns sorted array; pick by `effective_from <= orderDate` |
| Parser row type | No `orderDate` field | Add `orderDate: string` (ISO date, local interpretation) to ShopeeSaleRow + TikTokSaleRow |
| Master loader | Returns `Map<sku, PrimeCostMaster>` | Returns `Map<sku, PrimeCostVersion[]>` (sorted DESC by effective_from) + helper `findVersion(versions, orderDate)` |
| Master table | Edit → UPDATE pcs_prime_cost_vnd | Edit → INSERT new sal_prime_cost_versions row |
| UI list | 1 row per SKU showing current cost | 1 row per SKU showing latest version's cost; expandable → version history |
| CSV import | No date column | New `Effective From` column (YYYY-MM-DD); empty → defaults to today |
| Re-ingest Draft | New cost retro-applies (wrong) | New cost applies if order createDate ≥ effective_from of new version |
| Re-ingest Finalized/Locked | Blocked by status anyway | Confirmed — `ingest.actions.ts` rejects already; no new logic needed |

### 3.2 New DB entity

```
sal_prime_cost_versions
  pcv_id char(36) PK
  ent_id char(36) NOT NULL
  pcs_id char(36) NOT NULL                    -- FK → sal_prime_costs (SKU metadata)
  pcv_effective_from date NOT NULL            -- inclusive
  pcv_prime_cost_vnd numeric(18,2) NOT NULL
  pcv_breakdown jsonb                         -- { cogs, logistic, warehousePerDay, fulfillment, notes }
                                              -- Phase 1: optional, stored verbatim, no compute logic
  pcv_source_note varchar(255)                -- e.g. "Batch BL-2026-04-22", "Initial import"
  pcv_created_by char(36) NOT NULL
  pcv_created_at timestamptz NOT NULL DEFAULT NOW()
  pcv_updated_at timestamptz
  pcv_deleted_at timestamptz                  -- soft delete
  UNIQUE (ent_id, pcs_id, pcv_effective_from) WHERE pcv_deleted_at IS NULL
  INDEX idx_sal_pcv_ent_sku_date (ent_id, pcs_id, pcv_effective_from DESC)
```

### 3.3 Mutated existing entity

```
sal_prime_costs (KEEP — now holds SKU metadata only)
  pcs_prime_cost_vnd       -- KEEP, derived from latest version (computed on read, denormalized cache)
  pcs_selling_price_vnd    -- KEEP unchanged (Phase 1: per-SKU, not versioned)
  pcs_listing_price_vnd    -- KEEP unchanged
```

**Rationale:** Phase 1 only versions `prime_cost_vnd` (the part business says changes per batch). `sellingPrice` / `listingPrice` are platform-set and rarely change — keep flat. Future phase can version them too.

### 3.4 Business logic — calculator change

```ts
// New loader signature
loadPrimeCostMaster(entId) → Map<skuCode, {
  sellingPrice, listingPrice, productNameEn,
  versions: Array<{
    effectiveFrom: string,      // 'YYYY-MM-DD'
    primeCost: number,
    breakdown?: object | null
  }>  // sorted DESC by effectiveFrom
}>

// Per-row lookup helper
function findPrimeCost(versions, orderDate): number {
  // versions DESC; first version where effectiveFrom <= orderDate
  for (const v of versions) {
    if (v.effectiveFrom <= orderDate) return v.primeCost
  }
  return 0  // fallback if order predates all versions
}
```

Calculators replace `primeCosts.get(sku).primeCost` with `findPrimeCost(master.get(sku).versions, row.orderDate)`.

### 3.5 Parser additions

| Parser | New column | Field | Format |
|--------|-----------|-------|--------|
| Shopee Sales | `Ngày đặt hàng` | `orderDate: string` | parse Excel date → ISO `YYYY-MM-DD` (local TZ) |
| TikTok Sales | `Created Time` | `orderDate: string` | parse Excel date / "2026-04-24 10:23:45" → ISO `YYYY-MM-DD` |

Both go into the existing `ShopeeSaleRow` / `TikTokSaleRow`.

### 3.6 UI design

**Master list (PrimeCostTable):**
- New column "Effective From (Latest)" — date of the most recent version
- Row click / chevron → expand inline → shows version history (date, cost, source note, created_by)
- "Edit" button → opens **Add Version** modal (renamed from "Edit Prime Cost")

**Add Version modal (PrimeCostFormModal evolved):**
- For NEW SKU: same fields as before PLUS `Effective From` (defaults to today) + optional breakdown (cogs / logistic / warehouse / fulfillment) + source note
- For EXISTING SKU: only prompts `Effective From` (date) + `Prime Cost (VND)` + breakdown + note. Other fields (name/sku/sellingPrice) edited via separate "Edit metadata" flow (Phase 1: out of scope, keep using existing modal in "metadata mode")

**Version history view (inline expand):**
- Table: Effective From | Prime Cost VND | Breakdown | Source Note | Created By | Created At | Actions (Soft Delete)
- Soft-delete a version: only allowed if it's not the only version AND no Finalized snapshot references it (Phase 1 simplification: warn if any snapshot's period_start ≥ this version's effective_from)

**CSV import:**
- New optional column `Effective From` (YYYY-MM-DD)
- Empty → today
- Same row can refer to existing SKU → adds a new version (NOT upsert)
- New SKU → creates master row + initial version with given (or today's) effective_from

**CSV export:**
- Adds `Effective From` column → 1 row per version (export bloats by version count). Optional toggle "Latest only" for backward compat — Phase 1: default to "Latest only" to keep file shape compatible.

### 3.7 Activity log
Each version add / delete → 1 entry in `sal_action_logs`:
- `category: MASTER_DATA`
- `verb: ADD_VERSION` / `DELETE_VERSION`
- `targetType: prime-cost-version`
- `summary: "Added prime cost version for SKU {sku} effective {date}: {oldCost} → {newCost} (Δ {pct}%)"`
- `metadata: { sku, effectiveFrom, primeCost, breakdown, sourceNote }`

## 4. 갭 분석

### 4.1 Change scope

| Area | Current | Change | Risk |
|------|---------|--------|------|
| DB schema | `sal_prime_costs` flat | + `sal_prime_cost_versions` table; backfill migration | Medium — migration data correctness |
| Parser | 15 cols Shopee, 15 cols TikTok | +1 col each (`Ngày đặt hàng` / `Created Time`) | Low — robust parsers tolerate missing-column → fail-loudly during MISSING_COLUMN check |
| Row types | No orderDate | +`orderDate` field | Low — additive |
| Loader | Map<sku,master> | Map<sku, master+versions[]> | Low |
| Calculator | per-row lookup of fixed cost | per-row date-aware lookup | Medium — must perf-test (lookup happens per data row, 5k+ rows/period typical) |
| UI table | flat list | + expand history, + new column | Low |
| UI modal | edit in-place | add-version flow | Medium — UX shift, training needed |
| CSV import | upsert by sku | upsert master + insert version | Low |
| Ingest | unchanged signature | unchanged caller; new internal type for master | Low |
| Snapshot | unchanged | unchanged | None — Finalized snapshots already immutable |

### 4.2 File changes

**Backend (apps/web/src):**
- 신규: `packages/db/src/schema/prime-cost-versions.schema.ts`
- 신규: `packages/db/migrations/0005_prime_cost_versions.sql`
- 신규: `apps/web/src/server/services/prime-cost-version.service.ts` (CRUD for versions)
- 수정: `apps/web/src/server/services/prime-cost-master.service.ts` (return type)
- 수정: `apps/web/src/server/services/shopee-sales-parser.service.ts` (+ orderDate)
- 수정: `apps/web/src/server/services/tiktok-sales-parser.service.ts` (+ orderDate)
- 수정: `apps/web/src/server/services/gmv-calculator.service.ts` (per-row date lookup)
- 수정: `apps/web/src/server/services/tiktok-metrics-calculator.service.ts` (same)
- 수정: `apps/web/src/server/actions/prime-cost.actions.ts` (new version actions, CSV import handles date col)

**Frontend (apps/web/src):**
- 수정: `components/prime-cost/PrimeCostTable.tsx` (+ expand, + history view)
- 수정: `components/prime-cost/PrimeCostFormModal.tsx` (+ effective_from, + breakdown fields)
- 신규: `components/prime-cost/VersionHistoryRow.tsx` (inline expansion)
- 수정: i18n `messages/{en,ko}.json` (`primeCost.version.*` namespace)

**Migration (manual on staging/prod):**
- `0005_prime_cost_versions.sql` — CREATE TABLE + backfill SELECT/INSERT

### 4.3 DB migration strategy

```sql
-- 0005_prime_cost_versions.sql

CREATE TABLE sal_prime_cost_versions (
  pcv_id CHAR(36) PRIMARY KEY,
  ent_id CHAR(36) NOT NULL,
  pcs_id CHAR(36) NOT NULL REFERENCES sal_prime_costs(pcs_id),
  pcv_effective_from DATE NOT NULL,
  pcv_prime_cost_vnd NUMERIC(18,2) NOT NULL,
  pcv_breakdown JSONB,
  pcv_source_note VARCHAR(255),
  pcv_created_by CHAR(36) NOT NULL,
  pcv_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pcv_updated_at TIMESTAMPTZ,
  pcv_deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uniq_sal_pcv_ent_sku_date
  ON sal_prime_cost_versions(ent_id, pcs_id, pcv_effective_from)
  WHERE pcv_deleted_at IS NULL;

CREATE INDEX idx_sal_pcv_ent_sku_date
  ON sal_prime_cost_versions(ent_id, pcs_id, pcv_effective_from DESC);

-- Backfill: 1 version per existing master row with sentinel date
INSERT INTO sal_prime_cost_versions
  (pcv_id, ent_id, pcs_id, pcv_effective_from, pcv_prime_cost_vnd,
   pcv_source_note, pcv_created_by, pcv_created_at)
SELECT
  gen_random_uuid()::CHAR(36), ent_id, pcs_id,
  DATE '2020-01-01',
  pcs_prime_cost_vnd,
  'Backfilled from sal_prime_costs migration',
  pcs_created_by, pcs_created_at
FROM sal_prime_costs
WHERE pcs_deleted_at IS NULL;
```

**Rollback plan:** `DROP TABLE sal_prime_cost_versions;` — master table untouched, calculator falls back to reading `sal_prime_costs.pcs_prime_cost_vnd` (must keep an else-branch in code during rollout).

**Feature flag (recommended):** env var `PRIME_COST_VERSIONING=on|off`. Phase 1 ships behind flag; flip to `on` after backfill verified.

## 5. 사용자 플로우

### 5.1 Operator: nhập hàng đợt mới với COGS khác

```
Operator → Settings → Prime Cost Master
   ↓
[Search SKU SAFG47U] → row shows current cost 280,000 VND
   ↓
Click chevron → expand → version history
   ↓ (2 existing versions: 2020-01-01 = 280,000 ; 2026-03-15 = 285,000)
Click "Add new version"
   ↓
Modal:
  Effective From: [2026-05-20] ← default today
  Prime Cost (VND): [295,000]
  Breakdown (optional):
    COGS: [220,000]
    Logistic: [40,000]
    Warehouse / day: [200]
    Fulfillment: [15,000]
  Source Note: [Batch BL-2026-05-20]
   ↓
Save → INSERT sal_prime_cost_versions
   ↓
Toast "New version saved. Affects orders from 2026-05-20 onwards"
   ↓
Activity Log: MASTER_DATA ADD_VERSION SAFG47U @ 2026-05-20
```

### 5.2 Operator: re-ingest Draft period W21 (15-21 May)

```
Operator → Upload Reports → Period W21 (Draft) → re-upload files
   ↓
Ingest action loads master with versions
   ↓
For each Shopee Sales row:
  orderDate = parse "Ngày đặt hàng"
  cost = findPrimeCost(versions[SAFG47U], orderDate)
    if orderDate >= '2026-05-20' → 295,000  (new version)
    elif orderDate >= '2026-03-15' → 285,000
    else                          → 280,000
   ↓
New snapshot reflects mixed-cost reality
```

### 5.3 Manager: finalize period

```
Manager → Raw Archive → W21 → Approve & Finalize
   ↓
Snapshot status = Finalized → psp_metrics blob frozen
   ↓
LATER: Operator adds another version with effective_from = '2026-05-18' (retro)
   ↓
W21 snapshot UNCHANGED (NFR-08) — only future Draft periods pick it up
```

### 5.4 CSV bulk upload

```
File:
  SKU,Product (VI),Prime Cost (VND),Effective From
  SAFG47U,Muỗng silicon...,295000,2026-05-20
  SAFG48U,Bát silicon...,310000,2026-05-20
  SAFG49U,Đĩa silicon...,180000,                ← empty → today

Import flow:
  for each row:
    master = upsert sal_prime_costs (sku metadata)
    INSERT sal_prime_cost_versions (master.pcs_id, effective_from || today, prime_cost)
   ↓
Import summary: "3 versions added across 3 SKUs (1 new SKU)"
```

## 6. 기술 제약사항

| Constraint | Detail |
|------------|--------|
| Performance | Per-row date lookup adds O(log V) per row where V = versions per SKU. With typical V≤5 and 5,000 rows/period, ~25k comparisons → negligible. |
| Backwards compat | Existing periods that haven't been re-ingested keep current snapshot until Operator re-uploads. |
| Migration safety | Migration is additive; backfill ensures every SKU has ≥1 version → no MISSING_VERSION errors on first re-ingest. |
| Multi-tenancy | `pcv` table has `ent_id` + queries always wrap with `withEnt()` — no leak. |
| Timezone | `effective_from` is DATE (no time). Order date also stripped to date. Comparison is naive string-compare on `YYYY-MM-DD` (works for ISO format). |
| Returns | Per requirement R7 — no special logic. Returns inherit the order's effective version automatically. |
| NFR-06 (raw immutable) | Unchanged. |
| NFR-08 (no retro Finalized) | Enforced by snapshot pattern + existing Finalize lock — no new code needed, but ADD a clarification banner in the Add-Version modal: "Existing Finalized periods will NOT be re-computed." |
| Locale | All UI text via i18n. New keys under `primeCost.version.*`. |
| Feature flag | Ship behind `NEXT_PUBLIC_PRIME_COST_VERSIONING=on` for staged rollout. Default `off` until backfill verified. |

---

**Next step:** PLAN-20260521-prime-cost-versioning.md — concrete phased implementation steps + side-impact analysis.
