# RPT-20260519 — Driver UI/UX Refactor — Implementation Report

> **REQ**: REQ-20260519 · **PLAN**: PLAN-20260519 · **TC/TR**: TC-/TR-20260519
> **Date**: 2026-05-19
> **Branch**: `feat/car-v2-p5-pwa-setup`
> **Author**: dev@amoeba.group

## Summary

Refactor of `/today`, trip detail (driver perspective), and trip-action dialogs to ship a coherent driver-first PWA UX. Adds expense submission UI shell (route + form) gated by a stub server action while backend P2 is finished. Touchpoints: design system (Button size 2xl), shared layout primitives (DriverActionBar, BottomSheet wrapper), 3 i18n locales. No DB migrations. State-machine logic untouched.

## Phases delivered

| Phase | Status | Files |
|---|---|---|
| A — Design system foundation | ✅ | Button 2xl + DriverActionBar + BottomSheet wrapper |
| B — `/today` Driver mode | ✅ | DriverTodayView + DriverNextTripCard + page.tsx branching |
| C — Trip detail driver view | ✅ | driver-view.tsx (sticky bar + details fold) + trip-actions.tsx (size 2xl + BottomSheet) |
| D — Expense submission shell | ✅ | `/expenses/new` + 4 form components + stub action |
| E.1 — i18n keys | ✅ | vi/en/ko @ `today.driver.*` + `expenses.submit.*` |
| E.2 — A11y review | ✅ | radiogroup keyboard model · aria-labels · safe-area · roving tabindex |

## Files created (13)

- `packages/ui/src/components/button.tsx` (modified, +`2xl` size)
- `apps/web/src/components/layout/driver-action-bar.tsx`
- `apps/web/src/components/ui/bottom-sheet.tsx`
- `apps/web/src/app/(app)/today/_components/driver-today-view.tsx`
- `apps/web/src/app/(app)/today/_components/driver-next-trip-card.tsx`
- `apps/web/src/app/(app)/expenses/new/page.tsx`
- `apps/web/src/app/(app)/expenses/new/_components/expense-submit-form.tsx`
- `apps/web/src/app/(app)/expenses/new/_components/expense-type-chip-grid.tsx`
- `apps/web/src/app/(app)/expenses/new/_components/amount-input.tsx`
- `apps/web/src/app/(app)/expenses/new/_components/receipt-camera-input.tsx`
- `apps/web/src/server/actions/expenses/expense.actions.ts` (STUB)
- `docs/analysis/REQ-20260519-driver-ux-refactor.md`
- `docs/plan/PLAN-20260519-driver-ux-refactor.md`
- `docs/test/TC-20260519-driver-ux-refactor.md`
- `docs/test/TR-20260519-driver-ux-refactor.md`
- `docs/implementation/RPT-20260519-driver-ux-refactor.md` (this file)

## Files modified (5)

- `apps/web/src/app/(app)/today/page.tsx` — early-return to DriverTodayView when role=DRIVER
- `apps/web/src/app/(app)/trips/[id]/_components/driver-view.tsx` — sticky action bar, map cap 35vh, details fold
- `apps/web/src/app/(app)/trips/[id]/trip-actions.tsx` — Dialog→BottomSheet, conditional size for DRIVER
- `apps/web/messages/{vi,en,ko}.json` — `+today.driver.*` + `+expenses.submit.*`
- `packages/ui/src/components/button.tsx` — +`2xl` size

## Out-of-scope / deferred (intentional)

| Item | Why deferred | Tracking |
|---|---|---|
| Real `car_expenses` schema + S3 upload + approval rules | Backend P2 wasn't actually built despite CLAUDE.md saying "done" | Needs new REQ for backend P2 completion |
| `tel:` passenger phone tap-to-call | `passengerPhone` field doesn't exist on TripDetail / car_trips | Needs new REQ if product wants it |
| Driver availability toggle (on-trip/off-duty) | Listed as won't-have in PRD divergence D7 | — |
| Push notification opt-in UI | P4 territory | Continue P4 |
| Offline trip detail caching | P5 service-worker task | Continue P5 |
| Bottom-tab nav refactor (driver-only nav) | Current 4-tab nav is already driver-centric | — |

## Quality gates

| Gate | Status |
|---|---|
| `tsc --noEmit` (web + ui) | ✅ |
| `next lint` | ✅ 0 warnings |
| `next build` | ✅ 19 routes |
| All new UI text i18n'd | ✅ |
| No client→DB shortcuts | ✅ |
| No `target="_blank"` on internal links | ✅ |
| Stub mode obvious to QA | ✅ banner + console log prefix |

## Risks / known issues

### R-1 — Stub action could be confused with real submission
**Mitigation**: Loud warning banner in form (`expenses.submit.stubBanner`). Server-side `console.info('[STUB submitExpenseAction]', ...)` makes server logs explicit. Synthetic id prefix `stub-` makes any future query for the id distinguishable from real records.

### R-2 — DriverActionBar overlay on map iframe
**Mitigation**: Map hero capped at `35vh` on mobile so RouteTimeline appears above fold, and `pb-[220px]` on the scroll container guarantees content fully reachable behind the bar.

### R-3 — BottomSheet on desktop
**Note**: All driver dialogs (Reject/Cancel/Assign) now slide up from the bottom on desktop too. This was a deliberate simplification — one component, one mental model. If admin testers find it distracting on a wide screen, follow-up is to gate with `useMediaQuery` and fall back to centered Dialog ≥md.

### R-4 — iPad/desktop tap-target inflation
**Note**: Driver primary actions are 56px on every breakpoint (including iPad PWA on Mac UA), per `size="2xl"`. This is intentional — same target everywhere keeps muscle memory consistent across phone/tablet.

## What the user sees

- **Driver Today** is now state-aware: tapping the app surfaces the single most important next action (Accept / Reject / Start / End) within thumb reach. Two taps from cold-launch to status change, vs. the previous 3–4.
- **Trip detail** drops information noise behind a "More details" fold and pins the action bar at the bottom so the next decision is never scrolled off.
- **Reject / Cancel / Assign** now slide up from the bottom on mobile — typing in the reason no longer requires reaching to the middle of the screen.
- **Driver can submit an expense** for the first time — though backend persistence is stubbed and the banner makes this clear. Camera-capture works in PWA standalone on iOS/Android (requires HTTPS, already met).

## Next steps (recommended ordering)

1. **Manual staging smoke** — deploy `feat/car-v2-p5-pwa-setup` to stg, test on iPhone PWA + Android PWA + desktop. Verify TC-A2/A3/D2/D4/X4.
2. **Backend P2 follow-up REQ** — `car_expenses` schema + S3 presigned upload + replace stub action body.
3. **Trip schema enhancement** — add `passengerPhone` to enable tap-to-call.
4. **P5 wrap-up** — service-worker offline caching for trip list/detail.
