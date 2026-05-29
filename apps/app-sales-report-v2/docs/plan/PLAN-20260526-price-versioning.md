# PLAN-20260526 — Selling Price + Listing Price Versioning (Phase 1.2)

> **Status:** Draft v1
> **Date:** 2026-05-26
> **Source REQ:** [REQ-20260526-price-versioning.md](../analysis/REQ-20260526-price-versioning.md)
> **Estimated effort:** ~1-1.5 dev-day

---

## 1 · System context (already in REQ §2)

See REQ §2 for AS-IS analysis. Skipping repetition.

---

## 2 · Step-by-step

### Phase 1.2.A — DB layer (20 min)

#### Step 1: Migration `0009_selling_price_versions.sql`
Mirror `0008_prime_cost_versions.sql`. Drop `pcv_breakdown` jsonb (selling has no sub-components). Backfill from `pcs_selling_price_vnd` WHERE NOT NULL.

#### Step 2: Migration `0010_listing_price_versions.sql`
Same shape, for listing.

#### Step 3: Drizzle schemas
`packages/db/src/schema/selling-price-versions.schema.ts` + `listing-price-versions.schema.ts`. Re-export from `index.ts`.

#### Step 4: Apply locally
`drizzle-kit push` or run SQL directly via Neon.

**└─ Side impact:** 2 new tables; backfill creates sentinel 2020-01-01 row per existing SKU.

### Phase 1.2.B — Service + Calculator (30 min)

#### Step 5: Extend `gmv-calculator.service.ts` types
```ts
export interface PriceVersion { effectiveFrom: string; valueVnd: number; }
export interface PrimeCostMaster {
  primeCost: number;
  sellingPrice: number;
  listingPrice: number;
  productNameEn: string;
  versions: PrimeCostVersion[];          // prime
  sellingVersions: PriceVersion[];       // NEW
  listingVersions: PriceVersion[];       // NEW
}
export function findSellingPrice(master, orderDate): number { /* mirror findPrimeCost */ }
export function findListingPrice(master, orderDate): number { /* mirror findPrimeCost */ }
```

#### Step 6: Update `prime-cost-master.service.ts`
Add 2 queries (selling + listing version tables), build 2 maps, attach to each master row. Latest version → `sellingPrice` / `listingPrice` flat fields (backward-compat for UI cards).

#### Step 7: Update calculators
- `gmv-calculator.service.ts:399` → `findSellingPrice(master, row.orderDate)`
- `tiktok-metrics-calculator.service.ts:227` → `findListingPrice(master, row.orderDate)`

**└─ Side impact:** Recompute weekly/monthly reports gives same numbers IFF backfilled sentinel matches flat field (true by construction).

### Phase 1.2.C — Version services + actions (30 min)

#### Step 8: `selling-price-version.service.ts`
Mirror `prime-cost-version.service.ts`. CRUD: `listVersionsForSku`, `addVersion`, `softDeleteVersion`. Same `+30 days` future cap. Sync `pcs_selling_price_vnd` flat field when new version is latest.

#### Step 9: `listing-price-version.service.ts`
Same.

#### Step 10: 6 actions in `prime-cost.actions.ts`
`addSellingPriceVersionAction`, `listSellingPriceVersionsAction`, `softDeleteSellingPriceVersionAction` (+ 3 for listing).

### Phase 1.2.D — UI (45 min)

#### Step 11: `VersionHistoryModal.tsx` refactor → tabbed
- New state: `activeTab: 'prime' | 'selling' | 'listing'`
- New prop: `initialTab?: typeof activeTab`
- Each tab renders own list + AddVersionModal (call respective action)
- Tab headers show count badge

#### Step 12: `PrimeCostTable.tsx`
Replace "Effective From" col with 3 compact cols. Each cell clickable → open modal with `initialTab` deep-link.

#### Step 13: i18n
Add `sellingPrice.version.*` + `listingPrice.version.*` namespaces (or share via `priceVersion.*` generic + flavor key). Update both en + ko.

### Phase 1.2.E — CSV (20 min)

#### Step 14: CSV export
Add 2 columns: Effective From — Selling (J), Effective From — Listing (K). Pull latest version date per SKU per field.

#### Step 15: CSV import
Parse cols J + K. For each non-empty: parse via `parseFlexibleDate`. If value changed vs DB AND date provided → create version. If value changed AND date empty → version with today. If value unchanged → skip version, regardless of date.

### Phase 1.2.F — Verify + docs (30 min)

#### Step 16: Typecheck across web/db/shared
#### Step 17: Smoke test in dev server (start, hit pages, check no console error)
#### Step 18: TC doc
#### Step 19: RPT + update staging regression doc

---

## 3 · File change matrix

| Phase | File | Action |
|---|---|---|
| A | `packages/db/migrations/0009_selling_price_versions.sql` | NEW |
| A | `packages/db/migrations/0010_listing_price_versions.sql` | NEW |
| A | `packages/db/src/schema/selling-price-versions.schema.ts` | NEW |
| A | `packages/db/src/schema/listing-price-versions.schema.ts` | NEW |
| A | `packages/db/src/schema/index.ts` | MODIFY |
| B | `apps/web/src/server/services/gmv-calculator.service.ts` | MODIFY (+2 helpers, update Shopee row loop) |
| B | `apps/web/src/server/services/prime-cost-master.service.ts` | MODIFY (load 2 more version arrays) |
| B | `apps/web/src/server/services/tiktok-metrics-calculator.service.ts` | MODIFY (use findListingPrice) |
| C | `apps/web/src/server/services/selling-price-version.service.ts` | NEW |
| C | `apps/web/src/server/services/listing-price-version.service.ts` | NEW |
| C | `apps/web/src/server/actions/prime-cost.actions.ts` | MODIFY (+6 actions + CSV ext) |
| D | `apps/web/src/components/prime-cost/VersionHistoryModal.tsx` | MAJOR REFACTOR |
| D | `apps/web/src/components/prime-cost/PrimeCostTable.tsx` | MODIFY (3 effective cols + deep-link) |
| D | `apps/web/messages/en.json`, `ko.json` | MODIFY (~20 keys) |
| F | `docs/test/TC-20260526-price-versioning.md` | NEW |
| F | `docs/implementation/RPT-20260526-price-versioning.md` | NEW |
| F | `docs/test/TC-20260522-staging-full-regression.md` | MODIFY (extend §7 prime cost) |

---

## 4 · Side impact

| Range | Risk | Mitigation |
|---|---|---|
| Existing weekly/monthly reports recompute | LOW | Backfill captures current flat value into sentinel → first recompute gives same numbers |
| `PrimeCostMaster` type expansion | LOW | All consumers go through master loader; type-safe |
| Modal UX complexity | MEDIUM | Tabbed with clear count badges; initial-tab deep-link from table cells |
| Master loader N+2 query | LOW | 200 SKUs × 5 versions = 3000 rows max, indexed |
| Concurrent CSV import + version add | LOW | Same unique-key per `(ent, sku, eff_from)` prevents dup |

---

## 5 · Rollout

1. Code review + merge to `main`
2. Apply migrations 0009, 0010 trên staging (manual SQL since production uses `synchronize: false`)
3. Deploy app
4. Run TC-20260526 manual tests + regression TC-7.6/7.7/7.8/7.11
5. Verify reports W19-W21 still match pre-deploy snapshot numbers
