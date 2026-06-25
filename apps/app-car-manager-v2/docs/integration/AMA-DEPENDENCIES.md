# AMA-side dependencies cho app-car-manager-v2

> **Mục đích**: Track các yêu cầu phía AMA backend mà v2 cần để hoàn thành Wave 2 (onboarding sync) + Wave 3 (email login).
> **Owner**: Huy Nguyen (v2) + AMA team
> **Last updated**: 2026-05-26
> **Linked docs**:
> - [REQ-20260526-ama-user-sync-email-login.md](../analysis/REQ-20260526-ama-user-sync-email-login.md)
> - [PLAN-20260526-ama-user-sync-email-login.md](../plan/PLAN-20260526-ama-user-sync-email-login.md)

---

## 1. Authentication context

v2 nhận **2 loại JWT** từ AMA, cả 2 cùng `JWT_SECRET` shared:

| Token | Cookie ở v2 | Set bởi | Scope | Khi nào dùng |
|---|---|---|---|---|
| **User accessToken** | `amb_ama_access` (4h) | v2 `/api/auth/login` (gọi AMA `/auth/phone-login`) | User-scoped, full permission của user | Standalone phone-login |
| **User refreshToken** | `amb_ama_refresh` (7d) | v2 `/api/auth/login` | Refresh user accessToken | Silent refresh khi accessToken expire |
| **App token** | `amb_session` (30d max) | (a) `/api/auth/login` mint qua AMA `/custom-apps/:eca_id/token`, (b) middleware `?ama_token=` từ AMA portal embed | App-scoped — claims `entityId`, `sub`, `role`, `appCode` | EVERY request (RSC + actions) — verify bằng JWT_SECRET |

**App-token claims** (sau Zod transform, xem [jwt-claims.ts](../../packages/shared/src/auth/jwt-claims.ts)):
```json
{
  "sub": "<user_uuid>",
  "ent_id": "<entity_uuid>",
  "ent_name": "Optional entity display name",
  "role": "OWNER | MASTER | ADMIN | SUPER_ADMIN | MANAGER | MEMBER | VIEWER",
  "email": "user@example.com",
  "name": "User Name",
  "app_code": "car-manager-v2",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Vấn đề**: Trong embed mode (user vào v2 qua iframe AMA portal), v2 CHỈ nhận app-token qua `?ama_token=` → set `amb_session`. KHÔNG có `amb_ama_access`. Vì vậy mọi AMA endpoint gọi từ v2 dùng `Bearer amb_ama_access` sẽ fail trong embed mode.

---

## 2. Required AMA endpoint changes

### 2.1 `GET /entity-settings/members` — Wave 2 (BLOCKING)

**Status**: ⏳ Pending AMA team

**Mục đích**: v2 onboarding sync cần fetch full member list của entity.

**Hiện tại**:
- Accept `Bearer <user_accessToken>` only
- Không hỗ trợ pagination / status filter / cross-entity flag

**Yêu cầu v2:**

| Item | Yêu cầu |
|---|---|
| Accept app-token | **Thêm** — verify JWT bằng JWT_SECRET, accept nếu claim `appCode === 'app-car-manager-v2'` và `role` ∈ `[OWNER, MASTER, ADMIN, MANAGER]`. Extract `entityId` từ claim (anti-spoofing — KHÔNG đọc từ query param). |
| Pagination params | `?page=1&limit=100` (1-indexed). Response thêm `pagination: { total: number, page: number, limit: number }` |
| Status filter | `?status=ALL` trả về cả ACTIVE/INACTIVE/SUSPENDED. Default vẫn ACTIVE nếu param không truyền (backward compat). |
| Cross-entity flag | `?include_cross_entity=true` include luôn members có `levelCode = ADMIN_LEVEL` (system admin assigned cross-entity). Default false để khớp behavior cũ. |

**Response shape** (target):
```json
{
  "success": true,
  "data": [
    {
      "userId": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "phone": "0904567890",
      "role": "MEMBER",
      "levelCode": "ENTITY_LEVEL",
      "status": "ACTIVE",
      "unit": "Sales",
      "jobTitle": "Manager"
    }
  ],
  "pagination": {
    "total": 120,
    "page": 1,
    "limit": 100
  }
}
```

**Authorization logic gợi ý**:
```typescript
// Pseudo-code
async function membersEndpoint(req) {
  const token = extractBearer(req);
  const claims = verifyJwt(token, JWT_SECRET);

  // Reject if not v2 app or driver role
  if (claims.appCode !== 'app-car-manager-v2'
      && !isUserAccessToken(claims)) {
    throw 401;
  }
  if (!['OWNER', 'MASTER', 'ADMIN', 'MANAGER'].includes(claims.role)) {
    throw 403;
  }

  // entity_id ALWAYS from claim, not query (anti-spoofing)
  const entityId = claims.entityId ?? claims.ent_id;

  // ... paginate amb_users join amb_hr_entity_user_roles
}
```

---

### 2.2 `PATCH /entity-settings/members/:userId` — Wave 3

**Status**: ⏳ Pending — đi kèm Wave 3 (email login)

**Hiện tại**: Accept user accessToken only, body field `phone`.

**Yêu cầu v2**:
- Accept app-token tương tự §2.1
- Accept field `email` (validate RFC 5322 + unique check trong entity)

---

### 2.3 `POST /entity-settings/members/email-add` — Wave 3 (NEW)

**Status**: ⏳ Pending — Wave 3

**Mục đích**: Thay `phone-add` bằng `email-add` cho user creation flow.

**Yêu cầu**:
```
POST /entity-settings/members/email-add?entity_id=<uuid>
Auth: Bearer <app-token or user accessToken>
Body: { name: string, email: string (RFC 5322), role: MASTER|MANAGER|MEMBER|VIEWER, department?: string }

Response 200:
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "...",
    "name": "...",
    "role": "...",
    "entCode": "...",
    "entName": "...",
    "emailTemplate": "Welcome message với link onboarding..."
  }
}

Error cases:
  400 — email format invalid / duplicate in entity
  403 — caller role không đủ (MEMBER tạo MASTER chẳng hạn)
```

---

### 2.4 `POST /auth/email-login` — Wave 3 (NEW)

**Status**: ⏳ Pending — Wave 3

**Hiện tại**: `POST /auth/phone-login { entity_code, phone }`.

**Yêu cầu**:
```
POST /auth/email-login
Body: { entity_code: string, email: string }

Response 200:
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "...",
      "refreshToken": "..."
    }
  }
}

Error cases:
  400 — missing fields
  401 — email không tồn tại / không thuộc entity / inactive
  429 — rate limit
```

**Câu hỏi mở** (REQ Q1): passwordless email link hay match email + ent_code trực tiếp?

---

## 3. v2-side compatibility với AMA chưa update

v2 code đã defensive với AMA chưa support params:

| Param | AMA chưa support | v2 behavior |
|---|---|---|
| `?page=&limit=` | AMA ignore, trả default list | v2 loop dừng sau page 1 vì `data.length < 100`. Lấy được mọi user mà AMA mặc định trả. |
| `?status=ALL` | AMA ignore, default ACTIVE | v2 chỉ thấy ACTIVE users. Admin không thấy INACTIVE/SUSPENDED — acceptable nếu role local default `safeMapRole` work. |
| `?include_cross_entity=true` | AMA ignore | Cross-entity ADMIN_LEVEL không hiện ra → giảm noise. v2 cũng filter ra ở sync action. Acceptable. |
| App-token cho `/members` | AMA reject 401/403 | Embed mode admin/manager bị `CAR-E0101` khi click sync. **Block onboarding cho embed**. Standalone vẫn work. |

---

## 4. Driver standalone compatibility

**Constraint từ user** (2026-05-26): driver vẫn phải dùng được standalone app, không bị break.

**Phân tích**:

| Persona | Mode | Token có | Sync trigger? | Result |
|---|---|---|---|---|
| Driver | Standalone phone-login | Cả 2 (amb_session + amb_ama_access) | ❌ Không (DRIVER role không vào /onboarding hay /users) | ✅ Login + use app bình thường |
| Driver | Embed iframe | Chỉ amb_session | ❌ Không | ✅ Login + use app bình thường |
| Admin/Manager | Standalone phone-login | Cả 2 | ✅ Có | ✅ Sync dùng amb_ama_access (broader scope) |
| Admin/Manager | Embed iframe | Chỉ amb_session | ✅ Có | ⏳ Cần AMA §2.1 accept app-token |

**Quan trọng**: Việc thêm Option B fallback (app-token cho /members) KHÔNG ảnh hưởng driver. Driver không bao giờ trigger sync (enforce ở `syncTenantUsersAction` qua `requireRole(['ADMIN','MANAGER'])`). Driver app-token có `role=MEMBER` → kể cả nếu lỡ gọi AMA endpoint → AMA reject 403 theo authorization rule §2.1.

---

## 5. Migration timeline

| Phase | AMA work | v2 work | Owner |
|---|---|---|---|
| **Now** | — | ✅ Wave 1 + Wave 2 code + Option B fallback | Huy |
| **AMA-1** | §2.1 — accept app-token + pagination params cho `/members` | — | AMA team |
| **v2-1** | — | Test embed mode sync sau AMA-1 deploy | Huy |
| **AMA-2** | §2.4 — `/auth/email-login` | — | AMA team |
| **AMA-3** | §2.3 — `/members/email-add` | — | AMA team |
| **AMA-4** | §2.2 — PATCH accept `email` | — | AMA team |
| **AMA-5** | Backfill `amb_users.usr_email` 100% cho tenant dùng v2 | — | AMA team |
| **v2-2** | — | Wave 3 (email login refactor 14 files) | Huy |

---

## 6. Communication checklist với AMA team

- [ ] Share doc này
- [ ] Confirm JWT_SECRET vẫn shared giữa AMA và v2 (đã có sẵn theo PRD §5)
- [ ] Confirm app-token claim shape (xem §1) — đặc biệt `appCode` = `'app-car-manager-v2'`
- [ ] Confirm v2 sẽ verify nguyên token forward (không re-sign)
- [ ] Agree response shape cho §2.1 pagination
- [ ] Schedule AMA-1 deploy date
