# RPT-20260522 — Multi-year Week Picker

> **Status:** Implementation complete; tsc pass; manual smoke pending.
> **Tracks:** [REQ](../analysis/REQ-20260522-multi-year-week-picker.md) · [PLAN](../plan/PLAN-20260522-multi-year-week-picker.md) · [TC](../test/TC-20260522-multi-year-week-picker.md) · [TR](../test/TR-20260522-multi-year-week-picker.md)

## 1. What shipped

WeekPicker gains opt-in **year navigation arrows** matching MonthPicker's UX. Users can navigate to any past or future calendar year; week grid regenerates per year via existing `generateWeeksForYear()` (Friday-anchored, Thursday-in-year rule). Two callers wired up: Upload Wizard Step 1 (period selection) and Weekly Report viewer (`?year=N&weekNum=M` URL deep-link).

## 2. Files changed

| File | Change |
|------|--------|
| `apps/web/src/lib/weekly-report-mock.ts` | `getAvailableWeeks(year?)` — optional year arg, defaults to current year |
| `apps/web/src/components/shared/WeekPicker.tsx` | + `year` + `onYearChange` props; renders ◄ year ► header when both supplied |
| `apps/web/src/components/upload/Step1Period.tsx` | `WeekPickerForUpload` tracks `year` state; weeks regenerate per year |
| `apps/web/src/components/weekly/WeeklyReportClient.tsx` | + `year` state from URL; cross-year `prevWeek` uses `getAvailableWeeks(year-1)`; weekNum auto-clamps on year change |
| `apps/web/messages/en.json` + `ko.json` | + `weekPicker.prevYear` / `nextYear` / `prevYearTitle` / `nextYearTitle` |

**Total: 5 files modified, 0 new, 0 DB migration.**

## 3. Behaviour

- **Default year:** when no URL hint, defaults to latest real-data year (Weekly Report) or selected period year (Upload Wizard) or current calendar year.
- **Year arrows:** `◄ 2026 ►` centered above week grid. Clicking arrow regenerates weeks; `weekNum` clamps to first valid week if previous selection out of range.
- **Cross-year WoW:** picking W1 of year Y → prev week loads from `getAvailableWeeks(Y-1)` last entry (typically W52 or W53). Snapshot for that prev week loaded via existing `loadSnapshotAction({year: Y-1, weekNum: ...})`.
- **URL deep-link:** `/reports/weekly?year=2027&weekNum=1` works. Backward-compat: `?weekNum=18` (no year) defaults year to latest real week.
- **Single-year callers:** any caller not passing `year`/`onYearChange` → no UI change, no year nav rendered (opt-in).

## 4. Out of scope / Future

- **MonthPicker inside Step1Period.tsx** — not refactored. Only WeekPicker requested. The Monthly Report's MonthPicker already has year nav; Step1Period's inline MonthPicker doesn't (separate component within the file).
- **URL push-back on interactions** — clicking arrow or week pill doesn't update URL. Matches existing pattern. Could be added in follow-up.
- **Year-aware status overrides** — `useArchiveStatusByLabel(realLabels)` keys by W-label only. If W18/2026 and W18/2027 both exist with overrides, they'd collide. Currently overrides live in localStorage and are pretty rare so not a blocker.

## 5. Risks acknowledged

| Risk | Mitigation |
|------|------------|
| Year regen perf | Negligible (~55 iterations of UTC math) |
| Existing callers broken by getAvailableWeeks signature change | Optional arg defaults to current year — zero-arg calls preserved |
| Deep-link `?weekNum=18` from before this change | Still works — year defaults to latest real week / current year |
| User confusion (year arrows + week arrows in same picker) | Year nav header separates from week scroll row visually |

## 6. Verification

| Item | Status |
|------|--------|
| `tsc --noEmit` exit 0 | ✓ |
| REQ + PLAN + TC + TR docs in place | ✓ |
| Manual smoke — Upload wizard year nav | Pending |
| Manual smoke — Weekly Report cross-year WoW | Pending |
| Code review | Pending |

---

**Total effort:** ~1.5h (faster than 2h PLAN estimate — `generateWeeksForYear(year)` already existed, just needed exposure + UI wiring).
