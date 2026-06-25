# RPT-20260526 — Selling Price + Listing Price Versioning (Phase 1.2)

> **Status:** Implementation complete — pending manual test + staging deploy
> **Date:** 2026-05-26
> **Source REQ:** [REQ-20260526-price-versioning.md](../analysis/REQ-20260526-price-versioning.md)
> **Source PLAN:** [PLAN-20260526-price-versioning.md](../plan/PLAN-20260526-price-versioning.md)
> **Source TC:** [TC-20260526-price-versioning.md](../test/TC-20260526-price-versioning.md)

---

## 1 · Summary

Phase 1.2 hoàn tất. **Selling Price** + **Listing Price** giờ versioned theo `effective_from`, song song với Prime Cost từ Phase 1. Calculator phía Shopee + TikTok dùng version active tại order date thay vì flat field → KHÔNG retro-affect history khi update giá.

UI: button "Versions" mở **modal 3 tabs** (Prime / Selling / Listing). Main table có thêm 2 cột Effective Sell + Effective List. CSV import/export thêm 2 cột J + K cho dates tương ứng.

---

## 2 · Files changed (16 files, ~750 LOC)

| Layer | File | Action |
|---|---|---|
| DB | `packages/db/migrations/0009_selling_price_versions.sql` | NEW |
| DB | `packages/db/migrations/0010_listing_price_versions.sql` | NEW |
| Schema | `packages/db/src/schema/selling-price-versions.schema.ts` | NEW |
| Schema | `packages/db/src/schema/listing-price-versions.schema.ts` | NEW |
| Schema | `packages/db/src/schema/index.ts` | MODIFY (re-export) |
| Service | `apps/web/src/server/services/selling-price-version.service.ts` | NEW |
| Service | `apps/web/src/server/services/listing-price-version.service.ts` | NEW |
| Service | `apps/web/src/server/services/gmv-calculator.service.ts` | MODIFY (+`PriceVersion`, `findSellingPrice`, `findListingPrice`, master shape expanded) |
| Service | `apps/web/src/server/services/prime-cost-master.service.ts` | MODIFY (3 parallel queries + 3 maps) |
| Service | `apps/web/src/server/services/tiktok-metrics-calculator.service.ts` | MODIFY (use `findListingPrice`) |
| Action | `apps/web/src/server/actions/prime-cost.actions.ts` | MODIFY (+6 actions, +2 ImportResult counters, CSV cols J+K, export 3 effective cols) |
| UI | `apps/web/src/components/prime-cost/VersionHistoryModal.tsx` | MAJOR REFACTOR (tabbed, generic AddVersionModal handles all 3 cases) |
| UI | `apps/web/src/components/prime-cost/PrimeCostTable.tsx` | MODIFY (3 Effective cols + tab deep-link + ImportResultModal stats expanded) |
| i18n | `apps/web/messages/en.json` | MODIFY (+9 keys) |
| i18n | `apps/web/messages/ko.json` | MODIFY (+9 keys) |
| Docs | `docs/analysis/REQ-20260526-price-versioning.md` | NEW |
| Docs | `docs/plan/PLAN-20260526-price-versioning.md` | NEW |
| Docs | `docs/test/TC-20260526-price-versioning.md` | NEW |
| Docs | `docs/implementation/RPT-20260526-price-versioning.md` | NEW |

---

## 3 · Key implementation decisions

### 3.1 3 bảng riêng (user's choice)
Thay vì gộp 3 field vào 1 bảng `sal_prime_cost_versions`, user chọn tách riêng cho clarity:
- `sal_prime_cost_versions` (đã có) — Prime Cost + breakdown jsonb
- `sal_selling_price_versions` (NEW) — chỉ value + note
- `sal_listing_price_versions` (NEW) — chỉ value + note

Mỗi bảng có schema gần giống nhau, prefix riêng (`pcv` / `spv` / `lpv`). DROP `breakdown` cho selling/listing vì 2 field này không có sub-components.

### 3.2 Backfill sentinel `2020-01-01`
Migrations tự insert 1 row sentinel per SKU có flat value NOT NULL. Effective_from = `2020-01-01` → cover mọi historical order. Calculator scan DESC → tìm thấy sentinel cuối cùng nếu không có version mới hơn. Backfill idempotent (`NOT EXISTS` guard).

### 3.3 Calculator helpers mirror `findPrimeCost`
Cùng pattern: scan versions DESC, return first `v.effectiveFrom <= orderDate`. Empty list / empty date → fallback `master.{sellingPrice|listingPrice}` (đã được loader gán = latest version's value, ergo backward compat cho UI).

### 3.4 Master loader 3 parallel queries
`Promise.all([prime, selling, listing])` thay vì sequential. Mỗi query trả về DESC list, build map by `pcsId`. Tổng ~750 rows post-backfill (250 SKU × 3 fields).

### 3.5 UI: tabbed modal + count badges
Tabs trên cùng modal có badge count active versions. Add Version sub-modal nhận `tab: VersionTab` prop → chỉ hiện breakdown form cho Prime tab. PrimeCostTable's 3 Effective cells click → mở modal `initialTab` đúng.

### 3.6 CSV: 11 cols total
| Col | Header | Logic |
|---|---|---|
| I | Effective From — Prime | Always creates a prime version (existing behavior). Empty → today. |
| J | Effective From — Selling (NEW) | Only creates version when selling value **changed** vs DB. Empty + changed → today. |
| K | Effective From — Listing (NEW) | Same as J for listing. |

Khác Prime: Selling + Listing không create version no-op nếu value chưa đổi. Tránh rác data.

### 3.7 ImportResult expanded
Thêm `sellingVersionsAdded` + `listingVersionsAdded` counters. ActivityLog summary giờ liệt kê 3 counts riêng.

---

## 4 · Acceptance verification

| AC | Source | Status |
|---|---|---|
| R1 Selling versioned per effective date | REQ | ✅ Service + calculator wired |
| R2 Listing versioned per effective date | REQ | ✅ Same pattern as R1 |
| R3 Per-field independent CRUD | REQ | ✅ 6 actions, 3 service modules, 3 tabs |
| R4 Calculator date-aware per field | REQ | ✅ `findSellingPrice/Listing` used |
| R5 Tabbed modal 1 button | REQ | ✅ |
| R6 CSV cols J + K | REQ | ✅ + 3 effective cols in export |
| R7 i18n full | REQ | ✅ Both en + ko |
| R8 NFR-08 finalized snapshot không retro-affect | REQ | ✅ (architecture — snapshot store untouched) |

---

## 5 · Testing status

- [x] Typecheck pass (`npx tsc --noEmit` across all workspaces)
- [x] Migrations applied to dev DB; backfill counts verified:
  - 250 masters, 224 with selling → 224 selling versions
  - 220 with listing → 220 listing versions
- [x] Smoke test: 7 main routes return HTTP 200
- [x] `/cost-master/prime-cost` page renders 3 new column headers ("Prime Eff.", "Sell Eff.", "List Eff.")
- [ ] Manual test theo [TC-20260526](../test/TC-20260526-user-ama-sync.md) — pending
- [ ] Re-ingest W19-W21 to verify same numbers (pre-migration parity) — pending
- [ ] Staging regression — pending deploy

---

## 6 · Known limitations / Phase 2 backlog

| # | Limitation | Plan |
|---|---|---|
| L1 | Re-compute existing snapshots không tự động — admin phải bấm re-ingest từng period Draft sau khi add version mới | Phase 2: bulk recompute action for Draft periods |
| L2 | Master loader N+2 queries (now N+3) — vẫn fast với 750 rows. Nếu scale lên 10k SKU + versions, consider materialized view | Phase 3 |
| L3 | Selling/Listing version table không có `breakdown` jsonb như Prime — không capture "this version was for promo X" sub-context. Source note (255 char) là workaround. | Acceptable; revisit khi có demand |
| L4 | CSV import chỉ tạo version khi value KHÁC DB. Nếu user muốn force-create version với same value (vd "reset effective_from"), phải làm qua UI | By-design |

---

## 7 · Post-1.2 UX revision — split into 3 menus (2026-05-26 PM)

User feedback: tabbed modal was clunky; preferred separate menu items per field with the version history as the **primary content** (not behind a button).

### Changes:
| File | Action |
|---|---|
| `apps/web/src/components/prime-cost/PriceVersionPageClient.tsx` | NEW — shared client used by all 3 pages |
| `apps/web/src/app/(dashboard)/cost-master/prime-cost/page.tsx` | REWRITE — calls `<PriceVersionPageClient field="prime" />` |
| `apps/web/src/app/(dashboard)/cost-master/selling-price/page.tsx` | NEW |
| `apps/web/src/app/(dashboard)/cost-master/listing-price/page.tsx` | NEW |
| `apps/web/src/server/actions/prime-cost.actions.ts` | + `listFlatVersionsAction({ field })` returning joined version+SKU rows |
| `apps/web/src/components/layout/nav-config.ts` | + 2 nav items under "RFR Data": Selling Price / Listing Price |
| `apps/web/src/components/layout/page-title.ts` | + page-title mapping for 2 new routes |
| `apps/web/messages/{en,ko}.json` | + `nav.item.{sellingPrice,listingPrice}`, `pageTitle.{sellingPrice,listingPrice}`, `priceVersion.*` namespace, `common.{change,empty}` |

### New page layout:
```
[Prime Cost]                                                [+ Add SKU] [+ Add Version]
[Search SKU…]                            (Prime only: [Import CSV] [Download CSV])

┌─ Flat version list, DESC by Effective From ────────────────────────────────────┐
│ SKU              Product VI         VND        Effective    Recorded   Note     │
│ FIRGI-S3-001     Bộ 3 dụng cụ      120,000    2026-06-01   2026-05-26 Q3 hike   │
│ FIRGI-S5-002     Muỗng silicone    150,000    2026-05-15   2026-05-10 Cost up   │
│ FIRGI-S3-001     Bộ 3 dụng cụ      100,000    2020-01-01   2026-04-01 Backfill  │
│ ...                                                                              │
└──────────────────────────────────────────────────────────────────────────────────┘
Showing 224 of 224 versions
```

- Click SKU code → opens existing `PrimeCostFormModal` (Edit SKU master)
- "+ Add Version" → opens `AddVersionForFieldModal` (SKU autocomplete picker + form)
- "+ Add SKU" → opens `PrimeCostFormModal` in create mode
- Each row "Delete" → soft-delete that version (rejected if last)

### Deprecated (kept for now but unused):
- `VersionHistoryModal.tsx` (tabbed) — superseded by per-page view
- 3 effective columns in old `PrimeCostTable` — old component still works for SKU master if needed, but no page uses it now

### Sidebar:
```
RFR Data
├─ Prime Cost     (Database icon)
├─ Selling Price  (Tag icon)
└─ Listing Price  (Receipt icon)
```

---

## 8 · Combo / bundle split — extension (2026-05-26 PM)

User feedback: Shopee 1-product-many-options model means combo SKUs aggregate under the parent product in Product Breakdown. Client wants them split out.

### Changes:
| File | Action |
|---|---|
| `packages/db/migrations/0011_prime_cost_is_combo.sql` | NEW — `pcs_is_combo BOOLEAN NOT NULL DEFAULT FALSE` + filtered index |
| `packages/db/src/schema/prime-costs.schema.ts` | + `pcsIsCombo` boolean field |
| `apps/web/src/server/services/gmv-calculator.service.ts` | + `isCombo` on `PrimeCostMaster` + on `productBreakdown` row + aggregation key suffix `' __COMBO__'` (stripped before output) |
| `apps/web/src/server/services/tiktok-metrics-calculator.service.ts` | Same as Shopee |
| `apps/web/src/server/services/prime-cost-master.service.ts` | Load `pcsIsCombo` from DB |
| `apps/web/src/server/actions/prime-cost.actions.ts` | `rowSchema.isCombo`, `PrimeCostRow.isCombo`, `FlatVersionRow.isCombo`, CREATE/UPDATE persist it, CSV col L `Is Combo` (yes/no/1/0/true/false on import) |
| `apps/web/src/components/prime-cost/PrimeCostFormModal.tsx` | + checkbox "Mark as Combo / Bundle" |
| `apps/web/src/components/prime-cost/PriceVersionPageClient.tsx` | Combo badge next to product name in version list |
| `apps/web/src/lib/weekly-report-mock.ts` | + `isCombo?: boolean` on `ProductMetric` |
| `apps/web/src/lib/snapshot-to-report.ts` | Forward `p.isCombo` from snapshot to `ProductMetric` (Shopee + TikTok) |
| `apps/web/src/components/weekly/WeeklyProductBreakdownTable.tsx` | Combo badge next to Product (VI) |
| `apps/web/messages/{en,ko}.json` | `+priceVersion.badge.combo`, `+primeCost.form.{labelIsCombo,hintIsCombo}`, `+weeklyReport.productBreakdown.comboBadge` |

### Aggregation key strategy:
```ts
const aggKey = isCombo ? `${productName} __COMBO__` : productName;
```

Suffix is an internal sentinel — stripped before output. Same `productName` string is shown to UI, but `isCombo: true` flag is propagated so the UI can render a badge / a different row style. Old snapshots (pre-migration) → `p.isCombo` undefined → falls back to `false`, no breakage.

### How an Operator uses it:
1. RFR Data → Prime Cost (or Selling/Listing) → "+ Add SKU" or click existing SKU → modal opens
2. Tick **"Mark as Combo / Bundle"** at the bottom
3. Save → flag persists. Next ingest will split this SKU into its own Product Breakdown row.
4. Re-ingest the most-recent Draft week to apply retroactively (Finalized periods stay).

### CSV column L (`Is Combo`):
- Export emits `yes` / `no`
- Import accepts `yes/no/y/n/true/false/1/0` (case-insensitive). Empty → preserve existing on UPDATE / default `false` on INSERT.

---

## 9 · Combo metadata (reference) — 2026-05-27

User requested storing combo composition metadata for future use (Phase 1: reference only, calculator does not consume).

### Changes:
| File | Action |
|---|---|
| `packages/db/migrations/0012_prime_cost_combo_meta.sql` | NEW — `pcs_combo_meta JSONB NULL` |
| `packages/db/src/schema/prime-costs.schema.ts` | + `pcsComboMeta` jsonb field |
| `apps/web/src/server/actions/prime-cost.actions.ts` | + `ComboMeta` type, `rowSchema.comboMeta`, `PrimeCostRow.comboMeta`, persist on create/update, CSV cols M (`Combo Own SKU`) + N (`Combo Component SKUs` comma-separated) |
| `apps/web/src/components/prime-cost/PrimeCostFormModal.tsx` | 2 input fields revealed below the `isCombo` checkbox when checked |
| `apps/web/messages/{en,ko}.json` | + `primeCost.form.{comboMetaHint, labelComboOwnSku, labelComboComponentSkus, hintComboComponentSkus}` |

### Schema:
```jsonc
// pcs_combo_meta
{
  "ownSku": "COMBO_ABC123",                    // optional
  "componentSkus": ["SAFG26U0004", "SAFG26U0003"]  // optional
}
```

Both fields optional. Empty meta → `null` in DB. UI shows the 2 inputs only when `isCombo` checkbox is ticked.

### Use case examples:
- **Concat-pattern SKU**: master row's `sku_code` = `SAFG26U0004_SAFG26U0003`. Admin ticks `isCombo`, then fills `componentSkus = ["SAFG26U0004", "SAFG26U0003"]` for documentation.
- **Dedicated combo SKU**: master row's `sku_code` = `COMBO_ABC123` (whatever Shopee assigned). Admin ticks `isCombo`, fills `ownSku = "COMBO_ABC123"` (same as the row's sku_code — but useful when admin wants to record an alternate barcode) AND `componentSkus = ["SAFG26U0004", "SAFG26U0003"]`.

### CSV behavior:
- Export: cols M, N (cell M is the ownSku, cell N is comma-joined `componentSkus`)
- Import: empty cell preserves DB value on UPDATE; non-empty replaces. If both blank → field becomes `null`.

### Phase 2 reuse:
When inventory decomposition lands, the same `pcs_combo_meta.componentSkus` array drives:
- Cost auto-derivation: `combo_cost = sum(cost(component_sku))`
- Inventory: selling 1 combo decrements component inventory

No schema migration required when this happens.

---

## 10 · Deployment notes

### Migration order (production):
```bash
# Apply on staging first:
psql $DATABASE_URL -f packages/db/migrations/0009_selling_price_versions.sql
psql $DATABASE_URL -f packages/db/migrations/0010_listing_price_versions.sql

# Or via the migration script approach (Neon HTTP statement-by-statement):
node --env-file=.env.staging scripts/apply-migration.mjs packages/db/migrations/0009_selling_price_versions.sql
node --env-file=.env.staging scripts/apply-migration.mjs packages/db/migrations/0010_listing_price_versions.sql
```

Migrations idempotent (IF NOT EXISTS, NOT EXISTS guards) — re-runnable safely.

### Post-deploy verification:
```sql
SELECT
  (SELECT count(*) FROM sal_prime_costs WHERE pcs_deleted_at IS NULL AND pcs_selling_price_vnd IS NOT NULL) AS master_selling,
  (SELECT count(*) FROM sal_selling_price_versions WHERE spv_deleted_at IS NULL) AS sel_versions,
  (SELECT count(*) FROM sal_prime_costs WHERE pcs_deleted_at IS NULL AND pcs_listing_price_vnd IS NOT NULL) AS master_listing,
  (SELECT count(*) FROM sal_listing_price_versions WHERE lpv_deleted_at IS NULL) AS lis_versions;
```

Expected: `master_selling == sel_versions`, `master_listing == lis_versions`.

### Smoke test on staging:
1. Open `/cost-master/prime-cost` → confirm 3 Effective cols visible
2. Click any SKU → "Versions" → confirm 3 tabs với count badges
3. Add 1 Selling version với effective_from = tomorrow → confirm tab count +1, list refresh
4. Re-ingest W19/2026 (Draft) → confirm Shopee Net GMV = pre-deploy value (sentinel backfill)
5. Switch to KO locale → confirm tab labels = `원가 / 판매가 / 정상가`
