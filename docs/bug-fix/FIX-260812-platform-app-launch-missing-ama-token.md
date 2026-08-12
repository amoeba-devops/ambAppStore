# FIX-260812 — v2 앱 자동 로그인 실패 — 플랫폼 카탈로그가 앱 실행 URL에 `ama_token`을 붙이지 않음

- **날짜 / Date**: 2026-08-12
- **앱 / App**: platform (frontend) → 영향: app-car-manager-v2, app-sales-report-v2
- **환경 / Env**: apps.amoeba.site
- **관련 / Related**: [FIX-260812-car-manager-v2-basepath-runtime.md](FIX-260812-car-manager-v2-basepath-runtime.md) — basePath 이슈를 먼저 잡은 뒤에도 자동 로그인이 계속 실패해 추가로 발견된 **별개의 원인**.

## 1. 증상 / Symptom
AMA에서 차량관리 v2를 열면 앱 대시보드가 아니라 **앱 자체의 `/login` 페이지**가 뜬다. basePath 수정(FIX-260812)으로 404/플랫폼 이탈은 해결됐지만 자동 로그인은 여전히 안 됨.

실제 요청 흐름 (`apps.amoeba.site-access.log`, 09:00:10~09:00:12):
```
GET /apps/app-car-manager-v2?ama_token=<TOKEN>&locale=en   200   ← 플랫폼 카탈로그, 토큰 있음
GET /app-car-manager-v2                                    307   ← 앱 실행, 토큰 없음 ★
GET /app-car-manager-v2/login                              200   ← 로그인 페이지 착지
```

## 2. 원인 분석 / Root Cause
플랫폼 카탈로그의 앱 실행 링크가 `href={`/${slug}`}` 로만 만들어져 **AMA JWT를 전달하지 않음**. 3곳:

| 파일 | 위치 | 버튼 |
|---|---|---|
| `src/pages/AppDetailPage.tsx` | 136 | 서비스 사용 (`detail.useService`) |
| `src/pages/AppDetailPage.tsx` | 143 | 사용 중 (`detail.inUse`) |
| `src/components/SubscriptionCard.tsx` | 99 | 앱으로 이동 (`mySubscriptions.goToApp`) |

**왜 v1 앱은 멀쩡한가:** v1(car-manager, hscode, sales-report, stock)은 같은 오리진(`apps.amoeba.site`)에서 서빙되는 SPA라서 스스로 `localStorage.ama_token`을 읽는다. 실행 URL에 토큰이 없어도 동작한다.

**왜 v2 앱만 실패하는가:** v2는 Next.js이고 인증이 **서버(middleware)**에서 일어난다. 서버는 localStorage에 접근할 수 없다. `middleware.ts:140-163`은 `?ama_token=`을 받아 검증 → HttpOnly 세션 쿠키 기록 → 깨끗한 URL로 리다이렉트하는 구조다. 파라미터가 없으면 토큰도 쿠키도 없는 상태이므로 `absoluteUrl(req, '/login')`으로 튕긴다.

즉 실행 링크가 **v1 SPA 시대의 가정(같은 오리진 + localStorage)** 그대로 남아 있었고, v2 앱이 추가될 때 갱신되지 않았다.

## 3. 수정 내용 / Fix

### 3.0 1차 시도가 틀렸던 지점 — `401 Invalid token`
처음에는 `localStorage.ama_token`(=`useAuthStore`의 토큰)을 그대로 붙였다. 그러자 리다이렉트는 사라졌지만 앱이 **`401 Invalid token`**(`middleware.ts:146`)을 반환했다. 원인: **AMA 토큰이 두 종류이고, 둘의 페이로드 형태가 다르다.**

access log의 실제 토큰들을 디코딩해 확인한 결과:

| | 플랫폼 세션 토큰 | 앱 스코프 토큰 |
|---|---|---|
| 어디서 오나 | admin 로그인 → `localStorage.ama_token` | AMA가 `/apps/:slug?ama_token=…`에 붙여 보냄 |
| entity 클레임 | **`ent_id`** (snake_case) | **`entityId`** (camelCase) |
| `appCode` | **없음** | `car-manager-v2` |
| role | `role: 'SUPER_ADMIN'`, `roles: ['SUPER_ADMIN']`, `level: 'ADMIN_LEVEL'` | `role: 'MASTER'` |
| 기타 | — | `appId`, `scope: 'custom_app:context'` |

v2 앱의 `amaJwtClaimsSchema`(`packages/shared/src/auth/jwt-claims.ts`)는 `entityId`(uuid)와 자기 슬러그와 일치하는 `appCode`를 **요구**한다. 서명 검증은 통과하지만(공유 시크릿 동일) Zod parse에서 실패 → `verifyAmaJwt` throw → 401. 즉 **플랫폼 세션 토큰은 v2 앱에 넘길 수 없는 토큰**이다.

한편 플랫폼은 URL로 들어온 앱 스코프 토큰을 **읽지도 저장하지도 않고 버리고 있었다**(`ama_token`을 참조하는 코드가 localStorage 경로에만 존재).

### 3.1 최종 구현
`src/lib/app-launch.ts` 신규 — 앱 스코프 토큰만 전달:
```ts
const initialSearch = typeof window === 'undefined' ? '' : window.location.search;

export function buildAppLaunchUrl(slug: string): string {
  const path = `/${slug}`;
  const token = appScopedTokenFor(slug);   // URL 토큰, 아래 3조건 모두 만족 시
  return token ? `${path}?ama_token=${encodeURIComponent(token)}` : path;
}
```
`appScopedTokenFor()`가 확인하는 3가지:
1. `appCode` 클레임이 존재 — 없으면 플랫폼 세션 토큰이므로 사용 불가
2. `exp`가 아직 유효
3. `appCode`가 대상 슬러그와 일치 — AMA는 `app-` 접두사를 뺀 형태(`car-manager-v2`)로 발급하므로 두 형태 모두 매칭 (v2 스키마도 두 형태를 허용)

**조건을 못 채우면 토큰을 아예 붙이지 않는다.** 잘못된 토큰으로 401(막다른 길)을 만드는 것보다, 앱의 `/login`에 착지해 사용자가 직접 로그인할 수 있게 하는 편이 낫다.

`initialSearch`를 모듈 로드 시점에 캡처하는 이유: 라우터가 하이드레이션 중 쿼리 파라미터를 제거하므로(App.tsx의 `EntityContextInitializer`) 나중에 `window.location.search`를 읽으면 이미 비어 있다.

- 3개 링크 모두 이 헬퍼 사용. v1 앱에 붙어도 무해 — 알 수 없는 쿼리 파라미터는 무시된다.
- **`locale`은 전달하지 않음**: v2 앱은 `NEXT_LOCALE` 쿠키로 언어를 결정(`apps/web/src/i18n/request.ts`)하고 쿼리 파라미터를 읽지 않는다.

토큰이 URL에 노출되는 것은 설계된 핸드오프다 — AMA도 같은 방식으로 플랫폼에 토큰을 넘기며, v2 미들웨어는 쿠키를 심은 직후 파라미터를 제거한 URL로 리다이렉트한다.

### 3.2 남는 한계
`SubscriptionCard`(내 구독 목록)에서 앱을 열 때는 URL에 앱 스코프 토큰이 없는 경우가 많다. AMA가 특정 앱을 대상으로 발급한 토큰만 유효하고 **플랫폼은 앱 토큰을 발급할 수 없으므로**, 그 경로에서는 자동 로그인이 성립하지 않고 앱의 `/login`으로 간다. 근본 해결은 AMA에 앱 토큰 발급 API(또는 앱별 재진입 링크)가 필요하다.

### 3.1 배포 중 발견한 선행 장애: `apps/platform/.env` 부재
`docker-compose.platform.yml`은 `env_file: ./.env`를 선언하는데 **해당 파일이 디스크에 없었다.** 실행 중인 컨테이너(2026-07-12 생성)는 생성 시점 env를 그대로 들고 있어 동작했지만, `docker compose config`부터 실패하는 상태였다:

```
env file /home/ec2-user/ambAppStore/apps/platform/.env not found
```

즉 **한 달 넘게 플랫폼 스택을 재시작할 수 없는 상태**였고, `deploy-staging.sh restart platform`(또는 `full`/`all`)을 실행하면 `down`은 성공하고 `up`이 실패해 **사이트 전체와 API가 내려간 뒤 복구 불가**였다 (`DB_PASSWORD`/`JWT_SECRET`이 실행 중 컨테이너에만 존재).

복구: 실행 중 `bff-platform`의 env에서 11개 키(`.env.staging.example`과 동일한 집합)를 추출해 `.env` 재생성, `chmod 600`. 이후 `docker compose config` 정상.

## 4. 변경 파일 목록 / Changed Files
| 구분 | 파일 | 변경 |
|------|------|------|
| Frontend | `apps/platform/frontend/src/lib/app-launch.ts` | 신규 — `buildAppLaunchUrl()` |
| Frontend | `apps/platform/frontend/src/pages/AppDetailPage.tsx` | 헬퍼 적용 ×2, 스토어에서 `token` 취득 |
| Frontend | `apps/platform/frontend/src/components/SubscriptionCard.tsx` | 헬퍼 적용 ×1, `useAuthStore` 추가 |
| Config | `apps/platform/.env` | 재생성 (git 미포함, 서버 전용) |

## 5. 배포 / Deployment
```
sudo bash platform/scripts/deploy-staging.sh build platform      # Vite + Nest 이미지 재빌드
sudo docker compose --env-file .env -f docker-compose.platform.yml \
     up -d --no-deps --force-recreate web-platform               # ★ web만 교체
```
`deploy-staging.sh restart platform`을 쓰지 않은 이유: 이 compose에는 **`mysql-apps`도 포함**되어 있어 `down`이 MySQL까지 내린다. 그러면 이 DB를 쓰는 다른 4개 앱이 함께 영향을 받는다. 프론트엔드 번들만 바뀌었으므로 `--no-deps --force-recreate web-platform`으로 범위를 최소화했다 (`bff-platform`, `mysql-apps` 무중단 유지 확인).

빌드 전 `tei-hscode` 정지 → 완료 후 재시작 (호스트 RAM 절차, FIX-260812-staging-host-freeze-build-oom).

## 6. 검증 / Verification
번들에 컴파일된 헬퍼(appCode 검사 포함)가 실제로 포함됨:
```
$ docker exec web-platform grep -oE '.{0,60}appCode.{0,150}' /usr/share/nginx/html/assets/index-*.js
 ama_token");if(!t)return null;const n=v2(t);
 if(!(n!=null&&n.appCode)||n.exp&&n.exp*1e3<=Date.now())return null;
 const r=e.replace(/^app-/,"");return n.appCode!==e&&n.appCode!==r?null:t
```

**실제 AMA 토큰으로 앱 측 검증** (access log에서 유효한 앱 스코프 토큰을 추출해 미들웨어 단계만 호출 — 페이지를 렌더하지 않아 `ensureCarUser` upsert가 일어나지 않음):
```
appCode: car-manager-v2 | role: MASTER | 유효

GET /app-car-manager-v2?ama_token=<real AMA token>
→ HTTP/2 307
  location: /app-car-manager-v2
  set-cookie: amb_session=…; Max-Age=3251; Secure; HttpOnly; SameSite=none
```
401이 아니라 307 + 세션 쿠키 — 앱이 실제 AMA 토큰을 받아들인다.

| 항목 | 결과 |
|---|---|
| `/apps/app-car-manager-v2` (카탈로그) | 200 |
| `/` (플랫폼 루트) | 200 |
| `/api/v1/platform/apps/app-car-manager-v2` | 200 |
| `web-platform` | Up (healthy) |
| `bff-platform`, `mysql-apps` | 무중단 (Up 3 hours 유지) |

**최종 확인은 실제 AMA 로그인 필요** — 링크의 `href`는 클라이언트에서 조립되므로 curl로는 확인할 수 없다. 브라우저에서 AMA → 차량관리 v2를 열어 앱 대시보드로 바로 진입하는지 확인해야 한다.

## 7. 재발 방지 패턴 / Prevention
1. **앱을 새로 붙일 때 "실행 링크가 그 앱의 인증 모델과 맞는지" 확인.** 같은 오리진 SPA(localStorage)와 서버 사이드 앱(쿠키 + 쿼리 핸드오프)은 요구사항이 다르다. 카탈로그 링크는 v1 가정에 고정되어 있었다.
2. **자동 로그인 회귀 확인은 access log의 실행 요청 한 줄로 가능**: `GET /<slug>`에 `ama_token`이 붙어 있는지 본다. 없으면 무조건 로그인 페이지로 튕긴다.
3. **compose가 참조하는 `.env`의 실재를 배포 전 점검.** `docker compose config`(부작용 없음) 한 번으로 확인된다. 실행 중 컨테이너가 정상이라는 사실은 재시작 가능성을 보장하지 않는다.
4. **미해결 — 컨테이너 healthcheck가 여전히 신뢰 불가.** v2 앱 healthcheck는 `wget`이 리다이렉트를 추종해 로그인 페이지 200을 받아도 `healthy`로 통과한다. 자동 로그인이 깨진 내내 `healthy`였다.
