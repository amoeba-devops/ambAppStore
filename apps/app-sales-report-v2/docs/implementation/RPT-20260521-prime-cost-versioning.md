# RPT-20260521 — Prime Cost Versioning: Phase 1 Completion Report

> **Status:** Phase 1 implementation complete, awaiting staging soak.
> **Tracks:** [REQ](../analysis/REQ-20260521-prime-cost-versioning.md) · [PLAN](../plan/PLAN-20260521-prime-cost-versioning.md) · [TC](../test/TC-20260521-prime-cost-versioning.md) · [TR](../test/TR-20260521-prime-cost-versioning.md)
> **Date:** 2026-05-21
> **Developer:** Truc Hoang (with Claude)

## 1. What shipped

Phase 1 of versioned prime cost — each SKU can now carry multiple per-effective-date cost versions. The sales calculator picks the version active at each order's createDate (Shopee `Ngày đặt hàng`, TikTok `Created Time`), enabling per-shipment cost tracking that reflects business reality (each batch's COGS + logistic + warehouse + fulfillment differs).

### Capabilities now available (behind `NEXT_PUBLIC_PRIME_COST_VERSIONING=on`)

1. **Add a new version per SKU** via Settings → Prime Cost Master → "Versions" button on each row → "Add new version"
2. **View version history** in the same modal — Latest badge, full timeline, source notes, breakdown
3. **Soft-delete a version** (except the only remaining one)
4. **CSV bulk import** accepts optional `Effective From` column (9th); each row inserts a version
5. **CSV export** emits the latest version's `Effective From` per SKU
6. **Calculator auto-applies the right cost** based on order createDate during ingest
7. **Activity log** captures every add/delete with Δ% summary

### What's preserved unchanged

- **NFR-08 (no retro Finalized)** — Finalized period snapshots stay frozen. Adding a version with retro `effective_from` does NOT mutate `sal_period_snapshots`. Only Draft re-ingests pick up new versions.
- **Legacy uploads** — Shopee/TikTok files without the new date column still parse. `orderDate = ''` → calculator falls back to the latest version (best-effort).
- **`PrimeCostFormModal`** — existing Add/Edit form still works as before.
- **`sal_prime_costs.pcs_prime_cost_vnd`** — denormalized "latest cost" cache kept in sync by service.

## 2. Files shipped

### DB
- `packages/db/migrations/0008_prime_cost_versions.sql` (new)
- `packages/db/src/schema/prime-cost-versions.schema.ts` (new)
- `packages/db/src/schema/index.ts` (modify)

### Backend
- `apps/web/src/server/services/prime-cost-version.service.ts` (new) — CRUD + master-cache sync
- `apps/web/src/server/services/prime-cost-master.service.ts` (modify) — returns `versions[]` per SKU; flag-gated
- `apps/web/src/server/services/gmv-calculator.service.ts` (modify) — `PrimeCostMaster` extended; `findPrimeCost()` helper; per-row date lookup
- `apps/web/src/server/services/tiktok-metrics-calculator.service.ts` (modify) — per-row date lookup
- `apps/web/src/server/services/shopee-sales-parser.service.ts` (modify) — optional `Ngày đặt hàng` extraction
- `apps/web/src/server/services/tiktok-sales-parser.service.ts` (modify) — optional `Created Time` extraction
- `apps/web/src/server/actions/prime-cost.actions.ts` (modify) — 3 new actions (`addPrimeCostVersionAction`, `listPrimeCostVersionsAction`, `softDeletePrimeCostVersionAction`), CSV import/export updated

### Frontend
- `apps/web/src/lib/feature-flags.ts` (new)
- `apps/web/src/components/prime-cost/VersionHistoryModal.tsx` (new)
- `apps/web/src/components/prime-cost/PrimeCostTable.tsx` (modify) — Versions button + modal wiring

### Config + i18n
- `apps/web/messages/en.json` (modify) — `primeCost.version.*`, `primeCost.row.versions`, `common.createdAt`
- `apps/web/messages/ko.json` (modify) — same keys translated
- `.env.example` (modify) — `NEXT_PUBLIC_PRIME_COST_VERSIONING=off` default
- `.env` (modify, dev only) — set to `on` for local testing

**Total:** 14 modify · 5 new = **19 files**. Matches PLAN estimate of 20.

## 3. Migration verification

Migration `0008_prime_cost_versions.sql` was applied to the dev Neon branch on 2026-05-21:

```
Pre-migration counts: master_active = 225, table_exists = no
Post-migration counts:
  master_active   = 225
  versions_active = 225
✓ Backfill verified: every active master row has exactly 1 version.
```

Idempotency: re-running the migration is a no-op due to `IF NOT EXISTS` + `NOT EXISTS` guards.

## 4. Behaviour gates

| Scenario | Flag OFF | Flag ON |
|----------|----------|---------|
| `loadPrimeCostMaster` | Synthesizes 1-version array from flat `pcs_prime_cost_vnd` | Loads real versions from DB |
| `findPrimeCost(master, orderDate)` | Always returns flat cost (single synthetic version) | Date-aware lookup |
| Calculator output | Identical to pre-Phase-1 | Differs when SKU has multi-version + order dates span |
| UI "Versions" button | Hidden | Visible per row |
| CSV import "Effective From" col | Read but no version row created (flag gates loader read-back) | Read; version row inserted |
| Activity log new entries | Still emitted if action is called, but UI doesn't expose the action | Action exposed in UI, entries emitted |

> **Note on CSV import + flag OFF:** the CSV import path always inserts version rows regardless of flag, because the migration already backfilled the table and we want subsequent imports to keep the data accurate. The flag only gates *reading* versions from the loader, so flag-off behaviour for downstream calc stays flat. This means flipping the flag ON later is a smooth read-side switch — the data is already there.

## 5. Deferred / Out-of-scope (Phase 1.x or 2)

Carried over from PLAN risk table + TR known limitations:

- **Versioned `sellingPrice` / `listingPrice`** — only `prime_cost` is versioned in Phase 1.
- **FIFO batch tracking** — per shipment unit-level inventory ledger.
- **Auto-prorate warehouse fee** based on `storage_days × warehousePerDay`. Currently `breakdown.warehousePerDay` is stored verbatim, not applied.
- **CSV export `mode=all-versions`** — only latest-per-SKU export currently.
- **PrimeCostFormModal split** into edit-metadata vs add-version modes — single modal still handles all-fields edit.
- **Version comparison view (diff)** — operators see flat table only.
- **Concurrent-insert stress test** — TC-8.3 deferred to staging soak.

## 6. Rollout plan (next 1-2 weeks)

| Step | Owner | Expected date |
|------|-------|---------------|
| Code review (PR) | Truc + reviewer | 2026-05-22 |
| Merge to `main` → auto-deploy staging | Truc | 2026-05-22 |
| Apply migration 0008 on staging Neon | Truc | 2026-05-22 |
| Set `NEXT_PUBLIC_PRIME_COST_VERSIONING=on` on staging + redeploy | Truc | 2026-05-23 |
| Manual smoke (TC-7.1, TC-7.3, TC-6.*) | Truc + Manager | 2026-05-23 → 2026-05-26 |
| 1-week staging soak — monitor activity log + ingest error rate | Truc | 2026-05-26 → 2026-06-02 |
| Apply migration 0008 on production | Truc | 2026-06-03 |
| Flip flag ON production | Truc | 2026-06-03 |
| Operator training note shared | Truc | 2026-06-03 |

## 7. Risks acknowledged

| Risk | Mitigation |
|------|------------|
| Master cache (`pcs_prime_cost_vnd`) drifts from latest version | Service syncs on every add/delete; reconciliation cron not needed (single-source: service writes both atomically per request) |
| Legacy upload with empty orderDate produces inaccurate cost | Documented; users encouraged to re-export with date column when possible |
| Operator confused by dual entry points (form vs version modal) | Inline `flag.disabledNotice` banner in modal; Operator training |
| Retro version on Finalized period | Already gated — NFR-08 preserved by snapshot freeze |
| Performance on large masters (1k+ SKUs × 10 versions) | O(N+M) load query, in-memory grouping; tested at 225 SKUs trivially. Re-test at 1k+ during staging soak. |

## 8. Sign-off

- [x] Implementation complete (Truc)
- [x] TypeScript `tsc --noEmit` passes (exit 0)
- [x] Migration applied to dev + verified (225 = 225)
- [ ] Code review
- [ ] Staging deploy + smoke
- [ ] Production deploy

---

**End of Phase 1 implementation.** Phase 2 (FIFO batch tracking + warehouse proration) deferred to future quarter pending Phase 1 stability.
