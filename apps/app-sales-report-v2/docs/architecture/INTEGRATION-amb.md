# INTEGRATION-amb — Tích hợp với ambManagement

## 1. Tổng quan kiến trúc tích hợp

```
[ambManagement]                    [app-sales-report-v2]
  ├ amb_entity_custom_apps          ├ middleware.ts (jose verify)
  ├ JWT signer (JWT_SECRET)  ─────► ├ JWT verifier (same secret)
  ├ Sidebar render iframe           ├ Cookie session
  └ POST /custom-apps/:id/token     └ ent_id-scoped queries
                  │
                  └── shared JWT_SECRET (env, NEVER differ)
```

ambManagement đóng vai trò **Identity Provider + Host shell**. v2 là **resource server** verify token, không tự issue token.

## 2. App registration (one-time, admin AMA thao tác)

Admin AMA vào **Settings → Custom Apps → Add**:

| Field | Value |
|---|---|
| `eca_code` | `sales-report-v2` |
| `eca_name` | `Sales Performance & Prime Cost` |
| `eca_url` | `https://sales-v2.apps.amoeba.site` (hoặc dev URL) |
| `eca_auth_mode` | `jwt` |
| `eca_open_mode` | `iframe` |
| `eca_allowed_roles` | `OWNER, MASTER, MANAGER` |
| `eca_health_url` | `https://sales-v2.apps.amoeba.site/api/v1/health` |

→ DB ambManagement INSERT vào `amb_entity_custom_apps`. Sau đó user của entity đó sẽ thấy app trong sidebar.

## 3. Authentication flow

### 3.1 First-load (user click app trong sidebar AMA)

```
1. AMA frontend → POST /entity-settings/custom-apps/:id/token
   Response: { token: "eyJ...", expiresIn: 3600 }

2. AMA frontend render:
   <iframe src="https://sales-v2.apps.amoeba.site/?ama_token=eyJ...&locale=ko" />

3. Next.js v2 middleware.ts:
   a. Đọc query ?ama_token=
   b. Verify bằng jose.jwtVerify(token, secret) với JWT_SECRET env
   c. Parse claims: { entId, userId, role, channel: 'AMA' }
   d. Set HttpOnly Secure SameSite=None cookie 'amb_session' = token
   e. 302 redirect về same URL bỏ ?ama_token (giữ ?locale)
```

### 3.2 Subsequent requests

```
1. Browser tự gửi cookie 'amb_session'
2. middleware.ts verify cookie → inject vào headers:
   - x-ent-id
   - x-user-id
   - x-user-role
3. Server Component / Action đọc qua getCurrentUser() helper
```

### 3.3 Token expiry

- AMA token TTL ~1h. Khi expire → 401 từ middleware → trả về page `/session-expired` → user reload iframe → AMA tự issue token mới.
- Optional: gọi `postMessage` ra parent (AMA) để parent re-issue token thay vì reload.

## 4. JWT claims contract

```ts
// packages/shared/src/auth/jwt-claims.ts
export const amaJwtClaims = z.object({
  sub: z.string().uuid(),          // userId AMA
  ent_id: z.string().uuid(),       // entity (multi-tenancy key)
  role: z.enum(['OWNER', 'MASTER', 'MANAGER', 'MEMBER']),
  email: z.string().email().optional(),
  name: z.string().optional(),
  app_code: z.literal('sales-report-v2'),  // tránh token reuse
  iat: z.number(),
  exp: z.number(),
  iss: z.literal('amb-management'),
  aud: z.literal('sales-report-v2'),
});
```

**MUST**: verify `iss`, `aud`, `app_code` để chống dùng token của app khác.

## 5. Multi-tenancy (ent_id isolation)

### 5.1 Helper bắt buộc

```ts
// packages/db/src/lib/with-ent.ts
export function withEnt<T extends PgTableWithColumns<any>>(
  table: T,
  entId: string,
) {
  return eq(table.entId, entId);
}
```

### 5.2 Service pattern

```ts
// server/services/sku.service.ts
export async function listSkus(ctx: AuthContext) {
  return db.select()
    .from(salSkus)
    .where(and(
      withEnt(salSkus, ctx.entId),    // ← BẮT BUỘC
      isNull(salSkus.deletedAt),
    ));
}
```

### 5.3 Lint rule (đề xuất)

ESLint custom rule: cấm `db.select().from(salXXX)` không có `withEnt(...)` trong `.where()`. Hoặc dùng `eslint-plugin-no-unsanitized` pattern.

## 6. iframe constraints

### 6.1 Headers `next.config.ts`

```ts
async headers() {
  return [{
    source: '/:path*',
    headers: [
      // KHÔNG set X-Frame-Options (cấm cũng cấm cả AMA)
      {
        key: 'Content-Security-Policy',
        value: `frame-ancestors 'self' https://*.amoeba.site;`,
      },
    ],
  }];
}
```

### 6.2 Cookie

- `SameSite=None; Secure` (bắt buộc cho iframe cross-site)
- `HttpOnly` (chống XSS đọc token)
- Domain mặc định (host-only), không set Domain attribute

### 6.3 CORS

Server Action / Route Handler chỉ chấp nhận request từ chính origin của app — KHÔNG cần allow `*.amoeba.site` vì AMA gọi qua iframe (same-origin với app, không phải cross-origin fetch).

## 7. App Store proxy (optional)

Nếu cần sync subscription / app metadata từ ambAppStore platform:

```
v2 backend → GET ${APP_STORE_API_URL}/api/v1/platform/subscriptions/entity/{entId}
            Authorization: Bearer <service_token>
```

Service token dùng client_credentials grant — chưa cần ở MVP.

## 8. Locale passthrough

```ts
// middleware.ts
const locale = searchParams.get('locale') ?? cookies.get('locale')?.value ?? 'ko';
response.cookies.set('locale', locale);
```

→ Next.js `next-intl` đọc cookie `locale` cho mọi RSC.

## 9. Health check

`GET /api/v1/health` → `{ status: 'ok', db: 'ok', s3: 'ok', timestamp }` — AMA poll để hiển thị badge "healthy" trong custom apps list.

## 10. Checklist deploy app mới vào AMA

- [ ] `JWT_SECRET` env trên v2 trùng với AMA
- [ ] Deploy URL HTTPS (cookie Secure)
- [ ] CSP `frame-ancestors` cho phép AMA domain
- [ ] Health endpoint sống
- [ ] Admin AMA tạo record `amb_entity_custom_apps`
- [ ] Test JWT verify với token thật từ staging AMA
- [ ] Test refresh khi token expire
- [ ] Test multi-tenancy: 2 entity khác nhau không nhìn thấy data nhau
