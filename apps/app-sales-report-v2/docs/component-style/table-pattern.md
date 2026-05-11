---
title: Table Pattern
description: TanStack Table conventions — sort/filter/search, pagination, sticky header, totals row, virtualization.
load-when: Building a data table — Product Breakdown, SKU master list, Activity Log, etc.
status: skeleton
---

# Table Pattern

> Skeleton — fill code khi implement Product Breakdown table (FR-09).

## 1. Stack

- **@tanstack/react-table** — headless table logic
- **shadcn Table** — visual primitives
- **TanStack Virtual** — only if >500 rows

## 2. File layout

```
_components/<Entity>Table/
├── columns.ts              ← column defs (typed)
├── DataTable.tsx           ← generic wrapper
├── DataTableToolbar.tsx    ← search + filter
├── DataTablePagination.tsx
└── DataTableTotalsRow.tsx  ← sum row at bottom
```

## 3. Column definition skeleton

```
TODO: example
- accessorKey + header + cell renderer
- Sort indicator
- Formatter (VND, %, date)
- Sticky first column for SKU/name
```

## 4. Features per page (matching FR-09 AC)

- ✅ Sort by any column
- ✅ Filter/search by product name or SKU
- ✅ Sticky header on scroll
- ✅ Totals row at bottom (numeric columns)
- ✅ Visual flag (orange) cho row missing Prime Cost
- ✅ Empty state khi no rows
- ⏳ Column visibility toggle (Phase 2)
- ⏳ Column reorder (Phase 2)
- ⏳ Export inline (use page export button)

## 5. Performance

- < 500 rows: regular render OK
- 500-5000 rows: pagination (50 per page)
- > 5000 rows: TanStack Virtual + windowing

## 6. Anti-patterns ❌

- ❌ Map .filter().sort() trên client cho large dataset — server-side via query
- ❌ Custom sort/filter UI từ scratch — dùng TanStack Table primitives
- ❌ Inline format numbers — qua design-tokens helpers
- ❌ Cell click handler trùng với row click handler

## See also

- [_INDEX.md](_INDEX.md)
- [design-tokens.md](design-tokens.md) — number formatting
- TanStack Table docs: https://tanstack.com/table
