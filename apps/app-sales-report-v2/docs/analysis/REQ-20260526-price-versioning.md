# REQ-20260526 — Selling Price + Listing Price Versioning (Phase 1.2)

> **Status:** Draft v1
> **Author:** Truc Hoang (with Claude)
> **Date:** 2026-05-26
> **Scope:** Extend per-effective-date versioning from Prime Cost only to **3 independent tables** — one per price field. Mirrors the existing [Prime Cost Versioning Phase 1](REQ-20260521-prime-cost-versioning.md) pattern.

---

## 1 · Requirement summary

| # | Requirement | Type |
|---|---|---|
| R1 | Selling Price thay đổi theo giai đoạn (promo, price hike) phải được version để KHÔNG retro-affect Shopee Net GMV cũ | New |
| R2 | Listing Price thay đổi theo giai đoạn phải được version để KHÔNG retro-affect TikTok GMV cũ | New |
| R3 | Mỗi field có CRUD version độc lập (Selling không phải đổi cùng lúc với Prime Cost hay Listing) | Functional |
| R4 | Calculator phải lookup version active tại order date cho **mỗi** field độc lập (3 lookup riêng) | Functional |
| R5 | UI: 1 button "Versions" mở modal có **3 tabs** (Prime / Selling / Listing) — tránh clutter | UX |
| R6 | CSV import: thêm 2 cột Effective From cho Selling + Listing (optional) | Data flow |
| R7 | i18n đầy đủ (en/ko) | NFR |
| R8 | NFR-08: Finalized reports KHÔNG bị retro-recompute | Compliance |

---

## 2 · AS-IS analysis

### 2.1 Cách selling/listing đang được dùng

| File | Sử dụng |
|---|---|
| [apps/web/src/server/services/gmv-calculator.service.ts:399-403](../../apps/web/src/server/services/gmv-calculator.service.ts) | `sellingPrice = master?.sellingPrice ?? 0; netGmvRow = sellingPrice * itemSold` (Shopee Net GMV) |
| [apps/web/src/server/services/tiktok-metrics-calculator.service.ts:227-231](../../apps/web/src/server/services/tiktok-metrics-calculator.service.ts) | `listingPrice = master?.listingPrice ?? 0; gmv = listingPrice * itemSold` (TikTok GMV) |
| [apps/web/src/server/services/prime-cost-master.service.ts:28-29,78-79](../../apps/web/src/server/services/prime-cost-master.service.ts) | Loader đọc `sellingPrice` + `listingPrice` từ flat field — luôn dùng giá hiện tại |

### 2.2 Schema hiện tại

```sql
sal_prime_costs
  pcs_selling_price_vnd NUMERIC(18,2)  -- ← flat, không version
  pcs_listing_price_vnd NUMERIC(18,2)  -- ← flat, không version
```

### 2.3 Vấn đề

- Khi admin update `Selling Price` từ 100k → 120k cho 1 SKU, **tất cả** Net GMV history của SKU đó tự động đổi → vi phạm NFR-08
- Tương tự với `Listing Price` cho TikTok
- Phase 1 (Prime Cost) đã giải quyết bằng `sal_prime_cost_versions` — nhưng selling/listing vẫn chưa

---

## 3 · TO-BE design

### 3.1 Schema — 2 bảng mới (mirror `sal_prime_cost_versions`)

```sql
sal_selling_price_versions      -- 0009_selling_price_versions.sql
  spv_id              CHAR(36) PRIMARY KEY
  ent_id              CHAR(36) NOT NULL
  pcs_id              CHAR(36) NOT NULL  REFERENCES sal_prime_costs(pcs_id) ON DELETE CASCADE
  spv_effective_from  DATE NOT NULL
  spv_selling_price_vnd NUMERIC(18,2) NOT NULL  CHECK (>= 0)
  spv_source_note     VARCHAR(255)
  spv_created_by      CHAR(36) NOT NULL
  spv_created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
  spv_updated_at      TIMESTAMPTZ
  spv_deleted_at      TIMESTAMPTZ

  UNIQUE (ent_id, pcs_id, spv_effective_from) WHERE spv_deleted_at IS NULL
  INDEX  (ent_id, pcs_id, spv_effective_from)
  INDEX  (ent_id, spv_effective_from)

sal_listing_price_versions      -- 0010_listing_price_versions.sql
  lpv_id              CHAR(36) PRIMARY KEY
  ...                                  (identical shape)
  lpv_listing_price_vnd NUMERIC(18,2) NOT NULL
```

**Differences vs `sal_prime_cost_versions`:**
- KHÔNG có `breakdown` jsonb (selling/listing không có sub-components như prime cost)
- Còn lại y hệt shape

### 3.2 Backfill (in same migration)

```sql
-- Cho mỗi SKU có pcs_selling_price_vnd NOT NULL, insert 1 row sentinel
INSERT INTO sal_selling_price_versions (..., spv_effective_from, spv_selling_price_vnd, ...)
SELECT ..., DATE '2020-01-01', pc.pcs_selling_price_vnd, ...
FROM sal_prime_costs pc
WHERE pc.pcs_deleted_at IS NULL
  AND pc.pcs_selling_price_vnd IS NOT NULL
  AND NOT EXISTS (... idempotent guard ...)
```

Tương tự cho listing.

### 3.3 Calculator changes

Add helpers tương tự `findPrimeCost`:

```ts
findSellingPrice(master, orderDate): number  // scans master.sellingVersions DESC
findListingPrice(master, orderDate): number  // scans master.listingVersions DESC
```

Calculator update:
```ts
// Shopee (gmv-calculator.service.ts:399)
const sellingPrice = findSellingPrice(master, row.orderDate);

// TikTok (tiktok-metrics-calculator.service.ts:227)
const listingPrice = findListingPrice(master, row.orderDate);
```

### 3.4 Master loader changes

`prime-cost-master.service.ts`:
- Thêm 2 queries → load `sal_selling_price_versions` + `sal_listing_price_versions`
- Build 2 maps `sellingVersionsByPcsId` + `listingVersionsByPcsId`
- Extend `PrimeCostMaster` type:
  ```ts
  interface PrimeCostMaster {
    primeCost: number;       // ← latest effective from versions[0]
    sellingPrice: number;    // ← latest effective from sellingVersions[0] (NEW semantics)
    listingPrice: number;    // ← latest effective from listingVersions[0] (NEW semantics)
    versions: PrimeCostVersion[];
    sellingVersions: PriceVersion[];      // NEW
    listingVersions: PriceVersion[];      // NEW
    productNameEn: string;
  }
  ```

### 3.5 UI — 1 modal, 3 tabs

`VersionHistoryModal.tsx` → tabbed:

```
┌─────────────────────────────────────────────────┐
│  Versions — FIRGI-S3-001                    [X] │
├─────────────────────────────────────────────────┤
│ [Prime Cost (3)] [Selling (2)] [Listing (1)]    │
├─────────────────────────────────────────────────┤
│  Effective From │ VND      │ KRW    │ Note │ … │
│  2026-05-21 ★Latest │ 295k │ 16.8k  │ ...  │ ❌ │
│  2026-04-15         │ 280k │ 16.0k  │ ...  │ ❌ │
│                                                  │
│                                  [+ Add version] │
└─────────────────────────────────────────────────┘
```

- Click tab → switch context. Mỗi tab có riêng "Add version" button (tab-specific form).
- Tab count badge hiển thị số version active.
- Prime tab giữ breakdown (cogs/logistic/...). Selling + Listing tabs CHỈ có effective_from + value + note.

### 3.6 PrimeCostTable changes

Thay vì 1 cột "Effective From" (hiện chỉ cho Prime), thay bằng 3 cột compact:

| Pcost Eff | Sell Eff | List Eff |
|---|---|---|
| 2026-05-21 (3) | 2026-04-15 (2) | 2026-03-01 (1) |

Mỗi số trong ngoặc = `versions.length`. Click vào cell mở modal ngay tab tương ứng.

### 3.7 CSV import format

Extend hiện tại:
| Col | Header | Type | Note |
|---|---|---|---|
| A | Product ID | optional | |
| B | Variation ID | optional | |
| C | Product VI | optional | |
| D | Product EN | optional | |
| E | SKU | **required** | |
| F | Prime Cost | required | |
| G | Selling Price | optional | |
| H | Listing Price | optional | |
| I | Effective From — Prime | optional | If empty → use today only when Prime Cost changed vs DB |
| J | **Effective From — Selling** | optional **NEW** | Same logic for Selling |
| K | **Effective From — Listing** | optional **NEW** | Same logic for Listing |

**Rule:** Một row CSV có thể tạo version cho 1, 2, hoặc 3 field tùy theo column nào có giá trị + effective_from. Nếu Effective From rỗng nhưng giá trị thay đổi → effective_from = today.

### 3.8 Action layer

3 service modules + actions tương ứng (mirror `prime-cost-version.service.ts`):

| Service | Actions |
|---|---|
| `selling-price-version.service.ts` | `addSellingPriceVersion`, `softDeleteSellingPriceVersion`, `listVersionsForSku` |
| `listing-price-version.service.ts` | `addListingPriceVersion`, `softDeleteListingPriceVersion`, `listVersionsForSku` |

Wrap thành actions:
- `addSellingPriceVersionAction`, `listSellingPriceVersionsAction`, `softDeleteSellingPriceVersionAction`
- (tương tự cho listing)

---

## 4 · Gap analysis

| Area | Now | Change | Impact |
|---|---|---|---|
| DB | 1 bảng `sal_prime_cost_versions` | +2 bảng | 2 migrations |
| Drizzle schema | 1 file | +2 files | low |
| Service | 1 version service | +2 version services | mirror pattern |
| Action | 3 prime cost version actions | +6 actions (3 per price field) | additive only |
| Master loader | 1 versions array | +2 arrays | breaking change in `PrimeCostMaster` type — adjust all consumers |
| Calculator | `findPrimeCost` | +`findSellingPrice` + `findListingPrice` | additive |
| UI modal | Single-pane | Tabbed 3-pane | refactor `VersionHistoryModal.tsx` |
| Main table | 1 Effective From col | 3 compact Effective cols | layout adjust |
| CSV | 9 cols | 11 cols (J + K) | parser update |
| i18n | `primeCost.version.*` | +`sellingPrice.version.*`, `listingPrice.version.*` keys | both locales |

### 4.1 File change list

| Layer | File | Change |
|---|---|---|
| DB | `packages/db/migrations/0009_selling_price_versions.sql` | NEW |
| DB | `packages/db/migrations/0010_listing_price_versions.sql` | NEW |
| Schema | `packages/db/src/schema/selling-price-versions.schema.ts` | NEW |
| Schema | `packages/db/src/schema/listing-price-versions.schema.ts` | NEW |
| Schema | `packages/db/src/schema/index.ts` | MODIFY (re-export) |
| Service | `apps/web/src/server/services/selling-price-version.service.ts` | NEW |
| Service | `apps/web/src/server/services/listing-price-version.service.ts` | NEW |
| Service | `apps/web/src/server/services/prime-cost-master.service.ts` | MODIFY (load 2 more version arrays) |
| Service | `apps/web/src/server/services/gmv-calculator.service.ts` | MODIFY (+`findSellingPrice`, `findListingPrice`, update Shopee row loop) |
| Service | `apps/web/src/server/services/tiktok-metrics-calculator.service.ts` | MODIFY (use `findListingPrice`) |
| Action | `apps/web/src/server/actions/prime-cost.actions.ts` | MODIFY (+6 actions, CSV import extension) |
| UI | `apps/web/src/components/prime-cost/VersionHistoryModal.tsx` | MAJOR REFACTOR (tabbed) |
| UI | `apps/web/src/components/prime-cost/PrimeCostTable.tsx` | MODIFY (3 effective cols + tab-deep-link) |
| i18n | `apps/web/messages/en.json` + `ko.json` | MODIFY (+~20 keys) |
| Docs | `docs/test/TC-20260526-price-versioning.md` | NEW |
| Docs | `docs/implementation/RPT-20260526-price-versioning.md` | NEW |
| Regression | `docs/test/TC-20260522-staging-full-regression.md` | MODIFY (extend §7 prime cost) |

**Total estimate**: ~15 files changed, ~700 LOC.

### 4.2 DB migration order

Migrations applied in sequence (production):
1. `0009_selling_price_versions.sql` (CREATE TABLE + backfill)
2. `0010_listing_price_versions.sql` (CREATE TABLE + backfill)

Idempotent (`IF NOT EXISTS`, `NOT EXISTS` guards). Re-runnable safely.

---

## 5 · User flow

### 5.1 Admin tăng giá bán 1 SKU từ 100k → 120k bắt đầu 2026-06-01

1. Vào RFR Data → tìm SKU
2. Click "Versions" → modal mở tab "Prime Cost" (mặc định)
3. Click tab **"Selling"** → thấy 1 version cũ (2020-01-01, 100k)
4. Click "+ Add new version" trong tab Selling
5. Form: Effective From = `2026-06-01`, Value = `120000`, Note = "Q3 price adjustment"
6. Save → version mới xuất hiện DESC ở top
7. Master cache `pcs_selling_price_vnd` auto-update thành 120k (vì là latest)
8. Order ngày 2026-05-30 vẫn dùng 100k (version cũ), order ngày 2026-06-01 trở đi dùng 120k

### 5.2 Calculator lookup logic

Order với `orderDate = 2026-06-15`:
```
findSellingPrice(master, '2026-06-15'):
  sellingVersions DESC = [
    { effectiveFrom: '2026-06-01', value: 120000 },  ← scan: 2026-06-01 <= 2026-06-15 ✓ return 120000
    { effectiveFrom: '2020-01-01', value: 100000 },
  ]
```

### 5.3 CSV import 1 SKU, 1 row, đổi cả 3 field

```csv
,,,,FIRGI-S3-001,295000,120000,150000,2026-05-21,2026-06-01,2026-06-01
                   prime   sell   list    eff-prime   eff-sell    eff-list
```

→ Tạo 3 version rows (1 per table). Import summary: `Inserted 0 · Updated 1 · PrimeVersions 1 · SellingVersions 1 · ListingVersions 1 · Errors 0`.

---

## 6 · Technical constraints

- **NFR-08**: Finalized reports không retro-recompute — đã được Phase 1 architecture đảm bảo (snapshot store)
- **Multi-tenancy**: 2 bảng mới phải có `ent_id` + indexes prefix bằng `ent_id`
- **Idempotency**: Migrations re-runnable. Backfill skips existing versions.
- **Performance**: Master loader giờ chạy 3 queries (master + 3 version tables). Cho 200 SKUs × 5 versions/SKU mỗi loại = ~3000 rows total → vẫn fast với indexes. Nếu chậm sau này → consider materialized view.
- **Backward compat**: `PrimeCostMaster.sellingPrice` field giữ semantics "latest effective" (giống `primeCost`). Consumers chỉ display (UI cards) không bị ảnh hưởng.

---

## 7 · Out of scope (Phase 2+)

- Channel-specific Selling Price (Shopee selling khác TikTok listing đã tách → OK; nhưng nếu cần khác giá theo channel khác platform, defer)
- Promotional period auto-detection từ Shopee voucher campaign
- Bulk update via Effective From range (vd "all SKUs in category X tăng 10% từ ngày Y") — Phase 2
- Version diff visualization (vd plot price line over time chart)
- Cross-version analytics (vd "doanh thu giai đoạn promo vs giai đoạn thường")
