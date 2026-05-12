---
title: Request Lifecycle
description: End-to-end request flow for RSC, Server Action, API Route, Background Job. Where each piece runs.
load-when: Debugging request flow / unsure where logic should live / first time understanding Next.js App Router.
status: skeleton
---

# Request Lifecycle

> Skeleton — fill code examples khi implement.

## 1. Four request types

| Type | Path | When |
|---|---|---|
| **RSC** (React Server Component) | `app/**/page.tsx` | Page render (initial nav, browser request) |
| **Server Action** | `'use server'` function | Form submit, button click from Client Component |
| **API Route Handler** | `app/api/v1/**/route.ts` | External webhook, third-party callback |
| **Background Job** | `apps/web/src/server/inngest/*` | Async parse, scheduled cron |

## 2. RSC flow (page render)

```
Browser → GET /reports/weekly
       │
       ▼
Next.js middleware (auth verify, ent_id inject in headers)
       │
       ▼
RSC page.tsx (server, async)
   ├─ await getCurrentUser()
   ├─ await service.listSomething(entId)
   ├─ render JSX with data
       │
       ▼
Streaming HTML → browser
   │
   ▼
Client Components hydrate (interactive)
```

→ Reference: [INTEGRATION-amb.md §3](INTEGRATION-amb.md) middleware detail.

## 3. Server Action flow (mutation)

```
Client Component → form.onSubmit
                 → call `actionFn(formData)`
                 │
                 ▼ (network round-trip)
Server Action handler (server)
   ├─ Zod parse input
   ├─ requireRole(ctx.role, [...])
   ├─ service.doSomething(...)
   ├─ revalidatePath('/route') or redirect()
   │
   ▼ (response)
Client receives result, RSC re-renders
```

```
TODO: example
- create-sku.action.ts pattern
- error handling pattern
```

## 4. API Route flow (webhook)

```
External → POST /api/v1/inngest/webhook
        │
        ▼
route.ts POST handler
   ├─ verify HMAC signature
   ├─ parse payload
   ├─ delegate to service or queue
   ├─ return Response
```

## 5. Background Job flow (Render Worker + DB queue)

```
Server Action: INSERT into sal_upload_sessions { status: 'PENDING' }
       │ returns immediately
       ▼
Render Background Worker (separate service):
   while(true) {
     job = SELECT ... WHERE status='PENDING' FOR UPDATE SKIP LOCKED LIMIT 1
     if (job) {
       UPDATE status='PROCESSING'
       parse + calc
       UPDATE status='DONE' (or 'FAILED' on error)
     } else sleep(2s)
   }
```

Detail: [system-design/background-jobs.md](../system-design/background-jobs.md).

## 6. Caching layers

```
TODO: detail
- Next.js fetch cache (server-side)
- React.cache (per-request memo)
- RSC Suspense boundary
- React Query / SWR (client-side, optional)
- Drizzle query cache (none by default)
```

## 7. Anti-patterns ❌

- ❌ Fetch data trong Client Component (cần qua RSC + Server Action)
- ❌ Throw raw `Error` từ Server Action — wrap với error code (xem [ERROR-HANDLING.md](ERROR-HANDLING.md))
- ❌ Call Server Action từ Server Action (chain) — refactor thành shared service
- ❌ Use `revalidateTag` không có tag strategy — design tags upfront

## See also

- [LAYERS.md](LAYERS.md)
- [system-design/server-actions.md](../system-design/server-actions.md)
- [system-design/api-routes.md](../system-design/api-routes.md)
- [system-design/background-jobs.md](../system-design/background-jobs.md)
