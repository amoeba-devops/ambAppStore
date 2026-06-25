# BUG-260625 — HS Code Manager: 마이그레이션에 base 테이블 3개 누락 (production deploy 실패)

- **발견일 / Date**: 2026-06-25
- **앱 / App**: `app-hscode-manager`
- **심각도 / Severity**: High — 신규 환경(staging/production) 최초 배포 시 DB 마이그레이션 전체 실패
- **영역 / Area**: DB migration (`db-migrations/00_apply_all.sh`)

## 1. 증상 / Symptom

빈 DB(`db_app_hscode`)에 `bash db-migrations/00_apply_all.sh` 실행 시 Phase 4에서 중단:

```
[migrate] === Phase 4: ALTER classifications ===
ERROR 1146 (42S02) at line 1: Table 'db_app_hscode.hsc_classifications' doesn't exist
```

런북(`docs/test/TR-20260513-HSCode매니저-M1-회귀시연-가이드.md`)은 성공 + "table count: 15"를 기대하지만 실제로는 실패한다.

## 2. 원인 / Root Cause

TypeORM 테이블 생성 경로가 두 가지인데, 환경별로 다르게 동작한다:

| 환경 | `synchronize` | 테이블 생성 주체 |
|------|---------------|------------------|
| 로컬 dev | **ON** (`NODE_ENV !== 'production'`) | TypeORM이 Entity 보고 자동 생성 |
| staging / production | **OFF** | `db-migrations/*.sql` 수동 실행만 |

(`backend/src/app.module.ts`: `synchronize: config.get('NODE_ENV') !== 'production'`)

엔티티는 **20개** 테이블을 선언하지만, 마이그레이션 SQL은 **18개**만 `CREATE` 한다.
아래 3개 "Phase 0 placeholder" 엔티티는 `ALTER` 문만 있고 `CREATE`가 없다 — 로컬에서는 `synchronize`가 만들어줬기 때문에 누락이 드러나지 않았다:

- `hsc_classifications`  (Phase 4의 `ALTER`가 참조)
- `hsc_verification_events`  (Phase 5의 `ALTER`가 참조)
- `hsc_expert_reviews`

production 모드는 `synchronize`가 꺼져 있어 base 테이블이 안 만들어지고, 이를 참조하는 `ALTER`에서 "table doesn't exist"로 실패한다.

> 비유: "문을 다시 칠하라(ALTER)"는 지침은 있는데 "문을 단다(CREATE)"는 단계가 빠짐. 기존 집(synchronize로 이미 테이블 존재)에서는 문제없지만, 새 집(빈 DB)에서는 칠할 문이 없다.

## 3. 조치 / Fix

1. 누락 base 테이블 3개를 엔티티 정의 기준으로 생성하는 마이그레이션 신규 작성:
   `db-migrations/2026-05-13_phase4a_base-entity-tables.sql`
   - 뒤따르는 `ALTER`가 추가하는 컬럼(`cls_fta_agreement_code`, `cls_created_by`, `vrf_inquiry_id`, `vrf_amount_usd`)을 **CREATE 시점에 미리 포함** → 기존 `mysql_alter_safe` 가드가 "already exists, skipping"으로 안전하게 no-op 처리.
   - `CREATE TABLE IF NOT EXISTS` + 파일 상단 `USE db_app_hscode;` (mysql_exec는 기본 DB를 지정하지 않음).
2. `00_apply_all.sh`에 Phase 4 ALTER **직전** 실행 단계 추가:
   ```bash
   log "=== Phase 4a: base entity tables ==="
   mysql_exec "$SCRIPT_DIR/2026-05-13_phase4a_base-entity-tables.sql"
   ```

## 4. 검증 / Verification

빈 DB에 재실행:

```
[migrate] === Phase 4a: base entity tables ===
[migrate] === Phase 4: ALTER classifications ===
[warn]   - hsc_classifications.cls_fta_agreement_code already exists, skipping
[warn]   - hsc_classifications.cls_created_by already exists, skipping
[migrate] === Phase 5: ALTER verification_events ===
[warn]   - hsc_verification_events.vrf_inquiry_id already exists, skipping
[warn]   - hsc_verification_events.vrf_amount_usd already exists, skipping
...
  table count: 21
[migrate] All migrations applied successfully.
```

- BFF(`bff-hscode-manager`) 부팅 OK, MySQL 연결 정상, 라우트 매핑 완료.
- `https://stg-apps.amoeba.site/app-hscode/api/v1/health` → 200.

## 5. 변경 파일 / Changed Files

| 파일 | 유형 |
|------|------|
| `apps/app-hscode-manager/db-migrations/2026-05-13_phase4a_base-entity-tables.sql` | 신규 |
| `apps/app-hscode-manager/db-migrations/00_apply_all.sh` | 수정 (Phase 4a 호출 추가) |

## 6. 후속 / Follow-up

- 런북 TR 문서의 기대 테이블 수(15 → 21) 갱신 권장.
- 마이그레이션 idempotent 재확인 완료 (재실행 시 모두 skip).
