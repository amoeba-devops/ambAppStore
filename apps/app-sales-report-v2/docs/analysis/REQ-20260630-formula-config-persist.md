---
title: REQ — Formula Config persistence (FR-23)
description: Admin có thể edit constants/params trong Formula Config UI; giá trị persist vào DB và drive calculator ở lần ingest tiếp theo. Snapshot cũ giữ historical rate (không retro).
load-when: Khi đụng Formula Config UI, calculator constants, hay bất kỳ rate-versioning nào trong app.
status: ready
---

# REQ-20260630 — Formula Config persistence (FR-23)

## 1. 요구사항 요약

| # | Yêu cầu | Loại |
|---|---------|------|
| FR-01 | DB table `sal_formula_configs` lưu params có version (effective_from, ent_id, deleted_at) — mirror `sal_fx_rates` pattern | DB |
| FR-02 | Server Action `updateFormulaConfigAction({ key, value, effectiveFrom, sourceNote })` — Admin-only, ghi 1 row mới (không update inline) | Backend |
| FR-03 | Loader `loadFormulaConfig(entId, asOf)` — trả map of latest active params at date `asOf` | Backend |
| FR-04 | Calculator + ingest action consume params từ loader (không hardcode) | Backend refactor |
| FR-05 | Formula Config UI: wire "Save" cho mỗi row editable → call server action; show success/error toast; auto-refresh value | Frontend |
| FR-06 | Per-row inline edit: numeric + percentage + date + enum (4 input types), validate trước khi save | Frontend |
| FR-07 | Effective-date picker: Admin chọn khi nào rate mới có hiệu lực (default = now) | Frontend |
| FR-08 | Audit trail: mỗi update ghi vào `sal_action_logs` (verb=`updated`, target=formula_config_key) | Audit |
| FR-09 | Snapshot.constants giữ rate value snapshot tại lúc ingest → historical reproducibility (FR-NFR-08 retro lock) | Backend |
| FR-10 | History view per param: show all versions (Admin có thể trace ai đổi gì khi nào) | Frontend |
| NFR-01 | Chỉ ADMIN role được edit; OPERATOR + MANAGER chỉ xem | Security |
| NFR-02 | Đổi rate KHÔNG retro vào snapshot đã ingest — chỉ apply cho ingest tương lai | Business |
| NFR-03 | Multi-tenancy: `ent_id` scope; `NULL = global default` (fallback khi chưa có per-ent override) | Architecture |
| NFR-04 | Default values seed migration — fallback nếu DB chưa có row | Backward compat |
| NFR-05 | Param types: `numeric` (HQ Margin %), `percentage` (Platform Fee Rate), `currency` (Fulfillment Fee VND), `date` (rate cutoff), `enum` (allocation rule). Schema lưu raw string + type discriminator, parser ép kiểu khi load. | Data integrity |
| NFR-06 | Old `period-snapshot.constants.tiktokPlatformFeeRatePct` field giữ nguyên cho backward compat — generic `constants: Record<string, number>` mới sống song song | Backward compat |

## 2. AS-IS 현황 분석

### 2.1 Formula Config UI (review-only)
- [formula-config-data.ts](apps/app-sales-report-v2/apps/web/src/lib/formula-config-data.ts) — hardcoded TS const, 7 sections, ~50 metrics
- [FormulaConfigClient.tsx:135-138](apps/app-sales-report-v2/apps/web/src/components/formula-config/FormulaConfigClient.tsx#L135-L138) — `onSave` callback flash "saved" 1.2s rồi mất, **không call server**
- Comment trong code thú nhận: `formula-config-data.ts:3` viết *"Mirrors what sal_formula_configs **will eventually** store (FR-23)"*

### 2.2 Editable constants thực sự (audit findings)

| # | Param | Current value | Type | Hiện consumed? | Source |
|---|-------|---------------|------|----------------|--------|
| 1 | TikTok Platform Fee Rate | 26% (24% pre-2026-05-09) | percentage | ✓ | [ingest.actions.ts:116](apps/app-sales-report-v2/apps/web/src/server/actions/ingest.actions.ts#L116) |
| 2 | TikTok Rate cutoff date | 2026-05-09 | date | ✓ | [ingest.actions.ts:116](apps/app-sales-report-v2/apps/web/src/server/actions/ingest.actions.ts#L116) |
| 3 | Default KRW per VND | 17.543 | numeric | ✓ (đã có DB) | `sal_fx_rates` table + [format.ts:75](apps/app-sales-report-v2/apps/web/src/lib/format.ts#L75) fallback |
| 4 | HQ Margin % | 5% | percentage | ❌ chỉ doc | [formula-config-data.ts:806](apps/app-sales-report-v2/apps/web/src/lib/formula-config-data.ts#L806) |
| 5 | VAT Rate | 10% | percentage | ❌ chỉ doc | [formula-config-data.ts:814](apps/app-sales-report-v2/apps/web/src/lib/formula-config-data.ts#L814) |
| 6 | Fulfillment Fee per unit | 14,000 VND | currency | ❌ chỉ doc | [formula-config-data.ts:822](apps/app-sales-report-v2/apps/web/src/lib/formula-config-data.ts#L822) |

### 2.3 Categorical settings (formula-config-mock.ts)

| # | Param | Current value | Type | Consumed? |
|---|-------|---------------|------|-----------|
| 7 | Excluded order statuses | "CANCELLED, RETURNED, REFUNDED" | enum-list | ✓ (hardcoded in parsers) |
| 8 | Free Gift detection | "product_name starts with '[GIFT]'" | string-pattern | ✓ (hardcoded) |
| 9 | Free Gift treatment | "Prime Cost counted, revenue excluded" | enum | ✓ (hardcoded) |
| 10 | Affiliate Booking Fee split | "Cross-platform by GMV contribution" | enum | ✓ (hardcoded) |
| 11 | Week definition | "Friday → Thursday" | enum | ✓ (hardcoded) |

### 2.4 Existing DB pattern (sal_fx_rates) — template để mirror

[packages/db/src/schema/fx-rates.schema.ts](apps/app-sales-report-v2/packages/db/src/schema/fx-rates.schema.ts) — đã ship pattern hoàn chỉnh:
- `fxr_id` PK, `ent_id` nullable (NULL = global default)
- `fxr_vnd_per_krw` NUMERIC value
- `fxr_effective_from` TIMESTAMPTZ — versioning
- `fxr_source_note` audit string
- `fxr_created_by` user attribution
- Index `(ent_id, fxr_effective_from DESC) WHERE deleted_at IS NULL`
- Loader: latest active row per entity, fallback global default

### 2.5 Snapshot constants block

[period-snapshot.service.ts:83-86](apps/app-sales-report-v2/apps/web/src/server/services/period-snapshot.service.ts) hiện chỉ có:
```ts
constants: {
  tiktokPlatformFeeRatePct: number;
}
```

→ Cần extend thành `Record<string, number | string>` cho generic.

## 3. TO-BE 요구사항

### 3.1 AS-IS → TO-BE Mapping

| Area | AS-IS | TO-BE |
|------|-------|-------|
| DB | `sal_fx_rates` only | + `sal_formula_configs` (generic, all params) |
| Loader | `fx-rate.service.ts::getCurrentFxRate` | + `formula-config.service.ts::loadFormulaConfig(entId, asOf)` |
| UI | Review-only, "Save" no-op | Inline edit + Save → persist; History view per param |
| Calculator | Hardcoded constants | Read from loader at ingest, snapshot constants |
| Snapshot | `constants.tiktokPlatformFeeRatePct` | `constants: Record<string, number | string>` (legacy field aliased for backward compat) |
| Server actions | (none) | `updateFormulaConfigAction({ key, value, effectiveFrom?, sourceNote? })` |
| Audit | (none) | Every update → `sal_action_logs` |

### 3.2 New DB schema

```sql
CREATE TABLE sal_formula_configs (
  ffc_id              CHAR(36)        PRIMARY KEY,
  ent_id              CHAR(36),                                  -- NULL = global default
  ffc_key             VARCHAR(64)     NOT NULL,                  -- e.g. 'tiktok_platform_fee_rate_pct'
  ffc_value           VARCHAR(255)    NOT NULL,                  -- raw value, parsed by type at load
  ffc_value_type      VARCHAR(16)     NOT NULL,                  -- 'numeric' | 'percentage' | 'currency' | 'date' | 'enum'
  ffc_unit            VARCHAR(16),                               -- e.g. '%', 'VND', 'KRW'
  ffc_effective_from  TIMESTAMP WITH TIME ZONE NOT NULL,
  ffc_source_note     VARCHAR(255),
  ffc_created_by      CHAR(36),
  ffc_created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ffc_deleted_at      TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_sal_ffc_ent_key_effective
  ON sal_formula_configs (ent_id, ffc_key, ffc_effective_from DESC)
  WHERE ffc_deleted_at IS NULL;
```

### 3.3 Param registry

`packages/shared/src/formula-config/registry.ts` (NEW):
```ts
export interface FormulaParamSpec {
  key: string;                 // 'tiktok_platform_fee_rate_pct'
  displayName: string;         // 'Platform Fee Rate — TikTok'
  valueType: 'numeric' | 'percentage' | 'currency' | 'date' | 'enum';
  unit?: string;
  enumOptions?: string[];      // when valueType='enum'
  defaultValue: string;        // fallback when DB has no row
  description: string;
}

export const FORMULA_PARAM_REGISTRY: Record<string, FormulaParamSpec>;
// Initially 5-12 entries; extensible later.
```

→ Source of truth cho mọi consumer. UI render param card từ registry, server validate updates against registry.

### 3.4 Server Action

```ts
// apps/web/src/server/actions/formula-config.actions.ts
'use server';
export async function updateFormulaConfigAction(input: {
  key: string;                   // must exist in registry
  value: string;                  // validated against registry.valueType
  effectiveFrom?: string;         // ISO date; default = NOW
  sourceNote?: string;            // optional audit message
}): Promise<ActionResult<{ ffcId: string; effectiveFrom: string }>>;

export async function listFormulaConfigVersionsAction(input: {
  key: string;
  limit?: number;
}): Promise<ActionResult<FormulaConfigVersion[]>>;
```

### 3.5 Loader service

```ts
// apps/web/src/server/services/formula-config.service.ts
export async function loadFormulaConfig(
  entId: string,
  asOf: Date,
): Promise<FormulaConfigSnapshot>;
// Returns: { [key: string]: { value, valueType, effectiveFrom } } for ALL keys in registry.
// For each key: latest row where ent_id IN (entId, NULL) AND effective_from <= asOf, deleted_at IS NULL.
// Per-entity row wins over NULL default. If neither exists → fall back to registry.defaultValue.
```

### 3.6 Calculator refactor (Phase 2)

Calculators stop reading hardcoded constants; accept `FormulaConfigSnapshot` arg.

```ts
// Before:
const tiktokRate = periodStartIso >= '2026-05-09' ? 26 : 24;

// After:
const cfg = await loadFormulaConfig(entId, new Date(periodStartIso));
const tiktokRate = Number(cfg['tiktok_platform_fee_rate_pct'].value);
```

### 3.7 UI changes

`FormulaConfigClient.tsx`:
- Each editable row: input (number/date/select per `valueType`) + effective-date picker + Save button
- On Save: call `updateFormulaConfigAction` → toast success → re-fetch via `router.refresh()`
- Each row has "History" link → opens drawer showing all versions of that key
- ADMIN-only edits; non-ADMIN sees disabled inputs + "Read only" pill

### 3.8 Snapshot schema extension

```ts
constants: {
  // legacy field — kept for backward compat with snapshots persisted before FR-23
  tiktokPlatformFeeRatePct: number;
  // generic bag — captures snapshot of FormulaConfigSnapshot at ingest time
  formulaConfig: Record<string, { value: string; valueType: string }>;
};
```

→ Historical snapshots remain readable: old `tiktokPlatformFeeRatePct` field preserved; new ingest writes both for transition period.

## 4. 갭 분석

### 4.1 변경 범위

| Area | Risk | Estimate |
|------|------|----------|
| DB schema + migration | Low — additive, mirror existing pattern | 1h |
| Param registry (shared) | Low — pure TS const | 1h |
| Loader service | Low — small service | 1.5h |
| Server actions (update + list versions) | Medium — needs auth + validation per type | 2h |
| Calculator refactor — wire to loader | **High** — touches `ingest.actions.ts`, `tiktok-metrics-calculator.service.ts`, `gmv-calculator.service.ts`, `snapshot-to-report.ts`. Snapshot constants schema extends | 4h |
| UI Formula Config inline edit | Medium — 5 different input types, validation | 4h |
| History drawer | Low | 1.5h |
| i18n keys | Low | 30 min |
| Migration + seed | Low | 1h |
| Tests + manual verify | Medium | 2h |
| Docs (REQ/PLAN/TC/TR/RPT) | Low | 2h |

**Total: ~21h** (≈3 days work).

### 4.2 File 변경 목록

| 구분 | File | 신규/수정 |
|------|------|-----------|
| DB schema | `packages/db/src/schema/formula-configs.schema.ts` | 신규 |
| DB migration | `packages/db/migrations/00XX_formula_configs.sql` + apply script | 신규 |
| Shared types | `packages/shared/src/formula-config/registry.ts` | 신규 |
| Backend service | `apps/web/src/server/services/formula-config.service.ts` | 신규 |
| Backend action | `apps/web/src/server/actions/formula-config.actions.ts` | 신규 |
| Backend refactor | `apps/web/src/server/actions/ingest.actions.ts` | 수정 (load config) |
| Backend refactor | `apps/web/src/server/services/tiktok-metrics-calculator.service.ts` | 수정 (accept cfg) |
| Backend refactor | `apps/web/src/server/services/gmv-calculator.service.ts` | 수정 (accept cfg, nếu cần) |
| Backend refactor | `apps/web/src/lib/snapshot-to-report.ts` | 수정 (đọc cfg từ snapshot) |
| Snapshot type | `apps/web/src/server/services/period-snapshot.service.ts` | 수정 (extend constants) |
| Frontend | `apps/web/src/components/formula-config/FormulaConfigClient.tsx` | 수정 (wire Save) |
| Frontend | `apps/web/src/components/formula-config/FormulaParamRow.tsx` | 신규 |
| Frontend | `apps/web/src/components/formula-config/FormulaParamHistoryDrawer.tsx` | 신규 |
| i18n | `apps/web/messages/{en,ko}.json` | 수정 |
| Docs | REQ/PLAN/TC (this batch) + TR/RPT (sau impl) | 신규 |

### 4.3 DB migration

```sql
-- 00XX_formula_configs.sql
CREATE TABLE IF NOT EXISTS sal_formula_configs ( ... );
CREATE INDEX IF NOT EXISTS idx_sal_ffc_ent_key_effective ON sal_formula_configs (...);

-- Seed defaults (ent_id NULL = global)
INSERT INTO sal_formula_configs (ffc_id, ent_id, ffc_key, ffc_value, ffc_value_type, ffc_unit, ffc_effective_from, ffc_source_note)
VALUES
  (uuid_v4(), NULL, 'tiktok_platform_fee_rate_pct', '24', 'percentage', '%', '2020-01-01', 'Default pre-2026-05-09 rate'),
  (uuid_v4(), NULL, 'tiktok_platform_fee_rate_pct', '26', 'percentage', '%', '2026-05-09', 'TikTok policy update'),
  (uuid_v4(), NULL, 'hq_margin_pct', '5', 'percentage', '%', '2020-01-01', 'Default HQ margin'),
  (uuid_v4(), NULL, 'vat_rate_pct', '10', 'percentage', '%', '2020-01-01', 'Default VAT'),
  (uuid_v4(), NULL, 'fulfillment_fee_vnd', '14000', 'currency', 'VND', '2020-01-01', 'Default fulfillment fee per unit')
;
```

Migration được apply qua existing `apply-pending-migrations.mjs` script (range filter ≥ 9 đã cover).

## 5. 사용자 플로우

### 5.1 Admin edit Platform Fee Rate

```
Admin
  └─→ /settings/formula-config
        └─→ Row "Platform Fee Rate — TikTok" shows current 26%, effective from 2026-05-09
        └─→ Click ✏️ Edit → input number + effective-date picker
        └─→ Set 28% effective 2026-07-01
        └─→ Click Save
        └─→ Server Action: updateFormulaConfigAction
              ├─ requireRole(ADMIN)
              ├─ Validate value against registry.valueType
              ├─ INSERT new row (không UPDATE existing — versioning)
              └─ Log to sal_action_logs
        └─→ Toast "Saved — applies to ingests from 2026-07-01"
        └─→ Row refreshes; History drawer now lists 3 versions (24% / 26% / 28%)
```

### 5.2 Ingest sau khi rate đổi

```
Operator ingests for period 2026-07-04 (after new rate effective)
  └─→ commitIngestAction
        ├─ Load formula config at period start: loadFormulaConfig(entId, periodStart)
        │     → tiktok_platform_fee_rate_pct = 28%
        ├─ Calculator dùng 28%
        └─ Snapshot.constants.formulaConfig captures {tiktok_platform_fee_rate_pct: '28', ...}
  └─→ Report rendered: TikTok Platform Fee tính với 28%
```

### 5.3 Re-render old snapshot

```
View Weekly Report for W18 (period 2026-04-30 — before new rate)
  └─→ Snapshot loaded
  └─→ Report uses snapshot.constants.formulaConfig.tiktok_platform_fee_rate_pct = 24%
        (snapshot frozen — historical numbers don't change)
```

### 5.4 Edge cases

| Case | Behavior |
|------|----------|
| Param không có trong DB | Fallback registry.defaultValue + warning console |
| Admin set effective_from trong quá khứ | Cho phép (Admin có quyền), nhưng KHÔNG retro snapshot cũ. Period tương lai dùng giá trị mới. |
| 2 admin edit cùng lúc | INSERT (không UPDATE) → cả 2 version đều lưu, latest wins |
| Soft-delete | Bỏ qua row, fallback row cũ hơn hoặc default |
| Per-entity vs global | Per-entity wins. NULL ent_id = fallback default. |
| Invalid value type (vd Admin nhập "abc" cho numeric) | Server validation throw `SAL-E0400` |

## 6. 기술 제약사항

| Mục | Ràng buộc |
|-----|-----------|
| Multi-tenancy | `ent_id` scope mọi query; NULL = global default. Per-ent override khi cần. |
| Audit | NFR-13 (sal_action_logs append-only) — mỗi update ghi log. |
| Historical lock | NFR-08 — đổi config KHÔNG affect snapshot đã ingest. New ingest dùng config mới. |
| Performance | Loader chạy 1 lần / ingest (cheap). Cache trong-request scope. |
| Type safety | Registry là source of truth. Loader trả typed wrapper. Calculator cast theo `valueType`. |
| Backward compat | Old snapshots không có `formulaConfig` block → reader fallback đọc legacy `tiktokPlatformFeeRatePct` field. |
| Default values | Migration seed defaults cho mọi registry key. Loader fallback nếu missing. |
| i18n | EN + KO labels cho mỗi registry key + valueType labels. |
| Phase scope | Phase 1: 6 numeric/percentage/currency/date params. Phase 2 (sau): categorical/enum params + formula text editing (nếu cần). |

## 7. Phase plan

### Phase 1 — Numeric + date params (MVP, all 6 audit params)
- TikTok Platform Fee Rate (%)
- TikTok Rate cutoff date (currently hardcoded 2026-05-09 — biến thành param trên Platform Fee record)
- KRW/VND default rate (consolidate với existing sal_fx_rates? Hoặc giữ riêng)
- HQ Margin % (wire vào calculator if user wants — currently not consumed)
- VAT Rate %
- Fulfillment Fee VND per unit

### Phase 2 — Categorical/enum (Stretch)
- Excluded order statuses
- Free Gift detection pattern
- Allocation rules
- Week definition

### Phase 3 — Formula text (defer)
- Edit raw formula text. Cần parser + validator. Out of scope cho MVP.

## 8. 참조

- [SRD §FR-23](apps/app-sales-report-v2/docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md) — "48 formula parameters Admin configurable"
- [CLAUDE.md §9](apps/app-sales-report-v2/CLAUDE.md) — "❌ Hard-code 48 formula params — phải đọc từ sal_formula_configs"
- [sal_fx_rates pattern](apps/app-sales-report-v2/packages/db/src/schema/fx-rates.schema.ts) — template to mirror
- [Audit results](#) — 5 numeric + 7 categorical thực sự active. Discrepancy với "48 params" claim của SRD đã document trong §2.
