---
title: System Design Index
description: Cross-cutting backend patterns — Server Actions, API routes, background jobs, storage.
load-when: Implementing backend feature, choosing between Server Action vs Route Handler, integrating S3 / Background Worker.
---

# System Design

> Implementation patterns. NOT high-level architecture (see [architecture/](../architecture/_INDEX.md)) or UI (see [component-style/](../component-style/_INDEX.md)).

## Files

| File | When to read | Status |
|---|---|---|
| [server-actions.md](server-actions.md) | Writing mutations from UI (forms, buttons) | skeleton |
| [api-routes.md](api-routes.md) | Webhook endpoints, public API, third-party callbacks | skeleton |
| [background-jobs.md](background-jobs.md) | Async parse Excel / send email / cron | skeleton |
| [s3-storage.md](s3-storage.md) | Upload/download files (presigned URLs) | skeleton |

## Decision tree: Server Action vs API Route

```
Need from inside our own Next.js UI? ───► Server Action (use server)
Need from external system (webhook)? ───► API Route Handler (/api/v1/*)
Need long-running (>10s) or async UX? ──► Background Worker (Render service + DB queue)
Need file upload >5MB? ─────────────────► S3 Presigned URL (direct from browser)
```

## See also

- [docs/_NAV.md](../\_NAV.md)
- [architecture/REQUEST-LIFECYCLE.md](../architecture/REQUEST-LIFECYCLE.md)
- [.claude/skills/excel-parser/SKILL.md](../../.claude/skills/excel-parser/SKILL.md)
- [.claude/skills/cm-calculator/SKILL.md](../../.claude/skills/cm-calculator/SKILL.md)
