---
title: Architecture Index
description: All system architecture docs — read this before designing or modifying cross-cutting concerns.
load-when: Need understanding of how the system fits together / before architectural change.
---

# Architecture

> System-level design decisions. NOT UI patterns (see [component-style/](../component-style/_INDEX.md)) or implementation recipes (see [system-design/](../system-design/_INDEX.md)).

## Files

| File | When to read | Status |
|---|---|---|
| [ARCH-overview.md](ARCH-overview.md) | First time learning system / big picture | ready |
| [DATA-MODEL.md](DATA-MODEL.md) | Touching DB schema, query design, Drizzle ORM | ready |
| [INTEGRATION-amb.md](INTEGRATION-amb.md) | Auth, multi-tenancy, iframe, JWT verify | ready |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Setting up env, deploy to Render/Neon, CI/CD | ready |
| [LAYERS.md](LAYERS.md) | Implementing a feature — what goes in which layer | skeleton |
| [REQUEST-LIFECYCLE.md](REQUEST-LIFECYCLE.md) | Debugging request flow / RSC vs Server Action | skeleton |
| [ERROR-HANDLING.md](ERROR-HANDLING.md) | Throwing/catching errors, error codes, boundary | skeleton |

## Reading order for newcomers

1. `ARCH-overview.md` — big picture
2. `LAYERS.md` — clean architecture rules
3. `DATA-MODEL.md` — DB schema reference (only sections you touch)
4. `INTEGRATION-amb.md` — auth context every feature uses
5. Others on-demand

## See also

- [docs/_NAV.md](../\_NAV.md) — top-level navigation
- [.claude/skills/drizzle-neon/SKILL.md](../../.claude/skills/drizzle-neon/SKILL.md) — Drizzle query recipes
- [.claude/skills/amb-integration/SKILL.md](../../.claude/skills/amb-integration/SKILL.md) — JWT cheat-sheet
