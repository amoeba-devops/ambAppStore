---
title: Component Style Index
description: UI patterns and conventions — design tokens, page templates, form/table/chart/modal patterns, states.
load-when: Building or modifying UI components, layouts, forms, tables, charts.
---

# Component Style

> Frontend conventions for `apps/web/`. Tech: Next.js 15 App Router + React 18 + Tailwind 3 + shadcn/ui + Recharts.

## Files

| File | When to read | Status |
|---|---|---|
| [design-tokens.md](design-tokens.md) | Before adding any UI styling — colors, spacing, type | skeleton |
| [page-template.md](page-template.md) | Creating a new page (App Router) | skeleton |
| [form-pattern.md](form-pattern.md) | Building a form (React Hook Form + Zod) | skeleton |
| [table-pattern.md](table-pattern.md) | Data table (TanStack Table) | skeleton |
| [chart-pattern.md](chart-pattern.md) | Charts (Recharts bar / line) | skeleton |
| [modal-pattern.md](modal-pattern.md) | Dialog/Modal (shadcn Dialog) | skeleton |
| [states.md](states.md) | Loading / Empty / Error states (Suspense + ErrorBoundary) | skeleton |

## Conventions

- **Server Components by default**, Client Component only when needs hooks/events
- **Tailwind utility classes**, NO inline styles, NO CSS modules
- **shadcn/ui** primitives — copy generator, never raw import
- **All UI text via i18n** (`useTranslations()`), NO hard-code
- **lucide-react** for icons (lazy import for tree-shake)
- **dark mode**: NOT in MVP, design tokens dual-ready

## Reading order

1. `design-tokens.md` — foundation
2. `page-template.md` — page skeleton
3. `states.md` — wrap content in Suspense + ErrorBoundary
4. Specific pattern (form/table/chart/modal) when needed

## See also

- [docs/_NAV.md](../\_NAV.md)
- [system-design/server-actions.md](../system-design/server-actions.md) — data fetching pattern UI uses
- [Prototype FIRGI HTML](../../FIRGI%20Sales%20Ops%20_standalone_.html) — visual reference (browser only, Figma Make bundle)
