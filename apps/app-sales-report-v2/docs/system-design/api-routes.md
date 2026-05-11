---
title: API Route Handlers
description: '/api/v1/*' conventions — webhooks, public API, health check, third-party callbacks.
load-when: Adding webhook endpoint, exposing API for external system, health probe.
status: skeleton
---

# API Routes

> Skeleton — fill examples khi implement health endpoint.

## 1. When to use

Use API Route ONLY for:
- ✅ Health check `/api/v1/health`
- ✅ Third-party webhook receivers (rare in MVP)
- ❌ NOT for in-app UI mutations → use Server Action
- ❌ NOT for data fetching → use RSC
- ❌ NOT for background jobs → use Render Background Worker (xem [background-jobs.md](background-jobs.md))

## 2. File convention

```
app/api/v1/<resource>/route.ts
```

Export named functions: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`.

## 3. Standard response shape

```ts
{
  success: boolean,
  data?: T,
  error?: { code: string, message: string },
  timestamp: string  // ISO 8601
}
```

HTTP status:
- `200` success
- `400` invalid input (with `error.code = SAL-E0001`)
- `401` unauthenticated
- `403` forbidden
- `404` not found
- `500` internal error
- `503` external service unavailable

## 4. Skeleton

```
TODO: example
- app/api/v1/health/route.ts (GET): returns { status, db, s3, timestamp }
  - Used bởi Render health check + AMA registry status badge
```

## 5. Auth for API routes

External callers (webhooks): verify HMAC signature, NOT JWT.

```
TODO: HMAC verify helper (only if third-party webhook needed)
- HMAC-SHA256 với shared secret
- Compare timing-safe (crypto.timingSafeEqual)
```

In-app callers (rare): JWT verify same as Server Action.

## 6. Input validation

Same Zod schema as Server Action — share `packages/shared/zod/*`.

## 7. CORS

App này iframe-host, KHÔNG public API. Default Next.js no-CORS đủ.

Nếu cần cho phép specific origin: response header `Access-Control-Allow-Origin: <specific>`.

## 8. Rate limiting

Phase 2. Simple in-memory map nếu cần, hoặc DB-based counter (sliding window).

## 9. Anti-patterns ❌

- ❌ Auth qua cookie cho webhook external — phải HMAC
- ❌ Throw raw error → 500 leak stack
- ❌ Return non-standard shape — break consumer
- ❌ Forget timestamp field
- ❌ Public API không có versioning (`/api/v1/`)

## See also

- [_INDEX.md](_INDEX.md)
- [server-actions.md](server-actions.md)
- [background-jobs.md](background-jobs.md) — Worker (separate service, KHÔNG qua API route)
- [../architecture/ERROR-HANDLING.md](../architecture/ERROR-HANDLING.md)
