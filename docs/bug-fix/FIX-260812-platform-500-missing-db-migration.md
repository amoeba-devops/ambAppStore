# FIX-260812 — 플랫폼 500 (PLT-E9999) — DB 마이그레이션 미적용 (테이블 2개 누락 + ENUM 값 누락)

- **날짜 / Date**: 2026-08-12
- **앱 / App**: platform (`bff-platform`, host 3100)
- **환경 / Env**: apps.amoeba.site · MySQL 8 (`mysql-apps` 컨테이너, `db_app_platform`)
- **신고 증상 / Reported**: `GET https://apps.amoeba.site/api/v1/platform/notifications/unread-count`
  → `{"success":false,"error":{"code":"PLT-E9999","message":"Internal server error"}}`

## 1. 증상 / Symptom
| 엔드포인트 | 결과 |
|---|---|
| `GET /api/v1/platform/notifications/unread-count` | **500** PLT-E9999 |
| `GET /api/v1/platform/notifications` | **500** PLT-E9999 |
| `GET /api/v1/admin/integrations` | **500** PLT-E9999 |

추가로 `bff-platform` 로그에 매일 00:00마다 동일 오류 **28회 누적**:
`QueryFailedError: Data truncated for column 'sub_status' at row 1`

**로그에 500의 흔적이 없음** — 전역 exception filter가 모든 예외를 `PLT-E9999`로 감싸고 원인을 로깅하지 않기 때문. 그래서 증상만으로는 추적이 불가했고, DB 스키마를 코드와 직접 대조해 확인함.

## 2. 원인 분석 / Root Cause
**수동 SQL 마이그레이션이 작성/적용된 적이 없음.** 코드에 엔티티가 추가되었지만 `scripts/init-db.sql`(플랫폼 유일의 스키마 산출물)이 갱신되지 않았고, 프로덕션은 `synchronize`가 꺼져 있어 테이블이 생성될 경로가 아예 없었음.

```
app.module.ts:27 → synchronize: process.env.NODE_ENV !== 'production'
컨테이너 NODE_ENV=production  → synchronize OFF (의도된 설정, 정상)
```

코드의 `@Entity` 4개 vs 실제 DB 2개:

| 엔티티 | 테이블 | DB 존재 |
|---|---|---|
| `AppEntity` | `plt_apps` | ✅ |
| `SubscriptionEntity` | `plt_subscriptions` | ✅ |
| `NotificationEntity` | `plt_notifications` | ❌ **없음** |
| `AdminIntegrationEntity` | `plt_external_integrations` | ❌ **없음** |

`getUnreadCount()`는 `notificationRepository.count({ ntf_user_id, ent_id, ntf_is_read: 0 })` 한 줄 — 존재하지 않는 테이블을 조회하므로 즉시 실패.

### 2.1 별건: `sub_status` ENUM 값 누락
| | 값 |
|---|---|
| DB (init-db.sql 기준) | `('PENDING','ACTIVE','SUSPENDED','REJECTED','CANCELLED')` — 5개 |
| 코드 `SubscriptionStatus` | 위 5개 + **`EXPIRED`** — 6개 |

`notification-scheduler.service.ts:40`이 `sub.subStatus = SubscriptionStatus.EXPIRED`를 저장 → MySQL이 값을 받지 못해 truncate 오류.
결과: **구독 만료 처리 스케줄러가 한 번도 성공하지 못했음** → 만료 구독이 EXPIRED로 전환되지 않고 만료 알림도 발송되지 않음.

## 3. 수정 내용 / Fix
`apps/platform/backend/scripts/migration-20260812-notifications-integrations.sql` 작성 후 적용:

1. `CREATE TABLE plt_notifications` — 인덱스는 조회 형태(`ntf_user_id, ent_id, ntf_is_read`)에 맞춤
2. `CREATE TABLE plt_external_integrations` — 인덱스명은 엔티티 `@Index` 데코레이터와 동일하게 (`idx_pei_ent_id`, `idx_pei_category`)
3. `ALTER TABLE plt_subscriptions MODIFY sub_status ENUM(... ,'EXPIRED')` — ENUM 끝에 값을 추가하므로 기존 값의 내부 순번이 바뀌지 않음(데이터 무손상)

인덱스는 **인라인 KEY**로 선언 — MySQL 8에는 `CREATE INDEX IF NOT EXISTS`가 없어, 별도 문장으로 두면 재실행 시 중단됨. 인라인이면 `CREATE TABLE IF NOT EXISTS`로 전체가 idempotent.

`scripts/init-db.sql`도 동일 내용으로 갱신 — **이 파일이 갱신되지 않은 것이 이번 장애의 근원**이므로, 신규 환경이 같은 상태로 출발하지 않도록 함.

적용 전 백업: `mysqldump --single-transaction` → `/home/ec2-user/db-backups/db_app_platform-backup-20260812-085800.sql`

## 4. 변경 파일 목록 / Changed Files
| 구분 | 파일 | 변경 |
|------|------|------|
| DB (신규) | `apps/platform/backend/scripts/migration-20260812-notifications-integrations.sql` | 신규 — 적용 완료 |
| DB (baseline) | `apps/platform/backend/scripts/init-db.sql` | `plt_notifications`, `plt_external_integrations` 추가 + `sub_status`에 `EXPIRED` 추가 |

애플리케이션 코드 변경 없음. 컨테이너 재시작 불필요(TypeORM이 이 쿼리들에 대해 스키마를 캐시하지 않음 — 적용 직후 200 확인).

## 5. 검증 / Verification
```
SHOW TABLES → plt_apps, plt_subscriptions, plt_notifications, plt_external_integrations
sub_status  → enum('PENDING','ACTIVE','SUSPENDED','REJECTED','CANCELLED','EXPIRED')
```

| 엔드포인트 | 수정 전 | 수정 후 |
|---|---|---|
| `/api/v1/platform/notifications/unread-count` | 500 | **200** `{"success":true,"data":{"count":0}}` |
| `/api/v1/platform/notifications` | 500 | **200** `{"items":[],"pagination":{...}}` |
| `/api/v1/admin/integrations` | 500 | **200** `{"data":[]}` |

`EXPIRED` 쓰기 검증 (트랜잭션 + ROLLBACK, 실데이터 무변경):
```
UPDATE ... SET sub_status='EXPIRED' WHERE sub_id='ad7d0cf4…'  → 성공, SHOW WARNINGS 없음
트랜잭션 내 조회 → EXPIRED   /   ROLLBACK 후 → ACTIVE
구독 10건 전부 ACTIVE 유지
```
스케줄러 자체는 매일 00:00 실행이므로 다음 실행 로그에서 최종 확인 필요.

## 6. 재발 방지 패턴 / Prevention
1. **엔티티를 추가/변경하면 같은 PR에 SQL 마이그레이션을 반드시 포함.** 프로덕션은 `synchronize: false`라 코드만 배포하면 런타임 500으로 나타난다. 루트 CLAUDE.md 백엔드 체크리스트의 "스테이징/프로덕션 수동 SQL 마이그레이션 준비" 항목이 이번에 누락된 지점.
2. **ENUM에 값을 추가할 때 DB ALTER를 잊지 말 것.** TS enum만 늘리면 쓰기 시점에 "Data truncated"로 터진다. 조회 경로에는 증상이 없어 발견이 늦다.
3. **엔티티 ↔ 테이블 대조를 배포 검증에 포함.** 한 줄로 가능:
   `grep -rhoE "@Entity\('[a-z_]+'\)" src/` vs `SHOW TABLES` 비교.
4. **미해결 — exception filter가 원인을 로깅하지 않음.** 모든 예외가 `PLT-E9999`로 뭉개져 로그에 스택이 남지 않는다. 이번 진단은 순전히 스키마 대조로 이루어졌고, 로그만 봤다면 훨씬 오래 걸렸다. 필터에서 5xx는 원본 오류를 `logger.error`로 남기도록 개선 권장. **이번 수정 범위에는 미포함.**
