---
title: Server Actions Pattern
description: 'use server' function conventions — input validation, auth, error handling, revalidate/redirect.
load-when: Writing or modifying any Server Action / form submit handler.
status: skeleton
---

# Server Actions

> Skeleton — fill examples khi implement.

## 1. When to use Server Action vs API Route

Xem [_INDEX.md decision tree](_INDEX.md).

Default: **Server Action**. Use API Route only for external webhooks.

## 2. File convention

```
TODO: pattern
- File: <verb>-<entity>.action.ts (vd: create-sku.action.ts)
- Folder: app/(dashboard)/<route>/_actions/ (page-scoped)
         or server/actions/ (shared across routes)
- Top of file: 'use server'
- Export named function: export async function createSku(input: Input): Promise<Result>
```

## 3. Standard shape

```ts
TODO: example
'use server';

import { z } from 'zod';
import { getCurrentUser, requireRole } from '@/server/auth/get-current-user';
import { skuService } from '@/server/services/sku.service';
import { createSkuSchema } from '@v2/shared/zod/sku';

export async function createSku(input: unknown): Promise<ActionResult<{ skuId: string }>> {
  // 1. Auth + role
  const ctx = await getCurrentUser();
  requireRole(ctx.role, ['ADMIN', 'OPERATOR']);

  // 2. Validate input (Zod)
  const parsed = createSkuSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { code: 'SAL-E0001', message: parsed.error.message } };
  }

  // 3. Call service (business logic)
  try {
    const sku = await skuService.create(ctx.entId, parsed.data);
    revalidatePath('/master/skus');
    return { success: true, data: { skuId: sku.id } };
  } catch (e) {
    if (e instanceof SalError) {
      return { success: false, error: { code: e.code, message: e.message } };
    }
    throw e; // unexpected → error boundary
  }
}
```

## 4. Standard return type

```ts
type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
```

Always check `result.success` in caller.

## 5. Auth + role pattern

Mọi action phải `getCurrentUser()` ngay đầu. `requireRole()` cho action sensitive.

Reference: [.claude/skills/amb-integration/SKILL.md](../../.claude/skills/amb-integration/SKILL.md) §5.

## 6. Revalidate vs redirect

| Use case | Call |
|---|---|
| Update list view | `revalidatePath('/list-route')` |
| Update detail | `revalidatePath('/detail/[id]', 'page')` |
| Navigate after create | `redirect('/new-route')` (throws) |
| Cache tag invalidate | `revalidateTag('tag-name')` |

## 7. Anti-patterns ❌

- ❌ Skip `getCurrentUser()` — multi-tenant leak
- ❌ Direct DB call (Drizzle) trong action — phải qua service
- ❌ Throw raw `Error` — wrap với `SalError`
- ❌ Return data trên error path — confusing for caller
- ❌ Forget `revalidatePath` — stale UI
- ❌ Action chain calling action (refactor to service)
- ❌ Long-running (>10s for UX, or any task user doesn't need to wait for) — refactor to Background Worker (INSERT job to DB queue + return immediately)

## See also

- [_INDEX.md](_INDEX.md)
- [../architecture/ERROR-HANDLING.md](../architecture/ERROR-HANDLING.md)
- [../component-style/form-pattern.md](../component-style/form-pattern.md)
- Next.js Server Actions: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions
