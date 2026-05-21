# REQ-20260513 — P1 Trip MVP

> 작성일: 2026-05-13 · 작성자: dev@amoeba.group + Claude Code
> 관련 문서: [PRD.md](../../PRD.md) §6 MODULE 1, §8 (Data Model), §9 (Business Logic), §11 (User Flows) · [CLAUDE.md](../../CLAUDE.md) §6 Roadmap (P1)
> 후속 문서: `docs/plan/PLAN-20260513-p1-trip-mvp.md`

---

## 1. 요구사항 요약

| # | 요구사항 | 유형 |
|---|----------|------|
| R1 | 6개의 신규 Drizzle 스키마 정의: `car_vehicles`, `car_drivers`, `car_trips`, `car_trip_stopovers`, `car_audit_logs`, `car_notifications` | DB |
| R2 | Drizzle 마이그레이션 SQL 생성 + Neon dev 브랜치에 적용 | DB |
| R3 | Trip State Machine 서비스 — PRD §9.1의 7개 상태 전이를 단일 진입점으로 강제 (`trp_status` 직접 변경 금지) | Service |
| R4 | Audit Log 서비스 — append-only insert, 모든 Trip/Vehicle/Driver mutation을 기록 (NFR-9) | Service |
| R5 | Notification 서비스 — DB 큐에 insert만 (실제 발송은 P4) | Service |
| R6 | Vehicle Server Actions: create, list, get, update, soft-delete | Server Action |
| R7 | Driver Server Actions: create, list, get, update | Server Action |
| R8 | Trip Server Actions: create, list (filtered by role), get, update, 6 state transitions (assign, accept, reject, start, end, cancel) | Server Action |
| R9 | Zod request schemas (`packages/shared/zod/`) — snake_case 입력, Server Action에서 검증 | Validation |
| R10 | 권한 검증 — Manager는 자기 trip만 (R-3), Driver는 자기 지정 trip만, Admin은 전체. `requireRole()` + per-row filter | Authorization |
| R11 | UI Wiring: 5개 페이지의 샘플 데이터를 Drizzle 쿼리로 교체 — `/`, `/trips`, `/trips/[id]`, `/trips/new`, `/vehicles`, `/vehicles/[id]`, `/drivers`, `/drivers/[id]` | UI Integration |
| R12 | Seed 데이터 — 3 vehicles (51K-238.91, 30A-556.07, 51F-712.34) + 3 drivers (Nguyễn Văn Tú, Trần Quốc Hùng, Lê Minh Đức) + 5-8 trips covering all 7 states | Seed |
| R13 | i18n 키 보강 — trip status, expense type, error message (3 ngôn ngữ vi/en/ko) | i18n |
| R14 | Soft delete 패턴 — `*_deleted_at` 컬럼, 쿼리에서 자동 필터링 | DB |
| R15 | Error code `CAR-E1xxx` 시리즈 신규 (Trip domain errors): 1001 invalid transition, 1002 vehicle not available, 1003 driver not available, 1004 trip not found, 1005 forbidden by role | Error |

---

## 2. AS-IS 현황 분석

### 2.1 인프라 (이미 갖춰진 부분)

| 영역 | 파일 | 상태 |
|---|---|---|
| Neon DB client | [packages/db/src/client.ts](../../packages/db/src/client.ts) | ✅ `drizzle-orm/neon-http` + `@neondatabase/serverless` |
| Multi-tenancy helper | [packages/db/src/lib/with-ent.ts](../../packages/db/src/lib/with-ent.ts) | ✅ `withEnt(col, entId)` |
| JWT 검증 | [apps/web/src/lib/auth/verify-jwt.ts](../../apps/web/src/lib/auth/verify-jwt.ts) | ✅ jose + Zod schema |
| Auth context | [apps/web/src/lib/auth/get-current-user.ts](../../apps/web/src/lib/auth/get-current-user.ts) | ✅ `getCurrentUser()` + `requireRole()` |
| Middleware | [apps/web/src/middleware.ts](../../apps/web/src/middleware.ts) | ✅ JWT passthrough, sets x-ent-id/x-user-id/x-user-role headers |
| AMA role mapping | [packages/shared/src/auth/jwt-claims.ts](../../packages/shared/src/auth/jwt-claims.ts) | ✅ `mapAmaRoleToLocal()` |
| Error class | [packages/shared/src/errors/car-error.ts](../../packages/shared/src/errors/car-error.ts) | ✅ `CarError` + `ActionResult<T>` |
| Migration script | [scripts/db-migrate.mjs](../../scripts/db-migrate.mjs) | ✅ multi-env (dev/staging) |

### 2.2 DB 스키마 — 현재 1개 테이블만 존재

**파일**: [packages/db/src/schema/users.schema.ts](../../packages/db/src/schema/users.schema.ts)

```
car_users (1 테이블)
  ├── usr_id          CHAR(36) PK
  ├── ent_id          CHAR(36) NOT NULL  (multi-tenancy)
  ├── usr_ama_user_id CHAR(36) NOT NULL  (AMA SSO 매핑)
  ├── usr_email       VARCHAR(255)
  ├── usr_name        VARCHAR(255)
  ├── usr_local_role  ENUM('DRIVER','MANAGER','ADMIN')
  ├── usr_ama_role_snapshot  VARCHAR(32)
  ├── usr_preferred_locale   VARCHAR(8)
  ├── usr_last_login_at      TIMESTAMPTZ
  ├── usr_created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
  ├── usr_updated_at         TIMESTAMPTZ
  └── usr_deleted_at         TIMESTAMPTZ
```

### 2.3 Server-side 디렉토리 — 미존재

- ❌ `apps/web/src/server/` (Server Actions, services, queries) → 신규 디렉토리
- ❌ `packages/shared/src/zod/` (request schemas) → 신규
- ❌ API endpoint은 `/api/v1/health` 하나만 존재
- ❌ Server Action 없음 → 모든 페이지 샘플 데이터 하드코드

### 2.4 UI 상태 — 정적 샘플 데이터

5개 페이지가 P1 와이어링 대상:

| 페이지 | 현재 데이터 | TO-BE 데이터 소스 |
|---|---|---|
| `/` (Dashboard) | `VEHICLES`, `SPEND_MIX`, `ACTIONS`, `TOP_USERS`, `STACKED` (하드코드) | RSC 쿼리 (Vehicle list, Trip stats, Action queue) |
| `/trips` (List) | `TRIPS` 배열 8개 | RSC 쿼리 with role-based filter + pagination |
| `/trips/[id]` (Detail) | 단일 sample trip | RSC 쿼리 by id + timeline from audit log |
| `/trips/new` (Form) | RHF + Zod (UI만, 제출 핸들러 없음) | Server Action `createTrip` |
| `/vehicles`, `/drivers` | 3개씩 하드코드 | RSC 쿼리 |

### 2.5 ent_id (멀티테넌시) 정책

- 모든 비즈니스 데이터 테이블은 `ent_id` 컬럼 필수.
- `getCurrentUser().entId`로 읽고, `withEnt(table.entId, entId)`로 모든 쿼리에 강제 적용.
- Composite index `idx_{table}_ent_*` 필수.

### 2.6 디자인 시스템 — UI restyle 완료 (이전 작업)

- `@car-v2/ui` 30개 컴포넌트 + 7개 layout
- 모바일 first (h-11 inputs, FAB, BottomTab)
- i18n vi/en/ko 키 존재 (앱 텍스트 ~114 키)

**P1은 UI를 거의 손대지 않음.** 페이지의 데이터 소스만 교체하고, 일부 키만 추가 (status enums, error messages).

---

## 3. TO-BE 요구사항

### 3.1 DB 스키마 (6 신규 테이블 + car_users 확장)

#### 3.1.1 `car_vehicles`

```
PK: cvh_id CHAR(36)
FK: ent_id CHAR(36) NOT NULL                            -- 멀티테넌시
컬럼:
  cvh_plate_number    VARCHAR(20)  NOT NULL UNIQUE per ent_id
  cvh_model           VARCHAR(100) NOT NULL              -- "Hyundai Staria 11"
  cvh_make            VARCHAR(50)                        -- "Hyundai"
  cvh_year            SMALLINT
  cvh_color           VARCHAR(50)
  cvh_fuel_type       ENUM('PETROL','DIESEL','HYBRID','EV') DEFAULT 'PETROL'
  cvh_status          ENUM('AVAILABLE','IN_USE','MAINTENANCE','RETIRED') NOT NULL DEFAULT 'AVAILABLE'
  cvh_odometer_km     INTEGER NOT NULL DEFAULT 0
  cvh_last_oil_change_km   INTEGER
  cvh_last_oil_change_at   TIMESTAMPTZ
  cvh_oil_interval_km      INTEGER NOT NULL DEFAULT 5000
  cvh_oil_interval_months  SMALLINT NOT NULL DEFAULT 3
  cvh_home_base       VARCHAR(100)
  cvh_notes           TEXT
  cvh_created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  cvh_updated_at      TIMESTAMPTZ
  cvh_deleted_at      TIMESTAMPTZ                        -- soft delete
인덱스:
  idx_car_vehicles_ent_status (ent_id, cvh_status)
  uniq_car_vehicles_ent_plate (ent_id, cvh_plate_number) WHERE cvh_deleted_at IS NULL
```

#### 3.1.2 `car_drivers`

```
PK: drv_id CHAR(36)
FK: ent_id CHAR(36) NOT NULL
FK: drv_user_id CHAR(36) REFERENCES car_users(usr_id)   -- 1:1 with User (role=DRIVER)
컬럼:
  drv_license_number  VARCHAR(50) NOT NULL
  drv_license_class   ENUM('A2','B1','B2','C','D','E','F') NOT NULL DEFAULT 'B2'
  drv_license_expiry  DATE NOT NULL
  drv_phone           VARCHAR(20)
  drv_status          ENUM('AVAILABLE','ON_TRIP','OFF_DUTY','UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE'
  drv_emergency_contact VARCHAR(100)
  drv_notes           TEXT
  drv_created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  drv_updated_at      TIMESTAMPTZ
  drv_deleted_at      TIMESTAMPTZ
인덱스:
  idx_car_drivers_ent_status (ent_id, drv_status)
  idx_car_drivers_license_expiry (drv_license_expiry)      -- 만료 알림 P4
  uniq_car_drivers_ent_user (ent_id, drv_user_id) WHERE drv_deleted_at IS NULL
```

#### 3.1.3 `car_trips`

```
PK: trp_id CHAR(36)
FK: ent_id        CHAR(36) NOT NULL
FK: trp_creator_id CHAR(36) NOT NULL REFERENCES car_users(usr_id)
FK: trp_passenger_id CHAR(36) REFERENCES car_users(usr_id)   -- 누구를 위해
FK: trp_driver_id  CHAR(36) REFERENCES car_drivers(drv_id)   -- NULLABLE (PRD D1)
FK: trp_vehicle_id CHAR(36) REFERENCES car_vehicles(cvh_id)  -- NULLABLE (PRD D2)
컬럼:
  trp_ref             VARCHAR(20) NOT NULL UNIQUE per ent_id  -- "TR-1042" — sequence per ent
  trp_status          ENUM('PENDING_ASSIGNMENT','PENDING_DRIVER_CONFIRMATION','CONFIRMED',
                           'IN_PROGRESS','COMPLETED','REJECTED_BY_DRIVER','CANCELLED')
                      NOT NULL DEFAULT 'PENDING_ASSIGNMENT'
  trp_pickup_address  TEXT NOT NULL
  trp_dropoff_address TEXT NOT NULL
  trp_scheduled_at    TIMESTAMPTZ NOT NULL                    -- 예정 출발
  trp_duration_minutes SMALLINT                                -- 예상 소요
  trp_purpose         VARCHAR(255)
  trp_notes           TEXT
  trp_google_maps_url TEXT                                     -- 자동 생성
  trp_started_at      TIMESTAMPTZ                              -- 실제 출발
  trp_ended_at        TIMESTAMPTZ                              -- 실제 종료
  trp_start_odometer  INTEGER                                  -- (선택) 출발 km
  trp_end_odometer    INTEGER                                  -- (선택) 종료 km
  trp_reject_reason   TEXT                                     -- driver가 거절시 사유
  trp_cancel_reason   TEXT                                     -- 취소 사유
  trp_created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  trp_updated_at      TIMESTAMPTZ
  trp_deleted_at      TIMESTAMPTZ
인덱스:
  idx_car_trips_ent_status_scheduled (ent_id, trp_status, trp_scheduled_at)
  idx_car_trips_creator (trp_creator_id)
  idx_car_trips_driver (trp_driver_id)
  idx_car_trips_vehicle (trp_vehicle_id)
  uniq_car_trips_ent_ref (ent_id, trp_ref) WHERE trp_deleted_at IS NULL
```

#### 3.1.4 `car_trip_stopovers`

```
PK: tst_id CHAR(36)
FK: ent_id      CHAR(36) NOT NULL
FK: tst_trip_id CHAR(36) NOT NULL REFERENCES car_trips(trp_id) ON DELETE CASCADE
컬럼:
  tst_address  TEXT    NOT NULL
  tst_order    SMALLINT NOT NULL          -- 0-based
  tst_created_at TIMESTAMPTZ NOT NULL DEFAULT now()
인덱스:
  idx_car_trip_stopovers_trip_order (tst_trip_id, tst_order)
```

#### 3.1.5 `car_audit_logs`

```
PK: aud_id CHAR(36)
FK: ent_id     CHAR(36) NOT NULL
FK: aud_user_id CHAR(36) REFERENCES car_users(usr_id)  -- NULL = system
컬럼:
  aud_action     VARCHAR(64) NOT NULL    -- "TRIP.CREATE", "TRIP.ACCEPT", ...
  aud_entity     VARCHAR(32) NOT NULL    -- "Trip", "Vehicle", "Driver", "Expense"
  aud_entity_id  CHAR(36)
  aud_entity_ref VARCHAR(20)             -- "TR-1042"
  aud_before     JSONB                   -- 변경 전 (NULL on create)
  aud_after      JSONB                   -- 변경 후 (NULL on delete)
  aud_ip         INET
  aud_user_agent TEXT
  aud_created_at TIMESTAMPTZ NOT NULL DEFAULT now()
인덱스:
  idx_car_audit_logs_ent_created (ent_id, aud_created_at DESC)
  idx_car_audit_logs_entity (aud_entity, aud_entity_id)
제약:
  ❌ UPDATE/DELETE 금지 (DB trigger or application-level enforcement)
  CLAUDE.md §8: "UPDATE/DELETE on car_audit_logs — DB chỉ cho INSERT"
```

#### 3.1.6 `car_notifications`

```
PK: ntf_id CHAR(36)
FK: ent_id     CHAR(36) NOT NULL
FK: ntf_user_id CHAR(36) NOT NULL REFERENCES car_users(usr_id)
컬럼:
  ntf_event    VARCHAR(64) NOT NULL    -- "TRIP.ASSIGNED", "EXPENSE.SUBMITTED", ...
  ntf_title    VARCHAR(255) NOT NULL
  ntf_body     TEXT
  ntf_entity_id CHAR(36)
  ntf_entity_ref VARCHAR(20)
  ntf_read_at  TIMESTAMPTZ              -- NULL = unread
  ntf_created_at TIMESTAMPTZ NOT NULL DEFAULT now()
인덱스:
  idx_car_notifications_user_unread (ntf_user_id, ntf_read_at)
```

#### 3.1.7 `car_users` 확장 — 없음

P1에서는 `car_users` 변경 없음 (`drv_user_id` FK로 1:1 매핑).

### 3.2 Server-side 디렉토리 구조 (신규)

```
apps/web/src/server/
├── actions/                # "use server" — UI에서 호출 (form action, mutation)
│   ├── vehicles/
│   │   ├── create-vehicle.action.ts
│   │   ├── update-vehicle.action.ts
│   │   ├── delete-vehicle.action.ts
│   │   └── index.ts
│   ├── drivers/
│   │   ├── create-driver.action.ts
│   │   ├── update-driver.action.ts
│   │   └── index.ts
│   └── trips/
│       ├── create-trip.action.ts
│       ├── update-trip.action.ts
│       ├── assign-trip.action.ts        # → PENDING_DRIVER_CONFIRMATION
│       ├── accept-trip.action.ts        # → CONFIRMED
│       ├── reject-trip.action.ts        # → REJECTED_BY_DRIVER
│       ├── start-trip.action.ts         # → IN_PROGRESS
│       ├── end-trip.action.ts           # → COMPLETED
│       ├── cancel-trip.action.ts        # → CANCELLED
│       └── index.ts
├── queries/                # RSC에서 호출 (read-only, no "use server")
│   ├── vehicles.queries.ts
│   ├── drivers.queries.ts
│   ├── trips.queries.ts
│   └── audit.queries.ts
└── services/               # 도메인 로직, 프레임워크-non-aware
    ├── trip-state-machine.service.ts
    ├── audit-log.service.ts
    ├── notification.service.ts
    ├── trip-ref.service.ts             # TR-{nnnn} sequence per ent_id
    └── google-maps-url.service.ts      # share URL 생성
```

### 3.3 Zod 검증 스키마 (`packages/shared/src/zod/`)

```
packages/shared/src/zod/
├── vehicle.zod.ts          # createVehicle, updateVehicle (snake_case body)
├── driver.zod.ts
├── trip.zod.ts             # createTrip, updateTrip, rejectTrip (with reason)
└── index.ts
```

요청 바디는 snake_case, 응답은 camelCase (CLAUDE.md §4.4).

### 3.4 Trip State Machine 서비스 — 단일 진입점

```ts
// trip-state-machine.service.ts
export type TripTransition =
  | 'assign'    // PENDING_ASSIGNMENT → PENDING_DRIVER_CONFIRMATION
  | 'accept'    // PENDING_DRIVER_CONFIRMATION → CONFIRMED
  | 'reject'    // PENDING_DRIVER_CONFIRMATION → REJECTED_BY_DRIVER
  | 'reassign'  // REJECTED_BY_DRIVER → PENDING_DRIVER_CONFIRMATION
  | 'start'     // CONFIRMED → IN_PROGRESS
  | 'end'       // IN_PROGRESS → COMPLETED
  | 'cancel'    // any (except COMPLETED) → CANCELLED

export async function transitionTrip(
  tripId: string,
  transition: TripTransition,
  actor: AuthContext,
  payload?: TransitionPayload,
): Promise<Trip>
```

규칙:
- 전이가 PRD §9.1 Table 미준수 → throw `CAR-E1001`
- 권한 검증 (예: `start` → 본인 driver만) → `CAR-E1005`
- Audit log 자동 INSERT
- Notification 큐에 자동 INSERT (예: assign → 운전자에게)
- Trip의 `trp_status`를 직접 변경하는 다른 코드 금지 (코드 리뷰 + lint rule)

### 3.5 Audit Log 서비스

```ts
// audit-log.service.ts
export async function logAudit(input: {
  entId: string;
  userId: string | null;       // null = system
  action: string;              // "TRIP.CREATE"
  entity: 'Trip' | 'Vehicle' | 'Driver' | 'Expense' | 'System';
  entityId?: string;
  entityRef?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}): Promise<void>
```

`INSERT only`. PRD §15 retention 5년 (실제 purge cron은 P4).

### 3.6 Notification 서비스 — Stub

```ts
// notification.service.ts
export async function notifyUser(input: {
  entId: string;
  userId: string;
  event: string;              // "TRIP.ASSIGNED"
  title: string;
  body: string;
  entityId?: string;
  entityRef?: string;
}): Promise<void>
```

P1: DB에 row 만들기만. UI는 unread count 정도만 (P4에서 push/email 발송 추가).

### 3.7 Server Actions — 권한 및 비즈니스 규칙 매트릭스

| Action | ADMIN | MANAGER | DRIVER | 비고 |
|---|:-:|:-:|:-:|---|
| `createVehicle` | ✅ | ❌ | ❌ | |
| `updateVehicle` | ✅ | ❌ | ❌ | |
| `deleteVehicle` | ✅ | ❌ | ❌ | Soft delete |
| `listVehicles` | ✅ all | ✅ all | ✅ all | Read-all OK |
| `createDriver` | ✅ | ❌ | ❌ | |
| `updateDriver` | ✅ | ❌ | ❌ | |
| `createTrip` | ✅ | ✅ own | ❌ | Manager → 자기가 creator |
| `listTrips` | ✅ all | ✅ own | ✅ assigned | Role-based filter (R-3) |
| `getTrip` | ✅ all | ✅ own | ✅ assigned | |
| `updateTrip` (basic fields) | ✅ | ✅ own pre-confirm | ❌ | After confirmation: Admin only |
| `assignTrip` | ✅ | ❌ | ❌ | Driver + Vehicle 둘 다 필요 |
| `acceptTrip` | ❌ | ❌ | ✅ assigned only | |
| `rejectTrip` | ❌ | ❌ | ✅ assigned only | reason 필수 |
| `startTrip` | ❌ | ❌ | ✅ assigned only | scheduled_at-1h 이전이면 경고 |
| `endTrip` | ❌ | ❌ | ✅ assigned only | |
| `cancelTrip` | ✅ any pre-complete | ✅ own pre-confirm | ❌ | |

### 3.8 UI Wiring 매핑

| 페이지 | RSC 쿼리 | Server Action(s) | i18n 신규 키 |
|---|---|---|---|
| `/` Dashboard | `listVehicles`, `listTrips({today})`, `listAuditQueue`, `topUsers` (stats) | — | `dashboard.empty.*` |
| `/trips` | `listTrips(role, filter, page)` | (Filter form은 GET URL params) | `trip.status.*` (7개) |
| `/trips/[id]` | `getTrip(id)`, `listAuditForEntity('Trip', id)` | `assignTrip`, `acceptTrip`, `rejectTrip`, `startTrip`, `endTrip`, `cancelTrip` | `trip.action.*` |
| `/trips/new` | `listVehicles`, `listDrivers` (for selects), `listPassengers (=users)` | `createTrip` | `trip.form.*` |
| `/vehicles` | `listVehicles()` | — | `vehicle.status.*` |
| `/vehicles/[id]` | `getVehicle(id)`, `listTripsForVehicle(id)` | `updateVehicle`, `deleteVehicle` | |
| `/drivers` | `listDrivers()` | — | `driver.status.*` |
| `/drivers/[id]` | `getDriver(id)`, `listTripsForDriver(id)` | `updateDriver` | |
| `/audit` | `listAudit(filter, page)` | — | `audit.action.*` |
| `/users` | `listUsers()` | (none — managed via AMA) | |

### 3.9 Trip Ref Sequence

```
trp_ref = "TR-" + zeroPad(nextSeq, 4)   -- per ent_id
```

구현: 별도 `car_trip_seq` 테이블 또는 PostgreSQL sequence per-tenant. P1 간단화: `SELECT max(trp_ref) WHERE ent_id=? FOR UPDATE` (낮은 트래픽 OK).

### 3.10 Google Maps URL 자동 생성

```
https://www.google.com/maps/dir/?api=1
  &origin=<urlencoded pickup>
  &destination=<urlencoded dropoff>
  &waypoints=<stopover1|stopover2|...>
```

서비스 `google-maps-url.service.ts`. 저장 시 자동 생성 (`createTrip`, `updateTrip`).

---

## 4. 갭 분석

### 4.1 변경 범위 요약

| 영역 | 현재 | 변경 | 영향도 |
|---|---|---|---|
| DB 테이블 | 1 (`car_users`) | +6 (vehicles, drivers, trips, stopovers, audit, notifications) | High |
| Server Actions | 0 | +13 (CRUD + transitions) | High |
| Server Queries (RSC) | 0 | +12 (list/get for 5 도메인 + audit) | High |
| Services | 0 | +5 (state machine, audit, notify, trip-ref, gmaps-url) | Medium |
| Zod 스키마 | 1 (`amaJwtClaimsSchema`) | +10 (request bodies) | Medium |
| Error codes | 3 (CAR-E0101/0102/...) | +8 (CAR-E1001~1008 Trip domain) | Low |
| UI 페이지 | 13 (모든 샘플 데이터) | 데이터 소스 교체 (UI 거의 그대로) | Medium |
| i18n 키 | 114 (en.json) | +30 키 (status enums, errors, form labels) × 3 언어 | Low |
| Seed 데이터 | 없음 | +1 seed 스크립트 (3 vehicles, 3 drivers, 5-8 trips) | Low |

### 4.2 신규 파일 (~50개)

- Schemas: 6 × `*.schema.ts`
- Server Actions: 13 × `*.action.ts`
- Server Queries: 4 × `*.queries.ts`
- Services: 5 × `*.service.ts`
- Zod: 4 × `*.zod.ts`
- Migrations: 1 SQL file (auto-generated by drizzle-kit)
- Seed: 1 `scripts/db-seed.mjs`
- Tests (smoke): 1-2 vitest files

### 4.3 수정 파일 (~13개)

- 5 페이지 (`/trips`, `/trips/[id]`, `/trips/new`, `/vehicles*`, `/drivers*`, `/`)
- 3 i18n JSON files
- `packages/db/src/schema/index.ts` (export 추가)
- `packages/shared/src/index.ts` (zod export 추가)

### 4.4 DB 마이그레이션 전략

- **Dev** (Neon dev branch): `npm run db:migrate:dev` — drizzle-kit auto SQL
- **Staging**: 동일 SQL 적용. CLAUDE.md §4.3 정책상 `synchronize` 비활성.
- **Production**: 미정 (P0 단계, 아직 deploy 안함)
- **Rollback**: 신규 테이블이라 DROP TABLE만 (기존 데이터에 영향 없음)

---

## 5. 사용자 플로우

### 5.1 Flow A — Manager가 chuyến đi 등록 (PRD §11.1)

```
1. Manager → /trips/new
2. Form 채움: 승객, pickup, dropoff, 시간, 목적
   (Driver, Vehicle 선택사항)
3. Submit → createTrip Server Action
4. 검증 (Zod + business rule: 과거 시간 X)
5. INSERT car_trips (status=PENDING_ASSIGNMENT 또는 PENDING_DRIVER_CONFIRMATION)
6. INSERT car_trip_stopovers (있을 때)
7. INSERT car_audit_logs (action=TRIP.CREATE)
8. IF status=PENDING_DRIVER_CONFIRMATION:
     INSERT car_notifications (user=driver, event=TRIP.ASSIGNED)
9. revalidatePath('/trips'); redirect(`/trips/${ref}`)
```

### 5.2 Flow B — Driver가 trip 수락 (PRD §11.2)

```
1. Driver → /trips/{id} (assigned to them)
2. Click "Accept"
3. acceptTrip Server Action
4. transitionTrip(tripId, 'accept', actor)
   - 검증: actor.role === 'DRIVER' && trip.driver_id === actor.driver_id
   - 검증: current status === 'PENDING_DRIVER_CONFIRMATION'
   - UPDATE car_trips SET trp_status='CONFIRMED'
   - INSERT car_audit_logs (TRIP.ACCEPT)
   - INSERT car_notifications (manager + admin)
5. revalidatePath
```

### 5.3 Flow C — Admin이 거절된 trip 재배정 (PRD §11.2 변형)

```
1. Admin → /trips/{id} (status=REJECTED_BY_DRIVER)
2. Select new driver (UI)
3. assignTrip(tripId, {driverId, vehicleId})
4. transitionTrip(tripId, 'reassign', actor)
   - status → PENDING_DRIVER_CONFIRMATION
   - audit + notify
```

### 5.4 Flow D — Driver 운행 (PRD §11.3 단순화)

```
1. Driver → /today
2. Hero card: next confirmed trip
3. Tap "Start trip" → startTrip(tripId)
   - 검증: trip.status === 'CONFIRMED', actor === driver
   - trp_status → IN_PROGRESS
   - trp_started_at = now()
   - vehicle.status → IN_USE
4. (운행)
5. Tap "End trip" → endTrip(tripId, {endOdometer?})
   - trp_status → COMPLETED
   - trp_ended_at = now()
   - vehicle.status → AVAILABLE
   - vehicle.odometer = endOdometer (if provided)
```

### 5.5 Flow E — 권한별 trip 리스트 가시성 (R-3)

```
GET /trips
  ADMIN:   listTrips({entId})                            -- 전체
  MANAGER: listTrips({entId, creatorId: actor.userId})   -- 자기 만든 trip
  DRIVER:  listTrips({entId, driverId: actor.driverId})  -- 자기 지정 trip
```

---

## 6. 기술 제약사항

| 항목 | 제약 |
|---|---|
| **DB** | Neon Postgres free tier (1 project, dev/staging branch). Branch별 connection pooler. |
| **트랜잭션** | Neon HTTP driver는 multi-statement 트랜잭션 미지원 → 복잡한 mutation은 stored procedure 또는 단계별 commit + 실패시 보상 로직 |
| **runtime** | Server Actions는 Node.js runtime (Edge에서 drizzle pg-core 미지원) → `export const runtime = 'nodejs'` 또는 default |
| **multi-tenancy** | 모든 쿼리에 `ent_id` 필터 — `withEnt()` 헬퍼 강제. PR 리뷰 체크 |
| **soft delete** | `*_deleted_at IS NULL` 자동 필터 — query helper에 내장 또는 모든 쿼리에 명시 |
| **권한** | `requireRole(actor.role, [...])` + per-row filter (`creatorId === actor.userId` etc.) |
| **audit immutability** | DB level INSERT-only enforcement — Postgres `REVOKE UPDATE, DELETE` 또는 application-level 검증 |
| **i18n** | UI 텍스트는 `t()` 만 사용. 백엔드 에러 메시지는 영어 고정 (UI에서 코드 매핑) |
| **타입 안전** | TypeScript strict + `noUncheckedIndexedAccess`. Drizzle 추론 타입 우선, Zod 검증 후 변환 |
| **테스트** | Vitest는 P6에 도입. P1은 smoke test 정도만 |
| **데이터 마이그레이션** | 신규 테이블만 — 기존 데이터 변환 없음 |
| **iframe** | Server Actions는 form action으로 호출 — iframe 안에서도 동일 origin이라 OK |
| **시간 처리** | `TIMESTAMPTZ` 사용 — UTC 저장, locale별 표시. `date-fns-tz` 추후 (없어도 native Intl로 OK) |

---

## 7. Open Questions (수동 확인 필요)

1. **Trip ref 시퀀스 충돌** — 동시 createTrip 두 개 → race condition. Postgres advisory lock vs unique constraint retry — 어느 쪽?
2. **Vehicle 자동 status 변경** — start trip 시 vehicle.status=IN_USE 자동? 또는 명시적 UI?  
   _제안:_ 자동 (start trip → IN_USE, end trip → AVAILABLE). PRD R-6과 유사 패턴.
3. **Driver 1:1 user 매핑** — `car_drivers.drv_user_id`가 NULL이어도 되나? (legacy driver record without app account)  
   _제안:_ NOT NULL — 모든 driver는 app account가 있어야 trip을 받을 수 있음. legacy는 P0 seed에서 user를 함께 생성.
4. **Trip Update 권한 경계** — Manager가 자기 trip을 어디까지 수정 가능?  
   _제안 per PRD §FR-1.3:_ pre-confirm까지 모든 필드 (passenger 제외), confirm 후엔 Admin만.
5. **Audit log entity_ref** — vehicle은 plate, driver는 license? 또는 UUID?  
   _제안:_ Trip은 ref (TR-xxxx), Vehicle은 plate, Driver는 name short.

---

## 8. Out of P1 Scope (defer to P2+)

- ❌ Expense recording (P2)
- ❌ S3 attachment upload (P2)
- ❌ Approval queue (P2)
- ❌ Maintenance alerts cron (P4)
- ❌ Reports + Excel/PDF export (P3)
- ❌ Push/email notification delivery (P4 — DB row만 P1)
- ❌ PWA install + service worker (P5)
- ❌ Calendar view (Should-have)
- ❌ Driver performance metrics (Won't-have for MVP)
- ❌ Schedule conflict check (R2 — defer per PRD)
