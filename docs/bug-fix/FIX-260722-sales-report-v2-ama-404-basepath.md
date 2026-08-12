# FIX-260722 — app-sales-report-v2 AMA 연동 시 404 "This page could not be found"

- **날짜 / Date**: 2026-07-22
- **앱 / App**: app-sales-report-v2 (`/app-sales-report-v2`)
- **환경 / Env**: apps.amoeba.site (ec2-user 박스, 호스트 nginx + Docker 컨테이너)
- **컨테이너 / Container**: `next-sales-report-v2` (host 3106 → container 3001)

## 1. 증상 / Symptom
AMA에서 매출리포트 v2 앱을 열면 Next.js 기본 오류 페이지 **"404 — This page could not be found."** 표시.
(과거 메모의 "Session expired" 증상과 다른 별개 이슈 — 런타임 config 버그.)

## 2. 원인 분석 / Root Cause
런타임에 `BASE_PATH` 환경변수가 누락되어 앱이 **basePath 없이(root)** 구동됨.

근거 체인:
1. `Dockerfile`에서 `ENV BASE_PATH=/app-sales-report-v2`가 **builder 스테이지에만** 존재(49행). ENV는 멀티스테이지 경계를 넘지 못하므로 **runner 스테이지엔 없음**. `.env`/compose도 런타임에 미주입.
2. `apps/web/next.config.mjs`는 `next start`가 **런타임에 재평가** (파일 주석에 명시). `const basePath = process.env.BASE_PATH || undefined` → 런타임 `BASE_PATH` 없음 → **basePath = undefined**.
   - 증명: `docker exec next-sales-report-v2 node -e import(next.config.mjs)` → `basePath = undefined`; `-e BASE_PATH=…` 주입 시 → `"/app-sales-report-v2"`.
   - 빌드 산출물 `.next/routes-manifest.json`엔 `"basePath":"/app-sales-report-v2"`가 구워져 있으나, 런타임 config가 이를 덮어써 root로 서빙됨.
3. 결과: 앱은 root에서 서빙 (`/api/v1/health` 200, `/session-expired` 200) 하지만 **nginx는 `/app-sales-report-v2/` prefix를 그대로 전달**(strip 안 함). → 컨테이너가 prefixed 경로를 인식 못 함 → 미들웨어 진입 → 세션 쿠키 없음 → 리다이렉트.
4. 미들웨어 `absoluteUrl(req, '/session-expired')`도 `process.env.BASE_PATH`(빈 값)를 읽어 → 리다이렉트 타겟이 `https://apps.amoeba.site/session-expired` (**prefix 누락**) → **플랫폼 SPA**로 착지 → 해당 라우트 없음 → "This page could not be found."

부가: 컨테이너 healthcheck(`wget`)는 307을 따라 플랫폼 200 SPA를 받아 통과 → **false positive "healthy"**.

## 3. 수정 내용 / Fix
런타임에 `BASE_PATH=/app-sales-report-v2` 주입.

- **`apps/app-sales-report-v2/.env`** (즉시 반영, 재빌드 불필요 — 이미 구운 `.next` basePath와 일치):
  ```
  BASE_PATH=/app-sales-report-v2
  ```
- **`apps/app-sales-report-v2/Dockerfile`** runner 스테이지에 `ENV BASE_PATH=/app-sales-report-v2` 추가 (이미지 자기완결성 — 향후 재빌드 시 `.env` 없어도 정상).
- 배포: `sudo bash platform/scripts/deploy-staging.sh restart sales-report-v2` (down→up, `--env-file .env` 재적용). **재빌드 안 함.**

## 4. 변경 파일 목록 / Changed Files
| 구분 | 파일 | 변경 |
|------|------|------|
| Config (runtime) | `apps/app-sales-report-v2/.env` | `BASE_PATH` 추가 (git 미포함) |
| Docker | `apps/app-sales-report-v2/Dockerfile` | runner 스테이지 `ENV BASE_PATH` 추가 |

## 5. 검증 / Verification (public HTTPS)
| 경로 | 수정 전 | 수정 후 |
|------|--------|--------|
| `/app-sales-report-v2/api/v1/health` | 307→404 | **200** |
| `/app-sales-report-v2/session-expired` | 307→404 | **200** (로그인 페이지 렌더) |
| `/app-sales-report-v2/dashboard` (무쿠키) 리다이렉트 타겟 | `…/session-expired` (pl=SPA 404) | `…/app-sales-report-v2/session-expired` |
| `/api/v1/health` (무 prefix) | 200(오답) | 404(정상) |
| 컨테이너 health | false-positive | **true healthy** |

## 6. 재발 방지 / Prevention
- basePath 앱은 `BASE_PATH`를 **빌드+런타임 양쪽** 제공해야 함 (`next start`가 config 재평가하므로). 빌드 ARG만으론 불충분.
- 미들웨어 리다이렉트는 `absoluteUrl()`(env 의존) 대신 `req.nextUrl.clone()`(basePath 자동 보존, ama_token 경로에서 이미 사용) 패턴이 더 견고 — 향후 리팩터 후보.

## 7. 남은 이슈 / Remaining (별개)
- **AMA 앱 등록**: `amb_entity_custom_apps`에 FIRGI 엔티티 row 필요. 미등록이면 AMA가 `?ama_token=`을 안 붙여 열어 세션 쿠키 미설정 → session-expired 페이지 도달(이제 404 아님). 참조 메모 `sales-report-v2-session-expired`.
- **쿠키 이름 충돌 가능성**: `.env` `SESSION_COOKIE_NAME=amb_session` — 동일 오리진(apps.amoeba.site)의 car-manager-v2와 동일. app_code 불일치 시 verify 실패 루프 우려. 필요 시 `amb_session_sales`로 분리 검토.
