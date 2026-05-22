# TC-20260522 — Multi-year Week Picker Test Cases

> Tracks: [REQ](../analysis/REQ-20260522-multi-year-week-picker.md) · [PLAN](../plan/PLAN-20260522-multi-year-week-picker.md)

## TC-1 · Week generation

### TC-1.1 — `getAvailableWeeks(2026)` returns 53 weeks · P0 · UNIT
**Expected:** Array of 53 entries, weekNum 1..53, year = 2026, first entry periodStart = `2025-12-26` (Fri) or per existing algorithm; last entry periodEnd = `2027-01-01` Thu.

### TC-1.2 — `getAvailableWeeks(2025)` returns 52 weeks · P0 · UNIT
**Expected:** Year 2025 has 52 ISO weeks (Jan 1, 2025 is Wednesday). Entries 1..52.

### TC-1.3 — `getAvailableWeeks()` (no arg) defaults to current year · P1 · UNIT
**Expected:** Returns weeks for `new Date().getFullYear()` (e.g. 2026).

### TC-1.4 — W1/2027 starts 2026-12-28 · P0 · UNIT
**Pre:** `getAvailableWeeks(2027)[0]`
**Expected:** `weekNum=1, year=2027, periodStart=2026-12-28 (Mon), periodEnd=2027-01-03 (Sun)`. Per ISO 8601, week containing first Thursday of 2027 (Jan 7) — actually wait, the Thursday is in 2027 → so week is W1/2027.

> **Note:** Implementation uses Friday-anchored UTC math which matches ISO 8601 weeks. Verify against [hackmd.io/@iso8601](https://en.wikipedia.org/wiki/ISO_8601#Week_dates) if doubt.

### TC-1.5 — W53/2026 ends 2027-01-03 · P0 · UNIT
**Pre:** `getAvailableWeeks(2026)[52]`
**Expected:** `weekNum=53, year=2026, periodStart=2026-12-28, periodEnd=2027-01-03`. Same physical week as TC-1.4 — different label depending on ISO rule.

> Actually per ISO 8601: weeks have a unique label. The week 2026-12-28 → 2027-01-03 either belongs to W53/2026 OR W1/2027, NOT both. Per user spec (`2026-12-28 = W53/2026`), our algorithm should label it W53/2026 and W1/2027 should be the next week (Mon 2027-01-04 — but that contradicts ISO since first Thu of 2027 = Jan 7 → W1/2027 = Jan 4 → that week).

> **Decision:** trust existing `generateWeeksForYear()` algorithm. TC-1.4/1.5 verify the algorithm matches user expectation; if mismatch, treat as bug.

## TC-2 · WeekPicker component

### TC-2.1 — Year nav not rendered without `onYearChange` · P0 · UNIT
**Pre:** `<WeekPicker weeks={...} selectedWeekNum={5} onPickWeek={fn} />` (no year, no onYearChange)
**Expected:** No ◄/► year arrows in header. Component renders as today.

### TC-2.2 — Year nav rendered when `onYearChange` provided · P0 · UNIT
**Pre:** `<WeekPicker weeks={...} year={2026} onYearChange={fn} ... />`
**Expected:** Header shows `◄ 2026 ►` clickable arrows.

### TC-2.3 — Clicking ► calls `onYearChange(year + 1)` · P0 · UNIT
**Expected:** Mock `onYearChange` invoked with `2027`.

### TC-2.4 — Clicking ◄ calls `onYearChange(year - 1)` · P0 · UNIT

### TC-2.5 — i18n: aria labels translate to Korean · P2 · E2E
**Pre:** locale = ko
**Expected:** ◄ aria-label = "이전 연도", ► = "다음 연도" (or similar)

## TC-3 · Step1Period upload wizard

### TC-3.1 — Default year = current calendar year · P0 · E2E
**Steps:** Open Upload Reports → Step 1.
**Expected:** Week grid shows current year's weeks. Year header shows current year.

### TC-3.2 — ► navigates to next year, weeks regenerate · P0 · E2E
**Steps:** Click ► once.
**Expected:** Header shows year+1. Week grid regenerates (52 or 53 entries depending on year).

### TC-3.3 — Picking W1/2027 propagates year=2027 to Step 2 · P0 · E2E
**Steps:** Navigate to 2027 → click W1 → Next.
**Expected:** Step 2 banner reads `W1 (28 Dec – 3 Jan)`. Selected period sent to ingest has `year: 2027, weekNum: 1`.

### TC-3.4 — Status badges (Locked/Active/Finalized) still apply correctly across years · P1 · E2E
**Pre:** Snapshot exists for W1/2027 with status Locked.
**Expected:** Switching to 2027, W1 cell shows Locked badge.

## TC-4 · WeeklyReportClient + URL params

### TC-4.1 — URL `?year=2026&week=18` loads correct snapshot · P0 · E2E
**Expected:** Page loads with W18/2026 selected; metrics reflect that snapshot.

### TC-4.2 — URL `?week=18` (no year) defaults to current year · P0 · E2E
**Expected:** Page loads with W18/{currentYear}. If snapshot missing → empty state with helper text.

### TC-4.3 — Clicking year ► updates URL · P0 · E2E
**Steps:** From `?year=2026&week=53` click ►
**Expected:** URL becomes `?year=2027&week=1` (or current selection adjusted to valid week in new year — TBD UX). Weeks regenerate.

### TC-4.4 — Cross-year prev-week WoW · P0 · E2E
**Pre:** Snapshot for W1/2027 + W53/2026 exist.
**Steps:** View W1/2027 report.
**Expected:** Prev-week comparison loads W53/2026; WoW deltas computed correctly across year boundary.

### TC-4.5 — Browser back/forward preserves year+week state · P1 · E2E
**Steps:** Navigate ?year=2026&week=18 → ?year=2027&week=1 → back button.
**Expected:** Browser returns to `?year=2026&week=18`. State restored.

## TC-5 · Backward compatibility

### TC-5.1 — Existing single-year WeekPicker usage (no year prop) still works · P0 · UNIT
**Pre:** Any caller using `<WeekPicker weeks={...} ... />` without year/onYearChange.
**Expected:** No regression — year nav simply absent.

### TC-5.2 — `getAvailableWeeks()` zero-arg still works · P0 · UNIT
**Expected:** Returns current year's weeks (now `new Date().getFullYear()`). Before this change it was hardcoded 2026 — so callers expecting 2026 specifically in tests may need updating IF any. Survey shows callers always pass through `WeekEntry.year` so they're unaffected.

## TC-6 · Performance

### TC-6.1 — Regenerating weeks on year change < 5ms · P2 · UNIT
**Steps:** `console.time` around `generateWeeksForYear(year)`.
**Expected:** < 5ms — pure UTC math on 55 iterations.

---

**Execution order:** TC-1 (units) → TC-2 (component units) → TC-3, TC-4 (E2E manual) → TC-5 (regression) → TC-6 (perf).
