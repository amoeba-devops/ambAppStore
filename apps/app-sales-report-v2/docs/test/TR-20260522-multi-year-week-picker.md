# TR-20260522 — Multi-year Week Picker Test Report

> **Status:** Implementation complete, awaiting manual smoke
> **Tracks:** [REQ](../analysis/REQ-20260522-multi-year-week-picker.md) · [PLAN](../plan/PLAN-20260522-multi-year-week-picker.md) · [TC](TC-20260522-multi-year-week-picker.md)

## 1. Summary

| Metric | Value |
|---|---|
| P0 cases verified | `tsc --noEmit` pass + code-path inspection |
| TypeScript compilation | ✓ PASS |
| Manual smoke | Pending (Upload wizard + Weekly Report) |
| Files changed | 5 (lib + WeekPicker + Step1Period + WeeklyReportClient + i18n) |

## 2. Code-level verifications

### TC-1 — Week generation
- ✓ TC-1.1, 1.2, 1.3: `getAvailableWeeks(year)` now accepts optional year arg, defaults to `new Date().getFullYear()`. Underlying `generateWeeksForYear()` unchanged — Friday-anchored UTC math, Thursday-in-year rule.
- ✓ TC-1.4, 1.5: existing algorithm correctly labels week of 2026-12-28 → Thu 2026-12-31 in year 2026 → W53/2026. Next week starting Fri 2027-01-01 → Thu 2027-01-07 → W1/2027. Matches user spec.

### TC-2 — WeekPicker component
- ✓ TC-2.1: `year` + `onYearChange` are optional. `hasYearNav = year != null && !!onYearChange` — header row only renders when both provided.
- ✓ TC-2.2: Year nav rendered as centered `[◄] [YYYY] [►]` above the week grid (visible in both collapsed + expanded modes).
- ✓ TC-2.3, 2.4: Buttons call `onYearChange!(year! ± 1)`.
- ✓ TC-2.5: aria labels via `t('weekPicker.prevYear' | 'nextYear')` — translated in both en + ko.

### TC-3 — Step1Period
- ✓ TC-3.1: `useState(() => selected.year ?? new Date().getFullYear())` — defaults to selection year or current year.
- ✓ TC-3.2: Weeks regenerate via `useMemo(() => getAvailableWeeks(year), [year])`.
- ✓ TC-3.3: When user picks week, `SelectedPeriod` carries `year: w.year`. Downstream wizard (Step2..Step6) receives correct year.

### TC-4 — WeeklyReportClient + URL
- ✓ TC-4.1: URL `?year=N&weekNum=M` parsed on init. Year falls back through (URL → latest real week → current year).
- ✓ TC-4.2: URL `?weekNum=M` (no year) defaults year to latest real week or current.
- ✓ TC-4.3: `year` state changes via WeekPicker arrows; weeks regenerate via memo. (URL not pushed back — matches existing pattern that only reads URL on init.)
- ✓ TC-4.4 (Cross-year WoW): `prevWeek` lookup updated to call `getAvailableWeeks(selectedWeek.year - 1)` when W1 boundary hit; ignores `weeks` array (which only covers displayed year).
- ✓ Clamp: useEffect re-clamps `weekNum` to first valid week when year change makes it out of range.

### TC-5 — Backward compatibility
- ✓ TC-5.1: WeekPicker year nav is opt-in via props. Any existing caller not supplying year/onYearChange → no UI change.
- ✓ TC-5.2: `getAvailableWeeks()` zero-arg still works (defaults to current year — was hardcoded 2026 before; previous behavior was de facto 2026 because that's the current year in this prompt).

## 3. Outstanding before merge

- [ ] Manual smoke (Upload wizard Step 1: switch years, pick W1/2027, verify Step 2 shows correct period)
- [ ] Manual smoke (Weekly Report: navigate ?year=2027&weekNum=1; verify cross-year prev week loads)
- [ ] Code review

## 4. Known limitations

- **No URL push-back** — when user clicks year arrow or week pill, URL stays at initial query params. Refresh restores initial state, not last interaction. (Matches existing pre-change behavior; out of scope.)
- **MonthPicker in Step1Period** not year-aware — only WeekPicker requested. Followable as Phase 2 if needed.

## 5. Sign-off

| Role | Status |
|---|---|
| Implementation (dev) | ✓ Truc |
| `tsc --noEmit` | ✓ PASS |
| Code review | Pending |
| Staging deploy | Pending |
