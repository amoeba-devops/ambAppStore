# PLAN-20260513 — P1 Trip MVP 구현 계획

> 작성일: 2026-05-13 · 작성자: dev@amoeba.group + Claude Code
> 선행 문서: [REQ-20260513-p1-trip-mvp.md](../analysis/REQ-20260513-p1-trip-mvp.md)
> 후속 문서 (예정): `docs/test/TC-20260513-p1-trip-mvp.md` · `docs/implementation/RPT-20260513-p1-trip-mvp.md`

---

## 1. 시스템 개발 현황 분석

### 1.1 인프라

| 항목 | 상태 |
|---|---|
| Turborepo monorepo (apps/web, packages/db, packages/shared, packages/ui) | ✅ |
| Next.js 15 App Router + RSC | ✅ |
| Drizzle 0.38 + `@neondatabase/serverless` HTTP driver | ✅ |
| `getCurrentUser()` + `requireRole()` 서버 헬퍼 | ✅ |
| `withEnt()` Drizzle 멀티테넌시 헬퍼 | ✅ |
| Migration script (`db-migrate.mjs` for dev/staging) | ✅ |
| JWT middleware (sets x-ent-id / x-user-id / x-user-role) | ✅ |
| `@car-v2/ui` design system + 15 page templates (UI restyle 완료) | ✅ |

### 1.2 DB 상태

- 1 테이블만 존재: `car_users` (AMA SSO 매핑 + local role).
- Neon dev 브랜치 생성 완료, 마이그레이션 적용 가능.

### 1.3 제약사항

- Neon HTTP driver — **multi-statement 트랜잭션 미지원**. 복잡한 mutation은 단일 SQL 문 또는 application-level 보상 로직.
- Server Actions은 Node.js runtime 강제 (drizzle-orm/pg-core가 Edge 미지원).
- iframe 환경에서 모든 mutation은 form action 또는 fetch — `revalidatePath()` / `revalidateTag()` 호출 필요.

---

## 2. 단계별 구현 계획

> **6 phase 순차 실행**. 각 phase 종료 시 typecheck + 영향 페이지 수동 확인 → commit.

### Phase P1.1 — Drizzle 스키마 (6 테이블)

#### S1.1.1 Vehicle schema
- 신규: `packages/db/src/schema/vehicles.schema.ts`
- 컬럼: REQ §3.1.1 (cvh_* prefix)
- ENUM `car_vehicle_status`: AVAILABLE / IN_USE / MAINTENANCE / RETIRED
- ENUM `car_vehicle_fuel`: PETROL / DIESEL / HYBRID / EV
- 인덱스: `idx_car_vehicles_ent_status`, `uniq_car_vehicles_ent_plate (partial WHERE deleted_at IS NULL)`
- └─ 사이드 임팩트: 신규 ENUM은 Postgres에서 `CREATE TYPE` 별도 SQL — drizzle-kit이 자동 생성

#### S1.1.2 Driver schema
- 신규: `packages/db/src/schema/drivers.schema.ts`
- 컬럼: REQ §3.1.2 (drv_* prefix)
- ENUM `car_driver_status`, `car_driver_license_class`
- FK to `car_users.usr_id` (NOT NULL — REQ Open Q3 답: NOT NULL)
- 인덱스: `idx_car_drivers_ent_status`, `idx_car_drivers_license_expiry`

#### S1.1.3 Trip schema + Stopover schema
- 신규: `packages/db/src/schema/trips.schema.ts`
- ENUM `car_trip_status` (7개 값)
- FK to vehicles, drivers, users (passenger, creator) — vehicles/drivers FK는 nullable
- 추가 file: `packages/db/src/schema/trip-stopovers.schema.ts` (`tst_*`)

#### S1.1.4 Audit log schema
- 신규: `packages/db/src/schema/audit-logs.schema.ts`
- JSONB before/after, INET ip
- DB-level INSERT-only enforcement: P1에선 application-level만 (DB grant는 P6 hardening)

#### S1.1.5 Notification schema
- 신규: `packages/db/src/schema/notifications.schema.ts`

#### S1.1.6 Schema index re-export
- 수정: `packages/db/src/schema/index.ts` — export 추가
- 수정: `packages/db/src/client.ts` — `schema` 객체 그대로 (이미 `* as schema` import)

└─ 사이드 임팩트: drizzle 타입 자동 추론 → `db.query.carTrips.findMany(...)` 사용 가능.

### Phase P1.2 — DB 마이그레이션 + Seed

#### S1.2.1 Drizzle config 확인
- 파일: `packages/db/drizzle.config.ts` (이미 존재 가정)
- 마이그레이션 폴더: `packages/db/migrations/`

#### S1.2.2 Generate migration
```bash
npm run db:generate
# → 0001_p1_trip_mvp.sql 생성 (6 테이블 + ENUM + 인덱스)
```

#### S1.2.3 Apply to dev
```bash
npm run db:migrate:dev
```
- 신규 테이블 6개 + 4개 ENUM 타입 생성
- 기존 `car_users` 영향 없음

#### S1.2.4 Seed script
- 신규: `scripts/db-seed.mjs`
- 3 vehicles (51K-238.91, 30A-556.07, 51F-712.34) — HanaTech ent_id
- 3 drivers (Tú, Hùng, Đức) + 3 corresponding `car_users` records
- 5 sample trips covering states: PENDING_ASSIGNMENT, PENDING_DRIVER_CONFIRMATION, CONFIRMED, IN_PROGRESS, COMPLETED
- 8 audit log entries (creation + transitions)
- 명령: `node scripts/db-seed.mjs dev`

└─ 사이드 임팩트: seed는 idempotent — 중복 실행시 `INSERT ... ON CONFLICT DO NOTHING`.

### Phase P1.3 — Server Services

#### S1.3.1 Trip ref sequence service
- 신규: `apps/web/src/server/services/trip-ref.service.ts`
- 함수: `nextTripRef(entId): Promise<string>` — `TR-{nnnn}`
- 구현: SELECT max + INSERT with retry on unique conflict (낮은 트래픽 OK)

#### S1.3.2 Google Maps URL service
- 신규: `apps/web/src/server/services/google-maps-url.service.ts`
- 함수: `buildGoogleMapsUrl({pickup, dropoff, stopovers}): string`

#### S1.3.3 Audit Log service
- 신규: `apps/web/src/server/services/audit-log.service.ts`
- 함수: `logAudit(input): Promise<void>`
- INSERT only. Caller가 before/after를 직접 가공.
- IP/UA는 헤더에서 추출 헬퍼 별도

#### S1.3.4 Notification service
- 신규: `apps/web/src/server/services/notification.service.ts`
- 함수: `notifyUser(input): Promise<void>` — INSERT row
- 함수: `notifyMany(userIds, payload): Promise<void>` — batch insert

#### S1.3.5 Trip State Machine service ⭐ (핵심)
- 신규: `apps/web/src/server/services/trip-state-machine.service.ts`
- TYPE: `TripTransition`, `TransitionPayload`
- 함수: `transitionTrip(tripId, transition, actor, payload?): Promise<Trip>`
  - 1단계: 현재 trip 조회 (`withEnt` + soft-delete filter)
  - 2단계: 전이 valid 검사 (PRD §9.1 Table)
  - 3단계: 권한 검사 (REQ §3.7)
  - 4단계: payload 처리 (예: reject 사유, end odometer)
  - 5단계: UPDATE trp_status + 관련 컬럼
  - 6단계: 부수효과 (vehicle status, audit log, notification)
  - 7단계: 새 trip 반환
- Error codes: CAR-E1001 (invalid transition), CAR-E1005 (forbidden by role)

└─ 사이드 임팩트: 모든 Trip 상태 변경은 이 함수로만. 코드 리뷰에서 `trp_status` 직접 SET 발견시 reject.

### Phase P1.4 — Zod Schemas + Server Actions

#### S1.4.1 Zod request schemas (`packages/shared/src/zod/`)
- 신규: `vehicle.zod.ts`, `driver.zod.ts`, `trip.zod.ts`, `index.ts`
- snake_case 필드명 (request body 규약)
- Drizzle insert 타입과 분리 (UI 입력 검증 전용)

#### S1.4.2 Vehicle Server Actions
- 신규: `apps/web/src/server/actions/vehicles/`
  - `create-vehicle.action.ts` — ADMIN only, Zod 검증, INSERT, audit log
  - `update-vehicle.action.ts`
  - `delete-vehicle.action.ts` — soft delete (`SET cvh_deleted_at = now()`)
- 신규: `apps/web/src/server/queries/vehicles.queries.ts`
  - `listVehicles({entId, status?, limit?})` — RSC용
  - `getVehicle(entId, id)`
- index re-export

#### S1.4.3 Driver Server Actions
- 신규: `apps/web/src/server/actions/drivers/`
  - `create-driver.action.ts` — ADMIN, UUID로 user lookup, FK 연결
  - `update-driver.action.ts`
- 신규: `apps/web/src/server/queries/drivers.queries.ts`

#### S1.4.4 Trip Server Actions ⭐ (가장 많음)
- 신규: `apps/web/src/server/actions/trips/`
  - `create-trip.action.ts` — ADMIN/MANAGER. 시간 검증, ref 생성, gmaps URL, audit, notify
  - `update-trip.action.ts` — pre-confirm fields
  - `assign-trip.action.ts` — wraps `transitionTrip('assign')`
  - `accept-trip.action.ts` — wraps `transitionTrip('accept')`
  - `reject-trip.action.ts` — payload: {reason}
  - `start-trip.action.ts` — payload: {start_odometer?}
  - `end-trip.action.ts` — payload: {end_odometer?}
  - `cancel-trip.action.ts` — payload: {reason?}
- 신규: `apps/web/src/server/queries/trips.queries.ts`
  - `listTrips({entId, role, userId, filter?, page?})` — Role-based filter (R-3)
  - `getTrip(entId, id)`
  - `listTripsForDriver(entId, driverId)` — vehicle/driver detail 페이지용
  - `listTripsForVehicle(entId, vehicleId)`

#### S1.4.5 Audit queries
- 신규: `apps/web/src/server/queries/audit.queries.ts`
  - `listAudit({entId, filter?, page?})`
  - `listAuditForEntity(entId, entity, entityId)`

#### S1.4.6 Error codes 확장
- 수정: `packages/shared/src/errors/car-error.ts` 또는 별도 `error-codes.ts`
- 추가:
  - CAR-E1001 invalid trip state transition
  - CAR-E1002 vehicle not available
  - CAR-E1003 driver not available
  - CAR-E1004 trip not found
  - CAR-E1005 forbidden by role/ownership
  - CAR-E1006 trip locked (post-7-day or COMPLETED)
  - CAR-E1007 trip ref conflict (retry)
  - CAR-E1008 stopover limit exceeded (>3)

### Phase P1.5 — UI Wiring (5 페이지)

#### S1.5.1 `/trips` — list with role filter
- 수정: `apps/web/src/app/trips/page.tsx`
- 샘플 데이터 삭제 → `await listTrips({entId, role, userId, status: searchParams.status, page})`
- 페이지네이션을 URL params (`?page=2&status=PENDING`)로
- 빈 상태: `<EmptyState>` (PRD friendly message)

#### S1.5.2 `/trips/[id]` — detail with actions
- 수정: `apps/web/src/app/trips/[id]/page.tsx`
- `await getTrip(entId, id)`
- `await listAuditForEntity('Trip', id)` → timeline
- 페이지 안 client component (`trip-actions.tsx`) — 버튼들이 server action 호출
- `useFormStatus` for loading state

#### S1.5.3 `/trips/new` — form with createTrip
- 수정: `apps/web/src/app/trips/new/page.tsx`
- `await listDrivers()`, `listVehicles()`, `listUsers()` (select options)
- Form `action={createTripAction}`
- Client form wrapper with React Hook Form + Zod (resolver)
- 성공 → redirect to `/trips/{ref}`

#### S1.5.4 `/vehicles` + `/vehicles/[id]`
- 수정: `apps/web/src/app/vehicles/page.tsx`, `[id]/page.tsx`
- `await listVehicles()` + `getVehicle()`, `listTripsForVehicle()` (history tab)
- Edit modal (P2 또는 별도 페이지)

#### S1.5.5 `/drivers` + `/drivers/[id]`
- 동일 패턴

#### S1.5.6 `/` Dashboard
- 수정: `apps/web/src/app/page.tsx`
- 샘플 데이터를 실제 쿼리로:
  - `listVehicles({status: ['AVAILABLE','IN_USE','MAINTENANCE']})` — fleet status
  - `listTrips({today, limit: 5})` — schedule
  - `listAuditForEntity('Trip')` — action queue
  - 일부 차트는 P3까지 sample data 유지 (cost 도메인 P2)

#### S1.5.7 `/audit` — log viewer
- 수정: `apps/web/src/app/audit/page.tsx`
- `await listAudit({filter, page})`

└─ 사이드 임팩트: 페이지가 모두 server component 유지. 버튼/form만 client component로 분리.

### Phase P1.6 — i18n + Error handling polish

#### S1.6.1 새 i18n 키
- 수정: `apps/web/messages/{vi,en,ko}.json`
- 추가:
  - `trip.status.{PENDING_ASSIGNMENT,PENDING_DRIVER_CONFIRMATION,CONFIRMED,IN_PROGRESS,COMPLETED,REJECTED_BY_DRIVER,CANCELLED}`
  - `trip.transition.{assign,accept,reject,start,end,cancel}`
  - `trip.form.{passenger,pickup,dropoff,scheduledAt,duration,purpose,notes,driver,vehicle}`
  - `vehicle.status.{AVAILABLE,IN_USE,MAINTENANCE,RETIRED}`
  - `driver.status.{AVAILABLE,ON_TRIP,OFF_DUTY,UNAVAILABLE}`
  - `error.CAR-E1001`...`error.CAR-E1008`
- 검증: 3개 언어 누락 없음 (스크립트로 자동 체크 가능)

#### S1.6.2 Server Action 결과 처리
- 모든 Server Action은 `ActionResult<T>` 반환
- Client component에서 `result.success`로 분기 → toast 표시 (`toast.success` / `toast.error`)

#### S1.6.3 Form validation UX
- Zod 에러 → 필드별 inline error
- React Hook Form `mode: 'onBlur'`

---

## 3. 변경 파일 목록

### 3.1 신규 파일

**Database (packages/db)** — 8개
- `src/schema/vehicles.schema.ts`
- `src/schema/drivers.schema.ts`
- `src/schema/trips.schema.ts`
- `src/schema/trip-stopovers.schema.ts`
- `src/schema/audit-logs.schema.ts`
- `src/schema/notifications.schema.ts`
- `migrations/0001_p1_trip_mvp.sql` (auto)
- (수정) `src/schema/index.ts`

**Shared (packages/shared)** — 4개
- `src/zod/vehicle.zod.ts`
- `src/zod/driver.zod.ts`
- `src/zod/trip.zod.ts`
- `src/zod/index.ts`

**Web — Services** — 5개
- `apps/web/src/server/services/trip-state-machine.service.ts`
- `apps/web/src/server/services/audit-log.service.ts`
- `apps/web/src/server/services/notification.service.ts`
- `apps/web/src/server/services/trip-ref.service.ts`
- `apps/web/src/server/services/google-maps-url.service.ts`

**Web — Queries** — 4개
- `apps/web/src/server/queries/vehicles.queries.ts`
- `apps/web/src/server/queries/drivers.queries.ts`
- `apps/web/src/server/queries/trips.queries.ts`
- `apps/web/src/server/queries/audit.queries.ts`

**Web — Server Actions** — 13개
- `apps/web/src/server/actions/vehicles/{create,update,delete}-vehicle.action.ts` (3)
- `apps/web/src/server/actions/drivers/{create,update}-driver.action.ts` (2)
- `apps/web/src/server/actions/trips/{create,update,assign,accept,reject,start,end,cancel}-trip.action.ts` (8)

**Seed** — 1개
- `scripts/db-seed.mjs`

**Total new ≈ 35 files**

### 3.2 수정 파일

| 파일 | 변경 유형 |
|---|---|
| `packages/db/src/schema/index.ts` | export 추가 |
| `packages/shared/src/index.ts` | zod export 추가 |
| `packages/shared/src/errors/error-codes.ts` (신규 또는 car-error.ts) | CAR-E1xxx 추가 |
| `apps/web/src/app/page.tsx` (Dashboard) | 데이터 와이어링 |
| `apps/web/src/app/trips/page.tsx` | 데이터 와이어링 + URL params |
| `apps/web/src/app/trips/new/page.tsx` | createTrip 핸들러 + select options |
| `apps/web/src/app/trips/[id]/page.tsx` | getTrip + 6 action 버튼 client comp |
| `apps/web/src/app/vehicles/page.tsx` | listVehicles |
| `apps/web/src/app/vehicles/[id]/page.tsx` | getVehicle + history |
| `apps/web/src/app/drivers/page.tsx` | listDrivers |
| `apps/web/src/app/drivers/[id]/page.tsx` | getDriver + history |
| `apps/web/src/app/audit/page.tsx` | listAudit |
| `apps/web/messages/{vi,en,ko}.json` | ~30 키 추가 |

**Total modified ≈ 15 files**

### 3.3 삭제 파일

없음.

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 | 완화책 |
|---|---|---|---|
| DB schema 적용 — dev branch | Low | 신규 테이블, 기존 데이터 영향 X | seed가 conflict 없이 idempotent |
| Multi-tenancy 누락 | **High** | 한 군데라도 `withEnt` 빠지면 cross-tenant 데이터 노출 | Query 헬퍼 강제 + PR review checklist |
| Trip state 직접 수정 | **High** | `transitionTrip` 우회시 invalid state 가능 | 코드 리뷰 + 향후 lint rule (P6) |
| Audit log 누락 | Medium | Some mutation 빠지면 NFR-9 미준수 | service에서 INSERT 통합 — 모든 transition은 자동 |
| 권한 누락 | Medium | Manager가 다른 manager의 trip 보거나 수정 | `requireRole` + per-row check (creatorId) |
| Trip ref 충돌 | Low | 동시 createTrip 두 개 → 충돌 | unique constraint + retry (낮은 트래픽) |
| UI breakage | Medium | 페이지가 sample data를 받다가 실제 빈 DB → 빈 상태 | EmptyState 처리 확인 + seed로 항상 데이터 보유 |
| i18n 키 누락 | Low | 새 키 빠지면 raw key 노출 | next-intl `getMessageFallback` + 키 lint |
| Drizzle JSONB 직렬화 | Low | `aud_before`/`aud_after`는 unknown — 타입 명시 필요 | `.$type<MyShape>()` 활용 |
| Neon HTTP — no tx | Medium | 복잡한 multi-step mutation 실패시 부분 적용 | 보상 로직 (예: trip insert 실패 → stopover 안 만들음) |
| `revalidatePath` 누락 | Low | mutation 후 stale UI | 모든 action 종료에 revalidate 호출 (헬퍼 함수) |
| ENUM 마이그레이션 | Low | Postgres ENUM 변경 까다로움 | P1에서는 한번에 만들고 향후 변경 안 함 |

---

## 5. DB 마이그레이션

### 5.1 신규 ENUM 타입 (4개)

```sql
CREATE TYPE car_vehicle_status AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED');
CREATE TYPE car_vehicle_fuel AS ENUM ('PETROL', 'DIESEL', 'HYBRID', 'EV');
CREATE TYPE car_driver_status AS ENUM ('AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'UNAVAILABLE');
CREATE TYPE car_driver_license_class AS ENUM ('A2', 'B1', 'B2', 'C', 'D', 'E', 'F');
CREATE TYPE car_trip_status AS ENUM (
  'PENDING_ASSIGNMENT', 'PENDING_DRIVER_CONFIRMATION', 'CONFIRMED',
  'IN_PROGRESS', 'COMPLETED', 'REJECTED_BY_DRIVER', 'CANCELLED'
);
```

### 5.2 신규 테이블 (6개)

drizzle-kit이 자동 생성. 적용:
```bash
npm run db:migrate:dev
```

### 5.3 Rollback

```sql
DROP TABLE car_notifications;
DROP TABLE car_audit_logs;
DROP TABLE car_trip_stopovers;
DROP TABLE car_trips;
DROP TABLE car_drivers;
DROP TABLE car_vehicles;
DROP TYPE car_trip_status;
DROP TYPE car_driver_license_class;
DROP TYPE car_driver_status;
DROP TYPE car_vehicle_fuel;
DROP TYPE car_vehicle_status;
```

### 5.4 Staging/Production 정책

- **Dev**: 즉시 적용 OK (테스트 데이터만)
- **Staging**: P1 완료 후 일괄 적용
- **Production**: 미적용 (deploy는 P6 hardening에서)
- CLAUDE.md §4.3 정책: `synchronize` 비활성, 모든 SQL 수동 적용

---

## 6. 일정 추정

| Phase | Scope | 예상 |
|---|---|---|
| P1.1 | 6 Drizzle schemas + ENUM | 2-3h |
| P1.2 | Generate + apply migration + seed | 2-3h |
| P1.3 | 5 services (state machine, audit, notify, ref, gmaps) | 4-5h |
| P1.4 | Zod + 13 Server Actions + 4 queries + error codes | 6-8h |
| P1.5 | UI wiring 6 pages | 4-6h |
| P1.6 | i18n + error UX polish | 1-2h |

**Total ≈ 19-27h** (3-4일 풀타임)

---

## 7. 체크포인트 (커밋 단위)

| Commit | Phase | 검증 |
|---|---|---|
| `feat(db): P1 schemas — vehicles, drivers, trips, stopovers, audit, notifications` | P1.1+P1.2 | `db:migrate:dev` 성공, `db-seed` 성공, `SELECT * FROM car_vehicles` 확인 |
| `feat(server): trip state machine + audit/notify services` | P1.3 | typecheck pass, 단위 테스트 없으면 수동 시뮬레이션 |
| `feat(server): vehicle/driver/trip Server Actions + Zod` | P1.4 | typecheck pass, route handler test |
| `feat(web): wire trips list/detail/new to real data` | P1.5 (trips 부분) | 페이지 200 OK + 데이터 정확 |
| `feat(web): wire vehicles + drivers + dashboard to real data` | P1.5 (rest) | 페이지 200 OK |
| `feat(i18n): trip/vehicle/driver status + error keys` | P1.6 | 3개 언어 토글 확인 |

---

## 8. 롤백 전략

- **Phase별 branch**: `huy/p1-{phase}` (필요시)
- **DB rollback**: §5.3 SQL — 신규 테이블만 DROP. 기존 `car_users` 영향 없음.
- **Code rollback**: `git revert <merge commit>` — UI는 sample data로 자동 fallback (sample 코드 일부 보존 권장 위해 별도 fixtures 파일에 보관)

---

## 9. 후속 phase 의존성

P1이 완료되면:
- **P2 Expense MVP**: car_expenses 테이블 추가, S3 presigned upload, approval queue. Trip ↔ Expense 관계 활용.
- **P3 Reports**: Trip/Expense aggregation, Excel/PDF export.
- **P4 Maintenance + Notify**: oil interval cron, push/email delivery (P1의 notification row를 소비).
- **P5 PWA**: 추가 변경 없음 — UI는 이미 mobile-first.
- **P6 Hardening**: audit log INSERT-only DB grant, Playwright suite, retention cron.
