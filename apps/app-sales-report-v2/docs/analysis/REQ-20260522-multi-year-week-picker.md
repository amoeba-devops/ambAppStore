# REQ-20260522 — Multi-year support for Week Picker

> **Status:** Draft v1
> **Author:** Truc Hoang (with Claude)
> **Date:** 2026-05-22

## 1. 요구사항 요약

| # | Requirement | Type |
|---|-------------|------|
| R1 | WeekPicker shows ◄/► year arrows in header — same UX pattern as MonthPicker | Functional |
| R2 | User can navigate to any year (past or future); weeks regenerate per year via existing `generateWeeksForYear()` | Functional |
| R3 | ISO 8601 week numbering — boundary week (e.g. 2026-12-28 → W53/2026, 2027-01-04 → W1/2027) | Functional |
| R4 | Callers (Step1Period upload wizard, WeeklyReportClient) track `year` in their own state and pass to WeekPicker | Functional |
| R5 | URL persistence (Weekly Report) keeps `year` in query params alongside `weekNum` | Functional |
| R6 | Backward-compat — when no year explicitly chosen, defaults to current year (today's year) | Non-functional |
| R7 | Snapshots stored unchanged — schema already has `psp_year` + `psp_week_num` separate | Non-functional |

## 2. AS-IS 현황 분석

### 2.1 Week generation
[apps/web/src/lib/weekly-report-mock.ts](../../apps/web/src/lib/weekly-report-mock.ts):
- `generateWeeksForYear(year)` (function exists; UTC-based, Friday-anchored, ISO-style)
- `getAvailableWeeks()` (line ~528) — **hardcodes year=2026**, returns generated list
- `WeekEntry` type has `weekNum` + `year` fields, so per-entry year info already there

### 2.2 WeekPicker component
[apps/web/src/components/shared/WeekPicker.tsx](../../apps/web/src/components/shared/WeekPicker.tsx):
- Props: `weeks, selectedWeekNum, onPickWeek, statusByLabel, allowClickLocked`
- **No year prop, no year nav** — assumes single-year list
- Internal state: `center` (scroll), `expanded` (collapse/grid)

### 2.3 MonthPicker (reference — already year-aware)
[apps/web/src/components/shared/MonthPicker.tsx](../../apps/web/src/components/shared/MonthPicker.tsx):
- Has `year?: number` + `onYearChange?: (next: number) => void` props
- Renders ◄ year ► nav when `onYearChange` provided
- [MonthlyReportClient.tsx:81](../../apps/web/src/components/monthly/MonthlyReportClient.tsx#L81) tracks year state, passes through

### 2.4 Callers
| File | Uses | Current year handling |
|------|------|-----------------------|
| [Step1Period.tsx](../../apps/web/src/components/upload/Step1Period.tsx) | `<WeekPicker>` inside `WeekPickerForUpload` | Uses `getAvailableWeeks()` (hardcoded 2026), reads year from selected entry |
| [WeeklyReportClient.tsx](../../apps/web/src/components/weekly/WeeklyReportClient.tsx) | `<WeekPicker>` | Uses `getAvailableWeeks()`, tracks `weekNum` only |

### 2.5 DB schema
[packages/db/src/schema/period-snapshots.schema.ts](../../packages/db/src/schema/period-snapshots.schema.ts) — `pspYear` + `pspWeekNum` already separate, NOT NULL on year → **no migration needed**.

## 3. TO-BE 요구사항

### 3.1 AS-IS → TO-BE mapping

| Area | AS-IS | TO-BE |
|------|-------|-------|
| `weekly-report-mock` | `getAvailableWeeks()` hardcoded 2026 | `getAvailableWeeks(year)` — accept arg, default `new Date().getFullYear()` |
| `WeekPicker` props | no year nav | add `year?: number` + `onYearChange?: (next) => void` (optional); render ◄ year ► header when both supplied |
| `WeekPicker` "Show all" button | shows once collapsed | unchanged |
| `Step1Period` | uses hardcoded 2026 weeks | track `year` state at parent, regen weeks per year, pass to WeekPicker |
| `WeeklyReportClient` | tracks weekNum only | track `(year, weekNum)`; URL params: `?year=2027&week=12`; year arrow nav |
| Cross-year snapshot loading | `loadPeriodSnapshot({entId, year, weekNum})` already year-aware | unchanged |
| Status map (`statusByLabel`) | keyed by "W19" | unchanged — within a year display, labels still unique |

### 3.2 ISO 8601 boundary rule (confirmed)

- A week belongs to the year containing its **Thursday** (ISO 8601 §2.2.4).
- Equivalently: weeks with ≥4 days in year Y belong to year Y.
- `2026-12-28 (Mon) – 2027-01-03 (Sun)` has 4 days in 2026 + 3 in 2027 → **W53/2026**.
- `2027-01-04 (Mon) – 2027-01-10 (Sun)` → **W1/2027**.

The existing `generateWeeksForYear()` already follows this rule (Friday-anchored UTC math). No change to algorithm.

### 3.3 UI mock (WeekPicker header — when year nav active)

```
┌─────────────────────────────────────────────────────────────┐
│ 2. PICK THE WEEK                            ◄  2026  ►       │
├─────────────────────────────────────────────────────────────┤
│ [W1] [W2] [W3] [W4] [W5] [W6] [W7]                          │
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

Year arrows render only when `onYearChange` prop supplied — keeps WeekPicker usable for single-year contexts (back-compat).

### 3.4 URL state (WeeklyReportClient)

Current: `/reports/weekly?week=18`
After: `/reports/weekly?year=2026&week=18`

When `year` omitted in URL → default to current calendar year.

## 4. 갭 분석

| Area | Risk | Mitigation |
|------|------|------------|
| Cross-year prev-week lookup | Already handled in WeeklyReportClient.tsx:85-97 (falls back to last week of prev year) | reuse pattern |
| W53 vs W52 edge — year has 53 weeks vs 52 | `generateWeeksForYear()` returns correct count automatically | trust existing fn |
| User in 2027 viewing 2026 snapshot URL | Year query param handles it | tested via TC |
| MonthPicker has 2 callers — one already year-aware, one not | Out of scope (only WeekPicker requested) | flag for follow-up if needed |

### 4.1 Files to change

| File | Type | Phase |
|------|------|-------|
| `apps/web/src/lib/weekly-report-mock.ts` | MODIFY (`getAvailableWeeks(year?)`) | A1 |
| `apps/web/src/components/shared/WeekPicker.tsx` | MODIFY (+year nav) | A2 |
| `apps/web/src/components/upload/Step1Period.tsx` | MODIFY (track year state) | B1 |
| `apps/web/src/components/weekly/WeeklyReportClient.tsx` | MODIFY (track year + URL params) | B2 |
| i18n `messages/{en,ko}.json` | MODIFY (year nav aria labels — reuse from MonthPicker if exists) | B3 |

**Total:** 4 modify + 0 new = 4 files.

## 5. 사용자 플로우

### 5.1 Operator: upload report cho W1/2027

```
Operator → Upload Reports → Step 1 Period
   ↓
WeekPicker shows year header [◄ 2026 ►]
   ↓ click ►
WeekPicker shows year header [◄ 2027 ►] + regenerated weeks
   ↓ click W1 (Dec 28-Jan 3)
selectedPeriod = { year: 2027, weekNum: 1, periodStart: 2026-12-28, periodEnd: 2027-01-03 }
   ↓
Step 2 onwards uses (year=2027, weekNum=1) ingest
```

### 5.2 Manager: view Weekly Report W52/2026 from W1/2027 context

```
Manager on /reports/weekly?year=2027&week=1
   ↓ click ◄ year arrow (in picker)
Weeks regenerate for 2026; URL → /reports/weekly?year=2026&week=53
   ↓ click W52
URL → /reports/weekly?year=2026&week=52
   ↓
Loads snapshot via loadPeriodSnapshot({ year: 2026, weekNum: 52 })
```

## 6. 기술 제약사항

- **No DB migration** — `psp_year` + `psp_week_num` already separate.
- **No new dependency** — reuse existing UTC week math; no need for `date-fns`.
- **Performance** — regenerating weeks per year is O(55) iterations, trivial.
- **Cross-year prev-week** (WoW deltas) — already handled in WeeklyReportClient.
- **i18n** — reuse `weekPicker.*` namespace; add aria labels for year arrows if MonthPicker doesn't already share them.

---

**Next:** PLAN-20260522 — concrete phase steps.
