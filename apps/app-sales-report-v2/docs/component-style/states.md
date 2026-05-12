---
title: UI States — Loading / Empty / Error
description: Conventions for handling 3 non-happy-path UI states. Suspense, ErrorBoundary, empty placeholders.
load-when: Building any data-driven component / page / table.
status: skeleton
---

# Loading / Empty / Error States

> Skeleton — fill examples khi scaffold.

## 1. Three states required for ANY data UI

```
TODO: matrix
| State | When | UX |
|---|---|---|
| Loading | data fetching | skeleton placeholders |
| Empty | data fetched but list is empty | illustration + CTA |
| Error | fetch/mutation failed | message + retry button |
```

## 2. Loading state

### RSC (Server Component) — Suspense + loading.tsx

```
TODO: example
- app/(dashboard)/<route>/loading.tsx — auto-wraps page.tsx
- Show skeleton matching final layout
```

### Client Component — `useState` + isLoading

```
TODO: example
- Show <Spinner /> or skeleton
- Disable interaction during load
```

### Skeletons (shadcn `Skeleton`)

```
TODO: example
- <Skeleton className="h-4 w-32" /> placeholders matching content shape
- Animate-pulse default
```

## 3. Empty state

```
TODO: example
- Centered illustration / icon
- Message: "No data yet. <Action>"
- CTA button if action available
- i18n key per page
```

Common empty cases:
| Page | Empty when | Suggested CTA |
|---|---|---|
| Weekly Report | No upload for selected week | "Upload reports" → /upload |
| Prime Cost | No SKUs registered | "Import from CSV" |
| Activity Log | No actions logged | (no CTA — just message) |

## 4. Error state

### RSC — error.tsx

```
TODO: example
- app/(dashboard)/<route>/error.tsx — must be Client Component
- Shows message + Retry button (calls reset())
- Logs to Render logs (`console.error` → captured automatically)
```

### Server Action error response

```
TODO: example
- form.setError() or toast.error()
- Display error code + i18n message
- Retry button if retryable
```

### Error code → user message

```
TODO: table from ERROR-HANDLING.md
- 'SAL-E0201' → t('errors.invalid_file_type')
```

## 5. Combination patterns

### Table with all 3 states

```
TODO: example
- isLoading → skeleton rows
- data.length === 0 → empty state row spanning all columns
- error → error row with retry
```

### Form with all 3 states

```
TODO: example
- isSubmitting → disable + spinner
- success → toast + reset
- error → field-level message OR toast
```

## 6. Anti-patterns ❌

- ❌ Page render → blank screen → data popup (no loading state)
- ❌ Empty list shown as "No data" plain text — needs illustration
- ❌ Error console-only, no UI feedback
- ❌ Skeleton không match layout cuối (creates jank when data arrives)
- ❌ Retry button không clear error state (multiple retries stack)

## See also

- [_INDEX.md](_INDEX.md)
- [../architecture/ERROR-HANDLING.md](../architecture/ERROR-HANDLING.md)
- shadcn Skeleton: https://ui.shadcn.com/docs/components/skeleton
