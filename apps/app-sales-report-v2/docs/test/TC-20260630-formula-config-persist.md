---
title: TC — Formula Config persistence (Phase 1 + 2)
description: Test cases cho REQ-20260630. Mỗi case map về FR/NFR và Phase trong PLAN.
load-when: Sau khi implement; verify trước khi viết TR.
status: ready
---

# TC-20260630 — Formula Config persistence

## 1. DB schema + migration (Phase 1.1-1.2)

| TC | Mục tiêu | Expected | FR |
|----|----------|----------|-----|
| TC-01 | Migration 0019 apply idempotent | `IF NOT EXISTS` skip re-run. `\d+ sal_formula_configs` shows table với index `idx_sal_ffc_ent_key_effective`. | FR-01 |
| TC-02 | Seed defaults inserted | `SELECT * FROM sal_formula_configs WHERE ffc_key = 'tiktok_platform_fee_rate_pct'` returns 2 rows (24% effective 2020-01-01 + 26% effective 2026-05-09), ent_id=NULL. | FR-04, NFR-04 |
| TC-03 | Drop table rollback works | DROP TABLE clean; app fallback đọc legacy `tiktokPlatformFeeRatePct` field. | NFR-06 |

## 2. Loader service (Phase 1.4)

| TC | Mục tiêu | Steps | Expected | FR |
|----|----------|-------|----------|-----|
| TC-10 | Load latest active rate at asOf | `loadFormulaConfig('ent-1', new Date('2026-06-01'))` | `tiktok_platform_fee_rate_pct.value = '26'` (the row effective 2026-05-09) | FR-03 |
| TC-11 | Older asOf gets older rate | `loadFormulaConfig('ent-1', new Date('2026-03-01'))` | `tiktok_platform_fee_rate_pct.value = '24'` | FR-03, NFR-02 |
| TC-12 | Per-entity overrides global default | Insert row ent_id='ent-1' value='30' effective 2026-06-15. Then `loadFormulaConfig('ent-1', new Date('2026-07-01'))` | Returns 30% (per-ent wins over global 26%) | NFR-03 |
| TC-13 | Falls back global when no per-ent | `loadFormulaConfig('ent-2', new Date('2026-07-01'))` (ent-2 has no override) | Returns 26% (global) | NFR-03 |
| TC-14 | Falls back registry default when DB empty | Delete all rows for key. Loader returns `registry.defaultValue` + console.warn | NFR-04 |
| TC-15 | Soft-deleted row ignored | Mark a row deleted_at; loader picks next-older row | FR-03 |

## 3. Server action — update + list versions (Phase 1.5)

| TC | Mục tiêu | Steps | Expected | FR/NFR |
|----|----------|-------|----------|--------|
| TC-20 | ADMIN updates rate | Login as ADMIN; call `updateFormulaConfigAction({key:'tiktok_platform_fee_rate_pct', value:'28', effectiveFrom:'2026-07-01', sourceNote:'TikTok July update'})` | INSERT new row; return `{ffcId, effectiveFrom}`. Log entry in sal_action_logs. | FR-02, FR-08 |
| TC-21 | OPERATOR forbidden | Same call as OPERATOR | `{success:false, error:{code:'SAL-E0403'}}` | NFR-01 |
| TC-22 | Invalid value type rejected | `updateFormulaConfigAction({key:'tiktok_platform_fee_rate_pct', value:'abc'})` | `{success:false, error:{code:'SAL-E0400', message:'expected numeric'}}` | NFR-05 |
| TC-23 | Unknown key rejected | `updateFormulaConfigAction({key:'not_in_registry', value:'10'})` | `{success:false, error:{code:'SAL-E0404', message:'unknown formula key'}}` | NFR-05 |
| TC-24 | Concurrent updates both persist | 2 admins call update simultaneously | Both rows inserted; latest by effective_from wins | FR-02 |
| TC-25 | List versions returns history | `listFormulaConfigVersionsAction({key, limit:10})` | Array sorted by effective_from DESC with created_by + source_note | FR-10 |

## 4. Ingest action refactor (Phase 1.7)

| TC | Mục tiêu | Steps | Expected | FR/NFR |
|----|----------|-------|----------|--------|
| TC-30 | Ingest period 2026-04-15 → 24% rate | Upload + ingest week W16 (period 2026-04-12 to 2026-04-18) | Snapshot.constants.formulaConfig.tiktok_platform_fee_rate_pct = '24'. CM compute uses 24%. | FR-09 |
| TC-31 | Ingest period 2026-06-01 → 26% rate | Same flow, period 2026-06-01 | snapshot.formulaConfig = '26'. CM uses 26%. | FR-09 |
| TC-32 | Old hardcoded `>= '2026-05-09'` logic removed | Search codebase | grep returns nothing for '2026-05-09' literal in ingest.actions.ts | FR-04 |
| TC-33 | Snapshot of old period (before feature) unchanged | Re-render Weekly Report cho period đã ingest pre-feature | Report numbers identical (uses legacy `tiktokPlatformFeeRatePct`) | NFR-02, NFR-06 |
| TC-34 | After rate change, ingest tương lai dùng rate mới; cũ giữ nguyên | Admin updates rate to 28% effective 2026-08-01. Ingest 2026-07-30 → 26%. Ingest 2026-08-05 → 28%. Re-render 2026-07-30 → still 26% (snapshot frozen). | NFR-02 |

## 5. UI — inline edit + Save (Phase 1.10-1.12)

| TC | Mục tiêu | Expected | FR |
|----|----------|----------|-----|
| TC-40 | ADMIN sees edit input | Row "Platform Fee Rate — TikTok" shows current value + ✏️ Edit button. | FR-05 |
| TC-41 | OPERATOR sees read-only | Same row shows value but no Edit button. "Read only" pill. | NFR-01 |
| TC-42 | Click Edit → input + date picker | Input number (placeholder 26) + effective-date picker (default = today) + Save/Cancel. | FR-06, FR-07 |
| TC-43 | Save valid value → toast + refresh | Enter 28, date 2026-07-01, Save. Toast "Saved — applies to ingests from 2026-07-01". Row shows 28% / Effective from 2026-07-01. | FR-05 |
| TC-44 | Save invalid → inline error | Enter "abc" → button disabled or red border. Submit → "Value must be numeric". | FR-06, NFR-05 |
| TC-45 | History drawer | Click "History" → drawer lists all versions DESC: 28% (2026-07-01) / 26% (2026-05-09) / 24% (2020-01-01) | FR-10 |
| TC-46 | History entry shows source note + created_by | Each row in history has source_note + admin user identifier | FR-08 |
| TC-47 | i18n EN + KO | Switch locale → all labels translate (button labels, validation msg, history headers) | — |

## 6. Phase 2 — categorical params

| TC | Mục tiêu | Expected | FR |
|----|----------|----------|-----|
| TC-50 | Registry-driven UI auto-renders new param | Add entry to registry.ts (e.g. `week_definition` enum). Refresh page → row appears with dropdown of `enumOptions`. | FR-05, FR-06 |
| TC-51 | Enum param validates | Save dropdown value → server checks ∈ enumOptions → INSERT row | NFR-05 |
| TC-52 | Numeric/percentage/currency/date type rendering | Each valueType renders correct input control (number / number-with-% / number-with-VND / date picker / dropdown) | FR-06 |

## 7. Backward compat + edge cases

| TC | Mục tiêu | Expected | NFR |
|----|----------|----------|-----|
| TC-60 | Old snapshot loaded — no `formulaConfig` block | Report renders với rate từ legacy `tiktokPlatformFeeRatePct` field. No crash. | NFR-06 |
| TC-61 | Snapshot saved AFTER feature — has both legacy + formulaConfig | Both fields present trong snapshot JSON. Loader prefer formulaConfig khi present. | NFR-06 |
| TC-62 | Admin set effective_from in past | Cho phép. Period future dùng new value. Period đã ingest unchanged. | NFR-02 |
| TC-63 | Multi-tenancy: ent-A edit không ảnh hưởng ent-B | Admin@A update value cho ent-A → ent-B snapshot vẫn dùng global default | NFR-03 |

## 8. Performance

| TC | Mục tiêu | Expected |
|----|----------|----------|
| TC-70 | Loader query single round-trip | 1 SQL with `DISTINCT ON (ffc_key)` or similar — < 50ms |
| TC-71 | Ingest action overhead | Adding loader call adds < 100ms to ingest time |

## 9. Pass criteria

- [ ] TC-01 → TC-03 (DB) PASS
- [ ] TC-10 → TC-15 (loader) PASS
- [ ] TC-20 → TC-25 (server action) PASS
- [ ] TC-30 → TC-34 (ingest refactor) PASS — đặc biệt TC-33 (no retro) + TC-34 (frozen snapshot)
- [ ] TC-40 → TC-47 (UI) PASS
- [ ] TC-50 → TC-52 (Phase 2 categorical) PASS
- [ ] TC-60 → TC-63 (backward compat + multi-tenancy) PASS
- [ ] typecheck clean
- [ ] Manual: Admin edit Platform Fee Rate → next ingest dùng giá trị mới → snapshot cũ không đổi
