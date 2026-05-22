# Auth & RBAC cho app-car-manager-v2 — Kế hoạch Triển khai (Reuse-first)

```yaml
document_id: V2-PLAN-20260521-AUTH-RBAC
version: 4.0.0
status: Draft
created: 2026-05-21
updated: 2026-05-21
author: Claude (dev@amoeba.group)
strategy: "Reuse-first (D-008) + Driver phone-login (D-010 rev)"
requires: docs/analysis/REQ-20260521-auth-rbac-v2.md
effort: ~3.5 ngày (3.0d code + 0.5d testing)
```

> Strategy v4.0 = v3.0 nhưng driver login bằng **phone + ent_code (no password)** thay vì email+password. Thêm rate limit + audit + admin create driver UI ở v2.

---

## 1. Phân tích Hiện trạng Phát triển Hệ thống (시스템 개발 현황 분석)

### 1.1 Sẵn có trên repo

| Hệ thống | Sẵn sàng dùng | Cần sửa |
|----------|---------------|---------|
| **AMA** entity-custom-apps domain (CRUD + my + token endpoint) | ✅ Toàn bộ trừ payload role | 1 method service |
| **AMA** `CustomAppHostPage.tsx` (iframe mở app) | ✅ Hoàn chỉnh 209 dòng | Không sửa |
| **AMA** guards + decorators (Auth, OwnEntity, LevelRole) | ✅ Đầy đủ | Không sửa |
| **Platform** AMA SSO login (admin + user proxy) | ✅ Đang chạy | Không sửa |
| **Platform** subscription + catalog (`plt_apps`, `plt_subscriptions`) | ✅ Đang chạy | Không sửa |
| **Platform** `AppDetailPage` mở app | ⚠️ Link đơn giản | Sửa: gọi launch-token, set iframe src |
| **v2** middleware + verify + Zod | ✅ Đầy đủ | Không sửa |
| **v2** cookie + CSP + role guards | ✅ Đầy đủ | Không sửa |
| **v2** `dev-login` route | ✅ Đúng | Không sửa |
| **v2** `scripts/dev-token.mjs` | 🐛 Bug payload | Fix camelCase |
| **v2** `car_users` upsert | ❌ Chưa có | Thêm service |

### 1.2 Tech stack chốt

- **AMA**: NestJS 10 + TypeORM + PostgreSQL 15, JWT `@nestjs/jwt` HS256.
- **Platform**: NestJS 10 + TypeORM + MySQL 8 (backend), React 18 + Vite (frontend).
- **v2**: Next.js 15 + Drizzle + Neon Postgres + `jose` JWT.
- **Shared**: `JWT_SECRET` HS256 = `dev-local-jwt-secret-change-me` ở dev.

### 1.3 Ràng buộc

- v2 đã go-live MVP 2026-05-17 → thay đổi auth phải backward-compatible cookie hiện có.
- App v1 (car-manager v1, sales, stock) dùng cùng `generateAppToken` — per D-005 chấp nhận rủi ro break.
- Platform login đang hoạt động — KHÔNG đụng vào để tránh regression.

---

## 2. Kế hoạch Triển khai (단계별 구현 계획)

> 6 step nhỏ, không phase. Mỗi step 1 PR. Có thể merge độc lập (gần đúng — Step 1 + 2 cần đi cùng).

### Step 1 — AMA: `generateAppToken()` mint với `eur_role` (0.5 ngày)

**1.1** — Thêm method `findRoleByUserAndEntity()` vào `EntityUserRoleRepository`.

File: `ambManagement/apps/api/src/domain/hr/repository/entity-user-role.repository.ts`

```typescript
async findRoleByUserAndEntity(usrId: string, entId: string): Promise<EntityUserRole | null> {
  return this.repo.findOne({
    where: { usrId, entId, eurStatus: 'ACTIVE' },
  });
}
```

└─ **Side-impact**: Không (method mới).

**1.2** — Sửa `EntityCustomAppService.generateAppToken()`.

File: `ambManagement/apps/api/src/domain/entity-settings/service/entity-custom-app.service.ts:116-146`

Thay đoạn build payload:
```typescript
// 🆕 Lookup entity-scoped role
const entityRole = await this.entityUserRoleRepo
  .findRoleByUserAndEntity(user.userId, entityId);
if (!entityRole) {
  throw new ForbiddenException(
    `User ${user.userId} chưa được gán role ở entity ${entityId}`
  );
}

const payload = {
  sub: user.userId,
  email: user.email,
  role: entityRole.eurRole,           // 🆕 OWNER/MASTER/MANAGER/MEMBER
  entityId,
  appId: app.ecaId,
  appCode: app.ecaCode,
  scope: 'custom_app:context',
};
```

└─ **Side-impact**: ⚠️ **HIGH** — App v1 (car-manager v1, sales-report, stock-management) cùng dùng method này. Role payload đổi. Per D-005, chấp nhận rủi ro.

**1.3** — Inject repo vào module.

File: `ambManagement/apps/api/src/domain/entity-settings/entity-settings.module.ts`

Thêm `EntityUserRoleRepository` vào `providers` hoặc `imports` (qua `HrModule`).

└─ **Side-impact**: Low.

**1.4** — Unit test `generateAppToken()` 3 case:
1. User có eur_role ACTIVE → mint thành công, payload role = eur_role.
2. User không có row eur → 403.
3. User có row nhưng eur_status='INACTIVE' → 403.

File: `ambManagement/apps/api/test/entity-custom-app.service.spec.ts`

└─ **Side-impact**: Low.

### Step 2 — AMA: Seed `amb_entity_custom_apps` cho VN01 (0.1 ngày)

**2.1** — Viết SQL seed.

File mới: `ambManagement/scripts/seed-car-manager-v2-app.sql`

```sql
-- Activate app-car-manager-v2 cho VN01 (pilot)
INSERT INTO amb_entity_custom_apps (
  eca_id, ent_id, eca_code, eca_name, eca_name_en,
  eca_url, eca_auth_mode, eca_open_mode,
  eca_allowed_roles, eca_status,
  eca_icon_url, eca_description
)
SELECT
  gen_random_uuid(),
  ent_id,
  'app-car-manager-v2',
  N'법인차량관리 v2',
  'Corporate Vehicle Manager v2',
  -- Dev: http://localhost:3001 ; Staging: https://stg-apps.amoeba.site/app-car-manager-v2
  'http://localhost:3001',
  'jwt',
  'iframe',
  ARRAY['OWNER','MASTER','MANAGER','MEMBER']::text[],
  'ACTIVE',
  NULL,
  'CCMS - Quản lý điều xe + chi phí + bảo dưỡng (v2 Neon Postgres)'
FROM amb_hr_entities
WHERE ent_code = 'VN01'
ON CONFLICT (ent_id, eca_code) DO UPDATE SET
  eca_url = EXCLUDED.eca_url,
  eca_name = EXCLUDED.eca_name,
  eca_allowed_roles = EXCLUDED.eca_allowed_roles,
  eca_status = 'ACTIVE',
  eca_updated_at = NOW();

-- Verify
SELECT eca_code, ent_id, eca_url, eca_status, eca_allowed_roles
FROM amb_entity_custom_apps
WHERE eca_code = 'app-car-manager-v2';
```

**2.2** — Chạy seed local dev rồi staging:
```bash
# Local
psql -d db_amb -f scripts/seed-car-manager-v2-app.sql

# Staging
ssh amb-staging "cd ~/ambManagement && psql -f scripts/seed-car-manager-v2-app.sql"
```

└─ **Side-impact**: 1 row mới cho VN01. Idempotent qua ON CONFLICT.

### Step 3 — Platform: Endpoint launch-token + sửa AppDetailPage (0.5 ngày)

**3.1** — Endpoint backend Platform proxy AMA mint token.

File: `apps/platform/backend/src/platform-app/platform-app.controller.ts`

```typescript
@Post(':slug/launch-token')
@Auth()
async getLaunchToken(
  @Param('slug') slug: string,
  @CurrentUser() user: AmaJwtPayload,
) {
  return this.platformAppService.getLaunchToken(slug, user);
}
```

File: `apps/platform/backend/src/platform-app/platform-app.service.ts`

```typescript
async getLaunchToken(slug: string, user: AmaJwtPayload) {
  // 1) Validate subscription ACTIVE
  const sub = await this.subscriptionRepo.findOne({
    where: { entId: user.entityId, appSlug: slug, subStatus: 'ACTIVE' }
  });
  if (!sub) throw new ForbiddenException('Subscription not active');

  // 2) Find eca_id qua call AMA
  const amaUrl = process.env.AMA_API_BASE_URL;
  const headers = { Authorization: `Bearer ${user.amaToken}` };
  const list = await axios.get(`${amaUrl}/api/v1/entity-settings/custom-apps/my`, { headers });
  const eca = list.data.data.find((a) => a.code === slug);
  if (!eca) throw new NotFoundException(`Custom app ${slug} not registered`);

  // 3) Mint token qua AMA
  const tokenRes = await axios.post(
    `${amaUrl}/api/v1/entity-settings/custom-apps/${eca.id}/token`,
    {},
    { headers },
  );

  return { token: tokenRes.data.token, expiresAt: tokenRes.data.expiresAt };
}
```

└─ **Side-impact**: Mới — không xung đột.

⚠️ **Phase 0 finding (confirmed 2026-05-21)**: Platform JWT payload **KHÔNG include `amaToken`** ([auth.controller.ts:79](../../apps/platform/backend/src/auth/auth.controller.ts#L79)). AMA token chỉ nằm trong response object lúc login, frontend lưu localStorage.

**3.1.1 — Fix** (chọn 1):
- **Option A (Recommended)**: Thêm `amaToken` vào Platform JWT payload lúc mint (auth.controller line 64-73). Khi gọi launch-token, decode JWT lấy ra. ⚠️ JWT size tăng ~500 bytes.
- **Option B**: Frontend gửi kèm `ama_token` từ localStorage trong header `X-AMA-Token` khi gọi launch-token. ⚠️ Token expose trong request (vẫn HTTPS).
- **Option C**: Lưu (Platform user → ama_token) trong session DB / Redis. Lookup theo userId. ⚠️ Cần infra mới.

→ MVP recommend **Option B** (đơn giản nhất, không đụng JWT structure):
```typescript
// Frontend service
getLaunchToken: (slug, amaToken) => apiClient.post(`/api/v1/platform/apps/${slug}/launch-token`,
  null, { headers: { 'X-AMA-Token': amaToken } }),

// Backend controller
async getLaunchToken(@Param('slug'), @Headers('x-ama-token') amaToken, @CurrentUser() user) {...}
```

**3.2** — Sửa `AppDetailPage.tsx` để gọi launch-token.

File: `apps/platform/frontend/src/pages/AppDetailPage.tsx:135-146`

Đổi từ `<a href={app.slug}>` thành button:
```tsx
const handleOpen = async () => {
  setLoading(true);
  try {
    const { token } = await appLaunchService.getLaunchToken(app.slug);
    setIframeSrc(`/${app.slug}?ama_token=${token}`);
  } catch (e) {
    setError('Không mở được app: ' + e.message);
  } finally {
    setLoading(false);
  }
};

// render
{iframeSrc ? (
  <iframe src={iframeSrc} title={app.name} />
) : (
  <Button onClick={handleOpen} loading={loading}>Open</Button>
)}
```

File mới: `apps/platform/frontend/src/services/app-launch.service.ts`

```typescript
import { apiClient } from '@/lib/api-client';
export const appLaunchService = {
  getLaunchToken: async (slug: string) => {
    const res = await apiClient.post(`/api/v1/platform/apps/${slug}/launch-token`);
    return res.data;
  },
};
```

└─ **Side-impact**: AppDetailPage UI thay đổi (button thay link, loading state).

### Step 4 — v2: `ensureCarUser()` (0.3 ngày)

**4.1** — Service mới.

File mới: `apps/app-car-manager-v2/apps/web/src/server/services/user/ensure-car-user.service.ts`

```typescript
import { db } from '@car-v2/db';
import { carUsers, carAuditLogs } from '@car-v2/db/schema';
import { mapAmaRoleToLocal, type AmaJwtClaims } from '@car-v2/shared/auth';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';

export async function ensureCarUser(claims: AmaJwtClaims) {
  const localRole = mapAmaRoleToLocal(claims.role);

  const existing = await db.query.carUsers.findFirst({
    where: and(
      eq(carUsers.entId, claims.ent_id),
      eq(carUsers.usrAmaUserId, claims.sub),
    ),
  });

  const now = new Date();
  if (!existing) {
    const usrId = crypto.randomUUID();
    await db.insert(carUsers).values({
      usrId,
      entId: claims.ent_id,
      usrAmaUserId: claims.sub,
      usrEmail: claims.email ?? null,
      usrName: claims.name ?? null,
      usrPhone: claims.phone ?? null,       // 🆕 D-016 sync phone
      usrLocalRole: localRole,
      usrAmaRoleSnapshot: claims.role,
      usrLastLoginAt: now,
    });
    // Phase 0 finding: schema dùng aud_action + aud_entity, KHÔNG có aud_event
    await db.insert(carAuditLogs).values({
      audId: crypto.randomUUID(),
      entId: claims.ent_id,
      audActorUserId: usrId,
      audAction: 'PROVISIONED',                      // 🆕 aud_action
      audEntity: 'USER',                             // 🆕 aud_entity
      audAfter: { ama_role: claims.role, local_role: localRole },
      audCreatedAt: now,
    });
    return;
  }

  if (existing.usrLocalRole !== localRole) {
    await db.update(carUsers)
      .set({
        usrLocalRole: localRole,
        usrAmaRoleSnapshot: claims.role,
        usrLastLoginAt: now,
        usrUpdatedAt: now,
      })
      .where(eq(carUsers.usrId, existing.usrId));
    await db.insert(carAuditLogs).values({
      audId: crypto.randomUUID(),
      entId: claims.ent_id,
      audActorUserId: existing.usrId,
      audAction: 'ROLE_SYNC',
      audEntity: 'USER',
      audBefore: { local_role: existing.usrLocalRole },
      audAfter: { local_role: localRole, ama_role: claims.role },
      audCreatedAt: now,
    });
  } else {
    await db.update(carUsers)
      .set({ usrLastLoginAt: now })
      .where(eq(carUsers.usrId, existing.usrId));
  }
}
```

└─ **Side-impact**: Mới (1 file).

**4.2** — Gọi từ RSC root layout, wrap với React `cache()`.

File: `apps/app-car-manager-v2/apps/web/src/lib/auth/get-current-user.ts` (sửa) hoặc tạo wrapper mới.

```typescript
import { cache } from 'react';
import { ensureCarUser } from '@/server/services/user/ensure-car-user.service';

export const ensureCarUserCached = cache(ensureCarUser);
```

File: `apps/app-car-manager-v2/apps/web/src/app/layout.tsx`

```tsx
import { ensureCarUserCached } from '@/lib/auth/ensure-car-user-cached';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export default async function RootLayout({ children }) {
  const claims = await getCurrentUser(); // throws if not authed
  if (claims) await ensureCarUserCached(claims);
  return <html>...{children}...</html>;
}
```

└─ **Side-impact**: Mỗi RSC root render = 1 query DB (cached per request).

**4.3** — Migration audit enum: **SKIP**.

Phase 0 verify confirm: schema `car_audit_logs` dùng `aud_action` (varchar) + `aud_entity` (varchar) — không phải enum strict. KHÔNG cần migration. Chỉ dùng string mới: `audAction='PROVISIONED'`, `audEntity='USER'`.

└─ **Side-impact**: Không cần migration.

### Step 5 — v2: Fix `dev-token.mjs` bug (0.1 ngày)

File: `apps/app-car-manager-v2/scripts/dev-token.mjs:19-31`

Đổi payload từ snake_case + iss/aud sang camelCase:

```javascript
// Trước (BUG):
const token = await new SignJWT({
  sub: '00000000-...',
  ent_id: '00000000-...',         // ❌ snake_case
  role: ROLE,
  email: `dev-${ROLE.toLowerCase()}@dev.car-manager-v2.local`,
  name: `Dev ${ROLE}`,
  app_code: 'car-manager-v2',     // ❌ snake_case
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setIssuer('amb-management')    // ❌ thừa
  .setAudience('car-manager-v2')  // ❌ thừa
  .setExpirationTime('8h')
  .sign(secret);

// Sau (FIX):
const token = await new SignJWT({
  sub: '00000000-0000-0000-0000-000000000001',
  entityId: '00000000-0000-0000-0000-000000000010',  // ✅ camelCase
  role: ROLE,
  email: `dev-${ROLE.toLowerCase()}@dev.car-manager-v2.local`,
  name: `Dev ${ROLE}`,
  appCode: 'app-car-manager-v2',                      // ✅ camelCase + AMA literal
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  // ❌ Bỏ setIssuer / setAudience — verify schema không expect
  .setExpirationTime('8h')
  .sign(secret);
```

└─ **Side-impact**: Sửa dev tool, không touch production.

### Step 7 — AMA: endpoint `/auth/driver-phone-login` + security (0.5 ngày)

**7A.1** — DTO + Controller route.

File mới: `ambManagement/apps/api/src/domain/auth/dto/request/driver-phone-login.request.ts`

```typescript
import { IsString, Matches, Length } from 'class-validator';

export class DriverPhoneLoginRequest {
  @IsString() @Length(2, 10) entity_code: string;       // VN01, HQ, KR01
  @IsString() @Matches(/^\d{9,11}$/) phone: string;     // 9-11 chữ số
}
```

File: `ambManagement/apps/api/src/domain/auth/controller/auth.controller.ts` (sửa)

```typescript
@Post('driver-phone-login')
@Throttle({ default: { limit: 5, ttl: 60_000 } })   // 5/min — D-014
async driverPhoneLogin(
  @Body() dto: DriverPhoneLoginRequest,
  @Req() req: Request,
) {
  return this.authService.driverPhoneLogin(dto, req.ip);
}
```

└─ **Side-impact**: Low — endpoint mới. Cần `@nestjs/throttler` (check đã có).

**7A.2** — Service method.

File: `ambManagement/apps/api/src/domain/auth/service/auth.service.ts` (thêm method)

```typescript
// Phase 0 finding: auth.service KHÔNG có auditLog() helper.
// Dùng inline LoginHistoryEntity insert (đã có existing pattern trong service).
async driverPhoneLogin(dto: DriverPhoneLoginRequest, clientIp: string) {
  const reason = await this.tryFindDriver(dto);

  if (typeof reason === 'string') {
    // Log fail vào amb_login_history (existing table)
    await this.loginHistoryRepo.insert({
      lhEntCode: dto.entity_code,
      lhPhoneMasked: maskPhone(dto.phone),
      lhIp: clientIp,
      lhReason: reason,
      lhOutcome: 'fail',
      lhTransport: 'driver-phone-login',
    });
    throw new UnauthorizedException('E1014');  // Generic — D-014 SR-003
  }

  const user = reason;
  const tokens = await this.generateTokens(user);

  await this.loginHistoryRepo.insert({
    lhUserId: user.usrId,
    lhEntCode: dto.entity_code,
    lhPhoneMasked: maskPhone(dto.phone),
    lhIp: clientIp,
    lhReason: 'success',
    lhOutcome: 'success',
    lhTransport: 'driver-phone-login',
  });

  return tokens;
}

private async tryFindDriver(dto: DriverPhoneLoginRequest) {
  const entity = await this.entityRepo.findOne({
    where: { entCode: dto.entity_code, entStatus: 'ACTIVE' }
  });
  if (!entity) return 'entity_not_found';

  const user = await this.userRepo.findOne({
    where: {
      usrPhone: dto.phone,
      usrCompanyId: entity.entId,
      usrStatus: 'ACTIVE',
    }
  });
  if (!user) return 'phone_not_found';

  const role = await this.eurRepo.findOne({
    where: {
      usrId: user.usrId,
      entId: entity.entId,
      eurStatus: 'ACTIVE',
    }
  });
  if (!role) return 'no_role';

  return user;
}
```

File util mới: `ambManagement/apps/api/src/common/util/mask-phone.ts`

```typescript
export function maskPhone(phone: string): string {
  if (phone.length < 6) return '***';
  return phone.slice(0, 4) + '****' + phone.slice(-2);
}
```

└─ **Side-impact**: ⚠️ MEDIUM — Login không password là điểm mới về security model. Cần security review (rate limit + audit + masked phone đã có).

**7A.3** — Unit test service.

File: `ambManagement/apps/api/test/auth.service.driver-phone-login.spec.ts`

Test cases:
1. ent_code wrong → fail with 'entity_not_found'
2. phone không tồn tại → fail 'phone_not_found'
3. user phone đúng nhưng khác entity → fail 'phone_not_found' (composite unique)
4. user OK nhưng usr_status='SUSPENDED' → fail
5. user OK nhưng eur_status='INACTIVE' → fail 'no_role'
6. All pass → return tokens
7. Rate limit thử > 5 lần / phút → 429

└─ **Side-impact**: Low.

### Step 7B — v2: Driver login page + DB sync (0.7 ngày)

**7B.1** — DB migration: car_users add usr_phone + refresh token cols.

File mới: `apps/app-car-manager-v2/packages/db/migrations/0010_driver_phone_login.sql`

```sql
ALTER TABLE car_users
  ADD COLUMN usr_phone VARCHAR(30),
  ADD COLUMN usr_ama_refresh_token_enc TEXT;

CREATE INDEX idx_car_users_ent_phone ON car_users(ent_id, usr_phone)
  WHERE usr_deleted_at IS NULL;
-- Composite filter cho "phone exists in entity" check (defensive)
```

Sửa schema: `packages/db/src/schema/users.schema.ts` — thêm 2 cột.

└─ **Side-impact**: Additive, không break existing.

**7B.2** — Encrypt util (AES-256-GCM).

File mới: `apps/web/src/lib/auth/crypto.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');  // 32 bytes hex

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${enc.toString('base64')}.${tag.toString('base64')}`;
}

export function decrypt(enc: string): string {
  const [ivB64, dataB64, tagB64] = enc.split('.');
  const iv = Buffer.from(ivB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
```

└─ **Side-impact**: None.

**7.3** — Driver login page (mobile-first).

File mới: `apps/web/src/app/driver-login/page.tsx`

```tsx
'use client';
import { useState } from 'react';

export default function DriverLoginPage() {
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form
        action="/api/auth/driver-login"
        method="POST"
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow"
      >
        <h1 className="text-2xl font-bold text-center">Đăng nhập tài xế</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div>
          <label className="block text-sm font-medium mb-1">Mã công ty</label>
          <input
            name="ent_code" type="text" required autoCapitalize="characters"
            placeholder="VD: VN01"
            className="w-full rounded border p-3 text-base uppercase"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Số điện thoại</label>
          <input
            name="phone" type="tel" required inputMode="numeric"
            placeholder="VD: 0901234567"
            className="w-full rounded border p-3 text-base"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="remember" type="checkbox" defaultChecked />
          Ghi nhớ thiết bị 30 ngày
        </label>
        <button
          type="submit"
          className="w-full rounded bg-blue-600 py-3 font-semibold text-white"
        >
          Đăng nhập
        </button>
        <p className="text-xs text-slate-500 text-center mt-2">
          Chưa có tài khoản? Liên hệ quản lý công ty bạn.
        </p>
      </form>
    </main>
  );
}
```

Thêm `/driver-login` vào `PUBLIC_PATHS` trong middleware.

└─ **Side-impact**: Page mới.

**7.4** — API route `/api/auth/driver-login`.

File mới: `apps/web/src/app/api/auth/driver-login/route.ts`

```typescript
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/auth/crypto';
import { db, carUsers, carAuditLogs } from '@car-v2/db';
import { eq, and } from 'drizzle-orm';
import { ensureCarUser } from '@/server/services/user/ensure-car-user.service';
import { verifyAmaJwt } from '@/lib/auth/verify-jwt';
import crypto from 'node:crypto';

const AMA_API = process.env.AMA_API_BASE_URL!;
const APP_CODE = 'app-car-manager-v2';

export async function POST(req: Request) {
  const form = await req.formData();
  const entityCode = (form.get('ent_code') as string)?.trim().toUpperCase();
  const phone = (form.get('phone') as string)?.trim().replace(/\D/g, '');
  const remember = form.get('remember') === 'on';

  if (!entityCode || !phone) {
    return Response.redirect(new URL('/driver-login?error=missing', req.url));
  }

  try {
    // 1) AMA driver-phone-login (D-010 rev — no password)
    const loginRes = await fetch(`${AMA_API}/api/v1/auth/driver-phone-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_code: entityCode, phone }),
    });
    if (loginRes.status === 429) {
      return Response.redirect(new URL('/driver-login?error=rate_limit', req.url));
    }
    if (!loginRes.ok) {
      return Response.redirect(new URL('/driver-login?error=invalid', req.url));
    }
    const { accessToken, refreshToken, user } = await loginRes.json();

    // 2) Find eca_id
    const myAppsRes = await fetch(
      `${AMA_API}/api/v1/entity-settings/custom-apps/my`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const myApps = await myAppsRes.json();
    const app = myApps.data.find((a: any) => a.code === APP_CODE);
    if (!app) {
      return Response.redirect(new URL('/driver-login?error=not_installed', req.url));
    }

    // 3) Mint app token
    const tokenRes = await fetch(
      `${AMA_API}/api/v1/entity-settings/custom-apps/${app.id}/token`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!tokenRes.ok) {
      return Response.redirect(new URL('/driver-login?error=no_role', req.url));
    }
    const { token } = await tokenRes.json();

    // 4) ensureCarUser (verify token → upsert) + save refresh
    const claims = await verifyAmaJwt(token);
    await ensureCarUser(claims);
    await db.update(carUsers)
      .set({ usrAmaRefreshTokenEnc: encrypt(refreshToken), usrLastLoginAt: new Date() })
      .where(and(eq(carUsers.entId, claims.ent_id), eq(carUsers.usrAmaUserId, claims.sub)));

    // 5) Audit
    await db.insert(carAuditLogs).values({
      audId: crypto.randomUUID(),
      entId: claims.ent_id,
      audActorUserId: claims.sub,
      audEvent: 'USER.LOGGED_IN',
      audPayload: { remember, transport: 'driver-direct' },
      audCreatedAt: new Date(),
    });

    // 6) Set cookie
    const maxAge = remember ? 30 * 86400 : 8 * 3600;
    cookies().set('amb_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge,
    });

    return Response.redirect(new URL('/today', req.url));
  } catch (e) {
    console.error('driver-login error', e);
    return Response.redirect(new URL('/driver-login?error=server', req.url));
  }
}
```

└─ **Side-impact**: API route mới, không xung đột.

**7.5** — Silent refresh logic.

File mới: `apps/web/src/lib/auth/silent-refresh.ts`

```typescript
'use server';
import { cookies } from 'next/headers';
import { db, carUsers } from '@car-v2/db';
import { encrypt, decrypt } from '@/lib/auth/crypto';
import { eq } from 'drizzle-orm';

const AMA_API = process.env.AMA_API_BASE_URL!;
const APP_CODE = 'app-car-manager-v2';

export async function refreshDriverToken(amaUserId: string, entId: string): Promise<string | null> {
  const user = await db.query.carUsers.findFirst({
    where: eq(carUsers.usrAmaUserId, amaUserId),
  });
  if (!user?.usrAmaRefreshTokenEnc) return null;

  try {
    const refreshToken = decrypt(user.usrAmaRefreshTokenEnc);

    // Refresh AMA token
    const refRes = await fetch(`${AMA_API}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!refRes.ok) return null;
    const { accessToken, refreshToken: newRefresh } = await refRes.json();

    // Find eca + mint app token
    const myAppsRes = await fetch(`${AMA_API}/api/v1/entity-settings/custom-apps/my`,
      { headers: { Authorization: `Bearer ${accessToken}` } });
    const myApps = await myAppsRes.json();
    const app = myApps.data.find((a: any) => a.code === APP_CODE);
    if (!app) return null;
    const tokenRes = await fetch(`${AMA_API}/api/v1/entity-settings/custom-apps/${app.id}/token`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    if (!tokenRes.ok) return null;
    const { token } = await tokenRes.json();

    // Update refresh + cookie
    await db.update(carUsers)
      .set({ usrAmaRefreshTokenEnc: encrypt(newRefresh) })
      .where(eq(carUsers.usrId, user.usrId));

    cookies().set('amb_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 30 * 86400,
    });

    return token;
  } catch {
    return null;
  }
}
```

└─ **Side-impact**: Server action mới.

**7.6** — Tích hợp vào RSC layout / getCurrentUser.

File: `apps/web/src/lib/auth/get-current-user.ts` (sửa)

```typescript
import { decodeJwt } from 'jose';  // for unsafe decode (just to get sub)
import { refreshDriverToken } from './silent-refresh';
import { verifyAmaJwt } from './verify-jwt';
import { redirect } from 'next/navigation';

export async function getCurrentUser() {
  const cookie = cookies().get('amb_session')?.value;
  if (!cookie) redirect('/driver-login');

  try {
    return await verifyAmaJwt(cookie);
  } catch (e) {
    // Try silent refresh
    const payload = decodeJwt(cookie);  // unsafe decode just to get sub + ent_id
    const newToken = await refreshDriverToken(payload.sub as string, payload.entityId as string);
    if (!newToken) redirect('/driver-login');
    return await verifyAmaJwt(newToken);
  }
}
```

└─ **Side-impact**: Sửa core auth utility. Cần test kỹ admin flow vẫn OK.

**7.7** — Logout API + button.

File mới: `apps/web/src/app/api/auth/driver-logout/route.ts`

```typescript
export async function POST(req: Request) {
  const cookieToken = cookies().get('amb_session')?.value;
  if (cookieToken) {
    try {
      const claims = await verifyAmaJwt(cookieToken);
      await db.update(carUsers)
        .set({ usrAmaRefreshTokenEnc: null })
        .where(eq(carUsers.usrAmaUserId, claims.sub));
      await db.insert(carAuditLogs).values({
        audEvent: 'USER.LOGGED_OUT', entId: claims.ent_id,
        audActorUserId: claims.sub, audCreatedAt: new Date(),
      });
    } catch {/* token invalid, vẫn clear cookie */}
  }
  cookies().delete('amb_session');
  return Response.redirect(new URL('/driver-login', req.url));
}
```

Sidebar component: thêm Logout button (Sidebar v2 đã có pattern). Trên `/today`, thêm "Đổi tài xế" button cùng endpoint.

└─ **Side-impact**: 1 endpoint + 1 button UI.

**7.8** — Middleware update.

File: `apps/web/src/middleware.ts` (sửa)

```typescript
const PUBLIC_PATHS = [
  ...existing,
  '/driver-login',
  '/api/auth/driver-login',
  '/api/auth/driver-logout',
];

// Trong catch block sau verify fail:
const res = NextResponse.redirect(absoluteUrl(req, '/driver-login')); // ← thay /session-expired
```

└─ **Side-impact**: Tất cả error path đổi từ /session-expired sang /driver-login. Admin/manager dùng `/dev-login` hoặc qua AMA UI vẫn OK vì cookie sẽ được set qua flow đó.

### Step 8 — Admin create driver UI (D-017) (0.5 ngày)

> Cho phép admin tạo driver từ **cả 2** nơi: AMA Web (đã có) HOẶC v2 Web (build mới).

**8A — AMA Web: thêm "Send invite" template**

File AMA frontend: trang user create (existing) → sau khi tạo user, hiện modal template SMS:

```tsx
<Modal title="Driver đã được tạo">
  <p>Copy nội dung sau gửi cho driver qua Zalo/SMS:</p>
  <textarea readOnly value={`Anh/Chị ${name}, app quản lý xe đã sẵn sàng.
📱 Tải: https://v2.amoeba.site
Đăng nhập với:
• Mã công ty: ${ent_code}
• Số điện thoại: ${phone}`} />
  <Button onClick={copyToClipboard}>📋 Copy</Button>
</Modal>
```

└─ **Side-impact**: UI-only, không thay đổi backend.

**8B — v2 Web: trang `/drivers/new` (admin tạo driver)**

File mới: `apps/web/src/app/(admin)/drivers/new/page.tsx`

Form: { Tên, SĐT, GPLX, Email (optional) } → submit → server action `createDriverAction`:

```typescript
'use server';
export async function createDriverAction(data: DriverCreateInput) {
  // 1) Verify caller is ADMIN/MANAGER
  const actor = await requireRole(['ADMIN', 'MANAGER']);
  
  // 2) Gọi AMA API tạo user
  const amaToken = /* lấy AMA access từ session */;
  const userRes = await fetch(`${AMA_API}/api/v1/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${amaToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usr_name: data.name,
      usr_phone: data.phone,
      usr_email: data.email,
      usr_company_id: actor.entId,
      usr_level_code: 'USER_LEVEL',
      usr_role: 'MEMBER',
      usr_status: 'ACTIVE',
    }),
  });
  if (!userRes.ok) throw new CarError('CAR-E2001', 400, 'Tạo user AMA fail');
  const { usrId } = await userRes.json();
  
  // 3) Gán eur_role = MEMBER (qua AMA API)
  await fetch(`${AMA_API}/api/v1/hr/entity-user-roles`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${amaToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ent_id: actor.entId,
      usr_id: usrId,
      eur_role: 'MEMBER',
      eur_status: 'ACTIVE',
    }),
  });
  
  // 4) Tạo car_drivers record cho v2 trip flow
  await db.insert(carDrivers).values({
    drvId: crypto.randomUUID(),
    entId: actor.entId,
    drvName: data.name,
    drvPhone: data.phone,
    drvLicenseNumber: data.licenseNumber,
    drvLinkedUserId: usrId,  // FK link tới user AMA
  });
  
  // 5) Return SMS template
  return {
    success: true,
    smsTemplate: buildSmsTemplate(data.name, actor.entCode, data.phone),
  };
}

function buildSmsTemplate(name: string, entCode: string, phone: string) {
  return `Anh/Chị ${name}, app quản lý xe đã sẵn sàng.\n📱 Tải: ${process.env.APP_URL}\nĐăng nhập với:\n• Mã công ty: ${entCode}\n• Số điện thoại: ${phone}`;
}
```

└─ **⛔ Phase 0 finding (BLOCKER)**: AMA **KHÔNG có endpoint** `POST /api/v1/users` để tạo USER_LEVEL user với phone:
- `/admin/admin-users` POST chỉ cho `ADMIN`/`SUPER_ADMIN` level (SuperAdminGuard) + không accept `usr_phone`
- `/hr/entities/:id/users` POST chỉ **assign role** cho user đã tồn tại
- **→ Step 8B KHÔNG implement được nếu không thêm endpoint mới ở AMA**

**Quyết định D-018 (revise)**: **DEFER Step 8B sang Phase 2.** MVP chỉ làm Step 8A (AMA Web SMS template modal). Admin tạo driver qua AMA Web hiện có. Nếu sau MVP cần convenience tạo driver từ v2 → thêm endpoint AMA `POST /api/v1/users` (USER_LEVEL + phone).

**8C — UI hiển thị SMS template + Copy/Zalo share**

Sau submit thành công, hiện modal:
```tsx
<Modal title="✅ Đã tạo driver">
  <textarea readOnly value={result.smsTemplate} rows={6} />
  <Button onClick={() => copy(result.smsTemplate)}>📋 Copy</Button>
  <a href={`https://zalo.me/?text=${encodeURIComponent(result.smsTemplate)}`}>
    📲 Mở Zalo
  </a>
</Modal>
```

└─ **Side-impact**: Low.

### Step 6 — Testing manual + deploy (0.5 ngày)

**6.1** — Test local dev:

| Test | Expected |
|------|----------|
| `npm run dev:token -- OWNER` → mở URL | v2 dashboard hiện với role ADMIN, x-user-role header = OWNER |
| Cùng cho MASTER, MANAGER, MEMBER | Role mapping đúng |
| Tạo user X trong AMA, gán eur_role=OWNER ở VN01, mở v2 từ AMA Web | Dashboard hiện đúng, `car_users` có row mới với usrAmaRoleSnapshot='OWNER' |
| Đổi eur_role X từ OWNER sang MANAGER, X mở lại v2 | `car_users.usrLocalRole` update từ ADMIN sang MANAGER, `car_audit_logs` có event USER.ROLE_SYNC |
| User Y không có row eur ở VN01, mở v2 | AMA 403 "chưa được gán role" |
| User Z ở entity HQ, mở v2 ở VN01 | AMA 403 (do user.entityId = HQ, không phải VN01) |
| Driver Y (role MEMBER) vào `/trips/new` | Redirect `/today` |

**6.2** — Test Flow B (Platform iframe):

| Test | Expected |
|------|----------|
| Login Platform → click "Car Manager v2" trên AppDetailPage | Iframe load v2, ?ama_token URL clear sau verify |

**6.3** — Deploy:

Thứ tự bắt buộc:
1. AMA backend (rebuilt với Step 1.2) + run seed Step 2.
2. Platform backend + frontend (Step 3) — cần AMA endpoint mới sẵn.
3. v2 (Step 4 + 5) — chạy migration 0009 nếu cần.

**6.4** — Smoke test staging với 3 test account: OWNER, MANAGER, MEMBER ở VN01.

---

## 3. Danh sách File Thay đổi (변경 파일 목록)

| Loại | File | Thay đổi | Step |
|------|------|----------|------|
| BE AMA | `ambManagement/apps/api/src/domain/hr/repository/entity-user-role.repository.ts` | Thêm `findRoleByUserAndEntity` | 1.1 |
| BE AMA | `ambManagement/apps/api/src/domain/entity-settings/service/entity-custom-app.service.ts` | Sửa `generateAppToken` | 1.2 |
| BE AMA | `ambManagement/apps/api/src/domain/entity-settings/entity-settings.module.ts` | Inject repo | 1.3 |
| Test AMA | `ambManagement/apps/api/test/entity-custom-app.service.spec.ts` | 3 case mới | 1.4 |
| SQL AMA | `ambManagement/scripts/seed-car-manager-v2-app.sql` | INSERT VN01 | 2.1 |
| BE Platform | `apps/platform/backend/src/platform-app/platform-app.controller.ts` | Endpoint `:slug/launch-token` | 3.1 |
| BE Platform | `apps/platform/backend/src/platform-app/platform-app.service.ts` | Method `getLaunchToken` | 3.1 |
| FE Platform | `apps/platform/frontend/src/services/app-launch.service.ts` | Mới | 3.2 |
| FE Platform | `apps/platform/frontend/src/pages/AppDetailPage.tsx` | Gọi launch-token | 3.2 |
| BE v2 | `apps/app-car-manager-v2/apps/web/src/server/services/user/ensure-car-user.service.ts` | Mới | 4.1 |
| BE v2 | `apps/app-car-manager-v2/apps/web/src/lib/auth/ensure-car-user-cached.ts` (hoặc inline) | React cache wrapper | 4.2 |
| BE v2 | `apps/app-car-manager-v2/apps/web/src/app/layout.tsx` | Gọi `ensureCarUserCached` | 4.2 |
| DB v2 | `apps/app-car-manager-v2/packages/db/migrations/0009_user_audit_events.sql` | ALTER TYPE (nếu enum) | 4.3 |
| Script v2 | `apps/app-car-manager-v2/scripts/dev-token.mjs` | Fix payload | 5 |
| DB v2 | `apps/app-car-manager-v2/packages/db/migrations/0010_driver_direct_login.sql` | Refresh token cols | 7.1 |
| DB v2 | `apps/app-car-manager-v2/packages/db/src/schema/users.schema.ts` | Thêm 2 cột | 7.1 |
| BE v2 | `apps/app-car-manager-v2/apps/web/src/lib/auth/crypto.ts` | AES-256-GCM util | 7.2 |
| FE v2 | `apps/app-car-manager-v2/apps/web/src/app/driver-login/page.tsx` | Mobile login page | 7.3 |
| BE v2 | `apps/app-car-manager-v2/apps/web/src/app/api/auth/driver-login/route.ts` | Login proxy + mint | 7.4 |
| BE v2 | `apps/app-car-manager-v2/apps/web/src/lib/auth/silent-refresh.ts` | Server action refresh | 7.5 |
| BE v2 | `apps/app-car-manager-v2/apps/web/src/lib/auth/get-current-user.ts` | Catch expired → refresh | 7.6 |
| BE v2 | `apps/app-car-manager-v2/apps/web/src/app/api/auth/driver-logout/route.ts` | Logout endpoint | 7.7 |
| FE v2 | `apps/app-car-manager-v2/apps/web/src/components/Sidebar.tsx` | Logout button | 7.7 |
| FE v2 | `apps/app-car-manager-v2/apps/web/src/app/(driver)/today/page.tsx` | "Đổi tài xế" button | 7.7 |
| BE v2 | `apps/app-car-manager-v2/apps/web/src/middleware.ts` | /driver-login public + redirect | 7.8 |
| **BE AMA** | `ambManagement/apps/api/src/domain/auth/dto/request/driver-phone-login.request.ts` | Mới — DTO | **7A.1** |
| **BE AMA** | `ambManagement/apps/api/src/domain/auth/controller/auth.controller.ts` | Endpoint `/auth/driver-phone-login` + @Throttle | **7A.1** |
| **BE AMA** | `ambManagement/apps/api/src/domain/auth/service/auth.service.ts` | Method `driverPhoneLogin` + audit | **7A.2** |
| **BE AMA** | `ambManagement/apps/api/src/common/util/mask-phone.ts` | Util mask phone | **7A.2** |
| **Test AMA** | `ambManagement/apps/api/test/auth.service.driver-phone-login.spec.ts` | 7 case unit test | **7A.3** |
| **DB v2** | `apps/app-car-manager-v2/packages/db/migrations/0010_driver_phone_login.sql` | Add usr_phone + refresh col | **7B.1** |
| **FE v2** | `apps/app-car-manager-v2/apps/web/src/app/(admin)/drivers/new/page.tsx` | Admin tạo driver UI | **8B** |
| **BE v2** | `apps/app-car-manager-v2/apps/web/src/server/actions/drivers/create-driver.action.ts` | Server action gọi AMA API | **8B** |
| **FE AMA** | `ambManagement/apps/web/src/domain/users/components/UserCreatedModal.tsx` | SMS template modal | **8A** |

**Tổng: 33 file** (13 base + 11 driver-login + 5 AMA driver-phone-login + 4 admin create UI).

---

## 4. Phân tích Side-Impact (사이드 임팩트 분석)

| Phạm vi | Mức | Chi tiết |
|---------|-----|----------|
| AMA `generateAppToken` payload đổi | 🔴 HIGH | App v1 (car-manager v1, sales-report, stock-management) cùng dùng method này. Role payload đổi từ `usr_role` (ADMIN/MEMBER/...) sang `eur_role` (OWNER/MASTER/MANAGER/MEMBER). Per D-005 chấp nhận rủi ro. Coordinate khi deploy. |
| Platform thêm endpoint launch-token | 🟢 LOW | Endpoint mới. Không xung đột. |
| Platform `AppDetailPage` đổi từ link sang button | 🟡 MEDIUM | UI flow thay đổi. Cần test các app khác (v1) còn dùng `<a href={slug}>` không. |
| v2 `ensureCarUser` chạy mỗi request RSC | 🟡 MEDIUM | Cần React `cache()` để dedupe trong 1 request. |
| AMA seed VN01 | 🟢 LOW | Idempotent. |
| v2 audit enum migration | 🟢 LOW | Chỉ ALTER TYPE additive nếu enum. |
| Cookie v2 hiện có sau deploy | 🟡 MEDIUM | Token cũ chưa expire (8h) còn dùng role cũ. Documented limitation. |
| Token expire 1h khi mở iframe | 🟢 LOW | iframe load 1 lần, cookie 8h kế thừa session. |
| Refresh token rotation race condition | 🟡 MEDIUM | 2 request đồng thời cùng trigger refresh → 1 thành công, 1 fail. Cần lock hoặc 1st-wins. MVP: chấp nhận; user retry. |
| Refresh token leak qua DB | 🟡 MEDIUM | Encrypted AES-256-GCM với `ENCRYPTION_KEY`. Compromise key = compromise tất cả refresh. Rotate key cần re-encrypt all rows. |
| Driver cookie clear khi clear browser data | 🟢 LOW | Behavior expected — driver re-login. |
| ENCRYPTION_KEY mất | 🔴 HIGH | Tất cả driver phải re-login (refresh tokens không decrypt được). Backup key cần thiết. |
| Mass logout (admin disable user ở AMA) | 🟡 MEDIUM | Cookie v2 30d còn dùng được tới expire / refresh fail. Soft revoke acceptable cho MVP. Hard revoke = clear refresh cụ thể user. |

---

## 5. DB Migration (DB 마이그레이션)

### 5.1 AMA — KHÔNG cần schema change

Chỉ run seed SQL Step 2.1 (`psql -f scripts/seed-car-manager-v2-app.sql`).

### 5.2 v2 — Có thể cần (conditional)

Check `apps/app-car-manager-v2/packages/db/src/schema/audit.schema.ts`:
- Nếu `event` là `varchar` → KHÔNG cần migration.
- Nếu là enum `car_audit_log_event` strict → chạy migration 0009.

### 5.3 Platform — KHÔNG cần

---

## 6. Quyết định đã chốt

Xem REQ §7. Tóm tắt:

- **D-001** Direct + Embedded
- **D-002** eur_role
- **D-003** AMA mint (Platform passthrough) — *override bởi D-008 cho phần Platform*
- **D-004** VN01 only
- **D-005** App v1 tự lo
- **D-006** Platform AMA SSO đã wire (admin SSO + user proxy)
- **D-007** Skip HTTPS local
- **D-008** REUSE-FIRST strategy
- **D-009** Fix dev-token.mjs bug ngay
- ~~D-010~~ HỦY (email+password) → **D-010 rev**: Phone + ent_code, AMA endpoint mới `/auth/driver-phone-login`
- **D-011** Cookie 30d + silent refresh + rotating refresh token
- **D-012** Error UX = redirect /driver-login (không về AMA)
- **D-013** Logout + Switch user button trong sidebar + /today
- **D-014** Security MVP: rate limit 5/min/IP + audit log mọi attempt + masked phone
- **D-015** Org id = `ent_code` (VN01...) trong SMS, KHÔNG dùng UUID
- **D-016** Sync phone AMA → v2 ở login
- ~~D-017~~ HỦY (cả 2 nơi tạo driver) → **D-018**: DEFER Step 8B v2 admin UI, MVP chỉ có AMA SMS template modal
- **D-019** `car_audit_logs` dùng `aud_action` + `aud_entity` (Phase 0 finding)
- **D-020** AMA không có `auditLog()` helper → dùng `LoginHistoryEntity` (Phase 0 finding)
- **D-021** Platform JWT không có `amaToken` → frontend gửi header `X-AMA-Token` (Phase 0 finding)

---

## 7. Definition of Done

- [ ] AMA `generateAppToken()` mint payload với `role=eur_role`. Unit test 3 case pass.
- [ ] Seed `app-car-manager-v2` cho VN01 thành công, query verify ra 1 row.
- [ ] Platform endpoint `POST /apps/:slug/launch-token` chạy đúng — gọi AMA, trả token.
- [ ] Platform `AppDetailPage` mở v2 thành công (iframe load, không lỗi console).
- [ ] v2 `ensureCarUser()` upsert + audit log khi user lần đầu vào.
- [ ] User OWNER ở VN01 vào v2 → dashboard role ADMIN.
- [ ] User MEMBER → redirect `/today`, không vào `/trips/new`.
- [ ] User không có eur_role → AMA 403.
- [ ] Đổi eur_role → mở lại v2 → `usr_local_role` update + `car_audit_logs` event USER.ROLE_SYNC.
- [ ] `npm run dev:token -- OWNER` xuất URL → mở browser → v2 hoạt động.
- [ ] App v1 regression test: login + mở car-manager v1 + sales-report. Document break nếu có.

**Driver phone-login (Step 7A + 7B):**

- [ ] Driver Bình mở `/driver-login` trên mobile viewport 375px → form 2 field (ent_code, phone) fit, không scroll ngang.
- [ ] Input `ent_code` auto uppercase ('vn01' → 'VN01').
- [ ] Input `phone` strip ký tự không phải số ('090-1234567' → '0901234567').
- [ ] Login đúng (VN01 + phone tồn tại + có eur_role MEMBER active) → 302 `/today` + cookie 30d.
- [ ] Login sai ent_code → 401 với generic message E1014 (KHÔNG nói cụ thể "entity not found").
- [ ] Login phone không tồn tại trong VN01 → same E1014.
- [ ] Login user có usr_status='SUSPENDED' → same E1014.
- [ ] Login user thiếu eur_role record → same E1014.
- [ ] Try 6 lần liên tiếp trong 60s → request thứ 6 trả 429 + Retry-After.
- [ ] Mỗi attempt (success+fail) → 1 row `car_audit_logs` với event USER.LOGIN_ATTEMPT + phone masked '0901****67'.
- [ ] Đăng nhập, đợi 1h → request kế tiếp → silent refresh thành công → vẫn ở `/today`.
- [ ] Admin AMA disable Bình → silent refresh fail → redirect `/driver-login`.
- [ ] Click Logout button → cookie clear + `usr_ama_refresh_token_enc=NULL` + audit + `/driver-login`.
- [ ] Click "Đổi tài xế" trên /today → same logout flow.
- [ ] Restart browser sau "Ghi nhớ 30d" → mở v2 → vẫn vào /today.
- [ ] Phone sync: car_users.usr_phone bằng amb_users.usr_phone sau login.

**Admin create driver (Step 8):**

- [ ] Admin tạo driver ở AMA Web → sau submit hiện modal SMS template với ent_code + phone đúng → button Copy hoạt động.
- [ ] Admin Lan tạo driver ở v2 `/drivers/new` → form 4 field (name, phone, license, email optional) → submit → server action gọi AMA `POST /users` + `POST /hr/entity-user-roles` thành công.
- [ ] Sau submit ở v2, modal hiện SMS template + button "Mở Zalo" mở zalo.me với text đã encode.
- [ ] Tạo driver mới ở v2, ngay sau đó driver mở /driver-login với ent_code + phone vừa tạo → login OK.
- [ ] Driver tạo ở AMA Web vs v2 đều có cùng record ở amb_users (1 nguồn).
- [ ] Driver tạo ở v2 cũng có row `car_drivers` (cho trip flow).

---

## 8. Bước Kế tiếp

Sau khi user phê duyệt plan này:

1. Viết test cases → `docs/test/TC-20260521-auth-rbac-v2.md`
2. Implement Step 1-5 (mỗi step 1 PR, có thể merge tuần tự)
3. Run Step 6 test trên staging
4. Test report → `docs/test/TR-20260521-auth-rbac-v2.md`
5. Completion report → `docs/implementation/RPT-20260521-auth-rbac-v2.md`

## 9. Ước lượng chi tiết

| Step | Effort | Dependencies |
|------|--------|--------------|
| 1. AMA generateAppToken eur_role | 0.5d | — |
| 2. AMA seed VN01 | 0.1d | Step 1 deploy trước |
| 3. Platform launch-token + AppDetailPage (Option B X-AMA-Token header) | 0.5d | Step 1 + 2 |
| 4. v2 ensureCarUser + phone sync (audit field `aud_action`/`aud_entity`) | 0.3d | — |
| 5. v2 dev-token bug fix | 0.1d | — |
| 7A. AMA `/auth/driver-phone-login` (use LoginHistoryEntity inline) | 0.5d | — |
| 7B. v2 driver-login page + DB + login proxy | 0.7d | Step 7A, 1, 2 done |
| 8A. AMA Web SMS template modal | 0.2d | Step 1 done |
| ~~8B~~. v2 admin create driver UI | ⛔ DEFER | Cần endpoint mới ở AMA |
| 6. Testing + deploy | 0.5d | All above |
| **Tổng MVP** | **3.4 ngày** | |

Buffer: +0.5d regression test app v1 + security review → **Tổng 3.9 ngày max**.

Phase 2 (out-of-scope MVP): Step 8B (v2 admin tạo driver UI) — cần AMA endpoint mới `POST /api/v1/users` chấp nhận USER_LEVEL + usr_phone.

### 9.1 Critical path

```
Step 1 (AMA mint eur_role) ─┬─► Step 2 (seed VN01) ─► Step 3 (Platform iframe) ───┐
                            │                                                      │
                            ├─► Step 4 (v2 ensureCarUser + phone sync)            │
                            │                                                      │
                            ├─► Step 7A (AMA /auth/driver-phone-login) ─► Step 7B │
                            │                                                ↑    │
                            └─► Step 8 (admin create UI) ───────────────────┘    │
                                                                                  ▼
                                                                       Step 6 (test+deploy)

Step 5 (fix dev-token.mjs) — song song, quick win.
```

Có thể merge:
- Step 5 ngay (~10 phút, không block ai)
- Step 1+2 (cùng PR backend AMA)
- Step 4 song song Step 3
- Step 7A trước 7B (7B gọi 7A endpoint)
- Step 8 có thể chia: Step 8A (AMA template) ngay sau Step 1; Step 8B (v2 admin UI) sau Step 7
