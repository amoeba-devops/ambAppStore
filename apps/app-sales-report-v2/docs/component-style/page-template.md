---
title: Page Template
description: Base layout for a Next.js App Router page — RSC default, header, breadcrumb, content area, error/loading boundaries.
load-when: Creating new page under app/(dashboard)/* or any route.
status: skeleton
---

# Page Template

> Skeleton — chuẩn hóa structure của 1 page mới.

## 1. File layout

```
app/(dashboard)/<route>/
├── page.tsx              ← RSC entry (server)
├── loading.tsx           ← Suspense fallback (auto-wrapped by Next.js)
├── error.tsx             ← Error boundary (Client Component)
├── _components/          ← Page-scoped components (private)
│   ├── PageHeader.tsx
│   ├── SectionA.tsx
│   └── SectionB.tsx
└── _actions/             ← Page-scoped Server Actions (private)
    └── do-something.action.ts
```

`_` prefix = private subfolder Next.js không route.

## 2. page.tsx skeleton (TODO fill)

```
TODO: example
- async server component
- await getCurrentUser()
- await service.getData(...)
- return <PageLayout><Header /><Content /></PageLayout>
```

## 3. PageLayout (shared component)

```
TODO: từ packages/ui/PageLayout
- Sidebar nav
- Top bar (period selector, user menu)
- Main content slot
- Footer
```

## 4. Breadcrumb

```
TODO: từ shadcn breadcrumb
- Auto-generate từ pathname?
- Hoặc manual prop?
```

## 5. Metadata (SEO + tab title)

```
TODO: export const metadata = { title: ..., description: ... }
- Use generateMetadata() if dynamic per route
```

## 6. Required behaviors

| Element | Required? |
|---|---|
| `<title>` (metadata) | ✅ |
| Breadcrumb | ✅ (except dashboard root) |
| Page header với title + actions | ✅ |
| Loading state (Suspense) | ✅ |
| Error boundary | ✅ |
| Empty state khi no data | ✅ (xem [states.md](states.md)) |

## 7. Anti-patterns ❌

- ❌ Default Client Component (`'use client'` top of file) → mất RSC benefits
- ❌ Skip loading.tsx → blank screen during data fetch
- ❌ Inline service logic trong page.tsx — phải qua service layer
- ❌ Hardcode tab title — qua i18n + metadata

## See also

- [_INDEX.md](_INDEX.md)
- [states.md](states.md)
- [../architecture/REQUEST-LIFECYCLE.md](../architecture/REQUEST-LIFECYCLE.md)
