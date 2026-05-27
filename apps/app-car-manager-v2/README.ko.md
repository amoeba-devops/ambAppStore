# Company Car Management v2 (CCMS)

> 회사 차량 관리 시스템 — 차량 배차 + 비용 관리.
> Standalone Turborepo · Next.js 15 fullstack · Neon Postgres · S3 · Render.com.

**문서 진입점**: [CLAUDE.md](CLAUDE.md) (프로젝트 컨텍스트, ⭐ 먼저 읽기) · [PRD.md](PRD.md) (비즈니스 스펙 MVP).

> 🌏 한국어 버전입니다. 베트남어 원본은 [README.md](README.md) 참조.

---

## 0. TL;DR (이미 셋업 완료된 경우 실행만)

```bash
cd apps/app-car-manager-v2
npm install               # 1. 설치 (최초, ~1분, 415 packages)
cp .env.example .env      # 2. 템플릿 복사
# → .env 편집: Neon Console에서 DATABASE_URL 붙여넣기 + JWT_SECRET 설정 + DEMO_AUTO_LOGIN=true (dev)
npm run dev:web           # 3. dev 서버 시작 → http://localhost:3001
# → 브라우저 열기: http://localhost:3001/dev-login?role=OWNER
# → 쿠키 자동 설정 + / 로 리다이렉트, DashboardA 표시
```

전체 14개 라우트 사용 가능 (아래 §9 참조).

---

## 1. 최초 셋업

### 1.1 설치

```bash
cd apps/app-car-manager-v2
npm install               # standalone workspace, 루트 ambAppStore workspaces 사용 안 함
```

요구 사항: Node ≥ 20 · npm ≥ 10.

### 1.2 `.env` 구성

```bash
cp .env.example .env
```

dev 실행에 **필수**인 변수:

| 변수 | dev 값 | prod 값 |
|---|---|---|
| `JWT_SECRET` | 빈 값 아닌 임의 문자열 (예: `dev-only-secret-12345`) | ambManagement의 실제 shared secret |
| `DEMO_AUTO_LOGIN` | `true` (`/dev-login`이 fake JWT 발행 가능) | **`false`** (prod에서 반드시 끄기!) |
| `DATABASE_URL` | Neon connection string (§1.3 참조) | Neon staging/main branch |

기타 변수 (기본값 있음, optional):

| 변수 | 기본 | 언제 설정 |
|---|---|---|
| `NEXT_PUBLIC_APP_CODE` | `car-manager-v2` | 메타데이터, 변경 불필요 |
| `NEXT_PUBLIC_AMA_ORIGIN` | `https://ama.amoeba.site` | AMA가 다른 도메인이면 변경 |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `vi` | `en` 또는 `ko`로 locale 변경 |
| `SESSION_COOKIE_NAME` | `amb_session` | AMA의 모든 앱과 공유 |
| `AWS_*` | 빈 값 | P2에서 S3 영수증 업로드 wire-up 시 |

### 1.3 Neon Postgres 셋업

1. 무료 플랜 가입: https://neon.tech
2. 프로젝트 생성 (region `ap-southeast-1` 싱가포르)
3. 물리 DB 이름 = `neondb` (Neon 기본, 변경 불필요 — [CLAUDE.md §4.3](CLAUDE.md) 참조)
4. **pooler 형식** connection string 복사 (Connection details → Pooled connection):
   ```
   postgresql://neondb_owner:<pwd>@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
5. `.env`의 `DATABASE_URL=...`에 붙여넣기

### 1.4 DB 마이그레이션 적용

```bash
npm run db:migrate        # packages/db/migrations/의 모든 마이그레이션을 Neon에 적용
```

현재 다수의 마이그레이션 있음 (`0000_*` 부터 `0009_*`). Idempotent — 여러 번 실행해도 안전.

확인:
```bash
node --env-file=.env -e "import('@neondatabase/serverless').then(async({neon})=>{const r=await neon(process.env.DATABASE_URL)\`SELECT table_name FROM information_schema.tables WHERE table_schema='public'\`;console.log(r)})"
# → expect [{ table_name: 'car_users' }, ...]
```

---

## 2. Dev 실행 (local)

### 2.1 웹 서버 시작

```bash
npm run dev:web                # → http://localhost:3001 (Next.js dev), cron 자동 발사 없음
npm run dev:full               # → web + cron loop 병렬, 1 터미널 (§2.5 참조)
```

포트 **3001** (의도적 — port 3000은 `app-sales-report-v2`가 점유). `.env`는 `dotenv-cli`로 로드하여 Edge middleware가 `JWT_SECRET`을 볼 수 있게 함.

### 2.2 로컬 로그인 (실제 ambManagement 불필요)

`.env`에서 `DEMO_AUTO_LOGIN=true` 활성화 후, 2가지 방법:

**방법 A — CLI에서 URL 발행** (recommended):
```bash
npm run dev:token              # role OWNER (= 로컬 ADMIN), 8시간 유효
npm run dev:token -- MANAGER   # role MANAGER (= 로컬 MANAGER)
npm run dev:token -- MEMBER    # role MEMBER (= 로컬 DRIVER)
```
출력 예:
```
Dev login URL (open in browser, valid 8h):
  http://localhost:3001/?ama_token=eyJhbGc...
```
→ 브라우저에 붙여넣기 → middleware가 JWT 검증 → HttpOnly cookie 설정 → `/` 로 리다이렉트 → DashboardA.

**방법 B — 다이렉트 라우트**:
```
http://localhost:3001/dev-login?role=OWNER
```
쿠키 자동 설정 + `/` 로 리다이렉트. `?next=/trips`로 랜딩 경로 변경.

### 2.3 실행 확인

```bash
curl http://localhost:3001/api/v1/health
# → {"success":true,"data":{"status":"ok","service":"car-manager-staging",...}}
```

### 2.4 UI 언어 변경

URL이 자동으로 `NEXT_PUBLIC_DEFAULT_LOCALE` 사용 (기본 `vi`). 변경하려면 `.env` 편집 → 서버 재시작. 로드맵: P1+에서 UI 안에서 언어 스위처 추가 예정.

### 2.5 maintenance-alert cron loop와 함께 dev 실행

Module 2 (Expense + Maintenance)는 `POST /api/v1/cron/maintenance-alert` 엔드포인트가 staging/prod에서 매일 평가. dev local에서는 3가지 모드:

| 명령 | cron 자동 발사? | 사용 시점 |
|---|---|---|
| `npm run dev:web` | ❌ | **기본** — UI 빠른 반복, cron 호출 없음 |
| `npm run dev:full` | ✅ `CRON_INTERVAL_SECONDS` 주기 (기본 60s) | cron + 알림 end-to-end 테스트 시 |
| `npm run cron:maintenance` | One-shot | 수동 cron 1회 발사 (다른 터미널에서 dev 서버 실행 중) |

`dev:full`은 `concurrently`로 `dev:web` + `dev:cron`을 1 터미널에서 병렬 실행 (output prefix `[web]` cyan, `[cron]` magenta). `.env`에 `CRON_SECRET` 필요:

```bash
echo 'CRON_SECRET=local-dev-cron-secret-change-me' >> .env

# 기본 60s
npm run dev:full

# 빠른 테스트 15s (Bash / WSL / macOS)
CRON_INTERVAL_SECONDS=15 npm run dev:full

# Windows PowerShell
$env:CRON_INTERVAL_SECONDS="15"; npm run dev:full
```

`dev-cron-loop.mjs`는 첫 발사 전에 `/api/v1/health`가 200을 반환할 때까지 poll (Next.js 컴파일 중 404 방지). Ctrl+C로 두 프로세스 모두 종료.

24h Idempotency 적용 → 각 차량은 24h 윈도우 안에 type 당 alert 1개만 생성. 재테스트하려면 alert 초기화:

```sql
UPDATE car_maintenance_alerts SET mal_resolved_at = NOW() WHERE mal_resolved_at IS NULL;
```

---

## 3. 데이터베이스 마이그레이션

### 3.1 Multi-branch 셋업 (DEV + STAGING)

`.env`에 3개의 URL key 포함:
- `DATABASE_URL` — 현재 로컬 앱이 사용 중인 branch (dev 서버 읽음)
- `DATABASE_URL_DEV` — dev branch 고정 포인터
- `DATABASE_URL_STAGING` — staging branch 고정 포인터

3개 명령으로 각 branch 타겟:

```bash
npm run db:migrate              # DATABASE_URL 사용 (active branch — 보통 dev)
npm run db:migrate:dev          # DATABASE_URL_DEV 강제
npm run db:migrate:staging      # DATABASE_URL_STAGING 강제
```

`db:migrate:dev|staging`은 child process에서 `DATABASE_URL` 오버라이드 (in-memory), 디스크의 `.env`는 변경하지 않음. 비밀번호는 로그에서 마스킹.

### 3.2 새 테이블 / 컬럼 추가 워크플로우

```bash
# 1. schema 파일 편집/추가
#    packages/db/src/schema/<table>.schema.ts
#    packages/db/src/schema/index.ts에 export

# 2. 마이그레이션 SQL 생성
npm run db:generate
# → packages/db/migrations/NNNN_<name>.sql 생성 (drizzle 자동 명명)

# 3. 적용 전 SQL 리뷰
cat packages/db/migrations/NNNN_*.sql

# 4. dev branch에 적용 (local 테스트)
npm run db:migrate:dev

# 5. PR 리뷰 통과 후 → merge 전 staging에 적용
npm run db:migrate:staging

# 6. migration 파일 + push 커밋 → Render이 올바른 staging schema로 자동 배포
git add packages/db/migrations/ packages/db/src/schema/
git commit -m "feat: add car_vehicles schema"
git push origin main
```

### 3.2 Drizzle Studio (DB 검사 web UI)

```bash
npm run db:studio              # → https://local.drizzle.studio (proxy)
```

### 3.3 ⚠️ `db:push` (파괴적 — dev branch에서만)

```bash
npm run db:push                # interactive — schema 직접 push, migration 파일 미생성
```
migration history 유지를 위해 `db:generate + db:migrate` 권장.

### 3.4 Neon dev branch 리셋

Neon Console → Branches → `dev` → Reset from parent. 이후:
```bash
npm run db:migrate             # 모든 마이그레이션 처음부터 재적용
```

---

## 4. Build · typecheck · lint · test

```bash
npm run typecheck              # 4 workspaces에 대해 tsc --noEmit (turbo cache)
npm run build                  # next build (production output)
npm run lint                   # ESLint (next/core-web-vitals)
npm run format                 # Prettier write
npm run test                   # Vitest (P6 — 아직 테스트 파일 없음)
```

E2E 테스트 (Playwright):

```bash
cd apps/web
npm run test:e2e               # full E2E suite (~4분, 80개 테스트)
npm run test:e2e:ui            # 인터랙티브 디버그 UI
```

---

## 5. Render.com 배포

### 5.1 최초 프로비저닝

1. Render 계정 생성 → GitHub repo 연결
2. Dashboard → **New** → **Blueprint** → repo + branch 선택 (staging은 `main`)
3. Render이 `apps/app-car-manager-v2/render.yaml` 자동 인식 → 프로비전:
   - `car-manager-staging` (Web Service, **Starter** plan $7/mo)
4. **서비스 진입** → **Environment** 탭 → `sync: false` 변수 설정:

| 변수 | 값 |
|---|---|
| `JWT_SECRET` | ambManagement의 실제 secret (byte-for-byte 일치) |
| `DATABASE_URL` | Neon `staging` branch connection string |
| `NEXT_PUBLIC_AMA_ORIGIN` | `https://ama.amoeba.site` |
| `DEMO_AUTO_LOGIN` | ⚠️ **`false`** (prod에서 절대 `true` 금지) |
| `AWS_REGION` | `ap-southeast-1` (P2+) |
| `AWS_S3_BUCKET` | bucket 이름 (P2+) |
| `AWS_ACCESS_KEY_ID` | IAM key (P2+) |
| `AWS_SECRET_ACCESS_KEY` | IAM secret (P2+) |

5. **Manual Deploy** 클릭 → 빌드 ~3-5분 대기
6. 확인: `curl https://car-manager-staging.onrender.com/api/v1/health`

### 5.2 후속 배포

```bash
git push origin main           # → Render auto-build + deploy ~3분
```

main branch에 push (CI/CD 패턴 확정). Render이 push 시 자동 재빌드.

### 5.3 prod DB에 마이그레이션 적용

```bash
# 방법 1 (권장): named script 사용 — local에서 .env에 DATABASE_URL_STAGING 있을 때
npm run db:migrate:staging

# 방법 2: prod main branch URL로 One-off
DATABASE_URL=postgresql://...@main-branch... npm run db:migrate

# 방법 3: Render service shell (env에 DATABASE_URL이 staging으로 설정됨)
# Dashboard → car-manager-staging → Shell → npm run db:migrate
```

### 5.4 Rollback

Dashboard → service → **Deploys** 탭 → 이전 빌드의 **Rollback** 클릭.

### 5.5 Logs

Dashboard → service → **Logs** 탭 (live tail).

### 5.6 Custom domain

Dashboard → service → **Settings** 탭 → **Custom Domains** → 도메인 추가 → DNS CNAME을 `car-manager-staging.onrender.com`로 업데이트. 필요 시 `NEXT_PUBLIC_AMA_ORIGIN`을 새 도메인에 맞게 업데이트.

---

## 6. Maintenance-alert cron — 3개 환경

`POST /api/v1/cron/maintenance-alert`은 tenant별로 전체 차량을 스캔하여 OIL/INSPECTION alert 생성 + Admin/Manager에게 fan-out notification. `Authorization: Bearer $CRON_SECRET`로 인증. 24h Idempotency (차량 1개 + type 1개 → 24h 당 alert 1개).

### 6.1 요약 테이블

| 환경 | 트리거 방법 | 스케줄 | 상태 |
|---|---|---|---|
| **Local dev (수동)** | `npm run cron:maintenance` | On-demand | ✅ Ready |
| **Local dev (auto-loop)** | `npm run dev:full` (§2.5 참조) | `CRON_INTERVAL_SECONDS` (기본 60s) | ✅ Ready |
| **Staging Docker** (베트남 서버) | [docker-compose](docker-compose.app-car-manager-v2.yml)의 Sidecar `cron-maintenance-v2` | `0 6 * * *` ICT (매일 06:00) | ✅ Ready, `deploy-staging.sh`로 자동 배포 |
| **Render.com (optional)** | [render.yaml](render.yaml)의 Stub (comment 처리됨) | `0 23 * * *` UTC = 06:00 ICT | ⏸️ REQ-20260519 D9에 따라 보류 |

### 6.2 Docker sidecar (staging 베트남 서버)

[docker-compose.app-car-manager-v2.yml](docker-compose.app-car-manager-v2.yml)의 `cron-maintenance-v2` 서비스는 `alpine:3.20` + `crond` 사용. nginx 거치지 않고 Docker 내부 DNS로 메인 컨테이너 호출.

**최초 배포**:

```bash
# 1. staging에 SSH, .env에 CRON_SECRET 설정
ssh ambAppStore@stg-apps.amoeba.site
cd ~/ambAppStore/apps/app-car-manager-v2
openssl rand -hex 32                                                # → output 복사
echo "CRON_SECRET=<paste-secret>" >> .env
echo "EXPENSE_LOCK_DAYS=7" >> .env
exit

# 2. 배포 (스크립트가 cron-maintenance-v2 서비스 자동 pickup)
ssh ambAppStore@stg-apps.amoeba.site \
  "cd ~/ambAppStore && git pull origin main && bash platform/scripts/deploy-staging.sh full car-manager-v2"
```

**staging 확인**:

```bash
ssh ambAppStore@stg-apps.amoeba.site << 'EOF'
cd ~/ambAppStore/apps/app-car-manager-v2
docker compose -f docker-compose.app-car-manager-v2.yml ps cron-maintenance-v2
docker logs cron-maintenance-v2 --tail 20            # boot log: "ready · schedule: 06:00 daily"
docker exec cron-maintenance-v2 cat /etc/crontabs/root
# 수동 발사 (06:00 대기 불필요)
docker exec cron-maintenance-v2 /usr/local/bin/run-cron
EOF
```

**운영**:

```bash
docker logs -f cron-maintenance-v2                                                       # tail log
docker exec cron-maintenance-v2 /usr/local/bin/run-cron                                  # 수동 발사
docker compose -f docker-compose.app-car-manager-v2.yml restart cron-maintenance-v2      # sidecar만 재시작
docker compose -f docker-compose.app-car-manager-v2.yml stop cron-maintenance-v2         # 일시 중지 (앱 유지)
```

### 6.3 Render.com cron (보류)

[render.yaml](render.yaml)의 `type: cron` 블록은 REQ-20260519 결정 D9에 따라 현재 주석 처리됨 — staging 안정성 확인 후에만 enable. 준비되면:

1. `render.yaml`의 블록 주석 해제
2. Render dashboard → cron service → env `CRON_SECRET` 설정 (web service와 동일 값)
3. Push → Render이 cron job 배포

---

## 7. ambManagement 연동

### 7.1 AMA에 앱 등록

ambManagement → Admin → Custom Apps → record 삽입 (또는 SQL):
```sql
INSERT INTO amb_entity_custom_apps (eca_code, eca_url, eca_auth_mode, eca_open_mode, eca_name)
VALUES ('car-manager-v2', 'https://<render-domain>', 'jwt', 'iframe', 'Company Car Management');
```

### 7.2 shared JWT_SECRET 구성

ambManagement (issuer)와 car-manager-v2 (verifier) 모두 **동일한 `JWT_SECRET`** 사용 (HS256, byte-for-byte). 두 시스템에서 동시에 `JWT_SECRET` 변경.

### 7.3 AMA가 발행해야 하는 JWT payload

```json
{
  "sub": "<uuid-user>",
  "ent_id": "<uuid-entity>",
  "role": "OWNER | MASTER | MANAGER | MEMBER",
  "email": "...",
  "name": "...",
  "app_code": "car-manager-v2",
  "iss": "amb-management",
  "aud": "car-manager-v2"
}
```

### 7.4 AMA 리다이렉트 / iframe URL

```
https://<car-manager-v2-domain>/?ama_token=<JWT>
```
또는 `<iframe src="...">`. Middleware가 자동 검증 → HttpOnly cookie `amb_session` 설정 → clean URL로 리다이렉트 → 이후 모든 요청에 쿠키 사용.

자세히: [CLAUDE.md §5](CLAUDE.md).

### 7.5 Email login (Wave 3, 2026-05-27)

이메일 기반 로그인은 다음 AMA 엔드포인트를 필요로 함:
- `POST /auth/email-login` — passwordless email + entity_code로 로그인
- `POST /entity-settings/members/email-add` — admin이 새 user 즉시 생성

자세히: [docs/integration/AMA-DEPENDENCIES.md](docs/integration/AMA-DEPENDENCIES.md).

---

## 8. Repository 구조

```
apps/app-car-manager-v2/
├── CLAUDE.md, README.md, README.ko.md, PRD.md   # entry docs (CLAUDE 먼저 읽기)
├── package.json, turbo.json                     # workspace config
├── tsconfig.base.json
├── .env, .env.example                           # env (gitignored), 템플릿
├── render.yaml                                  # Render Blueprint (1 web service)
│
├── apps/
│   └── web/                                     # Next.js 15 fullstack
│       ├── src/
│       │   ├── app/                             # 14개 라우트 (§9 참조)
│       │   ├── components/                      # primitives + layout shells
│       │   ├── i18n/                            # next-intl 설정
│       │   ├── lib/                             # auth + request helpers
│       │   └── middleware.ts                    # JWT passthrough + onboarding gate
│       ├── messages/                            # en/vi/ko.json
│       └── e2e/                                 # Playwright 테스트
│
├── packages/
│   ├── db/                                      # Drizzle schema + migrations
│   │   ├── src/schema/                          # car_users.schema.ts + 기타 테이블
│   │   └── migrations/                          # 0000_new_earthquake.sql ...
│   ├── shared/                                  # Zod + AmaJwtClaims + CarError
│   └── ui/                                      # cn() Tailwind util
│
├── scripts/
│   └── dev-token.mjs                            # CLI mint dev JWT
│
├── resources/                                   # gitignored — design reference
│   └── claude-design/                           # Claude Design export bundle
│
└── docs/                                        # workflow docs
    ├── analysis/                                # REQ-YYYYMMDD-*
    ├── plan/                                    # PLAN-YYYYMMDD-*
    ├── test/                                    # TC-*, TR-*, STATUS-*
    ├── implementation/                          # RPT-*
    ├── integration/                             # AMA-DEPENDENCIES.md
    └── log/                                     # 일일 로그 (gitignored)
```

---

## 9. 사용 가능한 라우트

| 라우트 | Phase | 설명 |
|---|---|---|
| `/` | ✅ P0 | Root redirect (role 기반 → `/dashboard` 또는 `/today`) |
| `/onboarding` | ✅ Wave 2 | 최초 admin/manager가 AMA에서 user 동기화 |
| `/dashboard` | ✅ P0 | DashboardA (Operations overview) |
| `/today` | ✅ P5 | Driver PWA shell (오늘의 운행 카드) |
| `/trips` · `/trips/new` · `/trips/[id]` · `/trips/[id]/edit` | ✅ P1 | Trip CRUD + state machine |
| `/drivers` · `/drivers/new` · `/drivers/[id]` · `/drivers/[id]/edit` | ✅ P1 | Driver CRUD (Wave 1: inline user 생성 제거, 기존 user 선택) |
| `/vehicles` · `/vehicles/new` · `/vehicles/[id]` · `/vehicles/[id]/edit` | ✅ P1 | Vehicle CRUD |
| `/users` · `/users/new` · `/users/[userId]/edit` | ✅ P1 + Wave 2/3 | User & roles (Wave 2: local DB 읽기, Wave 3: email login) |
| `/expenses` · `/expenses/new` · `/expenses/[id]` | ✅ P2 | 비용 + 첨부 갤러리 |
| `/costs` | ✅ P2 | 차량별 비용 집계 |
| `/reports` | ✅ P3 | 리포트 + export |
| `/settings` · `/settings/me` | ✅ P1 | Tenant settings + 본인 프로필 |
| `/audit` | ✅ P1 | Audit log (ADMIN 전용) |
| `/inbox` | ✅ P4 | In-app notification stream |
| `/api/v1/health` | ✅ P0 | Health check (public) |
| `/login` · `/session-expired` | ✅ P0 | 공개 인증 페이지 |
| `/dev-login` | ✅ P0 | Local 전용 dev JWT minter (`DEMO_AUTO_LOGIN=true` 게이트) |

사이드바 nav active state는 `usePathname()`에서 자동 derive — 라우트 클릭 시 active highlight 정확히 이동.

---

## 10. Troubleshooting

| 증상 | 원인 | 해결 |
|---|---|---|
| `EADDRINUSE :::3001` | 이전 서버가 kill되지 않음 | Windows: `Get-NetTCPConnection -LocalPort 3001 -State Listen \| ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }` · Mac/Linux: `lsof -ti:3001 \| xargs kill -9` |
| `/dev-login`이 404 반환 | `DEMO_AUTO_LOGIN ≠ 'true'` | `.env` → `DEMO_AUTO_LOGIN=true` 편집 → **dev 서버 kill + 재시작** (env는 부팅 시 1회만 로드) |
| `?ama_token=` 붙여넣기 시 `401 Unauthorized` | JWT verify 실패 (secret 불일치 / 만료 / app_code mismatch) | `npm run dev:token`으로 재발행; minter와 verifier의 `JWT_SECRET` 동일 값 확인 |
| 로그인 직후 `307 → /session-expired` | Cookie가 stick 안 함 (iframe / cross-domain의 sameSite/secure mismatch) | Local: middleware가 자동 `sameSite=lax`; prod은 HTTPS + `sameSite=none` 필요 |
| **사이드바 클릭 시 `/session-expired`로 반복 리다이렉트** | sibling v2 앱 (예: sales-report-v2 port 3000)의 `amb_session` cookie 혼입 → Zod parse 시 `app_code` mismatch | Middleware가 bad cookie 자동 삭제 (fix 완료). `/session-expired` → "Sign in as ADMIN" 클릭하여 새 쿠키 발행. 또는 수동: DevTools → Application → Cookies → `localhost`의 `amb_session` 삭제 |
| `JWT_SECRET is required` | `.env` 미로드 | `apps/web/package.json`의 dev script에 `dotenv -e ../../.env --` prefix 확인 |
| `DATABASE_URL is required for drizzle-kit` | `db:*` 실행 시 `.env` 미로드 | root `app-car-manager-v2/`에서 실행 (script가 `dotenv -e ../../.env --` 사용) |
| `cannot find module @car-v2/db` | Workspace symlink 미생성 | `npm install` 다시 실행 (clone 후 최초) |
| `Pretendard font 표시 안 됨` | CDN 차단 | Network tab 확인 → jsdelivr.net 200 OK · 대안: 로컬 폰트 번들 |
| navigate 시 active sidebar 미업데이트 | `<Link>`가 Client Component 재렌더 안 함 | 페이지 새로고침; 여전히 오류면 `nav-list.tsx`의 `usePathname()` 확인 |

---

## 11. Quick reference — npm scripts

```bash
# Dev workflow
npm run dev:web              # Next.js dev 시작 → http://localhost:3001 (cron 자동 없음)
npm run dev:cron             # cron loop only (다른 터미널에서 dev:web 필요)
npm run dev:full             # web + cron 병렬, 1 터미널 (§2.5 참조)
npm run dev:token            # dev JWT URL 발행
npm run dev:token -- MANAGER # role variant

# Cron (Module 2 maintenance-alert)
npm run cron:maintenance     # 수동 one-shot trigger (env에서 CRON_SECRET + TARGET_URL 읽기)
                             # → 기본 http://localhost:3001
                             # → staging override: TARGET_URL=https://... CRON_SECRET=... npm run cron:maintenance

# Build
npm run typecheck            # tsc --noEmit (turbo cached)
npm run build                # next build (production)
npm run lint                 # ESLint
npm run format               # Prettier write

# DB
npm run db:generate          # Drizzle: schema → migration SQL
npm run db:migrate           # active DATABASE_URL에 적용
npm run db:migrate:dev       # DATABASE_URL_DEV에 적용 (explicit)
npm run db:migrate:staging   # DATABASE_URL_STAGING에 적용 (explicit)
npm run db:push              # ⚠️ destructive direct push (dev only)
npm run db:studio            # DB 검사 web UI (active DATABASE_URL 사용)

# E2E 테스트
npm run test:e2e             # Playwright (apps/web에서 실행)
npm run test:e2e:ui          # 인터랙티브 UI 모드

# Cleanup
npm run clean                # node_modules + .turbo 제거
```

---

## 12. 참고

- [CLAUDE.md](CLAUDE.md) — ⭐ Claude Code용 프로젝트 컨텍스트 (먼저 읽기)
- [PRD.md](PRD.md) — MVP source of truth (비즈니스 스펙)
- [docs/analysis/REQ-20260512-prd-srs-audit.md](docs/analysis/REQ-20260512-prd-srs-audit.md) — PRD ↔ SRS ↔ Prototype divergence audit
- [docs/integration/AMA-DEPENDENCIES.md](docs/integration/AMA-DEPENDENCIES.md) — Wave 3 AMA 엔드포인트 의존성
- [docs/test/STATUS-20260527-comprehensive.md](docs/test/STATUS-20260527-comprehensive.md) — 최신 E2E + requirement 상태
- [resources/claude-design/](resources/claude-design/) — design reference (gitignored, 48 MB)
- Root [CLAUDE.md](../../CLAUDE.md) — `ambAppStore` monorepo conventions
- Sibling [apps/app-sales-report-v2/](../app-sales-report-v2/) — template stack reference
