# TC-20260526 — Selling Price + Listing Price Versioning

> **Status:** Draft v1
> **Date:** 2026-05-26
> **Source REQ:** [REQ-20260526-price-versioning.md](../analysis/REQ-20260526-price-versioning.md)
> **Effort:** ~45 min manual

---

## Pre-test

### TC-0.1 — Verify migrations applied · P0
**Steps:**
1. `psql ... -c "\d sal_selling_price_versions"` and `\d sal_listing_price_versions`
2. `SELECT count(*) FROM sal_selling_price_versions WHERE spv_effective_from = '2020-01-01'` → should equal count of `sal_prime_costs` rows with non-null `pcs_selling_price_vnd`
3. Same for listing

**Expected:** Both tables exist. Sentinel rows = count of master rows with that price.

---

## 1 · Calculator parity

### TC-1.1 — Recompute existing snapshot gives same numbers · P0
**Pre:** Snapshot for W20/2026 exists. No new versions added yet.
**Steps:**
1. Open W20/2026 → note Net GMV, GMV (TikTok), Seller Discount, CM
2. Trigger recompute (Upload → re-ingest same files)
3. Compare numbers

**Expected:** All numbers identical to pre-migration. Backfill sentinel (`2020-01-01`) is being used as flat-equivalent.

### TC-1.2 — Add selling price version → past order uses old price · P0
**Pre:** SKU `FIRGI-S3-001` currently selling 100k.
**Steps:**
1. Open Versions modal → Selling tab → Add version: effective_from=`2026-06-01`, value=`120000`
2. Re-ingest W19/2026 (which has 1 order of this SKU on 2026-05-09)
3. Check Product Breakdown for this SKU → Net GMV row

**Expected:** Net GMV uses **100k** (old version, since `2026-05-09 < 2026-06-01`). Master cache `pcs_selling_price_vnd` is now 120k, but historical orders use the date-aware lookup.

### TC-1.3 — Same for listing price (TikTok) · P0
**Pre:** TikTok SKU with listing 150k currently. W18/2026 ingested.
**Steps:**
1. Add listing version: effective_from=`2026-05-20`, value=`160000`
2. Re-ingest W18 (orders on 2026-05-01..07)
3. Check TikTok GMV in W18 report

**Expected:** GMV uses **150k** (old) for W18 orders since they're all before 2026-05-20.

---

## 2 · UI

### TC-2.1 — Versions modal opens with 3 tabs · P0
**Steps:** Click Versions button on any SKU row.
**Expected:** Modal opens. 3 tabs visible: "Prime Cost (N)", "Selling (M)", "Listing (K)". Counts match number of active versions per field. Default active tab = Prime Cost.

### TC-2.2 — Tab switch shows different version lists · P0
**Steps:** Click each tab.
**Expected:** Table content updates. Prime tab shows breakdown (cogs/logistic/...). Selling + Listing tabs only show date, VND, KRW, note, actions.

### TC-2.3 — Add version in Selling tab · P0
**Steps:** Selling tab → "+ Add version" → fill date + value + note → Save.
**Expected:** New row appears at top with "Latest" badge. Tab count badge `Selling (M+1)`. `sal_selling_price_versions` has new row.

### TC-2.4 — Delete non-latest version · P1
**Steps:** Click Trash on a non-latest version.
**Expected:** Row removed. Tab count decrements. If was latest → master cache re-syncs to new latest.

### TC-2.5 — Cannot delete last version · P1
**Pre:** SKU has only 1 selling version.
**Steps:** Try Trash.
**Expected:** Button disabled with tooltip "Cannot delete the only version".

### TC-2.6 — Effective From columns in main table · P0
**Expected:** 3 compact columns visible: Pcost Eff, Sell Eff, List Eff. Each shows latest version date + count badge if >1. Click cell → opens modal with that tab active.

### TC-2.7 — Korean locale · P1
**Steps:** Switch to KO. Open modal.
**Expected:** Tab labels in Korean (가격 / 판매가 / 표시가 — placeholder, finalize during impl). Buttons translated.

---

## 3 · CSV import/export

### TC-3.1 — Export includes new effective cols · P0
**Steps:** Click Download CSV. Open in Excel.
**Expected:** Headers include columns I, J, K = "Effective From — Prime", "— Selling", "— Listing". Each row populated with latest version date per field.

### TC-3.2 — Import 1 row changes all 3 prices + 3 effective dates · P0
**Pre:** SKU `FIRGI-S3-001` exists.
**Steps:**
```csv
,,,,FIRGI-S3-001,295000,120000,150000,2026-05-21,2026-06-01,2026-06-01
```
**Expected:** Import summary: `Updated: 1 · PrimeVersions: 1 · SellingVersions: 1 · ListingVersions: 1 · Errors: 0`. DB has 3 new version rows with those dates.

### TC-3.3 — Import: only change Selling Price · P1
**Steps:**
```csv
,,,,FIRGI-S3-001,295000,130000,,,,2026-06-15
```
(Prime + Listing rows unchanged, only Selling has new value + effective date)

**Expected:** Summary `Updated: 1 · PrimeVersions: 0 · SellingVersions: 1 · ListingVersions: 0`. Only `sal_selling_price_versions` gets new row.

### TC-3.4 — Import: value changed but effective_from empty → use today · P1
**Steps:**
```csv
,,,,FIRGI-S3-001,295000,140000,150000,2026-05-21,,
```
(Selling value changed but col J empty)

**Expected:** Version row created with `effective_from = today`. Same for listing if applicable.

### TC-3.5 — Import: invalid date in J → row error, others continue · P1
**Steps:** Provide CSV with garbage `2026/13/40` in col J.
**Expected:** That row reported as Error. Other rows process normally.

---

## 4 · Negative / edge

### TC-4.1 — Future-dated >30 days rejected · P1
**Steps:** Try Add Selling version with `effective_from = today + 60 days`.
**Expected:** Error toast "effectiveFrom is more than 30 days in the future".

### TC-4.2 — Negative value rejected · P0
**Steps:** Try Add Listing version with value `-100`.
**Expected:** Error "must be >= 0".

### TC-4.3 — Duplicate (sku, date) per field rejected · P1
**Pre:** Selling version (sku, 2026-06-01) exists.
**Steps:** Try Add another Selling version (sku, 2026-06-01).
**Expected:** Error "A version with this effective date already exists for this SKU" (SAL-E0409).

### TC-4.4 — Per-field independence · P1
**Pre:** SKU has 3 Prime versions, 1 Selling, 1 Listing.
**Steps:** Add 1 Selling version.
**Expected:** Selling now has 2. Prime + Listing counts unchanged.

---

## 5 · NFR-08 compliance

### TC-5.1 — Finalized snapshot KHÔNG bị retro-recompute · P0
**Pre:** W18/2026 is Finalized. Snapshot stores Net GMV = X.
**Steps:**
1. Add Selling version effective_from = `2026-05-01` (before W18) with very different value
2. Open W18 report

**Expected:** Net GMV still = X (read from finalized snapshot, not live recompute). Only Draft periods get the new value when re-ingested.

---

## 6 · Sign-off

| Section | P0 | P0 pass | P1 | P1 pass | Tester | Date |
|---|---|---|---|---|---|---|
| Pre-test | 1 | / | 0 | / | | |
| Calculator | 3 | / | 0 | / | | |
| UI | 3 | / | 2 | / | | |
| CSV | 2 | / | 3 | / | | |
| Negative | 1 | / | 3 | / | | |
| NFR-08 | 1 | / | 0 | / | | |
| **TOTAL** | **11** | / | **8** | / | | |
