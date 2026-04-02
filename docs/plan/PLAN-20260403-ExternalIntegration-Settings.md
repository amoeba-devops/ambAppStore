# PLAN-20260403 — External Integration Settings (외부 연동 설정 관리)

---
- **document_id**: AMA-SAL-PLAN-20260403-ExtIntegration
- **version**: 1.0.0
- **status**: Draft
- **created**: 2026-04-03
- **based_on**: AMA-SAL-REQ-20260403-ExtIntegration
- **app**: app-sales-report
---

## 1. System Analysis (시스템 개발 현황 분석)

### 1.1 Directory Structure

```
apps/app-sales-report/
├── backend/src/
│   ├── app.module.ts                    # 10 modules registered
│   ├── main.ts                          # Port 3103, CORS, Swagger
│   ├── auth/                            # JWT SSO auth
│   ├── common/
│   │   ├── decorators/                  # @Auth(), @CurrentUser(), @Public()
│   │   ├── filters/                     # GlobalExceptionFilter (DRD-Exxxx)
│   │   └── utils/                       # (empty — crypto.util.ts will be added here)
│   └── domain/
│       ├── spu-master/                  # SPU CRUD
│       ├── sku-master/                  # SKU CRUD
│       ├── channel-master/              # Channel read
│       ├── channel-product-mapping/     # Mapping CRUD
│       ├── sku-cost-history/            # Cost history
│       ├── raw-order/                   # Order upload/query
│       ├── upload-history/              # Upload tracking
│       ├── product-master-excel/        # Excel import/export
│       ├── report-upload/               # Traffic/ad reports
│       └── (NEW) external-integration/  # 외부 연동 설정
├── frontend/src/
│   ├── pages/SettingsPage.tsx           # Placeholder → Full card view
│   ├── services/                        # sales.service.ts, raw-order.service.ts
│   ├── hooks/                           # useSales.ts, useRawOrders.ts
│   └── i18n/locales/{ko,en,vi}/sales.json
```

### 1.2 Tech Stack Constraints

| Item | Detail |
|------|--------|
| Backend Pattern | NestJS Module → Controller → Service → Entity, `@Auth()` decorator for JWT auth |
| DB | MySQL 8.0, TypeORM 0.3.x, `autoLoadEntities: true`, staging `DB_SYNC=true` |
| Frontend Pattern | React Query hooks + service layer, lucide-react icons, TailwindCSS |
| Response Format | `{ success, data, timestamp }` via GlobalExceptionFilter |
| Error Code | `DRD-Exxxx` prefix |
| Column Prefix | `eit_` for external integration table |
| Encryption | AES-256-GCM, key from `ENCRYPTION_KEY` env var |

### 1.3 Related Existing Code Patterns

**Controller pattern** (from SpuMasterController):
```typescript
@Controller('external-integrations')
export class ExternalIntegrationController {
  @Get() @Auth() findAll(@CurrentUser() user, @Query() ...) { }
  @Post() @Auth() create(@CurrentUser() user, @Body() request) { }
  @Patch(':eit_id') @Auth() update(@CurrentUser() user, @Param(), @Body()) { }
  @Delete(':eit_id') @Auth() softDelete(@CurrentUser() user, @Param()) { }
}
```

**Service pattern** (from SkuMasterService):
- `@InjectRepository(Entity)` for TypeORM repo
- `createQueryBuilder()` or `find()` for queries
- `ent_id` filter on every query
- `save()` / `update()` for writes
- Soft delete via `eit_deleted_at = new Date()`

---

## 2. Implementation Plan (단계별 구현 계획)

### Phase 1: Backend — Encryption Utility (암호화 유틸리티)

**Step 1.1**: Create `src/common/utils/crypto.util.ts`
- AES-256-GCM encrypt/decrypt static methods
- Use `ENCRYPTION_KEY` from environment (32 byte hex string)
- `encrypt(plaintext: string): string` → returns `iv:authTag:ciphertext` (base64)
- `decrypt(encrypted: string): string` → returns plaintext
- └─ Side Impact: 없음 — 독립 유틸리티, 다른 모듈에 영향 없음

### Phase 2: Backend — Entity, DTO, Mapper (데이터 모델)

**Step 2.1**: Create `src/domain/external-integration/entity/external-integration.entity.ts`
- Table: `drd_external_integrations`
- All columns as defined in REQ §3.2
- Column prefix: `eit_`
- Nullable columns: explicit `type:` declaration (TypeORM union type bug)
- JSON column: `type: 'json'` for `extra_config`
- └─ Side Impact: 없음 — 신규 테이블, autoLoadEntities로 자동 등록

**Step 2.2**: Create Request DTOs
- `create-external-integration.request.ts`: category, service_code, service_name required; endpoint, key_name, key_value, extra_config, is_active optional
- `update-external-integration.request.ts`: all fields optional (PartialType)
- snake_case field names (API convention)
- class-validator decorators: `@IsString()`, `@IsOptional()`, `@IsIn()` for category enum
- └─ Side Impact: 없음

**Step 2.3**: Create Response DTO
- `external-integration.response.ts`: camelCase fields
- `hasKeyValue: boolean` instead of `keyValue` (security)
- └─ Side Impact: 없음

**Step 2.4**: Create Mapper
- `external-integration.mapper.ts`: `toResponse(entity)`, `toListResponse(entities)`
- Maps `eit_key_value` presence to `hasKeyValue: boolean`
- └─ Side Impact: 없음

### Phase 3: Backend — Service + Controller + Module (비즈니스 로직)

**Step 3.1**: Create `external-integration.service.ts`
- `findAll(entId, category?)`: List integrations filtered by ent_id + optional category
- `create(entId, request)`: Validate, encrypt key_value, save
- `update(entId, eitId, request)`: Find, encrypt new key_value if provided, update
- `remove(entId, eitId)`: Soft delete
- Encryption: `CryptoUtil.encrypt(key_value)` before save
- └─ Side Impact: 없음

**Step 3.2**: Create `external-integration.controller.ts`
- Routes: `GET /`, `POST /`, `PATCH /:eit_id`, `DELETE /:eit_id`
- All routes use `@Auth()` + `@CurrentUser()`
- └─ Side Impact: 없음

**Step 3.3**: Create `external-integration.module.ts`
- Import `TypeOrmModule.forFeature([ExternalIntegrationEntity])`
- Provide: Service, Controller
- └─ Side Impact: 없음

**Step 3.4**: Register in `app.module.ts`
- Add `ExternalIntegrationModule` to imports array
- └─ Side Impact: LOW — 기존 모듈 배열에 추가만, 다른 모듈 영향 없음

### Phase 4: Backend — Service Catalog Constant

**Step 4.1**: Create `constant/service-catalog.constant.ts`
- `SERVICE_CATALOG` array: `{ category, serviceCode, serviceName, defaultEndpoint, defaultKeyName, icon }`
- 12 predefined services (see REQ §3.3)
- └─ Side Impact: 없음

**Step 4.2**: Add `GET /api/v1/external-integrations/catalog` endpoint
- Returns predefined service catalog (public-ish, but still @Auth)
- └─ Side Impact: 없음

### Phase 5: Frontend — Service + Hook (API 연동)

**Step 5.1**: Create `src/services/integration.service.ts`
- Interfaces: `ExternalIntegration`, `ServiceCatalogItem`, `CreateIntegrationPayload`, `UpdateIntegrationPayload`
- API functions: `list(category?)`, `create(payload)`, `update(eitId, payload)`, `remove(eitId)`, `getCatalog()`
- └─ Side Impact: 없음

**Step 5.2**: Create `src/hooks/useIntegrations.ts`
- `useIntegrationList(category?)` — useQuery
- `useServiceCatalog()` — useQuery, staleTime: 10min
- `useCreateIntegration()` — useMutation + invalidate
- `useUpdateIntegration()` — useMutation + invalidate
- `useDeleteIntegration()` — useMutation + invalidate
- └─ Side Impact: 없음

### Phase 6: Frontend — Settings Page UI (카드뷰 설정 페이지)

**Step 6.1**: Rewrite `SettingsPage.tsx`
- Header with settings icon + title
- "External Integrations" card section
  - Category tabs/sections (AI, MARKETPLACE, EMAIL, STORAGE, ERP, PLATFORM)
  - Each integration shown as a row/card: icon, name, endpoint (truncated), key status (●●● or empty), active toggle
  - [+ Add] button → opens modal
  - Each card has edit (pencil) and delete (trash) icons
- └─ Side Impact: MEDIUM — 기존 placeholder 완전 교체, 하지만 다른 페이지 영향 없음

**Step 6.2**: Create Integration Form Modal (inline in SettingsPage or separate component)
- Category select → Service select (filtered by category, populated from catalog)
- Service selection auto-fills: name, endpoint, keyName defaults
- Key Value: password input with eye toggle
- Extra Config: text area (JSON)
- Active checkbox
- Save/Cancel buttons
- Edit mode: pre-fill existing values, keyValue shows masked placeholder
- └─ Side Impact: 없음

### Phase 7: i18n Keys (번역 키 추가)

**Step 7.1**: Add `settings.*` keys to ko/en/vi sales.json
- `settings.title`, `settings.integrations`, `settings.integrationsDesc`
- `settings.addIntegration`, `settings.editIntegration`
- `settings.category`, `settings.serviceCode`, `settings.serviceName`, `settings.endpoint`
- `settings.keyName`, `settings.keyValue`, `settings.keyValueMasked`, `settings.keyValuePlaceholder`
- `settings.extraConfig`, `settings.isActive`, `settings.lastVerified`
- Category labels: `settings.categoryAI`, `settings.categoryMarketplace`, etc.
- `settings.deleteConfirm`, `settings.noIntegrations`
- └─ Side Impact: 없음

### Phase 8: Environment Variable + Build Verification

**Step 8.1**: Add `ENCRYPTION_KEY` to `.env.staging.example` and staging `.env`
- 32-byte hex string (64 hex chars)
- └─ Side Impact: LOW — 새 env 변수 추가, 기존 변수 영향 없음

**Step 8.2**: Backend `npx tsc --noEmit` verification
**Step 8.3**: Frontend `npx tsc --noEmit` verification

---

## 3. File Change List (변경 파일 목록)

| # | Type | File | Change |
|---|------|------|--------|
| 1 | Backend | `src/common/utils/crypto.util.ts` | **NEW** — AES-256-GCM encrypt/decrypt |
| 2 | Backend | `src/domain/external-integration/entity/external-integration.entity.ts` | **NEW** — TypeORM entity |
| 3 | Backend | `src/domain/external-integration/dto/request/create-external-integration.request.ts` | **NEW** — Create DTO |
| 4 | Backend | `src/domain/external-integration/dto/request/update-external-integration.request.ts` | **NEW** — Update DTO (PartialType) |
| 5 | Backend | `src/domain/external-integration/dto/response/external-integration.response.ts` | **NEW** — Response DTO |
| 6 | Backend | `src/domain/external-integration/mapper/external-integration.mapper.ts` | **NEW** — Entity→Response mapper |
| 7 | Backend | `src/domain/external-integration/constant/service-catalog.constant.ts` | **NEW** — Predefined service catalog |
| 8 | Backend | `src/domain/external-integration/external-integration.service.ts` | **NEW** — Business logic |
| 9 | Backend | `src/domain/external-integration/external-integration.controller.ts` | **NEW** — API routes |
| 10 | Backend | `src/domain/external-integration/external-integration.module.ts` | **NEW** — NestJS module |
| 11 | Backend | `src/app.module.ts` | **MODIFY** — Add ExternalIntegrationModule |
| 12 | Frontend | `src/services/integration.service.ts` | **NEW** — API client |
| 13 | Frontend | `src/hooks/useIntegrations.ts` | **NEW** — React Query hooks |
| 14 | Frontend | `src/pages/SettingsPage.tsx` | **MODIFY** — Replace placeholder with card view |
| 15 | Frontend | `src/i18n/locales/ko/sales.json` | **MODIFY** — Add `settings.*` keys |
| 16 | Frontend | `src/i18n/locales/en/sales.json` | **MODIFY** — Add `settings.*` keys |
| 17 | Frontend | `src/i18n/locales/vi/sales.json` | **MODIFY** — Add `settings.*` keys |

---

## 4. Side Impact Analysis (사이드 임팩트 분석)

| Scope | Risk | Description |
|-------|------|-------------|
| Existing Backend Modules | NONE | 신규 모듈 추가만, 기존 10개 모듈 코드 변경 없음 |
| Existing Frontend Pages | NONE | SettingsPage만 변경, 다른 페이지 영향 없음 |
| Database | LOW | 신규 테이블만 생성, 기존 테이블 ALTER 없음 |
| Auth/JWT | NONE | 기존 `@Auth()` 데코레이터 그대로 사용 |
| Docker Build | LOW | 새 환경변수 `ENCRYPTION_KEY` 필요 — `.env`에 추가 |
| API Routes | NONE | 새 `/api/v1/external-integrations` 경로, 기존 라우트 충돌 없음 |
| i18n | LOW | `settings.*` 네임스페이스 키 추가, 기존 키 변경 없음 |

---

## 5. DB Migration (데이터베이스 마이그레이션)

### Staging (자동)
- `DB_SYNC=true` → TypeORM이 `drd_external_integrations` 테이블 자동 생성
- synchronize 실패 시 아래 수동 SQL 사용

### Production (수동)
```sql
CREATE TABLE IF NOT EXISTS drd_external_integrations (
  eit_id              CHAR(36)      NOT NULL,
  ent_id              CHAR(36)      NOT NULL,
  eit_category        VARCHAR(30)   NOT NULL,
  eit_service_code    VARCHAR(50)   NOT NULL,
  eit_service_name    VARCHAR(100)  NOT NULL,
  eit_endpoint        VARCHAR(500)  NULL,
  eit_key_name        VARCHAR(100)  NULL,
  eit_key_value       TEXT          NULL,
  eit_extra_config    JSON          NULL,
  eit_is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  eit_last_verified_at DATETIME     NULL,
  eit_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eit_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eit_deleted_at      DATETIME      NULL,
  PRIMARY KEY (eit_id),
  INDEX idx_eit_ent_id (ent_id),
  INDEX idx_eit_category (ent_id, eit_category),
  UNIQUE KEY uq_eit_ent_service (ent_id, eit_service_code, eit_deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Environment Variable

```env
# 신규 추가 — 32 byte hex (64 chars)
ENCRYPTION_KEY=your-64-hex-chars-here
```
