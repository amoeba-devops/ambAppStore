# BUG-260601 — 프로덕션 AMA iframe에서 car-manager-v2 차단 (CSP/redirect 빌드타임 박제)

## 1. 증상
- 프로덕션 `ama.amoeba.site` → custom-apps "Quản lý điều xe v2" 클릭 시 **iframe 안에서만 오류**.
- 동일 URL `https://stg-apps.amoeba.site/app-car-manager-v2/dashboard`를 **새 탭**(top-level)으로 열면 정상.
- 즉 임베딩(iframe)일 때만 실패.

## 2. 원인
`apps/app-car-manager-v2/apps/web/next.config.mjs`:
```js
const amaOrigin = process.env.NEXT_PUBLIC_AMA_ORIGIN ?? 'https://*.amoeba.site';
// headers(): frame-ancestors 'self' ${amaOrigin};
```
- 스테이징 Docker 이미지는 **`NEXT_PUBLIC_AMA_ORIGIN=https://stg-ama.amoeba.site`로 빌드**됨 → 앱 자체 CSP = `frame-ancestors 'self' https://stg-ama.amoeba.site;` (빌드타임 박제, `.next/routes-manifest.json`에 고정).
- 스테이징 nginx는 별도로 `frame-ancestors 'self' https://ama.amoeba.site https://stg-ama.amoeba.site` 추가.
- 브라우저는 CSP 헤더가 여러 개면 **교집합(최엄격)** 적용 → 최종 `frame-ancestors`에서 **`ama.amoeba.site` 제외** → 프로덕션 AMA의 iframe 차단.

응답 헤더 증거 (`/app-car-manager-v2/dashboard`):
```
content-security-policy: frame-ancestors 'self' https://stg-ama.amoeba.site;          ← 앱(박제)
content-security-policy: frame-ancestors 'self' https://ama.amoeba.site https://stg-ama.amoeba.site  ← nginx
→ 교집합 = stg-ama만 허용
```

### 2.1 동일 변수의 2차 충돌 (CSP만 고쳐도 남는 문제)
`apps/web/src/app/session-expired/page.tsx:19,40`:
```js
const amaOrigin = process.env.NEXT_PUBLIC_AMA_ORIGIN ?? 'https://ama.amoeba.site';
<a href={amaOrigin}>Open AMA</a>
```
- 같은 `NEXT_PUBLIC_AMA_ORIGIN`이 **세션만료 리다이렉트 대상(단일 구체 origin)** 으로도 사용됨.
- CSP는 "다중 허용 목록", 리다이렉트는 "단일 구체 origin"을 원함 → **와일드카드(`*.amoeba.site`)로 일괄 해결 불가** (리다이렉트가 깨짐).
- 스테이징 이미지(=stg-ama)로는 프로덕션 사용자가 세션 만료 시 **스테이징 AMA로 튕김**.

→ **근본 원인: 빌드타임 인라인(NEXT_PUBLIC_*) 값이 환경(스테이징)에 박제되어, 같은 이미지가 프로덕션 AMA를 서빙할 수 없음.** (안정성 분석의 C2)

## 3. 수정 방안

### 권장 — 프로덕션 전용 빌드/배포
프로덕션 v2를 **prod 환경값으로 빌드**:
- `NEXT_PUBLIC_AMA_ORIGIN=https://ama.amoeba.site` (구체 — CSP·리다이렉트 모두 정상)
- `APP_URL=https://apps.amoeba.site`, `BASE_PATH=/app-car-manager-v2`
- 배포: Render 프로덕션 서비스 (권장) → `apps.amoeba.site/app-car-manager-v2/` nginx 프록시.
- eca_url은 이미 `https://apps.amoeba.site/app-car-manager-v2` (정합).

> 참고: 스테이징·프로덕션 AMA를 **한 이미지**로 동시 지원하려면 §2.1 때문에 코드 변경이 필요
> (CSP용 origin 목록과 redirect용 단일 origin을 **분리된 env**로 — 예: `NEXT_PUBLIC_AMA_FRAME_ORIGINS` vs `NEXT_PUBLIC_AMA_LOGIN_ORIGIN`).
> 단기적으로는 환경별 빌드가 단순·안전.

### 임시 (스테이징 경유 검증 한정, 비권장)
스테이징 nginx `/app-car-manager-v2/`에 `proxy_hide_header Content-Security-Policy;` + 허용 CSP 1개만 → iframe happy-path는 로드되나, 세션만료 리다이렉트는 여전히 stg-ama로 감(§2.1). 카나리아 happy-path 확인용으로만.

## 4. 검증
- prod 빌드 배포 후 `apps.amoeba.site/app-car-manager-v2/dashboard` 응답 CSP에 `https://ama.amoeba.site` 포함 확인.
- 프로덕션 AMA(VN01)에서 custom-apps 클릭 → iframe 로딩 → 세션만료 시 ama.amoeba.site로 복귀 확인.

## 5. 영향 범위
- v2 배포 이미지(빌드 env), `apps.amoeba.site` nginx, (선택) 멀티-AMA 지원 시 v2 소스(env 분리).
- 데이터/스키마 변경 없음.
