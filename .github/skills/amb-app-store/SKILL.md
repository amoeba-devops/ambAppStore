---
name: amb-app-store
description: >
  ambAppStore 파트너 앱 플랫폼 개발 스킬. React + NestJS + MySQL + Clean Architecture + MSA 기반의
  커스텀 앱(app-car-manager, app-hscode, app-sales-report, app-stock-forecast) 개발 시 사용.
  Use when: 앱 CRUD 기능 구현, API 설계, DB 스키마 설계, 프론트엔드 페이지/컴포넌트 작성,
  NestJS 모듈/서비스/컨트롤러 생성, Docker 설정, Nginx 라우팅, TypeORM 엔티티 작성,
  React Query 훅 작성, Zustand 스토어, i18n 번역 파일, Vite 설정, 배포 스크립트,
  요구사항분석서, 작업계획서, 테스트케이스, 작업완료보고서, 개발 프로세스 문서 작성.
  Triggers: "앱 개발", "API 구현", "화면 구현", "DB 설계", "엔티티 작성", "새 앱 추가",
  "app-car-manager", "hscode", "sales-report", "stock-forecast", "BFF", "배포", "deploy",
  "요구사항분석", "작업계획", "테스트케이스", "완료보고서", "ANALYSIS", "TASK-PLAN",
  "TEST-CASE", "REPORT".
---

# ambAppStore Development Skill

AMA(AI Management Assistant) 생태계 위에서 동작하는 **파트너 앱 플랫폼** 개발 가이드.
단일 도메인(`apps.amoeba.site`) 아래 4개 앱을 독립적으로 개발·배포한다.

---

## 1. Project Context (프로젝트 컨텍스트)

### 1.1 앱 목록 및 할당

| App | Slug | DB | BE Port | FE Port | Table Prefix | Column Prefix |
|-----|------|----|---------|---------|-------------|---------------|
| 법인차량관리 | `/app-car-manager` | `db_app_car` | :3101 | :5201 | `car_` | `car_`, `dsp_`, `drv_`, `mnt_` |
| HS Code Tool | `/app-hscode` | `db_app_hscode` | :3102 | :5202 | `hsc_` | `hsc_` |
| 매출리포트 | `/app-sales-report` | `db_app_sales` | :3103 | :5203 | `sal_` | `sal_` |
| 재고예측 | `/app-stock-forecast` | `db_app_stock` | :3104 | :5204 | `stk_` | `stk_` |

### 1.2 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript 5 + TailwindCSS 3 + Vite 5 |
| Backend | NestJS 10 + TypeScript 5 + TypeORM 0.3.x |
| Database | **MySQL 8.0** (앱별 독립 DB) |
| State | Zustand (global) + React Query 5 (server) + React Hook Form + Zod |
| Auth | JWT (AMA SSO Passthrough) |
| Icons | lucide-react |
| Container | Docker + docker-compose (앱별 BFF 격리) |
| Proxy | Nginx (SSL + Reverse Proxy) |
| CI/CD | GitHub Actions |
| Monorepo | Turborepo + npm workspaces |

### 1.3 Architecture Overview

```
┌──────────────────────────┐        ┌──────────────────────────────────┐
│  AMA (ama.amoeba.site)   │        │  AppStore (apps.amoeba.site)     │
│                          │        │                                  │
│  ┌────────────────────┐  │  JWT   │  Nginx                           │
│  │ Entity 사용자       │──┼───────▶│  ├── /{slug}/*   → React SPA     │
│  │ (법인별 사용자)     │  │  SSO   │  └── /{slug}/api/* → NestJS BFF  │
│  └────────────────────┘  │        │                                  │
│  ┌────────────────────┐  │  API   │  ┌────────────────────────┐      │
│  │ 앱 서비스 안내     │──┼───────▶│  │ App Subscription       │      │
│  │ (신청/해제 페이지)  │  │        │  │ (ent_id별 구독 관리)    │      │
│  └────────────────────┘  │        │  └────────────────────────┘      │
└──────────────────────────┘        └──────────────────────────────────┘
```

각 앱은 **완전 격리**: 독립 DB, 독립 Docker 컨테이너, 독립 빌드.

### 1.4 AMA ↔ AppStore 연동 흐름

```
1. AMA Entity 사용자 → AMA 내 "앱스토어" 메뉴 진입
2. 앱 서비스 안내 페이지에서 원하는 앱 "신청" 클릭
3. AMA → AppStore Subscription API 호출 (ent_id + app_slug)
4. AppStore가 해당 Entity의 앱 구독 레코드 생성
5. 사용자가 앱 접속 시 AMA JWT 토큰으로 인증
6. BFF가 JWT에서 ent_id 추출 → 구독 여부 확인 → 앱 데이터 격리 제공
```

**핵심 원칙**:
- 모든 앱 데이터는 `ent_id` (AMA Entity/법인 코드) 기준으로 **멀티테넌시 격리**
- 앱 접근 권한은 Entity 단위 **구독(subscription)** 기반
- 인증은 AMA JWT SSO Passthrough (앱별 자체 회원가입 없음)

---

## 2. Project Structure (프로젝트 구조)

```
ambAppStore/
├── apps/
│   └── {app-slug}/
│       ├── frontend/                 # React SPA
│       │   ├── src/
│       │   │   ├── domain/{name}/    # 도메인 모듈
│       │   │   │   ├── pages/        # {Domain}{Action}Page.tsx
│       │   │   │   ├── components/   # 도메인 전용 컴포넌트
│       │   │   │   ├── hooks/        # use{Xxx}.ts (React Query)
│       │   │   │   ├── service/      # {domain}.service.ts (API 호출)
│       │   │   │   ├── store/        # {domain}.store.ts (Zustand)
│       │   │   │   └── types/        # {domain}.types.ts
│       │   │   ├── components/       # 공통 UI (DataTable, StatusBadge 등)
│       │   │   ├── hooks/            # 공통 훅
│       │   │   ├── lib/              # api-client, utils
│       │   │   ├── store/            # 전역 스토어 (auth, notification)
│       │   │   ├── i18n/             # i18n 설정 + locales/{ko,en}.json
│       │   │   └── App.tsx
│       │   ├── vite.config.ts        # base: '/{slug}'
│       │   └── package.json
│       ├── backend/                  # NestJS BFF (Clean Architecture)
│       │   ├── src/
│       │   │   ├── domain/{name}/    # 도메인 모듈
│       │   │   │   ├── controller/   # {domain}.controller.ts
│       │   │   │   ├── service/      # {domain}.service.ts
│       │   │   │   ├── entity/       # {domain}.entity.ts (TypeORM)
│       │   │   │   ├── repository/   # {domain}.repository.ts
│       │   │   │   ├── dto/
│       │   │   │   │   ├── request/  # create-{domain}.request.ts (snake_case)
│       │   │   │   │   └── response/ # {domain}.response.ts (camelCase)
│       │   │   │   ├── mapper/       # {domain}.mapper.ts (static methods)
│       │   │   │   ├── constant/     # {domain}.constant.ts
│       │   │   │   └── {domain}.module.ts
│       │   │   ├── global/           # Guards, Filters, Interceptors
│       │   │   ├── app.module.ts
│       │   │   └── main.ts
│       │   └── package.json
│       └── docker-compose.{slug}.yml
├── packages/
│   ├── eslint-config/
│   ├── tsconfig/
│   └── ui-kit/
├── platform/
│   ├── nginx/apps.amoeba.site.conf
│   └── scripts/deploy.sh, rollback.sh
├── turbo.json
└── package.json
```

---

## 2.5 AMA Integration & App Subscription (AMA 연동 및 앱 구독)

### 2.5.1 Platform DB — 공통 구독 관리

각 앱의 독립 DB와 별도로, 플랫폼 레벨 공통 DB(`db_app_platform`)에 앱 구독 정보를 관리한다.

```sql
-- db_app_platform

-- 앱 등록 마스터
CREATE TABLE plt_apps (
  app_id          CHAR(36)     NOT NULL PRIMARY KEY,
  app_slug        VARCHAR(50)  NOT NULL UNIQUE,       -- 'app-car-manager', 'app-hscode' 등
  app_name        VARCHAR(100) NOT NULL,               -- 표시 이름
  app_description TEXT,
  app_icon_url    VARCHAR(500),
  app_status      ENUM('ACTIVE','INACTIVE','COMING_SOON') NOT NULL DEFAULT 'ACTIVE',
  app_port_fe     SMALLINT,
  app_port_be     SMALLINT,
  app_created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  app_updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  app_deleted_at  DATETIME
);

-- Entity별 앱 구독 (핵심 테이블)
CREATE TABLE plt_subscriptions (
  sub_id          CHAR(36)     NOT NULL PRIMARY KEY,
  ent_id          CHAR(36)     NOT NULL,               -- AMA Entity(법인) ID
  app_id          CHAR(36)     NOT NULL,               -- 구독 대상 앱
  sub_status      ENUM('ACTIVE','SUSPENDED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  sub_requested_by CHAR(36)    NOT NULL,               -- 신청자 (AMA user_id)
  sub_approved_at DATETIME,
  sub_expires_at  DATETIME,                            -- NULL = 무기한
  sub_created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sub_updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  sub_deleted_at  DATETIME,
  FOREIGN KEY (app_id) REFERENCES plt_apps(app_id),
  UNIQUE KEY uq_plt_subscriptions_ent_app (ent_id, app_id)
);

CREATE INDEX idx_plt_subscriptions_ent ON plt_subscriptions(ent_id, sub_status);
```

### 2.5.2 인증 흐름 (JWT SSO Passthrough)

```
AMA 로그인 → AMA JWT 발급 (payload: { userId, entityId, entityCode, roles, ... })
  → 사용자가 apps.amoeba.site/{slug} 접속
  → React SPA가 AMA JWT를 Authorization 헤더에 포함
  → BFF JwtAuthGuard가 AMA 공개키로 JWT 검증
  → SubscriptionGuard가 해당 ent_id + app_slug 구독 여부 확인
  → 통과 시 요청 처리, 실패 시 403 반환
```

**JWT Payload (AMA에서 발급)**:
```typescript
interface AmaJwtPayload {
  userId: string;      // AMA 사용자 UUID
  entityId: string;    // AMA 법인 UUID (ent_id)
  entityCode: string;  // AMA 법인 코드 (예: 'AMB-KR', 'AMB-VN')
  email: string;
  name: string;
  roles: string[];     // AMA 역할
  iat: number;
  exp: number;
}
```

### 2.5.3 Guard Stack (인증/인가 데코레이터)

| 데코레이터 | 조합 | 용도 |
|-----------|------|------|
| `@Auth()` | JwtAuthGuard + SubscriptionGuard | **기본** — JWT 인증 + 앱 구독 확인 + ent_id 격리 |
| `@Public()` | 인증 없음 | Health check, 앱 정보 조회 등 공개 API |
| `@AdminOnly()` | Auth + RoleGuard(ADMIN) | 앱 내 관리자 전용 |

```typescript
// Guard 적용 예시
@Controller('vehicles')
@ApiTags('차량')
export class VehicleController {
  @Get()
  @Auth()  // JWT 검증 + 구독 확인 + ent_id 자동 추출
  async findAll(
    @CurrentUser() user: AmaJwtPayload,
  ): Promise<BaseListResponse<VehicleResponse>> {
    // user.entityId로 데이터 자동 격리
    const vehicles = await this.vehicleService.findAll(user.entityId);
    return { success: true, data: VehicleMapper.toListResponse(vehicles), ... };
  }
}
```

### 2.5.4 Subscription API (AMA에서 호출)

```
POST   /api/v1/platform/subscriptions          앱 구독 신청 (AMA → AppStore)
DELETE /api/v1/platform/subscriptions/:id       앱 구독 해제
GET    /api/v1/platform/subscriptions            Entity의 구독 목록 조회
GET    /api/v1/platform/apps                     앱 목록 (서비스 안내 페이지용)
GET    /api/v1/platform/apps/:slug               앱 상세 정보
```

### 2.5.5 각 앱 DB의 Entity 격리 패턴

모든 앱의 **주요 데이터 테이블에 `ent_id` 컬럼 필수 포함**:

```sql
-- 예: car_vehicles 테이블에 ent_id 추가
CREATE TABLE car_vehicles (
  car_id         CHAR(36)  NOT NULL PRIMARY KEY,
  ent_id         CHAR(36)  NOT NULL,           -- ★ AMA Entity ID (필수)
  car_plate_no   VARCHAR(20) NOT NULL,
  -- ... 기타 컬럼
  UNIQUE KEY uq_car_vehicles_ent_plate (ent_id, car_plate_no)  -- Entity 내 유니크
);
CREATE INDEX idx_car_vehicles_ent ON car_vehicles(ent_id);
```

**Entity 작성 시**:
```typescript
@Entity('car_vehicles')
export class VehicleEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'car_id' })
  carId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;  // ★ AMA Entity ID — 멀티테넌시 필수

  @Column({ name: 'car_plate_no', length: 20 })
  carPlateNo: string;
  // ...
}
```

**Service에서 Entity 격리 쿼리**:
```typescript
async findAll(entityId: string): Promise<VehicleEntity[]> {
  return this.repository.find({
    where: { entId: entityId, carDeletedAt: IsNull() },
    order: { carCreatedAt: 'DESC' },
  });
}

async create(entityId: string, request: CreateVehicleRequest): Promise<VehicleEntity> {
  const vehicle = this.repository.create({
    entId: entityId,  // ★ 반드시 entityId 주입
    carPlateNo: request.plate_no,
    // ...
  });
  return this.repository.save(vehicle);
}
```

---

## 3. Backend Rules (백엔드 규칙)

### 3.1 Clean Architecture 4-Layer (MUST)

```
Presentation  → Controller, DTO (Request/Response 변환)
Application   → Service (비즈니스 로직, 트랜잭션 경계)
Domain        → Entity, Repository Interface
Infrastructure → TypeORM Entity, Repository 구현체, 외부 API
```

**레이어 규칙**:
- Controller → Service 호출만 (비즈니스 로직 금지, Repository 직접 접근 금지)
- Service → Repository, Entity 사용 가능
- Entity → Service/Controller import 금지

### 3.2 Controller Pattern

```typescript
@Controller('vehicles')
@ApiTags('차량')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post()
  @Auth()  // ★ JWT 인증 + 구독 확인 + ent_id 자동 추출
  @ApiOperation({ summary: '차량 등록' })
  async create(
    @Body() request: CreateVehicleRequest,
    @CurrentUser() user: AmaJwtPayload,  // ★ JWT에서 사용자/법인 정보 추출
  ): Promise<BaseSingleResponse<VehicleResponse>> {
    const vehicle = await this.vehicleService.create(user.entityId, request);
    return { success: true, data: VehicleMapper.toResponse(vehicle), timestamp: new Date().toISOString() };
  }
}
```

### 3.3 DTO Rules

**Request DTO** — `snake_case` (API 입력):
```typescript
export class CreateVehicleRequest {
  @IsString() @IsNotEmpty() @MaxLength(20)
  plate_no: string;

  @IsString() @IsNotEmpty()
  make: string;

  @IsEnum(FuelType)
  fuel_type: FuelType;
}
```

**Response DTO** — `camelCase` (API 출력):
```typescript
export class VehicleResponse {
  carId: string;
  plateNo: string;
  make: string;
  model: string;
  fuelType: string;
  status: string;
  createdAt: string;
}
```

### 3.4 Entity Rules (TypeORM + MySQL)

```typescript
@Entity('car_vehicles')
export class VehicleEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'car_id' })
  carId: string;

  @Column({ name: 'car_plate_no', length: 20, unique: true })
  carPlateNo: string;

  @Column({ name: 'car_status', type: 'enum', enum: VehicleStatus, default: VehicleStatus.AVAILABLE })
  carStatus: VehicleStatus;

  // ⚠ MUST: nullable 컬럼은 반드시 type 명시 (TypeORM reflect-metadata 이슈)
  @Column({ name: 'car_note', type: 'text', nullable: true })
  carNote: string | null;

  @CreateDateColumn({ name: 'car_created_at' })
  carCreatedAt: Date;

  @UpdateDateColumn({ name: 'car_updated_at' })
  carUpdatedAt: Date;

  @DeleteDateColumn({ name: 'car_deleted_at' })
  carDeletedAt: Date;  // Soft Delete
}
```

### 3.5 Mapper Pattern (static method)

```typescript
export class VehicleMapper {
  static toResponse(entity: VehicleEntity): VehicleResponse {
    return {
      carId: entity.carId,
      plateNo: entity.carPlateNo,
      make: entity.carMake,
      model: entity.carModel,
      fuelType: entity.carFuelType,
      status: entity.carStatus,
      createdAt: entity.carCreatedAt.toISOString(),
    };
  }

  static toListResponse(entities: VehicleEntity[]): VehicleResponse[] {
    return entities.map(VehicleMapper.toResponse);
  }
}
```

### 3.6 Module Registration

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([VehicleEntity])],
  controllers: [VehicleController],
  providers: [VehicleService],
  exports: [VehicleService],
})
export class VehicleModule {}
```

### 3.7 Error Handling

```typescript
// 앱별 에러 코드 prefix
// app-car-manager: CAR-E{4자리}, app-hscode: HSC-E{4자리}
// app-sales-report: SAL-E{4자리}, app-stock-forecast: STK-E{4자리}

throw new BusinessException('CAR-E3001', '차량을 찾을 수 없습니다.');
// → { success: false, data: null, error: { code: 'CAR-E3001', message: '...' }, timestamp: '...' }
```

---

## 4. Frontend Rules (프론트엔드 규칙)

### 4.1 API Client

```typescript
// src/lib/api-client.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,  // e.g., '/app-car-manager/api/v1'
  headers: { 'Content-Type': 'application/json' },
});
```

### 4.2 Service Layer

```typescript
// domain/vehicle/service/vehicle.service.ts
class VehicleService {
  private readonly basePath = '/vehicles';

  getList = (params: VehicleFilter) =>
    apiClient.get(this.basePath, { params }).then(r => r.data);
  getById = (id: string) =>
    apiClient.get(`${this.basePath}/${id}`).then(r => r.data.data);
  create = (data: CreateVehicleReq) =>
    apiClient.post(this.basePath, data).then(r => r.data.data);
  update = (id: string, data: UpdateVehicleReq) =>
    apiClient.patch(`${this.basePath}/${id}`, data).then(r => r.data.data);
  remove = (id: string) =>
    apiClient.delete(`${this.basePath}/${id}`).then(r => r.data);
}
export const vehicleService = new VehicleService();
```

### 4.3 Query Key Factory

```typescript
export const vehicleKeys = {
  all: ['vehicles'] as const,
  lists: () => [...vehicleKeys.all, 'list'] as const,
  list: (filter: VehicleFilter) => [...vehicleKeys.lists(), filter] as const,
  detail: (id: string) => [...vehicleKeys.all, 'detail', id] as const,
};
```

### 4.4 Custom Hooks (React Query)

```typescript
export const useVehicleList = (filter: VehicleFilter) =>
  useQuery({
    queryKey: vehicleKeys.list(filter),
    queryFn: () => vehicleService.getList(filter),
  });

export const useCreateVehicle = () =>
  useMutation({
    mutationFn: vehicleService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vehicleKeys.lists() }),
  });
```

### 4.5 Import Order (MUST)

1. React core (`react`)
2. Third-party libraries
3. React Router
4. Global (`@/components/`, `@/hooks/`, `@/lib/`)
5. Domain (`../`)
6. Types

### 4.6 State Management

| State Type | Tool | 용도 |
|------------|------|------|
| Server state | React Query | API 데이터 (staleTime: 30s) |
| Global state | Zustand | auth, notification |
| Local state | useState | 컴포넌트 전용 |
| Form state | React Hook Form + Zod | 폼 검증 |
| URL state | React Router | 쿼리/경로 파라미터 |

### 4.7 Routing Pattern

```typescript
// vite.config.ts: base: '/{slug}'
const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: '{resource}', element: <{Resource}ListPage /> },
      { path: '{resource}/new', element: <{Resource}FormPage /> },
      { path: '{resource}/:id', element: <{Resource}DetailPage /> },
    ],
  },
], { basename: '/{slug}' });
```

### 4.8 Common UI Components

`DataTable`, `StatusBadge`, `SearchBar`, `DateRangePicker`, `ConfirmModal`,
`FileUpload`, `LoadingSpinner`, `EmptyState`, `PageHeader`

---

## 5. Database Rules (데이터베이스 규칙)

### 5.1 Naming Convention

| 대상 | 규칙 | 예시 |
|------|------|------|
| DB | `db_app_{slug}` | `db_app_car`, `db_app_platform` |
| 테이블 | `{prefix}_{name_plural}` | `car_vehicles`, `car_dispatches` |
| PK | `{colPrefix}_id` (UUID v4, CHAR(36)) | `car_id`, `dsp_id` |
| FK | 참조 테이블 PK 그대로 | `car_id` (car_vehicles 참조) |
| **Entity ID** | `ent_id` CHAR(36) NOT NULL | **★ 모든 주요 테이블 필수** |
| 일반 컬럼 | `{colPrefix}_{name}` snake_case | `car_plate_no`, `dsp_purpose` |
| Boolean | `{colPrefix}_is_{name}` | `car_is_active` |
| 생성일 | `{colPrefix}_created_at` DATETIME | `car_created_at` |
| 수정일 | `{colPrefix}_updated_at` DATETIME | `car_updated_at` |
| 삭제일 | `{colPrefix}_deleted_at` DATETIME NULL | `car_deleted_at` (Soft Delete) |
| ENUM | 대문자 snake_case | `AVAILABLE`, `IN_USE`, `MAINTENANCE` |

### 5.2 Common Column Template

```sql
{prefix}_id           CHAR(36)   NOT NULL PRIMARY KEY,
ent_id                CHAR(36)   NOT NULL,              -- ★ AMA Entity ID (멀티테넌시 필수)
{prefix}_created_at   DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
{prefix}_updated_at   DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
{prefix}_deleted_at   DATETIME   NULL DEFAULT NULL
-- ★ 반드시 ent_id 인덱스 추가: CREATE INDEX idx_{table}_ent ON {table}(ent_id);
```

### 5.3 Index Naming

| 유형 | 패턴 | 예시 |
|------|------|------|
| Index | `idx_{table}_{columns}` | `idx_car_dispatches_car_status` |
| Primary | `pk_{table}` | `pk_car_vehicles` |
| Foreign | `fk_{table}_{ref}` | `fk_car_dispatches_vehicles` |
| Unique | `uq_{table}_{column}` | `uq_car_vehicles_plate_no` |

---

## 6. API Design (API 설계)

### 6.1 Common Rules

```
Base Path:     /api/v1
Request Body:  snake_case
Response Body: camelCase
Auth Header:   Authorization: Bearer {jwt}
Content-Type:  application/json
```

### 6.2 Standard Response

```typescript
// 단일 응답
{ success: true, data: T, timestamp: string }

// 목록 응답
{ success: true, data: T[], pagination: { page, size, totalCount, totalPages }, timestamp: string }

// 에러 응답
{ success: false, data: null, error: { code: string, message: string }, timestamp: string }
```

### 6.3 Health Check (모든 앱 필수)

```
GET /health → { status: 'ok' }
```

---

## 7. i18n Rules (다국어 규칙)

- **모든 UI 텍스트 i18n 처리** (하드코딩 금지)
- 최소 KO 필수, EN 권장
- `react-i18next` + namespace별 JSON 번역 파일
- 새 네임스페이스 추가 시 `i18n.ts`에 import + resource + ns 배열 등록

```
src/i18n/
├── i18n.ts
└── locales/
    ├── ko/
    │   ├── common.json
    │   └── vehicle.json
    └── en/
        ├── common.json
        └── vehicle.json
```

---

## 8. Git & Branch Rules

### 8.1 Branch Strategy

| Branch | Environment | Deploy |
|--------|-------------|--------|
| `main` | **Staging** (`apps.amoeba.site`) | Push/Merge → 자동 배포 |
| `production` | Production | *향후 구성* — main에서 merge |

> 현재 Phase: **Staging Only** — `main` 브랜치만 운영.
> Production 서버 구성 시 `production` 브랜치 추가.

### 8.2 Branch Naming

```
{type}/{app-slug}/{description}
```

| Type | 사용 시점 | 예시 |
|------|-----------|------|
| `feature` | 신규 기능 | `feature/app-car-manager/vehicle-crud` |
| `fix` | 버그 수정 | `fix/app-hscode/search-encoding-error` |
| `hotfix` | 긴급 수정 (main에서 분기) | `hotfix/app-car-manager/jwt-expired-handling` |
| `platform` | 인프라/공유 패키지 | `platform/subscription-guard` |
| `docs` | 문서 작업 | `docs/api-spec-update` |

### 8.3 Workflow

```
일반 개발:
  main 분기 → feature/{app-slug}/{desc} → PR → Code Review → main 머지 → Staging 자동 배포

긴급 수정:
  main 분기 → hotfix/{app-slug}/{desc} → PR (간소화 리뷰) → main 머지 → Staging 자동 배포

향후 Production:
  main (Staging 검증 완료) → PR → production 머지 → Production 배포
```

### 8.4 Merge Rules

- **Squash Merge** 기본 (feature → main)
- **Merge Commit** 허용 (main → production)
- 머지 후 원격 feature 브랜치 **자동 삭제**
- `main` 직접 push 금지 — 반드시 PR 경유

### 8.5 Commit Convention

```
{type}: {설명}

type: feat | fix | docs | style | refactor | test | chore | hotfix
예시: feat: 차량 등록 API 구현
      fix: 배차 충돌 검사 로직 수정
      hotfix: JWT 만료 시 리다이렉트 오류 수정
```

---

## 9. Docker & Deployment (배포)

### 9.1 Docker Compose (앱별 격리)

각 앱은 독립 `docker-compose.{slug}.yml` 파일로 관리.
BFF 컨테이너 이름: `bff-{slug}` (예: `bff-app-car-manager`)

### 9.2 Nginx Routing

```nginx
location /{slug}/ {
    alias /usr/share/nginx/html/{slug}/;
    try_files $uri $uri/ /{slug}/index.html;
}
location /{slug}/api/ {
    proxy_pass http://bff-{slug}:{port}/api/;
}
```

### 9.3 Vite Build Config

```typescript
// vite.config.ts
export default defineConfig({
  base: '/{slug}/',
  // ...
});
```

---

## 10. Procedure: New App Scaffolding (새 앱 추가)

1. `apps/{slug}/frontend/` — Vite + React 프로젝트 생성, `base: '/{slug}'`
2. `apps/{slug}/backend/` — NestJS 프로젝트 생성, Clean Architecture 폴더 구조
3. MySQL DB 생성: `db_app_{name}`
4. `docker-compose.{slug}.yml` 작성 (포트: 다음 가용 포트)
5. Nginx `apps.amoeba.site.conf`에 라우팅 추가
6. `turbo.json`에 앱 등록
7. GitHub Actions workflow에 앱 추가

## 11. Procedure: New Domain Module (새 도메인 모듈 추가)

### Backend
1. `src/domain/{name}/` 폴더 생성
2. Entity 정의 (`{name}.entity.ts`) — 테이블/컬럼 네이밍 규칙 준수
3. Request DTO (`dto/request/`) — snake_case
4. Response DTO (`dto/response/`) — camelCase
5. Mapper (`{name}.mapper.ts`) — static toResponse()
6. Service (`{name}.service.ts`) — 비즈니스 로직
7. Controller (`{name}.controller.ts`) — Swagger 데코레이터 필수
8. Module (`{name}.module.ts`) — TypeOrmModule.forFeature([Entity])
9. AppModule에 import 등록

### Frontend
1. `src/domain/{name}/` 폴더 생성
2. Service (`service/{name}.service.ts`) — API 호출
3. Query Keys (`hooks/{name}Keys.ts` 혹은 hooks 내 정의)
4. Hooks (`hooks/use{Name}List.ts`, `hooks/use{Name}Mutation.ts`)
5. Pages (`pages/{Name}ListPage.tsx`, `pages/{Name}DetailPage.tsx`)
6. Components 필요 시 추가
7. Router에 경로 등록
8. i18n 번역 JSON 추가 (ko/en)

---

## 12. Checklist (코드 리뷰 체크리스트)

**AMA 연동 / 멀티테넌시**:
- [ ] 주요 데이터 테이블에 `ent_id` 컬럼 포함?
- [ ] `ent_id` 인덱스 추가?
- [ ] Service 메서드에서 `entityId` 파라미터 받아 쿼리 격리?
- [ ] Controller에 `@Auth()` 데코레이터 적용? (`@CurrentUser()`로 JWT payload 추출)
- [ ] 데이터 생성 시 `entId: entityId` 주입?

**코드 품질**:
- [ ] 테이블/컬럼 네이밍이 DB 규칙 준수? (prefix, snake_case, UUID PK)
- [ ] Request DTO는 snake_case, Response DTO는 camelCase?
- [ ] Entity nullable 컬럼에 `type` 명시?
- [ ] Mapper로 Entity↔DTO 변환? (Controller에 비즈니스 로직 없음?)
- [ ] Soft Delete (`deleted_at`) 적용?
- [ ] 표준 응답 형식 `{ success, data, error?, timestamp }` 사용?
- [ ] API path `/api/v1/{resource}` 형식?
- [ ] 프론트엔드 Service layer 통해 API 호출? (컴포넌트 내 axios 금지)
- [ ] React Query + Query Key Factory 패턴 사용?
- [ ] UI 텍스트 i18n 처리? (하드코딩 없음?)
- [ ] `any` 타입 사용 없음?
- [ ] Health check endpoint 존재?

---

## 13. Development Process (개발 작업 프로세스)

### 13.1 산출물 흐름 (Document Flow)

앱 단위 기능 개발은 아래 순서의 문서 산출물을 따른다. 각 산출물은 이전 단계의 **입력물**을 기반으로 작성한다.

```
┌─────────────────────────────────────────────────────────────────┐
│  ① 요구사항정의서 (REQ)                                          │
│     PM/기획자가 비즈니스 요구사항을 정의                          │
│     ↓  입력물                                                    │
│  ② 요구사항분석서 (ANALYSIS)                                     │
│     기능 분해, 비즈니스 규칙 도출, 리스크 식별, 추적 매트릭스     │
│     ↓  입력물                                                    │
│  ③ 작업계획서 (TASK-PLAN)                                        │
│     구현 태스크 분해, 의존성 정의, 일정 산정, 담당자 배정         │
│     ↓  입력물                                                    │
│  ④ 구현 (Implementation)                                        │
│     코드 작성 — §2~§12 규칙 준수                                  │
│     ↓  입력물                                                    │
│  ⑤ 테스트케이스 (TEST-CASE)                                      │
│     기능/API/비즈니스규칙 단위 테스트 시나리오 정의               │
│     ↓  실행                                                      │
│  ⑥ 작업완료보고서 (REPORT)                                       │
│     구현 결과 요약, 테스트 결과, 잔여 이슈, 배포 정보            │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 문서 공통 규칙

#### 13.2.1 문서 ID 체계

```
{APP_PREFIX}-{DOC_TYPE}-{MAJOR}.{MINOR}.{PATCH}
```

| 요소 | 규칙 | 예시 |
|------|------|------|
| APP_PREFIX | 앱별 고유 코드 | `AMA-VEH` (car-manager), `AMA-HSC` (hscode), `AMA-SAL` (sales-report), `AMA-STK` (stock-forecast) |
| DOC_TYPE | 문서 유형 코드 | `REQ`, `ANALYSIS`, `TASK-PLAN`, `TEST-CASE`, `REPORT` |
| 버전 | SemVer | `1.0.0`, `1.1.0` |

**ID 예시**:
- `AMA-VEH-REQ-1.1.0` — 법인차량 요구사항정의서
- `AMA-VEH-ANALYSIS-1.1.0` — 법인차량 요구사항분석서
- `AMA-VEH-TASK-PLAN-1.0.0` — 법인차량 작업계획서
- `AMA-VEH-TEST-CASE-1.0.0` — 법인차량 테스트케이스
- `AMA-VEH-REPORT-1.0.0` — 법인차량 작업완료보고서

#### 13.2.2 Frontmatter (YAML 헤더) — 모든 문서 필수

```yaml
---
document_id: AMA-VEH-{DOC_TYPE}-{VERSION}
version: {VERSION}
status: Draft | Review | Approved | Final
created: YYYY-MM-DD
updated: YYYY-MM-DD
author: {작성자}
based_on: {입력물 document_id}      # ② 이후 문서는 필수
app: {app-slug}                     # 대상 앱
phase: {Phase 번호}                  # 해당 Phase (선택)
---
```

#### 13.2.3 파일 저장 위치

**SDLC 문서** (`docs/` — 작업 프로세스 산출물):
```
docs/
├── analysis/                     # 요구사항분석서
│   └── REQ-{YYYYMMDD}-{제목}.md
├── plan/                         # 작업계획서
│   └── PLAN-{YYYYMMDD}-{제목}.md
├── test/                         # 테스트케이스
│   └── TC-{YYYYMMDD}-{제목}.md
└── implementation/               # 작업완료보고서
    └── RPT-{YYYYMMDD}-{제목}.md
```

**참조 문서** (`reference/` — 앱별 상세 스펙):
```
reference/
├── req/                          # 앱별 상세 요구사항 문서
│   ├── AMA-VEH-REQ-1.1.0.md
│   └── AMA-VEH-ANALYSIS-1.1.0.md
├── plan/                         # 작업계획서
│   └── AMA-VEH-TASK-PLAN-1.0.0.md
├── test/                         # 테스트케이스
│   └── AMA-VEH-TEST-CASE-1.0.0.md
├── report/                       # 작업완료보고서
│   └── AMA-VEH-REPORT-1.0.0.md
├── requirements.md               # 플랫폼 전체 요구사항정의서
├── func-definition.md            # 플랫폼 전체 기능명세서
├── ui-spec.md                    # 플랫폼 전체 화면정의서
└── project-plan.md               # 플랫폼 전체 프로젝트수행계획서
```

#### 13.2.4 문서 상태 전이

```
Draft → Review → Approved → Final
                    ↓
               (수정 필요 시)
                 Draft (버전 bump)
```

### 13.3 ① 요구사항정의서 (REQ)

**작성 시점**: 새 앱 또는 주요 기능 기획 완료 시
**작성자**: PM / 기획자
**입력물**: 비즈니스 요구사항, 이해관계자 인터뷰

**필수 섹션**:

| # | 섹션 | 내용 |
|---|------|------|
| 1 | 개요 및 범위 | 배경, 목표, 이해관계자, 제약사항 |
| 2 | 아키텍처 설계 | 시스템 위치, AMA 연동 범위, 데이터 소유 원칙 |
| 3 | 도메인 모델 | 핵심 도메인 개념, 관계 모델, 상태 전이 |
| 4 | 기능 요구사항 | 도메인별 FR 테이블 (ID, 기능, 우선순위) |
| 5 | 데이터 모델 | ERD, 테이블 정의 (DDL), ENUM 목록 |
| 6 | API 설계 | 엔드포인트 목록 (Method, Path, 설명) |
| 7 | UI 구성 | 화면 구조, 주요 화면 와이어프레임 (ASCII) |
| 8 | 비기능 요구사항 | 성능, 보안, 권한 체계 |
| 9 | 구현 단계 | Phase별 작업 범위, 예상 공수 |
| 10 | Open Questions | 미결정 사항 (BLOCKER / P0 / P1 / P2) |

**FR ID 규칙**: `FR-{도메인코드}-{3자리 순번}` (예: `FR-VEH-001`, `FR-DSP-015`)

### 13.4 ② 요구사항분석서 (ANALYSIS)

**작성 시점**: REQ 문서 작성/갱신 후
**작성자**: PM / 개발 리드
**입력물**: 요구사항정의서 (REQ)
**저장 경로**: `docs/analysis/REQ-{YYYYMMDD}-{제목}.md`

> **특징**: 관련 기존 코드·DB 스키마·API를 반드시 탐색한 후 **정확한 현황 기반**으로 작성

**필수 섹션** (순서 엄수):

| # | 섹션 | 내용 |
|---|------|------|
| 1 | 요구사항 요약 | 핵심 요구사항 목록 테이블 (#, 요구사항, 유형) |
| 2 | AS-IS 현황 분석 | 현재 프론트/백엔드/DB/i18n 상태, **파일경로·필드명 명시**, 문제점 분석 |
| 3 | TO-BE 요구사항 | AS-IS→TO-BE 매핑표, 신규 필드/엔티티/페이지, 비즈니스 로직, UI 설계 |
| 4 | 갭 분석 | 변경 범위 요약표 (영역×현재×변경×영향도), 파일 변경 목록, DB 마이그레이션 전략 |
| 5 | 사용자 플로우 | Step-by-Step 시나리오, 조건별 분기 (ASCII 흐름도) |
| 6 | 기술 제약사항 | 호환성, 성능, 보안 (GDPR 등) |

**분석 핵심 산출물**:
- 비즈니스 규칙 목록 (`BR-001` ~ `BR-NNN`)
- 상태 전이도 (ASCII 다이어그램)
- 외부 인터페이스 실패 영향도 매트릭스
- 리스크 레지스터

### 13.5 ③ 작업계획서 (TASK-PLAN)

**작성 시점**: ANALYSIS 완료 후, 구현 착수 전
**작성자**: 개발 리드 / 담당 개발자
**입력물**: 요구사항분석서 (ANALYSIS)
**저장 경로**: `docs/plan/PLAN-{YYYYMMDD}-{제목}.md`

**필수 섹션** (순서 엄수):

| # | 섹션 | 내용 |
|---|------|------|
| 1 | 시스템 개발 현황 분석 | 디렉토리 구조, 기술 스택, 기존 코드 상황, 제약사항 |
| 2 | 단계별 구현 계획 | Phase/Step 구조, 각 Step에 `└─ 사이드 임팩트: {설명}` 명시 |
| 3 | 변경 파일 목록 | 테이블 (구분: Backend/Frontend/DB/i18n × 파일 × 변경유형: 신규/수정) |
| 4 | 사이드 임팩트 분석 | 영향 범위 테이블 (범위×위험도×설명) |
| 5 | DB 마이그레이션 | 필요 시 수동 SQL 명시 (스테이징/프로덕션은 synchronize 비활성) |

**태스크 ID 규칙**: `T-{Phase번호}{2자리 순번}` (예: `T-101`, `T-102`, `T-201`)

**태스크 분해 테이블 형식**:
```markdown
| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-101 | DB 스키마 생성 (6 테이블) | — | 0.5d | — | dev-A | TODO |
| T-102 | AMA 인증 미들웨어 | — | 1d | T-101 | dev-A | TODO |
```

**태스크 상태**: `TODO` → `IN_PROGRESS` → `DONE` → `VERIFIED`

### 13.6 ④ 테스트케이스 (TEST-CASE)

**작성 시점**: 구현 착수와 병행 또는 구현 완료 후
**작성자**: 개발자 / QA
**입력물**: 요구사항분석서 (ANALYSIS), 작업계획서 (TASK-PLAN)

**필수 섹션**:

| # | 섹션 | 내용 |
|---|------|------|
| 1 | 문서 개요 | 문서 정보, 테스트 범위, 테스트 환경 |
| 2 | 테스트 전략 | 테스트 유형 (단위/통합/E2E), 도구, 커버리지 목표 |
| 3 | API 테스트케이스 | 엔드포인트별 정상/이상 케이스 |
| 4 | 비즈니스 규칙 테스트 | BR-{ID}별 검증 시나리오 |
| 5 | UI 시나리오 테스트 | 화면별 사용자 시나리오 |
| 6 | 비기능 테스트 | 성능, 보안, 멀티테넌시 격리 검증 |

**테스트케이스 ID 규칙**: `TC-{도메인코드}-{3자리 순번}` (예: `TC-VEH-001`, `TC-DSP-015`)

**API 테스트케이스 테이블 형식**:
```markdown
| TC ID | 구분 | 관련 FR/BR | 시나리오 | Method | Endpoint | 입력 | 기대 결과 | 상태 |
|-------|------|-----------|---------|--------|----------|------|----------|------|
| TC-VEH-001 | 정상 | FR-VEH-001 | 차량 등록 성공 | POST | /api/vehicles | 유효한 차량 정보 | 201, 차량 생성 | TODO |
| TC-VEH-002 | 이상 | FR-VEH-001 | 중복 번호판 등록 | POST | /api/vehicles | 기존 번호판 | 409, 중복 에러 | TODO |
```

**비즈니스 규칙 테스트 테이블 형식**:
```markdown
| TC ID | 관련 BR | 시나리오 | 사전 조건 | 실행 | 기대 결과 | 상태 |
|-------|---------|---------|---------|------|----------|------|
| TC-BR-001 | BR-001 | 기사 본인 배차 신청 차단 | DRIVER 역할 사용자 | 배차 신청 API 호출 | 403 Forbidden | TODO |
```

**테스트 상태**: `TODO` → `PASS` / `FAIL` / `BLOCKED` / `SKIP`

### 13.7 ⑤ 작업완료보고서 (REPORT)

**작성 시점**: Phase 또는 Sprint 구현 완료 후
**작성자**: 개발 리드 / 담당 개발자
**입력물**: 작업계획서 (TASK-PLAN), 테스트케이스 (TEST-CASE), Git 커밋 이력

**필수 섹션**:

| # | 섹션 | 내용 |
|---|------|------|
| 1 | 문서 개요 | 문서 정보, 대상 Phase/Sprint, 기간 |
| 2 | 구현 요약 | 완료 FR 목록, 생성 파일/모듈 요약, 주요 기술 결정 |
| 3 | 태스크 완료 현황 | TASK-PLAN의 태스크별 완료 상태, 실제 공수 |
| 4 | 테스트 결과 | TEST-CASE 실행 결과 요약 (PASS/FAIL/SKIP 집계) |
| 5 | 배포 정보 | 배포 환경, 커밋 해시, Docker 이미지 태그, 배포 일시 |
| 6 | 잔여 이슈 및 기술 부채 | 미완료 항목, 알려진 이슈, 리팩토링 필요 사항 |
| 7 | 다음 단계 | 다음 Phase 계획, Open Questions 해소 현황 |

**태스크 완료 현황 테이블 형식**:
```markdown
| Task ID | 태스크 | 상태 | 계획 공수 | 실제 공수 | 비고 |
|---------|--------|------|----------|----------|------|
| T-101 | DB 스키마 생성 | DONE | 0.5d | 0.5d | |
| T-102 | AMA 인증 미들웨어 | DONE | 1d | 1.5d | OQ-0 미확정으로 Mock 구현 |
```

**테스트 결과 요약 형식**:
```markdown
| 도메인 | 전체 | PASS | FAIL | SKIP | BLOCKED | 통과율 |
|--------|:----:|:----:|:----:|:----:|:-------:|:------:|
| 차량 관리 | 15 | 14 | 0 | 1 | 0 | 93.3% |
| 배차 관리 | 25 | 23 | 1 | 1 | 0 | 92.0% |
| 합계 | 40 | 37 | 1 | 2 | 0 | 92.5% |
```

### 13.8 프로세스 적용 규칙

| 규칙 | 설명 |
|------|------|
| **순서 준수** | REQ → ANALYSIS → TASK-PLAN → 구현 → TEST-CASE → REPORT 순서 엄수 |
| **입력물 참조** | 각 문서의 `based_on` 필드에 입력물 document_id 기록 |
| **버전 동기화** | REQ 변경 시 ANALYSIS 이후 문서도 버전 bump 필요 |
| **Phase 단위** | 작업계획서/테스트케이스/완료보고서는 Phase 단위로 작성 |
| **간소화 허용** | 소규모 버그 수정/핫픽스는 REPORT만 작성 (REQ~TASK-PLAN 생략 가능) |
| **Git 커밋 연결** | 완료보고서에 관련 커밋 해시 또는 PR 번호 기록 |

**문서 작성 트리거**:

| 트리거 | 필수 문서 |
|--------|---------|
| 새 앱 개발 시작 | REQ → ANALYSIS → TASK-PLAN |
| Phase 구현 착수 | TASK-PLAN (해당 Phase) |
| Phase 구현 완료 | TEST-CASE → REPORT |
| 기존 앱 기능 추가 (대규모) | REQ 갱신 → ANALYSIS 갱신 → TASK-PLAN |
| 기존 앱 기능 추가 (소규모) | TASK-PLAN (간소) → TEST-CASE → REPORT |
| 핫픽스/버그 수정 | REPORT (간소) |

---

## 14. Mandatory Standards (필수 준수 표준) — MUST

코드 구현 및 문서 작성 시 아래 2개 표준 문서를 **반드시** 참조·준수해야 한다.
위반 시 코드 리뷰/문서 리뷰에서 반려된다.

### 14.1 Amoeba Code Convention v2 (코드 컨벤션)

**파일**: `reference/amoeba_code_convention_v2.md`

모든 코드 작성(백엔드, 프론트엔드, DB, API) 시 이 문서의 규칙을 따른다.
주요 적용 항목:
- Architecture: Clean Architecture + DDD 레이어 규칙
- DB Naming: 테이블 prefix, 컬럼 prefix, ENUM 규칙, 인덱스 네이밍
- Backend: NestJS Module/Controller/Service/Entity 패턴, DTO snake_case/camelCase 분리, Mapper, Guard/Decorator
- Frontend: 컴포넌트 구조, State Management (Zustand/React Query), Import Order, Hook 패턴
- API: 표준 응답 형식, 에러 코드 체계, 유효성 검증
- Multi-Tenancy: `ent_id` 기반 격리, OwnEntityGuard
- i18n: 번역 파일 관리, namespace 규칙
- Git: 커밋 메시지 포맷, 브랜치 전략

### 14.2 Amoeba Web Style Guide v2 (웹 스타일 가이드)

**파일**: `reference/amoeba_web_style_guide_v2.md`

모든 프론트엔드 UI 구현 시 이 문서의 디자인 표준을 따른다.
주요 적용 항목:
- Layout System: Basic-A-1 / A-2-R / A-2-L 레이아웃 타입
- Color System: Primary/Secondary/Semantic/Gray 팔레트
- Typography: 폰트 사이즈, 줄 간격, 제목 체계
- Component Styles: Button, Input, Table, Card, Badge, Modal 등
- Spacing System: 간격 단위 (4px 기반)
- Responsive Breakpoints: sm/md/lg/xl/2xl 구간
- Web Accessibility: WCAG 2.1 Level AA 준수
- Icon System: lucide-react 아이콘 규칙
- Notification/Toast: 알림 UI 패턴

### 14.3 적용 체크리스트

코드 리뷰 시 아래 항목을 추가 확인한다:

- [ ] DB 스키마가 Code Convention §4 DB Naming Rules 준수?
- [ ] Entity/DTO/Mapper가 Code Convention §5 Backend Rules 준수?
- [ ] 프론트엔드 컴포넌트가 Code Convention §6~§7 Frontend Rules 준수?
- [ ] API 응답이 Code Convention §8 API Design 준수?
- [ ] UI 레이아웃이 Web Style Guide §1~§3 Layout System 준수?
- [ ] 컬러/타이포가 Web Style Guide §5~§6 준수?
- [ ] 컴포넌트 스타일이 Web Style Guide §7 Component Styles 준수?
- [ ] 반응형 대응이 Web Style Guide §10 Responsive Breakpoints 준수?

---

## References

추가 상세 규격은 [reference 디렉토리](../../../reference/) 참조:

- **[코드 컨벤션](../../../reference/amoeba_code_convention_v2.md)** ⭐ MUST
- **[웹 스타일 가이드](../../../reference/amoeba_web_style_guide_v2.md)** ⭐ MUST
- [SDLC 문서 생성 스킬](../../../reference/amoeba-spec-generator-SKILL-v3.1.md)
- [개발 스킬 가이드](../../../reference/amoeba_basic_skill_v2.md)
- [프로젝트 구조 가이드](../../../reference/amoeba_basic_Structure_v2.md)
- [SPEC 템플릿](../../../reference/amoeba_basic_SPEC_v2.md)
- [기능명세서](../../../reference/func-definition.md)
- [요구사항정의서](../../../reference/requirements.md)
- [화면정의서](../../../reference/ui-spec.md)
- [프로젝트수행계획서](../../../reference/project-plan.md)
