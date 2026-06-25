---
title: Clean Architecture Layers
description: 4-layer separation rules — Presentation/Application/Domain/Infrastructure. Dependency direction.
load-when: Implementing feature / unsure where code goes / before adding cross-layer import.
status: skeleton
---

# Layers & Dependency Rules

> Skeleton — fill examples khi scaffold code. Source convention: root [CLAUDE.md](../../../../CLAUDE.md) §4 + adapted cho Next.js fullstack.

## 1. Four layers

```
┌─────────────────────────────────────────────┐
│ Presentation                                │
│  - app/(routes)/*  page.tsx / layout.tsx    │  React Server Components
│  - components/*    UI primitives             │  Client Components when needed
│  - server/actions/* "use server" — entry   │
└────────────────────┬────────────────────────┘
                     │ calls (typed)
┌────────────────────▼────────────────────────┐
│ Application                                  │
│  - server/services/*                         │  business orchestration
│  - server/mappers/*                          │  Entity ↔ DTO (Zod)
└────────────────────┬────────────────────────┘
                     │ calls
┌────────────────────▼────────────────────────┐
│ Domain                                       │
│  - server/domain/*                           │  pure logic (no Next.js, no Drizzle)
│  - packages/shared/zod/*                     │  schemas shared client/server
└────────────────────┬────────────────────────┘
                     │ uses interface
┌────────────────────▼────────────────────────┐
│ Infrastructure                               │
│  - packages/db/*  Drizzle schema + queries  │
│  - server/lib/s3/*                           │
│  - server/lib/inngest/*                      │
│  - server/lib/auth/*  JWT verify             │
└─────────────────────────────────────────────┘
```

## 2. Dependency rules

| Layer | MAY import from | MAY NOT import from |
|---|---|---|
| Presentation | Application, Domain (types), `packages/ui` | Infrastructure direct, `packages/db` direct |
| Application | Domain, Infrastructure (via interface) | Presentation |
| Domain | (nothing — pure) | Application, Infrastructure, `next/*`, `drizzle-orm` |
| Infrastructure | Domain (types) | Presentation, Application |

**One-way arrow only**: Presentation → Application → Domain ← Infrastructure.

## 3. Test guidance

```
TODO: examples
- Domain test: pure unit, no mocks
- Application test: mock Infrastructure interface
- Presentation test: Playwright e2e
```

## 4. Example folder mapping (TODO scaffold)

```
TODO: tree per layer
apps/web/src/
├── app/                       ← Presentation
├── components/                ← Presentation
├── server/
│   ├── actions/               ← Presentation entry
│   ├── services/              ← Application
│   ├── mappers/               ← Application
│   ├── domain/                ← Domain
│   └── lib/                   ← Infrastructure
└── ...

packages/
├── db/                        ← Infrastructure
├── shared/                    ← Domain (types + Zod)
└── ui/                        ← Presentation (shared UI)
```

## 5. Anti-patterns ❌

- ❌ Client Component import từ `packages/db` (leaks DB types/queries to browser bundle)
- ❌ Domain function import `drizzle-orm` or `next/headers` (breaks purity)
- ❌ Service function import `next/cache` (couples to framework)
- ❌ Direct `fetch('/api/...')` từ Client Component — phải qua Server Action

## See also

- [_INDEX.md](_INDEX.md)
- [ARCH-overview.md](ARCH-overview.md)
- [REQUEST-LIFECYCLE.md](REQUEST-LIFECYCLE.md)
- [system-design/server-actions.md](../system-design/server-actions.md)
