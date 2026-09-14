# FIX-260914 — car-manager v2 프로덕션 수동 마이그레이션 누락 (0026 / 0030)

- **일시 / Date**: 2026-09-14
- **환경 / Env**: Production — `apps.amoeba.site/app-car-manager-v2` (server `52.221.66.39`, Neon `ep-misty-butterfly-…ap-southeast-1`)
- **심각도 / Severity**: High — 운영 중 500 발생

## 1. 증상 / Symptom

프로덕션 컨테이너 `next-car-manager-v2` 로그에 반복 발생:

```
⨯ Error [NeonDbError]: relation "car_truck_maintenances" does not exist
```

발생 시각: `04:59:32`, `05:00:43`, `05:00:47`, `05:08:51` (UTC) — 총 4건.

영향 화면:
- TRUCK 워크스페이스 **Bảo trì(정비)** 메뉴 — 목록/등록/수정
- **P&L** (`packages/core/src/truck/truck-pnl.service.ts` — 고정비 3번째 항목)
- 차량 상태 파생 로직 (`truck-vehicle-status.ts`), `vehicle.actions.ts`
- Drivers 페이지 (0026 `car_user_region_access` 의존)

## 2. 원인 분석 / Root Cause

`packages/db/migrations/` 의 SQL 파일 31개 중 **5개는 의도적으로 drizzle journal
(`meta/_journal.json`)에 등록되지 않은 "수동 마이그레이션"** 이다. 각 파일 헤더에 명시:

> "Manual migration (same pattern as 0011/0018): NOT in the drizzle journal.
>  Dev syncs schema via `db:push`; staging/prod apply this file via psql."

따라서 `drizzle-kit migrate` 는 이 파일들을 **절대 적용하지 않으며**, journal 기준으로는
26/26 전부 적용 완료로 보여 **"pending 없음"** 으로 오판하게 된다.

프로덕션 점검 결과:

| Migration | 유형 | 프로덕션 상태(수정 전) |
|---|---|---|
| 0026 `car_user_region_access` | 수동 | ❌ MISSING |
| 0028 drop fuel cols | 수동 | ✅ 적용됨 |
| 0029 `trr_fixed_alloc` | 수동 | ✅ 적용됨 |
| 0030 `car_truck_maintenances` | 수동 | ❌ MISSING |
| 0031 TRUCK status normalize | 수동 | ✅ 정상(0건) |

`04:19` 배포된 빌드에는 정비(maintenance) 기능 코드가 포함되어 해당 테이블을 SELECT 하지만,
DB에는 테이블이 없어 런타임 500이 발생했다. **코드 배포와 수동 SQL 적용이 분리**되어 있고
적용 여부를 추적하는 장치가 없는 것이 근본 원인이다.

## 3. 수정 내용 / Fix

누락된 2개 마이그레이션을 프로덕션 DB에 적용 (idempotent, 순수 additive —
`CREATE TABLE/INDEX IF NOT EXISTS` 만 사용. DROP/DELETE/TRUNCATE 없음 → 데이터 손실 없음).

적용된 statement 7건 — 전부 OK:

- `car_user_region_access` 테이블 + FK(`usr_id`→`car_users`) + unique/일반 인덱스 2종
- `car_truck_maintenances` 테이블 + CHECK(`tmn_end_date >= tmn_start_date`) + 인덱스 2종

## 4. 변경 파일 목록 / Changed Files

| 구분 | 대상 | 변경 유형 |
|---|---|---|
| DB (prod) | `car_user_region_access` | 신규 테이블 (migration 0026) |
| DB (prod) | `car_truck_maintenances` | 신규 테이블 (migration 0030) |
| Script | `apps/app-car-manager-v2/scripts/check-manual-migrations.mjs` | 신규 (재발 방지) |
| Config | `apps/app-car-manager-v2/package.json` | 수정 (`db:check:manual*` 3종 추가) |
| Docs | `docs/bug-fix/FIX-260914-…md` | 신규 |

> 애플리케이션 런타임 소스 변경 없음 — DB 스키마 드리프트 해소 + 점검 스크립트 추가.

## 5. 검증 / Verification

스키마 확인:
- `car_truck_maintenances`: 12 columns, 3 indexes ✅
- `car_user_region_access`: 7 columns, 3 indexes ✅

애플리케이션 실제 쿼리 4종 재현 — 전부 성공:
- 정비 목록 / P&L 월별 합계 / 진행중 정비 상태 파생 / region access 조회 → OK (0 rows)

운영 상태:
- 수정(05:10) 이후 `does not exist` 에러 **0건** (05:13 기준)
- 컨테이너 `healthy`, restart 0회
- `GET /app-car-manager-v2/api/v1/health` → `200 {"status":"ok"}`

## 6. 재발 방지 / Prevention

현재 수동 마이그레이션 5종은 **적용 여부를 추적하는 수단이 전혀 없어**, 프로덕션이 조용히
드리프트한 뒤 500으로만 드러난다. 권장 조치:

1. **배포 전 스키마 검증 스크립트 추가 (본 PR에 포함)** —
   `scripts/check-manual-migrations.mjs` 가 수동 마이그레이션 5종을 실제 스키마에 직접
   probe 한다. journal 과 무관하게 동작하므로 이번 같은 드리프트를 배포 전에 잡는다.

   ```bash
   npm run db:check:manual:staging    # .env 의 DATABASE_URL_STAGING 사용
   npm run db:check:manual:prod       # .env 의 DATABASE_URL_PROD 사용
   DATABASE_URL=postgresql://... npm run db:check:manual   # one-off
   ```

   exit code: `0` = 전부 적용됨, `2` = 누락 (누락 파일명 + 적용 명령 출력).
   신규 수동 마이그레이션 추가 시 `MIGRATIONS` 배열에 probe 를 함께 등록할 것.
   → 배포 파이프라인에서 이 스크립트를 게이트로 사용 권장.
2. **수동 마이그레이션도 적용 이력 기록** — 전용 테이블(예: `car_manual_migrations`)에
   파일명 기록, 또는 journal 편입 검토.
3. **코드-스키마 동시 배포 원칙** — 신규 테이블을 읽는 빌드는 SQL 선적용 후 배포
   (0030 헤더에도 동일 경고가 이미 기술되어 있음).
4. **문서 정정**: `CLAUDE.md` 의 프로덕션 IP `18.138.206.18` 은 현행과 불일치
   (실제 `apps.amoeba.site` → `52.221.66.39`). 확인 후 갱신 필요.
