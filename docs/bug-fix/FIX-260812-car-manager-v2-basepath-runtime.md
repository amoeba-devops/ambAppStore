# FIX-260812 — app-car-manager-v2 basePath 런타임 누락 (nginx prefix → /login 리다이렉트)

- **날짜 / Date**: 2026-08-12
- **앱 / App**: app-car-manager-v2 (`/app-car-manager-v2`)
- **환경 / Env**: apps.amoeba.site (ec2-user 박스, 호스트 nginx + Docker 컨테이너)
- **컨테이너 / Container**: `next-car-manager-v2` (host 3105 → container 3001)
- **관련 / Related**: [FIX-260722-sales-report-v2-ama-404-basepath.md](FIX-260722-sales-report-v2-ama-404-basepath.md) — **동일 원인의 형제 앱 이슈**. 당시 sales-report-v2만 수정하고 car-manager-v2는 누락됨.

## 1. 증상 / Symptom
nginx prefix 경로로 접근하면 앱이 응답하지 않고 `/login`(플랫폼 SPA 루트)으로 리다이렉트됨.

| 경로 | 수정 전 |
|------|--------|
| `localhost:3105/api/v1/health` (prefix 없음) | **200** JSON ← 앱이 root에서 서빙 중 |
| `localhost:3105/app-car-manager-v2/api/v1/health` | **307** → `/login` |
| `https://apps.amoeba.site/app-car-manager-v2/` | **308** → `/app-car-manager-v2` (진행 불가) |

컨테이너 healthcheck는 `healthy`로 표시됨 → **false positive**(§6 참고).

## 2. 원인 분석 / Root Cause
런타임에 `BASE_PATH`가 빈 값이어서 앱이 **basePath 없이(root)** 구동됨.

근거 체인:
1. `apps/app-car-manager-v2/.env:51`이 `BASE_PATH=` (**빈 값**). 해당 주석에 "set in docker-compose build args, **NOT .env**"라고 적혀 있었음 — 이 서술이 버그의 직접 원인.
2. `docker-compose.app-car-manager-v2.yml`의 `build.args.BASE_PATH: /app-car-manager-v2`는 **빌드 시점 전용**. Dockerfile에서도 `ENV BASE_PATH`가 **builder 스테이지에만** 존재 → ENV는 멀티스테이지 경계를 넘지 못하므로 runner 스테이지엔 없음.
3. `apps/web/next.config.mjs:26` `const basePath = process.env.BASE_PATH || undefined` 는 `next start`가 **런타임에 재평가** → 런타임 값 없음 → `basePath = undefined` → 앱이 root에서 서빙.
   - 증명: `docker exec next-car-manager-v2 sh -c 'echo $BASE_PATH'` → `[]` (빈 값).
4. 라이브 nginx(`/etc/nginx/conf.d/apps.amoeba.site.conf:60`)는 `proxy_pass http://127.0.0.1:3105;` — **URI 부분이 없어 prefix를 그대로 전달**(strip 안 함). 컨테이너는 `/app-car-manager-v2/...`를 받지만 매칭되는 라우트가 없음.
5. `middleware.ts:136` `PUBLIC_PATHS.some(p => pathname.startsWith(p))`에서 `PUBLIC_PATHS`는 `/api/v1/health`(prefix 없는 형태)를 담고 있으나, basePath가 비활성이라 `pathname`은 `/app-car-manager-v2/api/v1/health` 그대로 → **매칭 실패** → 인증 분기 진입 → 세션 쿠키 없음 → `/login` 리다이렉트.

### 추가 함정 / Additional pitfall (sales-report-v2 때는 드러나지 않았던 점)
compose의 `env_file: ./.env`는 **이미지 자체 ENV를 덮어쓴다.** 따라서 Dockerfile runner 스테이지에 `ENV BASE_PATH`를 넣어도 `.env`에 `BASE_PATH=`(빈 값)가 남아 있으면 **다시 빈 값으로 덮여 재발**한다. 두 곳을 모두 채워야 함.

## 3. 수정 내용 / Fix
런타임에 `BASE_PATH=/app-car-manager-v2` 주입. **재빌드 불필요** — 이미 구워진 `.next` 번들이 동일 basePath로 빌드되어 있어(compose build arg 하드코딩) 런타임 config만 맞추면 정합됨.

- **`apps/app-car-manager-v2/.env`** (즉시 반영):
  ```
  BASE_PATH=/app-car-manager-v2
  NEXT_PUBLIC_BASE_PATH=/app-car-manager-v2
  ```
  잘못된 주석("build args, NOT .env")을 **정정** + 경고 주석 추가.
- **`apps/app-car-manager-v2/Dockerfile`** runner 스테이지에 `ENV BASE_PATH=/app-car-manager-v2` 추가 (이미지 자기완결성 — 다른 호스트에서 `.env` 없이 띄울 때 대비). `.env` 우선순위 함정도 주석에 명시.
- 배포: `sudo bash platform/scripts/deploy-staging.sh restart car-manager-v2` (down→up으로 `--env-file .env` 재적용). **재빌드 안 함.**

## 4. 변경 파일 목록 / Changed Files
| 구분 | 파일 | 변경 |
|------|------|------|
| Config (runtime) | `apps/app-car-manager-v2/.env` | `BASE_PATH`, `NEXT_PUBLIC_BASE_PATH` 값 채움 + 주석 정정 (git 미포함) |
| Docker | `apps/app-car-manager-v2/Dockerfile` | runner 스테이지 `ENV BASE_PATH` 추가 |

백업: `.env.bak.20260812-072*` (수정 직전 스냅샷)

## 5. 검증 / Verification
```
docker exec next-car-manager-v2 → BASE_PATH=[/app-car-manager-v2]  NEXT_PUBLIC_BASE_PATH=[/app-car-manager-v2]
```

| 경로 | 수정 전 | 수정 후 |
|------|--------|--------|
| `localhost:3105/app-car-manager-v2/api/v1/health` | 307 → `/login` | **200** `{"success":true,"data":{"status":"ok","service":"car-manager-v2-web"}}` |
| `https://apps.amoeba.site/app-car-manager-v2/api/v1/health` (nginx) | 307 | **200** JSON |
| `https://apps.amoeba.site/app-car-manager-v2/` (chain) | 308 → 막힘 | 308 → 307 → `/app-car-manager-v2/login` → **200** HTML |
| `/app-car-manager-v2/_next/static/chunks/webpack-*.js` | — | **200** (asset prefix 정합) |
| `localhost:3105/api/v1/health` (prefix 없음) | 200 ← 비정상 | **404** ← basePath 활성 증거 |

컨테이너 상태: `Up (healthy)`, image `4ef58fe7f883`.

## 6. 재발 방지 패턴 / Prevention
1. **빌드 시 주입한 환경변수는 런타임에도 있는지 반드시 확인.** `next start`는 `next.config.mjs`를 재평가한다. 확인 명령: `docker exec <container> sh -c 'echo $BASE_PATH'`.
2. **compose `env_file` > 이미지 `ENV`.** `.env`에 빈 값으로 존재하는 키는 이미지 기본값을 무력화한다. 빈 값으로 두려면 키 자체를 지워야 한다.
3. **형제 앱 동시 점검.** v2 앱들(car-manager-v2, sales-report-v2)은 동일 토폴로지 — 한쪽에서 발견한 런타임 config 버그는 반대쪽도 즉시 확인할 것. 이 이슈는 그 확인을 빠뜨려 21일간 잔존했다.
4. **healthcheck를 신뢰하지 말 것 (미해결).** `docker-compose.app-car-manager-v2.yml`의 healthcheck는 `wget -qO-`가 **리다이렉트를 자동 추종**하므로, 307 → 플랫폼 `/login` 200을 받아 `healthy`로 통과한다. basePath가 깨진 상태에서도 계속 `healthy`였다. 개선안: `wget --max-redirect=0` 사용, 또는 응답 본문에 `"status":"ok"` 포함 여부를 grep. **본 수정에는 미포함 — 별도 판단 필요.**
