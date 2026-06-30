---
title: PLAN — Formula Config persistence (Phase 1 + 2)
description: Implementation plan cho REQ-20260630. Scope: numeric/date params + categorical/enum. Phase 3 (formula text engine) defer riêng.
load-when: Khi implement FR-23, tra side-impact trước khi sửa calculator hoặc Formula Config UI.
status: ready
---

# PLAN-20260630 — Formula Config persistence (Phase 1 + 2)

## 1. 시스템 개발 현황 분석

### 1.1 디렉토리 구조 (target)

```
apps/app-sales-report-v2/
├── apps/web/src/
│   ├── components/formula-config/
│   │   ├── FormulaConfigClient.tsx          ← MODIFY (wire Save + History)
│   │   ├── FormulaParamRow.tsx              ← NEW (per-param inline edit)
│   │   ├── FormulaParamHistoryDrawer.tsx    ← NEW (version list)
│   │   └── DataSourceMultiSelect.tsx
│   ├── server/
│   │   ├── actions/
│   │   │   ├── formula-config.actions.ts    ← NEW
│   │   │   └── ingest.actions.ts            ← MODIFY (use loader)
│   │   └── services/
│   │       ├── formula-config.service.ts    ← NEW (loader)
│   │       ├── tiktok-metrics-calculator.service.ts  ← MODIFY (accept cfg)
│   │       └── period-snapshot.service.ts   ← MODIFY (extend constants)
│   ├── lib/
│   │   ├── snapshot-to-report.ts            ← MODIFY (read cfg)
│   │   └── formula-config-data.ts           ← MODIFY (mark deprecated where applicable)
│   └── messages/{en,ko}.json                ← MODIFY (i18n keys mới)
├── packages/
│   ├── db/
│   │   ├── src/schema/formula-configs.schema.ts  ← NEW
│   │   └── migrations/0019_formula_configs.sql   ← NEW
│   └── shared/src/formula-config/
│       └── registry.ts                       ← NEW (param spec registry)
└── docs/{analysis,plan,test}/ (current batch)
```

### 1.2 제약사항
- Reuse `sal_fx_rates` pattern (đã proven) — không tự design lại versioning logic
- Backward compat: old snapshots không có `constants.formulaConfig` → loader fallback đọc legacy `tiktokPlatformFeeRatePct` field
- Type safety: registry là source of truth, mọi consumer type-check qua registry
- No external dep — pure TS + Drizzle + existing infrastructure

## 2. 단계별 구현 계획

### Phase 1 — Foundation (numeric/date param: Platform Fee Rate)

| Step | Action | File |
|------|--------|------|
| 1.1 | Tạo schema `sal_formula_configs` (Drizzle + raw SQL migration 0019) | `packages/db/src/schema/formula-configs.schema.ts` + `migrations/0019_formula_configs.sql` |
| 1.2 | Seed default rows: tiktok_platform_fee_rate_pct @ 24% (2020-01-01) + 26% (2026-05-09) | (migration SQL) |
| 1.3 | Tạo param registry với 1 entry (Platform Fee Rate) | `packages/shared/src/formula-config/registry.ts` |
| 1.4 | Tạo loader service `loadFormulaConfig(entId, asOf)` — returns full snapshot map | `apps/web/src/server/services/formula-config.service.ts` |
| 1.5 | Tạo server action `updateFormulaConfigAction` + `listFormulaConfigVersionsAction` | `apps/web/src/server/actions/formula-config.actions.ts` |
| 1.6 | Extend snapshot type: `constants.formulaConfig?: Record<string, { value, valueType }>` | `apps/web/src/server/services/period-snapshot.service.ts` |
| 1.7 | Refactor `ingest.actions.ts`: gọi loader, snapshot `formulaConfig` block. Remove hardcoded `>= '2026-05-09' ? 26 : 24` logic — loader handle it | `ingest.actions.ts` |
| 1.8 | Refactor `tiktok-metrics-calculator.service.ts`: ưu tiên nhận `platformFeeRatePct` từ cfg snapshot, fallback `constants.tiktokPlatformFeeRatePct` (legacy) | (same) |
| 1.9 | Refactor `snapshot-to-report.ts`: same fallback hierarchy | (same) |
| 1.10 | UI `FormulaParamRow.tsx`: render input (number for percentage), effective-date picker, Save button | NEW |
| 1.11 | UI `FormulaParamHistoryDrawer.tsx`: list all versions per key | NEW |
| 1.12 | `FormulaConfigClient.tsx` wire Save → call action → toast → refresh | MODIFY |
| 1.13 | i18n keys mới (EN + KO) | messages/{en,ko}.json |
| 1.14 | Manual apply migration via `apply-pending-migrations.mjs` | dev DB |
| 1.15 | Typecheck + verify edit-save-reingest flow end-to-end | manual test |

└─ **사이드 임팩트 (Phase 1):**
   - Snapshot schema mở rộng → consumer cũ vẫn đọc được vì `formulaConfig` optional
   - Hardcoded date `2026-05-09` removed → period bắt đầu ≥ 2026-05-09 vẫn tự động được 26% qua DB seed (idempotent)
   - Legacy `tiktokPlatformFeeRatePct` field tiếp tục được write vào snapshot (Pha transition). Phase 2 mới remove.

### Phase 2 — Categorical/enum params + remaining numeric

| Step | Action | File |
|------|--------|------|
| 2.1 | Add registry entries: `hq_margin_pct`, `vat_rate_pct`, `fulfillment_fee_vnd` (numeric, NOT wired to calculator at this phase per user decision) | registry.ts |
| 2.2 | Add categorical entries: `excluded_order_statuses`, `free_gift_detection_prefix`, `affiliate_booking_split_basis`, `week_definition` | registry.ts |
| 2.3 | Seed defaults trong migration 0020 | NEW SQL |
| 2.4 | UI: registry-driven row rendering (auto-render any registry entry, không cần per-key code) | FormulaParamRow.tsx |
| 2.5 | Categorical: render dropdown từ `enumOptions`; numeric/percentage/currency: number input | FormulaParamRow.tsx |
| 2.6 | Per categorical: validate value ∈ enumOptions trên server | formula-config.actions.ts |
| 2.7 | (Optional) Wire `hq_margin_pct`, `vat_rate_pct`, `fulfillment_fee_vnd` vào CM formula nếu business confirm — defer for now | (defer) |
| 2.8 | Update CLAUDE.md §9: remove "Hard-code 48 formula params" anti-pattern | CLAUDE.md |

└─ **사이드 임팩트 (Phase 2):**
   - Categorical params trong code (vd "Đã hủy" filter in tiktok-affiliate-orders-parser) tiếp tục hardcoded ở Phase 2 — UI chỉ display + edit, calculator chưa consume.
   - Wire vào calculator là sub-task Phase 2.5 hoặc Phase 3 (user quyết định khi review).

### Phase 3 (defer — spec riêng)
- Formula text editing (runtime engine). Cần REQ riêng vì scope khác biệt (parser + evaluator + UI).

## 3. 변경 파일 목록 (Phase 1)

| 구분 | File | 변경 | LOC ước tính |
|------|------|------|--------------|
| DB | `packages/db/src/schema/formula-configs.schema.ts` | NEW | ~40 |
| DB | `packages/db/migrations/0019_formula_configs.sql` | NEW | ~30 |
| DB | `packages/db/scripts/apply-pending-migrations.mjs` | (no change — range filter ≥ 9 đã cover 0019) | 0 |
| Shared | `packages/shared/src/formula-config/registry.ts` | NEW | ~50 |
| Backend service | `apps/web/src/server/services/formula-config.service.ts` | NEW | ~80 |
| Backend action | `apps/web/src/server/actions/formula-config.actions.ts` | NEW | ~120 |
| Backend ingest | `apps/web/src/server/actions/ingest.actions.ts` | MODIFY | +30 -10 |
| Backend calc | `apps/web/src/server/services/tiktok-metrics-calculator.service.ts` | MODIFY | +10 |
| Backend snapshot | `apps/web/src/server/services/period-snapshot.service.ts` | MODIFY | +10 |
| Backend report | `apps/web/src/lib/snapshot-to-report.ts` | MODIFY | +5 |
| Frontend | `apps/web/src/components/formula-config/FormulaParamRow.tsx` | NEW | ~120 |
| Frontend | `apps/web/src/components/formula-config/FormulaParamHistoryDrawer.tsx` | NEW | ~80 |
| Frontend | `apps/web/src/components/formula-config/FormulaConfigClient.tsx` | MODIFY (wire Save) | +40 |
| i18n | `apps/web/messages/en.json` + `ko.json` | MODIFY | +20 each |

Phase 2 adds ~3-4 more registry entries + UI handles them via registry (no per-key code).

## 4. 사이드 임팩트 분석

| Phạm vi | Risk | Mitigation |
|---------|------|------------|
| Old snapshots (no `constants.formulaConfig`) | Low | Loader fallback: đọc `tiktokPlatformFeeRatePct` legacy field nếu `formulaConfig` chưa có. Test verify. |
| Edit rate khi đang ingest | Low | Ingest dùng rate at start; nếu Admin edit giữa chừng, current ingest dùng old rate, ingest sau dùng new. No race. |
| Hardcoded `2026-05-09` date | Med (high impact, low complexity) | Remove from `ingest.actions.ts`; loader auto picks correct rate via effective_from. Need seed migration covering both 24%/26% periods. |
| Ent_id scope vs global default | Low | Per-ent override > global default. NULL ent_id = fallback. Cover edge cases in test. |
| Edit invalid value type | Low | Server validates against registry.valueType; reject invalid + return error code. |
| Audit log (sal_action_logs) | Low | Wrap update action with logAction call. |
| RBAC | Low | requireRole(ADMIN) before write. OPERATOR/MANAGER view-only. |

## 5. DB migration

### 5.1 Dev (Neon dev branch)
```bash
cd apps/app-sales-report-v2
node packages/db/scripts/apply-pending-migrations.mjs
```
Range filter `^0[0-9]{3}_` (≥ 9) đã cover 0019.

### 5.2 Staging + Production (manual)
```sql
-- 0019_formula_configs.sql nội dung sẽ áp run trên Neon SQL console
```

### 5.3 Rollback
```sql
DROP TABLE IF EXISTS sal_formula_configs;
-- Code rollback: revert commit. Calculator quay về hardcoded defaults.
```

## 6. Rollback plan per phase

| Phase | Rollback |
|-------|----------|
| 1 (foundation + Platform Fee Rate) | Revert commit. Drop table. Snapshot extension là optional field → safe. |
| 2 (categorical params) | Revert commit. Categorical còn lại hardcoded như cũ. |

Toàn bộ Phase 1+2 backward compat → có thể rollback từng phần.

## 7. Estimated effort (Phase 1 + 2)

| Phase | Work |
|-------|------|
| Phase 1.1-1.4 (DB + registry + loader) | 3h |
| Phase 1.5-1.6 (server action + snapshot extension) | 2.5h |
| Phase 1.7-1.9 (calculator/ingest/report refactor) | 2.5h |
| Phase 1.10-1.12 (UI inline edit + history drawer + wire Save) | 4h |
| Phase 1.13-1.15 (i18n + migration + manual test) | 1.5h |
| Phase 2 (categorical params, registry-driven UI, additional seed) | 3h |
| Docs + TR + RPT | 2h |

**Total: ~18.5h (~2.5 ngày work)**.

## 8. Open questions trước implement

- [ ] Param key naming convention: `snake_case` (DB-friendly) hay `camelCase` (TS-friendly)? Recommend `snake_case` để mirror sal_fx_rates field naming.
- [ ] UI: 1 page liệt kê tất cả params, hay group theo section? Recommend giữ section grouping hiện tại của FormulaConfigClient.
- [ ] Audit log: ghi vào sal_action_logs với category gì? `OTHER` đã có sẵn; mở category mới `FORMULA_CONFIG` cần migration enum. Recommend `OTHER` cho MVP.
- [ ] Phase 2 wiring HQ Margin / VAT / Fulfillment Fee vào CM: tách sub-task Phase 2.5 chờ business confirm.
