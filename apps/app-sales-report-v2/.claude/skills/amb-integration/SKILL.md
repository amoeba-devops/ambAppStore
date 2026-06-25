---
name: amb-integration
description: Tích hợp với ambManagement (AMA) — JWT verify, ent_id multi-tenancy, iframe hosting, app registration. Dùng khi đụng auth, session, cross-app.
---

# Skill: amb-integration

> Tài liệu chính: [INTEGRATION-amb.md](../../../docs/architecture/INTEGRATION-amb.md). Skill này là cheat-sheet cho code.

## Khi nào dùng
- Implement `middleware.ts`
- Implement `getCurrentUser()` helper
- Debug session expired, iframe blocked, ent_id leak
- Test cross-entity isolation

## JWT verify pattern (jose)

```ts
// apps/web/src/lib/auth/verify-jwt.ts
import { jwtVerify } from 'jose';
import { amaJwtClaims } from '@v2/shared/auth/jwt-claims';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function verifyAmaJwt(token: string) {
  const { payload } = await jwtVerify(token, secret, {
    issuer: 'amb-management',
    audience: 'sales-report-v2',
  });
  return amaJwtClaims.parse(payload);
}
```

## Middleware

```ts
// apps/web/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAmaJwt } from '@/lib/auth/verify-jwt';

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  
  // 1. First-load: ?ama_token= → cookie → redirect
  const incomingToken = url.searchParams.get('ama_token');
  if (incomingToken) {
    try {
      await verifyAmaJwt(incomingToken);
    } catch {
      return new NextResponse('Invalid token', { status: 401 });
    }
    const cleanUrl = new URL(url);
    cleanUrl.searchParams.delete('ama_token');
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set('amb_session', incomingToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',  // iframe cross-site
      path: '/',
    });
    return res;
  }
  
  // 2. Subsequent: cookie present → verify → pass
  const cookieToken = req.cookies.get('amb_session')?.value;
  if (!cookieToken) {
    return NextResponse.redirect(new URL('/session-expired', req.url));
  }
  try {
    const claims = await verifyAmaJwt(cookieToken);
    const res = NextResponse.next();
    res.headers.set('x-ent-id', claims.ent_id);
    res.headers.set('x-user-id', claims.sub);
    res.headers.set('x-user-role', claims.role);
    return res;
  } catch {
    return NextResponse.redirect(new URL('/session-expired', req.url));
  }
}

export const config = {
  matcher: ['/((?!_next|api/v1/health|session-expired).*)'],
};
```

## getCurrentUser helper (RSC + Server Action)

```ts
// apps/web/src/server/auth/get-current-user.ts
import { headers } from 'next/headers';
import 'server-only';

export async function getCurrentUser() {
  const h = await headers();
  const entId = h.get('x-ent-id');
  const userId = h.get('x-user-id');
  const role = h.get('x-user-role') as Role;
  if (!entId || !userId) throw new Error('Unauthenticated');
  return { entId, userId, role };
}
```

## Pattern: ent_id-scoped query (BẮT BUỘC)

```ts
// server/services/sku.service.ts
export async function listSkus() {
  const { entId } = await getCurrentUser();
  return db.select()
    .from(salSkus)
    .where(and(
      eq(salSkus.entId, entId),       // ← KHÔNG được quên
      isNull(salSkus.deletedAt),
    ));
}
```

→ Helper `withEnt(table, entId)`:
```ts
export function withEnt<T extends { entId: any }>(table: T, entId: string) {
  return eq(table.entId, entId);
}
```

## Role check

```ts
import { z } from 'zod';

export function requireRole(role: Role, allowed: Role[]) {
  if (!allowed.includes(role)) {
    throw new Error('SAL-E0403');  // Forbidden
  }
}

// Usage in Server Action:
'use server';
export async function updatePrimeCost(input: UpdatePrimeCostInput) {
  const ctx = await getCurrentUser();
  requireRole(ctx.role, ['OWNER', 'MASTER']);  // Chỉ admin sửa giá vốn (PRD §3.1 F3, §4.3)
  // ...
}
```

## iframe headers config

```ts
// apps/web/next.config.ts
const config = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: `frame-ancestors 'self' https://*.amoeba.site;`,
        },
      ],
    }];
  },
};
```

**KHÔNG set** `X-Frame-Options` (sẽ block iframe).

## Cookie config

| Attribute | Value | Lý do |
|---|---|---|
| `httpOnly` | `true` | Chống XSS |
| `secure` | `true` | HTTPS only |
| `sameSite` | `'none'` | Iframe cross-site |
| `path` | `'/'` | |
| `maxAge` | match JWT `exp` | |

## Session expired flow

```
User idle → JWT expire → next request → middleware verify fail
   ↓ redirect /session-expired
Page session-expired.tsx:
   - Hiển thị message
   - postMessage('AMA_TOKEN_EXPIRED', '*') → parent AMA xử lý
   - Hoặc: button "Reload" → user click → AMA reload iframe với token mới
```

## Debug checklist

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| 401 ngay khi load | `JWT_SECRET` không trùng với AMA |
| Cookie không set | Thiếu `SameSite=None; Secure` → browser block iframe cookie |
| Cookie set nhưng request không gửi | Missing `secure` trên HTTPS env |
| Vẫn vào được app dù entity khác | Quên `withEnt()` trong query |
| iframe blank | CSP `frame-ancestors` chặn AMA domain |
| Token verify pass nhưng claims sai | Sai `audience` / `issuer` |

## Test cross-tenant isolation

```ts
// e2e test
test('user from entity A không nhìn thấy data của entity B', async () => {
  const tokenA = signTestJwt({ ent_id: 'ent-a', sub: 'user-1' });
  const tokenB = signTestJwt({ ent_id: 'ent-b', sub: 'user-2' });
  
  // seed: 1 SKU cho ent-a, 1 SKU cho ent-b
  
  const resA = await fetch('/api/...', { headers: { Cookie: `amb_session=${tokenA}` }});
  expect(await resA.json()).toHaveLength(1);  // chỉ thấy SKU của ent-a
});
```
