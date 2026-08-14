# FIX-260813 — 승인된 사용자가 v2 앱에 못 들어가고 App Store 카탈로그에 갇힘 — 카탈로그가 `ama_token`에서 entity 컨텍스트를 만들지 않음

- **환경**: 프로덕션 `apps.amoeba.site` (52.221.66.39)
- **영향 앱**: `app-car-manager-v2`, `app-sales-report-v2` (동일 원인, 동일 경로)
- **선행 이슈**: [FIX-260812-platform-app-launch-missing-ama-token.md](FIX-260812-platform-app-launch-missing-ama-token.md) — 그 수정에서 남은 구멍

## 1. 증상 / Symptom

AMA에서 조직(org)에 대한 앱 연동 요청을 **승인(ACTIVE)했는데도**, 사용자가 AMA의 커스텀 앱 메뉴로 앱을 열면 앱으로 들어가지 못하고 `apps.amoeba.site`의 App Store 화면에 머문다. 화면에는 "사용하기"가 아니라 **"신청하기"** 버튼이 보인다 — 이미 승인된 사용자에게 다시 신청하라고 요구하는 상태이며, 앱으로 이동할 링크가 어디에도 없다.

프로덕션 access log 2026-08-13 06:31 구간에 같은 사용자가 1분 동안 6회 재시도한 흔적이 남아 있다.

## 2. 원인 분석 / Root Cause

### 2.1 구독 데이터는 정상

`db_app_platform.plt_subscriptions` (프로덕션) 확인 결과 승인은 정상적으로 기록되어 있었다.

| ent_code | app | sub_status | sub_approved_at |
|---|---|---|---|
| CARGO434 | car-manager-v2 | ACTIVE | 2026-08-12 |
| UIT327 | car-manager-v2 | ACTIVE | 2026-07-17 |
| UIT327 | sales-report-v2 | ACTIVE | 2026-07-15 |
| KR3798 | sales-report-v2 | ACTIVE | 2026-07-03 |
| VN01 | 둘 다 | ACTIVE | 2026-06-29 |

백엔드 `SubscriptionService.findByEntity()`도 정상 — ACTIVE/PENDING/SUSPENDED를 `subCreatedAt DESC`로 읽어 앱당 최신 1건을 돌려준다.

### 2.2 진짜 원인: 카탈로그가 구독 조회를 아예 하지 않음

nginx access log (referer `https://ama.amoeba.site/`):

```
GET /apps/app-car-manager-v2?ama_token=<JWT>&locale=en   200
GET /api/v1/platform/apps/app-car-manager-v2             200
   ← 끝. /api/v1/platform/subscriptions/entity/{entId} 요청이 없음
```

체인을 따라가면:

| # | 위치 | 동작 |
|---|------|------|
| 1 | AMA | `/apps/:slug?ama_token=<jwt>&locale=xx`로 진입시킴. **`ent_id`/`ent_code`/`ent_name` 쿼리 파라미터는 보내지 않음** |
| 2 | `App.tsx` `EntityContextInitializer` | `entId && entCode && entName` **3개가 모두** 있어야 스토어에 저장 → 조건 불성립 → entity 컨텍스트 `null` |
| 3 | `AppDetailPage.tsx:34` | 폴백도 `searchParams.get('ent_id')`만 봄 → 역시 `null` |
| 4 | `AppDetailPage.tsx:52` | `useEntitySubscriptions(null)` → React Query `enabled: false` → **API 호출 없음** |
| 5 | `AppDetailPage.tsx:59` | `currentStatus = null` |
| 6 | `AppDetailPage.tsx:168` | 마지막 분기로 떨어져 "신청하기" 버튼 렌더 |

`ama_token`에는 `entityId` 클레임이 들어 있지만(앱 스코프 토큰, FIX-260812 §3.0 참조), 이 토큰을 읽는 코드는 `app-launch.ts`의 `buildAppLaunchUrl()` 하나뿐이었고 그마저도 **토큰을 실행 링크에 그대로 전달하는 용도**로만 썼다. 아무도 토큰에서 entity를 꺼내지 않았다.

즉 FIX-260812가 "실행 링크에 토큰을 붙이는" 문제는 고쳤지만, **그 실행 링크를 노출시키는 조건(구독 ACTIVE 판정)에 도달하지 못하는** 상위 문제가 남아 있었다.

두 v2 앱이 똑같이 막힌 이유는 단순히 둘 다 같은 `/apps/:slug` 화면을 거치기 때문이다. 앱 자체는 정상이었다 (`/app-car-manager-v2/api/v1/health` → 200).

## 3. 수정 내용 / Fix

### 3.1 `lib/ama-token.ts` (신규)

앱 스코프 토큰을 다루는 공용 헬퍼. `app-launch.ts`에 있던 `decodeClaims()` + 모듈 로드 시점 `initialSearch` 캡처를 옮기고, 두 가지 접근자를 제공한다:

- `getInitialAmaClaims()` — 만료되지 않은 토큰의 클레임. **`appCode` 검사 없음** (entity만 필요한 호출자를 위해)
- `appScopedTokenFor(slug)` — 기존 동작 그대로. `appCode`가 슬러그와 일치할 때만 토큰 반환

클레임은 검증 없이 디코드만 한다 — 카탈로그에는 `JWT_SECRET`이 없다. 용도가 (a) 어느 entity의 구독을 읽을지 고르는 것(공개 읽기 전용 엔드포인트)과 (b) UI 분기뿐이라 문제되지 않으며, 실제 검증은 토큰을 넘겨받은 v2 미들웨어가 수행한다.

### 3.2 `App.tsx` — `EntityContextInitializer` 폴백

쿼리 파라미터 3종이 없으면 `getInitialAmaClaims()?.entityId`로 entity 컨텍스트를 세운다. 기존 iframe 파라미터 경로는 `return`으로 분리해 100% 그대로 유지.

- `entCode`/`entName`은 토큰에 없어 빈 문자열. 구독 조회에는 `entId` 하나면 충분하고, 신규 신청 모달의 두 필드는 원래도 사용자가 직접 입력하던 값이라 회귀 없음 (폴백 이전에는 entity 컨텍스트 자체가 null이라 역시 빈칸이었다).
- `ama_token`은 URL에서 제거하지 않는다 — 새로고침해도 컨텍스트가 유지되고, `buildAppLaunchUrl()`이 실행 링크에 실어 보낼 수 있어야 한다.

### 3.3 `AppDetailPage.tsx` — role 폴백

`isMaster` 판정이 `searchParams.get('role')`(구 iframe 파라미터)에만 의존했다. 같은 정보를 토큰 클레임에서도 읽도록 폴백 추가. iframe 파라미터가 있으면 그쪽이 우선.

### 3.4 `Header.tsx` — 빈 뱃지 방지

폴백으로 컨텍스트가 잡히면 `entName`이 빈 문자열이라 entity 뱃지가 빈 알약 모양으로 렌더된다. 라벨이 있을 때만 그리고, `entName || entCode` 순으로 표시.

## 4. 변경 파일 목록 / Changed Files

| 구분 | 파일 | 변경 |
|------|------|------|
| Frontend | `apps/platform/frontend/src/lib/ama-token.ts` | **신규** — `getInitialAmaClaims()`, `appScopedTokenFor()` |
| Frontend | `apps/platform/frontend/src/lib/app-launch.ts` | 토큰 디코딩 로직을 `ama-token.ts`로 이전, 헬퍼만 남김 |
| Frontend | `apps/platform/frontend/src/App.tsx` | `EntityContextInitializer`에 토큰 폴백 추가 |
| Frontend | `apps/platform/frontend/src/pages/AppDetailPage.tsx` | `isMaster` role 폴백 |
| Frontend | `apps/platform/frontend/src/components/layout/Header.tsx` | 빈 entity 뱃지 방지 |

DB 마이그레이션 없음. 백엔드 변경 없음. i18n 키 추가 없음.

## 5. 검증 / Verification

호스트에 node 툴체인이 없어 용량 제한 컨테이너에서 컴파일 검증:

```
$ docker run --rm -m 1500m -v <src>:/app -w /app node:20-alpine \
    sh -c "npm install --ignore-scripts && ./node_modules/.bin/tsc -b"
(exit 0, 출력 없음)

$ ./node_modules/.bin/vite build
✓ 1761 modules transformed.
✓ built in 7.22s
$ grep -c entityId dist/assets/*.js
3
```

배포 후 확인해야 할 것:

1. AMA → 커스텀 앱 클릭 → `/apps/app-car-manager-v2?ama_token=…` 진입
2. **access log에 `/api/v1/platform/subscriptions/entity/{entId}` 요청이 찍히는지** ← 이번 수정의 핵심 지표
3. 버튼이 "사용하기"로 바뀌고, 클릭 시 `/app-car-manager-v2?ama_token=…`로 이동
4. v2 미들웨어가 쿠키를 심고 대시보드 렌더 (`/login`·`/session-expired`로 튕기지 않을 것)
5. `app-sales-report-v2`도 동일하게 반복

## 6. 배포 / Deployment

⚠️ 플랫폼은 이 박스(프로덕션)에만 있다. 루트 CLAUDE.md의 "스테이징 먼저" 원칙에 따라 `main` PR → 스테이징 검증 → `production` PR 순서를 따른다.

빌드 시 주의 (FIX-260812-staging-host-freeze-build-oom 절차 동일):

```bash
sudo docker stop tei-hscode            # 3.5GB 점유, 빌드 중 OOM 방지
sudo bash platform/scripts/deploy-staging.sh build platform
sudo docker compose --env-file .env -f docker-compose.platform.yml \
     up -d --no-deps --force-recreate web-platform
sudo docker start tei-hscode
```

`deploy-staging.sh restart platform`을 쓰지 않는 이유: 이 compose에 `mysql-apps`가 포함되어 `down`이 MySQL까지 내리고, 같은 DB를 쓰는 다른 앱들이 함께 죽는다. 프론트엔드 번들만 바뀌었으므로 `--no-deps --force-recreate web-platform`으로 범위를 최소화한다.

## 7. 재발 방지 패턴 / Prevention

- **AMA ↔ 플랫폼 진입 계약이 바뀌면 소비 지점을 전부 훑을 것.** AMA가 entity 전달 방식을 쿼리 파라미터 → JWT 클레임으로 바꿨는데, 플랫폼에는 옛 계약만 읽는 코드가 남아 조용히 `null`로 떨어졌다. 예외도 에러 로그도 없어서 "승인이 안 먹는다"처럼 보였다.
- **React Query `enabled: false`는 조용한 실패다.** 조회가 통째로 사라지는데 콘솔에도 네트워크 탭에도 아무 흔적이 없다. `enabled`가 컨텍스트에 의존하면, 컨텍스트가 비어 있는 상태를 UI에서 "미신청"과 구분해 표시할 것.
- **"버튼이 안 보인다"류 제보는 access log의 *없는 요청*부터 확인.** 이번에도 `subscriptions/entity` 요청이 없다는 사실 하나가 원인을 바로 지목했다.

## 8. 함께 발견한 사항 (이번 수정 범위 밖)

- **중복 구독 레코드**: CARGO434는 car-manager-v2에 ACTIVE 2건, UIT327은 sales-report-v2에 ACTIVE + EXPIRED. `findByEntity()`가 최신 1건만 쓰므로 동작은 정상이지만 정리 필요.
- **`SubscriptionCard`(내 구독 목록) 경로**: URL에 앱 스코프 토큰이 없는 경우가 많아 자동 로그인이 성립하지 않는다 (FIX-260812 §3.2). 근본 해결은 AMA의 앱 토큰 발급 API가 필요.
- **`entCode`/`entName` 클레임**: AMA가 토큰에 두 값을 넣어주면 신청 모달 자동 입력과 헤더 뱃지가 완전해진다.
