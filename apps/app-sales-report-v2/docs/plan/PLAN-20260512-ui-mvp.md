# PLAN-20260512 — UI MVP Implementation

> **Goal**: Implement all UI screens cho MVP Phase 1 (9/23 FRs) — base trên design system đã thống nhất + prototype FIRGI visual reference.
> **Scope**: Web app (`@v2/web`) only. Worker + Cron mock data until UI working end-to-end.
> **Source of truth**: [SRD v2.0](../analysis/SRD-20260506-FIRGI-SalesReport-v2.md) + [REQ-20260511 §3.3 page structure](../analysis/REQ-20260511-sales-report-v2.md#33-page-structure-v2) + [final-decisions](../../.claude/memory/final-decisions.md).

## 1. MVP scope (chốt)

**IN** (Phase 1):
| FR | Screen | Role gate |
|---|---|---|
| — | `/dashboard` landing | All |
| FR-01,02,03 | `/upload` (Smart Drop Zone) | OPERATOR + ADMIN |
| FR-04 | `/manual-input` | OPERATOR + ADMIN |
| FR-05 | `/cost-master/prime-cost` | OPERATOR + ADMIN |
| FR-07,08,09,10 | `/reports/weekly` | All (view + download) |
| FR-19 | `/activity-log/login` | MANAGER + ADMIN |
| FR-20 | `/activity-log/action` | MANAGER + ADMIN |
| FR-21 | `/activity-log/download` | MANAGER + ADMIN |
| — | `/session-expired` | Public |

**OUT** (Phase 2 deferred):
- FR-06 COGS Master (separate from Prime Cost)
- FR-11~14 Monthly Report
- FR-15~18 Trending (4 views × Shopee/TikTok × WoW/MoM)
- FR-22 User Management UI
- FR-23 Formula Configuration UI

## 2. Design system references (đọc trước khi code)

| Doc | Use case |
|---|---|
| [component-style/_INDEX.md](../component-style/_INDEX.md) | Foundation — patterns navigation |
| [component-style/design-tokens.md](../component-style/design-tokens.md) | Tailwind theme — colors, fonts, spacing |
| [component-style/page-template.md](../component-style/page-template.md) | Page skeleton (RSC + loading.tsx + error.tsx) |
| [component-style/form-pattern.md](../component-style/form-pattern.md) | RHF + Zod forms |
| [component-style/table-pattern.md](../component-style/table-pattern.md) | TanStack Table + sort/filter |
| [component-style/modal-pattern.md](../component-style/modal-pattern.md) | shadcn Dialog/AlertDialog |
| [component-style/states.md](../component-style/states.md) | Loading/Empty/Error 3-states |
| [system-design/server-actions.md](../system-design/server-actions.md) | `'use server'` patterns |
| [system-design/s3-storage.md](../system-design/s3-storage.md) | Presigned URL flow |
| [analysis/UPLOAD-FLOW-20260511.md](../analysis/UPLOAD-FLOW-20260511.md) | Smart Drop Zone full spec |
| Prototype: [FIRGI Sales Ops _standalone_.html](../../FIRGI%20Sales%20Ops%20_standalone_.html) | Visual reference (open browser) |

**Stack** (locked, no alternatives): Next.js 15 App Router + Tailwind 3 + shadcn/ui + Recharts + React Hook Form + Zod + next-intl + lucide-react.

## 3. Screen inventory (11 routes)

| # | Route | Status | FR | Components | Effort |
|---|---|---|---|---|---|
| S-01 | `/` | placeholder | — | redirect → `/dashboard` | done |
| S-02 | `/dashboard` | placeholder | — | 4 KPI cards + recent activity | 3-5h |
| S-03 | `/upload` | TODO | FR-01,02,03 | PeriodPicker + DropZone + DetectionList + FileList + ContinueDialog | 8-12h |
| S-04 | `/upload/status/[id]` | TODO | FR-01 AC-11 | Poll job status + progress bar | 3-4h |
| S-05 | `/manual-input` | TODO | FR-04 | PeriodPicker + 12 numeric fields + FX rate + Save | 5-7h |
| S-06 | `/cost-master/prime-cost` | TODO | FR-05 | DataTable + Search + Inline edit + Add modal + Download | 10-14h |
| S-07 | `/reports/weekly` | TODO | FR-07,08,09,10 | WeekPicker + OverviewCard + Breakdown × 2 + Product Table + Export | 12-18h |
| S-08 | `/activity-log/login` | TODO | FR-19 | DataTable + DateFilter + UsernameFilter (Mgr+) | 2-3h |
| S-09 | `/activity-log/action` | TODO | FR-20 | DataTable + DateFilter + ActionTypeFilter | 2-3h |
| S-10 | `/activity-log/download` | TODO | FR-21 | DataTable + DateFilter | 1-2h |
| S-11 | `/session-expired` | placeholder | — | static message | done |

**Total feature effort**: 46-67h (~1.5-2 sprints solo dev).

## 4. Phase 1.0 — Foundation tasks (must do first)

> Foundation = atomic UI primitives + design system extraction. Block tất cả feature tasks.

| ID | Task | Output | Effort |
|---|---|---|---|
| T-001 | Extract design tokens từ prototype | `design-tokens.md` filled + `tailwind.config.ts` updated với palette/fonts/spacing thực tế | 2-3h |
| T-002 | Init shadcn/ui + install 12 primitives | `components.json` + `components/ui/*.tsx` (Button, Card, Input, Label, Select, Dialog, AlertDialog, DropdownMenu, Tabs, Table, Skeleton, Toast, Badge) | 1-2h |
| T-003 | Setup next-intl i18n | `messages/{ko,en,vi}.json` + `i18n.ts` + provider wrap | 1-2h |
| T-004 | Upgrade `(dashboard)/layout.tsx` shell | Sidebar role-aware nav + topbar (period selector slot) + user menu + mobile drawer | 3-4h |
| T-005 | Form primitives | `<FormField>`, `<NumberInput>` (VND/KRW), `<DateRangePicker>` (date-fns), `<FilePicker>` | 3-4h |
| T-006 | DataTable shared component | TanStack Table wrapper + sort/filter/search + sticky header + totals row + empty state | 4-5h |
| T-007 | Dialog patterns | `<ConfirmDialog>` (destructive 2-step), `<FormDialog>` (form-in-modal) | 1-2h |
| T-008 | Common states | `<EmptyState>` + `<ErrorState>` + `<LoadingSkeleton>` variants + `error.tsx` per route group | 2-3h |
| T-009 | Auth helper hooks | `<RoleGate role={['ADMIN']}>` wrapper, `useCurrentUser()` client hook | 1-2h |

**Total foundation**: 18-27h.

**Critical path**: T-001 → T-002 → T-004 (shell) → all features.
**Parallelizable**: T-005, T-006, T-007, T-008, T-009 sau khi T-002 xong.

## 5. Phase 1.x — Feature tasks (after foundation)

### F-1: Upload Smart Drop Zone (FR-01, FR-02, FR-03)

Spec: [UPLOAD-FLOW-20260511.md](../analysis/UPLOAD-FLOW-20260511.md) (1 drop zone, auto-detect, lenient skip).

| ID | Task | Spec ref |
|---|---|---|
| T-101 | `/upload` page shell + `<PeriodPicker>` | UPLOAD-FLOW §2 mockup |
| T-102 | `<SmartDropZone>` component (drag/drop/browse, multi-file) | UPLOAD-FLOW §2 |
| T-103 | Server Action `requestUploadUrl` (S3 presign) | s3-storage.md §3 |
| T-104 | Server Action `confirmUpload` → insert `sal_uploaded_files` | s3-storage.md §3 |
| T-105 | Server Action `detectSections` (row 1 markers + column heuristic) | excel-parser SKILL §4 |
| T-106 | `<DetectionList>` 9-row status (✅ detected / ⚪ missing / ❌ failed / ⚠️ ambiguous) | UPLOAD-FLOW §2 |
| T-107 | `<UploadedFilesList>` with [Remove] | UPLOAD-FLOW §2 |
| T-108 | `<ContinueDialog>` when <9/9 detected | UPLOAD-FLOW §2 |
| T-109 | Server Action `triggerProcessing` → INSERT `sal_upload_sessions` PENDING | background-jobs.md |
| T-110 | `/upload/status/[id]` poll page | UPLOAD-FLOW §5 state machine |

**Effort**: 11-16h.
**Dependencies**: T-001, T-002, T-005, T-007, T-008. Independent of F-2~F-6.

### F-2: Manual Input (FR-04)

| ID | Task |
|---|---|
| T-201 | `/manual-input` page + period picker (re-use from F-1) |
| T-202 | Form with 12 numeric fields (5 main + 7 TikTok platform subitems): Affiliate Booking, Shopee Livestream, TikTok Livestream, TikTok Ads, TT-PF Transaction/Commission/Shipping/Exclusive/VoucherXtra/OrderProcessing/SFR |
| T-203 | FX rate field (default 17.543 VND/KRW) — separate from cost fields |
| T-204 | Save Server Action → upsert `sal_manual_inputs` by (entId, fieldCode, periodStart) |
| T-205 | Empty state when no period selected; pre-fill from existing record |
| T-206 | Recalculate trigger after save (emit job) |

**Effort**: 5-7h.
**Dependencies**: T-001, T-002, T-005, T-008. Independent of F-1.

### F-3: Prime Cost Master (FR-05)

| ID | Task |
|---|---|
| T-301 | `/cost-master/prime-cost` page + `<DataTable>` |
| T-302 | Columns: Product ID, Variation ID, Name (VI/EN), SKU, Prime Cost VND, Prime Cost KRW (read-only), Selling Price, Listing Price |
| T-303 | Search by SKU/name (debounce 300ms per FR-05 AC-02) |
| T-304 | Inline edit price fields (save on blur/Enter) → Server Action `updatePrimeCost` |
| T-305 | `<AddSkuModal>` — form with Zod validation |
| T-306 | Delete confirm dialog + Server Action `deletePrimeCost` |
| T-307 | Version snapshot logic on edit (INSERT `sal_prime_cost_versions`) |
| T-308 | Download CSV button (export current view) |
| T-309 | DEFERRED: Bulk upload CSV (Phase 1.5 if time, else Phase 2) |

**Effort**: 10-14h.
**Dependencies**: T-001, T-002, T-005, T-006, T-007, T-008.

### F-4: Weekly Report (FR-07, FR-08, FR-09, FR-10)

| ID | Task | Spec ref |
|---|---|---|
| T-401 | `/reports/weekly` page + `<WeekSelector>` (only weeks with data per FR-07 AC-02) | SRD FR-07 |
| T-402 | `<OverviewPerformanceCard>` — VND + KRW columns side-by-side | SRD FR-08 AC-01 |
| T-403 | `<DiscountCostsBreakdown>` — Seller Voucher / Seller Discount / Free Gift / Total Platform Discount Rfr | SRD FR-08 AC-02 |
| T-404 | `<PromotionalCostsBreakdown>` — AD Spend / Brand Ads / Off-Platform / Affiliate Commission / Affiliate Booking / Livestream | SRD FR-08 AC-03 |
| T-405 | `<TrafficCard>` — Total Page View + Conversion Rate | SRD FR-08 AC-04 |
| T-406 | `<ProductBreakdownTable>` — sort + filter + search + totals row + flag missing Prime Cost row (orange) | SRD FR-09 |
| T-407 | WoW % indicators (▲ green / ▼ red / `----` first / `N/A` zero) | SRD FR-08 AC-05~07 + cm-calculator SKILL §7 |
| T-408 | Export Excel button — match screen exactly + filename `Weekly_Report_W{WW}_{YYYY}.xlsx` | SRD FR-10 |
| T-409 | Loading skeleton matching final layout | states.md |
| T-410 | Server Actions: `getWeeklyReport(week)` + `exportWeeklyReport(week, format)` | server-actions.md |

**Effort**: 12-18h.
**Dependencies**: T-001, T-002, T-006, T-008. Mock data từ DB initial; real data after F-1+F-2 complete.

### F-5: Activity Logs (FR-19, FR-20, FR-21)

| ID | Task |
|---|---|
| T-501 | `/activity-log/login` — DataTable (username, action, IP, timestamp), filter date range + username |
| T-502 | `/activity-log/action` — DataTable (user, action type, target, before, after, timestamp), filter type + date |
| T-503 | `/activity-log/download` — DataTable (user, report type, filename, timestamp), filter date |
| T-504 | Pagination (50 rows/page, server-side) |
| T-505 | Role gate: MANAGER + ADMIN view, ADMIN only future delete (none in MVP — immutable) |
| T-506 | Read-only UI (no edit/delete buttons) per NFR-13 |

**Effort**: 5-7h.
**Dependencies**: T-001, T-002, T-006, T-008.

### F-6: Dashboard landing (placeholder → real)

| ID | Task |
|---|---|
| T-601 | 4 KPI cards (Net GMV, Total CM, Orders, AOV — latest week) |
| T-602 | Quick links: "Resume upload" if PENDING session exists; "Latest report" link |
| T-603 | Recent activity feed (top 5 from `sal_log_action`) |
| T-604 | Empty state: "No data yet — Upload your first report" → CTA `/upload` |

**Effort**: 3-5h.
**Dependencies**: T-001, T-002, T-008. Real KPIs after F-4 working.

## 6. Dependency graph

```
┌──────────────────────────────────────────────┐
│ T-001 design-tokens                          │
│   └─► T-002 shadcn primitives                │
│         ├─► T-003 i18n                       │
│         ├─► T-004 shell layout (CRITICAL)    │
│         ├─► T-005 form primitives            │
│         ├─► T-006 DataTable                  │
│         ├─► T-007 dialogs                    │
│         ├─► T-008 states                     │
│         └─► T-009 role gates                 │
│              │                               │
│              ▼                               │
│    ┌─────────┴──────────┐                    │
│    ▼  ▼  ▼  ▼  ▼  ▼                          │
│   F-1 F-2 F-3 F-4 F-5 F-6 (parallel after foundation)│
└──────────────────────────────────────────────┘
```

**Sprint 1** (Foundation, 18-27h): T-001 → T-009
**Sprint 2** (Core features parallel, 28-39h): F-1 + F-2 + F-3
**Sprint 3** (Reports + logs, 17-25h): F-4 + F-5 + F-6 polish

## 7. Definition of Done (per screen)

- [ ] Route exists tại `app/(dashboard)/<path>/page.tsx`
- [ ] Role gate qua `getCurrentUser()` + `requireRole()` (Server Component) hoặc `<RoleGate>` (Client)
- [ ] 3 states implemented: `loading.tsx` skeleton + empty state + error boundary (`error.tsx`)
- [ ] All UI text qua `t()` (i18n key registered ở `messages/ko.json` + `en.json` + `vi.json`)
- [ ] Mobile responsive ≥640px width baseline
- [ ] Tailwind utility classes only — KHÔNG inline styles, KHÔNG CSS modules
- [ ] Server Action validates input qua Zod schema (shared `@v2/shared/zod/*`)
- [ ] Multi-tenant scoped — query có `withEnt(table, entId)` filter
- [ ] Action logged vào `sal_log_action` (where mutation)
- [ ] Playwright smoke test added (route load + 1 happy path)

## 8. Cross-cutting concerns

| Concern | Approach |
|---|---|
| i18n | All strings → t() từ namespace `<page-name>` |
| Number format | `Intl.NumberFormat('vi-VN')` cho VND, `'ko-KR'` cho KRW, font-mono cho cell |
| Date format | `date-fns` formatters, vi-VN locale default |
| Loading | Suspense + skeleton matching layout (KHÔNG generic spinner) |
| Errors | `<ErrorBoundary>` → toast + retry button + log Render |
| Mutations | Server Action returns `ActionResult<T>` (success boolean + data/error) |
| Toasts | `sonner` lib via shadcn |
| Forms | RHF + zodResolver, error inline + toast on submit fail |
| Mobile | Test breakpoints: sm (640), md (768), lg (1024) |

## 9. Out of scope (Phase 2 — separate plan)

- FR-06 COGS Master page
- FR-11~14 Monthly Report (mirror Weekly + MoM)
- FR-15~18 Trending Reports (4 tab views + Recharts bar/line + export chart)
- FR-22 User Management UI (passthrough only in MVP)
- FR-23 Formula Configuration UI (48 params Admin editable)
- T-309 Prime Cost bulk CSV upload
- T-110 detail Status page (defer if simple polling enough)
- Dark mode (tokens dual-ready but no UI switch)

## 10. Next steps

1. **You**: Review this plan + confirm scope/effort hợp lý
2. **Start T-001**: Extract design tokens từ prototype HTML (browser inspect mode)
   - Open `FIRGI Sales Ops _standalone_.html` in browser
   - Pick 5-10 key screens via screenshot
   - DevTools → Computed styles của primary buttons/text/cards
   - Fill [design-tokens.md](../component-style/design-tokens.md) + update `tailwind.config.ts`
3. **T-002**: `npx shadcn@latest init` trong `apps/web/` + add 12 primitives
4. **T-004**: Upgrade dashboard layout với proper sidebar role gate
5. Parallelize features sau khi foundation xong

## 11. Risks

| Risk | Mitigation |
|---|---|
| Prototype HTML không decode được visual → design tokens guess | Browser-only inspection (no auto-extract); take screenshots for offline reference |
| Weekly Report layout phức tạp (Overview + 2 breakdowns + Product table + export) | Split T-401~410 thành sub-tasks, test render từng phần |
| Smart Drop Zone state machine có edge cases (ambiguous, overwrite, resume) | Reference UPLOAD-FLOW.md state machine exact; write Playwright per state |
| Activity Log permissions confusing (Mgr read, no Operator) | Role gate ở layout level cho `/activity-log/*` group |
| i18n message bloat → JSON files lớn | Namespace per page (`upload.*`, `report.*`); flatten only when shared |
| Number format VND/KRW mismatch giữa cells | Helper functions `formatVND`/`formatKRW` in `packages/ui` |

## 12. See also

- [REQ-20260511 §3.3 page structure](../analysis/REQ-20260511-sales-report-v2.md#33-page-structure-v2)
- [REQ-20260511 §3.4 role matrix](../analysis/REQ-20260511-sales-report-v2.md#34-role-permission-matrix)
- [REQ-20260511 §4.6 MVP path](../analysis/REQ-20260511-sales-report-v2.md#46-mvp-path-ready-to-start)
- [ARCH-overview §4 page layout](../architecture/ARCH-overview.md)
- [final-decisions.md](../../.claude/memory/final-decisions.md) — 6 Q-A~Q-F resolutions
- [component-style/_INDEX.md](../component-style/_INDEX.md) — design system hub
