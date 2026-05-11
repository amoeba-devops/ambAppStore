---
title: Chart Pattern
description: Recharts conventions — bar chart, line chart, tooltips, legends, exportable PNG for trending reports.
load-when: Building Trending Report charts (FR-15~18) — Net GMV bar, CM line.
status: skeleton
---

# Chart Pattern

> Skeleton — fill khi implement Trending Report charts.

## 1. Stack

- **Recharts** — React chart library
- **html2canvas** hoặc **dom-to-image** — export chart as PNG for Excel embed

## 2. Required charts

| Chart | FR | Data source | Type |
|---|---|---|---|
| Net GMV by week | FR-15 AC-04 | `sal_reports` weekly | BarChart |
| Contribution Margin by week | FR-15 AC-05 | `sal_reports` weekly | LineChart |
| Net GMV by month (Phase 2) | FR-17 | aggregated | BarChart |
| CM by month (Phase 2) | FR-18 | aggregated | LineChart |

## 3. Bar chart skeleton

```
TODO: example
- <BarChart data={...}>
-   <XAxis dataKey="period" />
-   <YAxis tickFormatter={formatVND} />
-   <Tooltip content={<CustomTooltip />} />
-   <Bar dataKey="netGmv" fill="#color" />
- </BarChart>
```

## 4. Line chart skeleton

```
TODO: example
- <LineChart data={...}>
-   <Line dataKey="cm" stroke="..." />
-   <ReferenceLine y={0} stroke="red" /> ← cho âm/dương
- </LineChart>
```

## 5. Tooltip convention

```
TODO: CustomTooltip
- Show: period, value (VND), value (KRW), WoW/MoM %
- Format using design-tokens helpers
- Position: follow cursor
```

## 6. Color tokens

```
TODO: từ design-tokens.md
- Bar primary: ?
- Line primary: ?
- Negative value: red (status.error)
- Positive: green (status.success)
- Grid: muted gray
```

## 7. Export to PNG (FR-15 AC-06)

```
TODO: example
- Use html2canvas trên ref của ChartContainer
- Capture as base64 PNG
- Embed into Excel export workbook
```

## 8. Responsive

Use `<ResponsiveContainer width="100%" height={300}>`. KHÔNG hard-code width.

## 9. Anti-patterns ❌

- ❌ Render chart trong RSC — must Client Component (Recharts không SSR friendly)
- ❌ Format numbers inline trong dataKey — pre-format trước khi pass data
- ❌ Mix bar + line trong same chart không có rõ legend
- ❌ Chart không có empty state khi data=[]

## See also

- [_INDEX.md](_INDEX.md)
- [design-tokens.md](design-tokens.md) — colors + formatters
- Recharts docs: https://recharts.org
