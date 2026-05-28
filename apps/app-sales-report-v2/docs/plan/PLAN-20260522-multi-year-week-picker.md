# PLAN-20260522 — Multi-year Week Picker

> **Tracks:** [REQ-20260522](../analysis/REQ-20260522-multi-year-week-picker.md)
> **Estimated effort:** ~2h (no DB, no new dep, no test fixtures)

## 1. 시스템 개발 현황 분석

- WeekPicker (single-year) + MonthPicker (already year-aware) — apply MonthPicker's pattern.
- `getAvailableWeeks()` hardcodes 2026; underlying `generateWeeksForYear(year)` already accepts year arg.
- Two callers: `Step1Period` (upload wizard, has parent state for selected period) and `WeeklyReportClient` (URL-backed report viewer).
- No external libraries needed.

## 2. 단계별 구현 계획

### Phase A — Shared util + component (Day 1, 30 min)

**A1. `getAvailableWeeks` accepts year**
- File: `apps/web/src/lib/weekly-report-mock.ts`
- Signature: `getAvailableWeeks(year?: number): WeekEntry[]` — default `new Date().getFullYear()`
- └─ Side impact: existing zero-arg calls still work (default year).

**A2. WeekPicker year nav**
- File: `apps/web/src/components/shared/WeekPicker.tsx`
- Add props `year?: number`, `onYearChange?: (next: number) => void`
- Render ◄ year ► nav in header (clone MonthPicker pattern); only when `onYearChange` provided
- Pull aria labels from i18n
- └─ Side impact: optional props → fully backward-compat for any caller that doesn't supply them.

### Phase B — Callers + URL state (Day 1, 1h)

**B1. Step1Period (upload wizard)**
- File: `apps/web/src/components/upload/Step1Period.tsx`
- Add `weekYear` state to `WeekPickerForUpload` (or hoist to parent)
- Memoize weeks via `useMemo(() => getAvailableWeeks(weekYear), [weekYear])`
- Default `weekYear = new Date().getFullYear()`
- Pass `year` + `onYearChange` to WeekPicker
- └─ Side impact: selected period now derives year from picker state, not hardcoded.

**B2. WeeklyReportClient + URL params**
- File: `apps/web/src/components/weekly/WeeklyReportClient.tsx`
- Read `year` query param: `searchParams.get('year')` (use `useSearchParams` from `next/navigation`)
- Track `year` state alongside `weekNum`
- Memoize `weeks = useMemo(() => getAvailableWeeks(year), [year])`
- On pickWeek / year change → update URL via `router.replace`
- └─ Side impact: existing URLs `?week=18` still work (default year = current).

**B3. i18n year nav aria**
- File: `messages/{en,ko}.json`
- Add `weekPicker.prevYear` / `nextYear` keys (or reuse `monthPicker.*` if exists)
- └─ Side impact: none — additive translations.

### Phase C — Verify (Day 1, 30 min)

**C1. Type-check** `tsc --noEmit`

**C2. Manual smoke**
- Upload wizard Step 1: click ◄ → 2025; weeks regenerate. Click ► twice → 2027; weeks regenerate.
- Pick W1/2027 → next steps receive `year: 2027, weekNum: 1`.
- Weekly Report: navigate via URL `?year=2027&week=1`; arrow ◄ → URL becomes `?year=2026&week=53`. Verify snapshot loads correctly.

## 3. 변경 파일 목록

| Layer | File | Type |
|-------|------|------|
| Lib | `apps/web/src/lib/weekly-report-mock.ts` | MODIFY |
| Shared component | `apps/web/src/components/shared/WeekPicker.tsx` | MODIFY |
| Upload wizard | `apps/web/src/components/upload/Step1Period.tsx` | MODIFY |
| Weekly report | `apps/web/src/components/weekly/WeeklyReportClient.tsx` | MODIFY |
| i18n | `apps/web/messages/en.json` + `ko.json` | MODIFY |

**Total: 4 file + 2 i18n files**

## 4. 사이드 임팩트 분석

| Scope | Risk | Notes |
|-------|------|-------|
| Existing callers of `getAvailableWeeks()` | None | Default arg = current year (matches old behaviour when year was 2026; from 2027+ will default to that year — desired) |
| WeekPicker single-year usage | None | Year nav only rendered when `onYearChange` provided |
| WeeklyReport URL deep links | Low | Without `year`, default to current year. If user has bookmarked `?week=18` (assuming 2026), in 2027 it would load 2027/W18 which may not have a snapshot → empty state shown gracefully |
| Cross-year prev-week (WoW) | None | Already handled in WeeklyReportClient L85-97 |
| Snapshot DB | None | Schema unchanged |
| Mobile UI | Low | Year arrows are 4 extra chars in header — fits viewport |

## 5. DB 마이그레이션

**None.**

---

**Next:** TC-20260522.
