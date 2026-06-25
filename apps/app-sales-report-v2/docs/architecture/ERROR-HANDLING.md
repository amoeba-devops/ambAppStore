---
title: Error Handling
description: Error code convention SAL-E*, error boundaries, retry strategy, user-facing messages.
load-when: Throwing/catching error / writing error boundary / designing retry logic.
status: skeleton
---

# Error Handling

> Skeleton — fill examples + code patterns khi implement.

## 1. Error code system

Format: `SAL-E{4 digits}` (per root [CLAUDE.md](../../../../CLAUDE.md))

| Range | Category | Examples |
|---|---|---|
| `SAL-E0001~0099` | Validation | `0001` invalid SKU, `0002` invalid period |
| `SAL-E0100~0199` | Auth | `0101` unauthenticated, `0102` forbidden, `0103` expired |
| `SAL-E0200~0299` | Upload | `0201` invalid file type, `0202` parse failed, `0203` ambiguous |
| `SAL-E0300~0399` | Calculation | `0301` missing prime cost, `0302` div by zero |
| `SAL-E0400~0499` | DB | `0401` not found, `0402` duplicate, `0403` constraint |
| `SAL-E0500~0599` | External | `0501` AMA JWT verify failed, `0502` S3 unavailable |
| `SAL-E0900~0999` | Internal | `0900` unknown |

```
TODO: full table on implement
```

## 2. Error class

```ts
TODO: implement
class SalError extends Error {
  constructor(public code: string, public httpStatus: number, message: string, public details?: any) {
    super(message);
  }
}
```

## 3. Throwing from layers

| Layer | What to throw |
|---|---|
| Domain | Pure errors (no HTTP concept) — `InvalidSkuError extends Error` |
| Application | `SalError` with code + httpStatus |
| Presentation (Server Action) | `SalError` propagates to client as serialized response |

## 4. Catching

### Server Action

```
TODO: example
- try/catch + return { success: false, error: { code, message } }
- never throw raw — always typed response
```

### RSC

```
TODO: example
- error.tsx route file
- ErrorBoundary wrap for Client Components
```

### API Route

```
TODO: example
- Standard JSON response: { success: false, error: { code, message, timestamp } }
- HTTP status from SalError.httpStatus
```

## 5. User-facing messages (i18n)

Server return **error code only**, frontend i18n lookup translates to user language:

```
TODO: example
- errors.SAL-E0201 = "File format không hỗ trợ. Chỉ accept .csv .xls .xlsx"
- per locale ko/en/vi
```

## 6. Retry policy

| Operation | Retry? | Strategy |
|---|---|---|
| S3 upload | ✅ 3x | exponential backoff |
| Background Worker job | ✅ 3x | DB-driven (retry_count + next_retry_at + backoff 1m/5m/15m) |
| Drizzle query | ❌ | DB pool handle |
| AMA JWT verify | ❌ | redirect to /session-expired |
| External API | ✅ 3x | with circuit breaker |

```
TODO: implement helpers
```

## 7. Anti-patterns ❌

- ❌ Throw raw `new Error('...')` từ Server Action — leak stack trace
- ❌ Catch và swallow silent — luôn log
- ❌ Retry idempotent operations (POST without dedup key)
- ❌ User-facing message khô hard-code tiếng English — phải qua i18n
- ❌ Error code không trong table § 1 → add code mới + document

## See also

- [_INDEX.md](_INDEX.md)
- [REQUEST-LIFECYCLE.md](REQUEST-LIFECYCLE.md)
- [component-style/states.md](../component-style/states.md) — UI error state
