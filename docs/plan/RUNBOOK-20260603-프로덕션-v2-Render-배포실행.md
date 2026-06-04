# RUNBOOK-20260603 — 프로덕션 v2 배포 실행 체크리스트 (Render prod + nginx 프록시)

> 상위 계획: [PLAN-20260601-프로덕션-v2-Render-안정배포.md](PLAN-20260601-프로덕션-v2-Render-안정배포.md)
> 관련 버그: [BUG-260601-prod-AMA-iframe-CSP-차단.md](../bug-fix/BUG-260601-prod-AMA-iframe-CSP-%EC%B0%A8%EB%8B%A8.md)
>
> 목적: `apps.amoeba.site/app-car-manager-v2/`를 **Render prod 서비스 + nginx 프록시 1개**로 안정 제공한다.
> 작성 시점 현황(2026-06-03 확인): apps.amoeba.site 루트·v2 경로 모두 **404**, Render에 **prod 서비스 미존재**(render.yaml = staging 1개뿐).
>
> ⚠️ 실제 프로덕션 변경은 §6 게이트 전부 통과 + 승인 후에만 진행. 스테이징 그린 구성만 prod 반영.

---

## 0. 배포 차트 (의존성 / 실행 주체)

```
[G] 게이트 점검(§6)            ← prod 서버 SSH(읽기) + Render/Neon 대시보드
     │ 전부 통과해야 진행
     ▼
[1] Neon prod 브랜치 생성       ← Neon 대시보드 (사용자)        ──┐
[2] Render prod 서비스 생성     ← Render 대시보드 (사용자)        │ 병렬 가능
     │  prod env 12종 설정(§3)                                   │
     ▼                                                          │
[3] Render 첫 빌드 → 헬스 확인   ← git push + 수동 deploy          │
     │  https://<prod-host>.onrender.com/app-car-manager-v2/api/v1/health
     ▼                                                          │
[4] prod Neon 마이그레이션      ← npm run db:migrate (prod URL) ◄─┘ (Claude 가능, URL 받으면)
     ▼
[5] nginx 프록시 location 추가  ← prod 서버 SSH + sudo (승인 필요)
     │  apps.amoeba.site.prod.conf 의 <V2_PROD_RENDER_HOST> 채움 → 교체 → nginx -t → reload
     ▼
[6] 검증: apps.amoeba.site/app-car-manager-v2/api/v1/health → {success:true}
     ▼
[7] AMA Postgres 시드 (단계적)  ← AMA PG 접근 (사용자/Claude)
     │  Step 7a: DEMO 1개만 → 로그인·iframe·CSP 검증
     │  Step 7b: 검증 OK → CARGO434/UIT327/VN01 나머지 3개
     ▼
[8] 운영 안정화 + 롤백 절차 확인(§7)
```

| 단계 | 실행 주체 | Claude 단독 가능? | 막는 것 |
|---|---|---|---|
| G 게이트 | 사용자+Claude | △ | prod SSH 명시 승인, Render/Neon 대시보드 |
| 1 Neon prod | 사용자 | ❌ | Neon 자격증명 |
| 2 Render prod 생성 | 사용자 | ❌ | Render 자격증명 |
| 3 빌드/헬스 | 사용자 | ❌ | Render 대시보드 deploy |
| 4 마이그레이션 | Claude | ⚠️ | prod `DATABASE_URL` 전달 시 |
| 5 nginx | Claude | ⚠️ | prod SSH 명시 승인 + Render host |
| 6 검증 | Claude | ✅ | — (curl) |
| 7 시드 | 사용자/Claude | ⚠️ | AMA PG 접근정보 |

---

## 1. Render prod 서비스 — render.yaml prod 블록 초안

현재 [render.yaml](../../apps/app-car-manager-v2/render.yaml)은 `car-manager-staging` **1개**만 정의. prod는 **별도 서비스**로 추가하거나 Render 대시보드에서 신규 생성한다. Blueprint로 관리하려면 아래 블록을 `services:` 배열에 추가:

```yaml
  # ── PRODUCTION ── apps.amoeba.site/app-car-manager-v2/ 뒤에 nginx 프록시로 노출
  - type: web
    name: car-manager-prod              # ⚠️ 대시보드 서비스명과 정확히 일치(불일치 시 신규 생성됨)
    runtime: node
    rootDir: apps/app-car-manager-v2
    buildCommand: npm install --include=dev && npm run build --workspace @car-v2/web
    startCommand: npm start --workspace @car-v2/web
    plan: starter
    envVars:
      # ── staging Render와 다른 핵심 3종 ──
      - key: BASE_PATH                  # ⭐ staging은 생략(root), prod는 nginx 경로와 일치 필수
        value: /app-car-manager-v2
      - key: NEXT_PUBLIC_BASE_PATH      # 클라이언트 asset prefix (_next/static 404 방지)
        value: /app-car-manager-v2
      - key: APP_URL                    # getRequestOrigin → 공개 origin
        value: https://apps.amoeba.site
      - key: NEXT_PUBLIC_AMA_ORIGIN     # ⭐ 단일 구체 origin (CSP+세션만료 리다이렉트 모두 정상, BUG-260601)
        value: https://ama.amoeba.site
      # ── 공통(스테이징과 동일해야 하는 값) ──
      - key: NODE_ENV
        value: production
      - key: NEXT_PUBLIC_APP_CODE
        value: car-manager-v2
      - key: NEXT_PUBLIC_DEFAULT_LOCALE
        value: vi
      # ── 시크릿(대시보드에서 sync:false로 직접 입력) ──
      - key: JWT_SECRET                 # prod AMA(amb-api-production)와 byte-for-byte 동일
        sync: false
      - key: DATABASE_URL               # Neon prod 브랜치 pooler URL
        sync: false
      - key: DEMO_AUTO_LOGIN            # 반드시 false
        sync: false
      - key: AWS_REGION
        sync: false
      - key: AWS_S3_BUCKET
        sync: false
      - key: AWS_ACCESS_KEY_ID
        sync: false
      - key: AWS_SECRET_ACCESS_KEY
        sync: false
```

> ⚠️ Render 대시보드 env가 render.yaml보다 **우선**. 대시보드에 잔존하는 `APP_URL`/`BASE_PATH`가 있으면 prod 서비스에서 정리.
> ⚠️ `NEXT_PUBLIC_*`·`BASE_PATH`는 **빌드타임 인라인**(제약 C2) → 값 바꾸면 **재빌드 필수**. staging 이미지 재사용 불가.

---

## 2. prod env 값 표 (staging Render 대비)

| Key | Staging Render | **Prod Render** | 비고 |
|---|---|---|---|
| `BASE_PATH` | (생략, root) | **`/app-car-manager-v2`** | ⭐ nginx 경로와 일치 |
| `NEXT_PUBLIC_BASE_PATH` | (생략) | **`/app-car-manager-v2`** | asset prefix |
| `APP_URL` | `…onrender.com` | **`https://apps.amoeba.site`** | 공개 origin |
| `NEXT_PUBLIC_AMA_ORIGIN` | `ama + stg-ama` | **`https://ama.amoeba.site`** | ⭐ 단일값(BUG-260601) |
| `JWT_SECRET` | stg AMA(`5575a8ec558c`) | **prod AMA값** | 게이트 G1로 검증 |
| `DATABASE_URL` | Neon staging | **Neon prod 브랜치** | 데이터 격리 |
| `DEMO_AUTO_LOGIN` | false | **false** | 절대 true 금지 |
| `NODE_ENV` | production | production | — |
| `NEXT_PUBLIC_APP_CODE` | car-manager-v2 | car-manager-v2 | JWT `aud`와 일치 |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | vi | vi | — |
| `AWS_*` | staging S3 | prod S3(또는 공용) | 첨부 업로드용 |
| (P4 선택) `RESEND_API_KEY`, `EMAIL_FROM`, `WEB_PUSH_*` | — | 알림 활성화 시 | 초기 배포엔 생략 가능 |

> **byte-for-byte 일치 필수**: `JWT_SECRET`, `NEXT_PUBLIC_APP_CODE`(=JWT `aud`). 불일치 → 클릭 시 `/session-expired` 401.
> **JWT 계약**(고정, INTEGRATION §7): HS256, `iss=amb-management`, `aud=car-manager-v2`, `app_code=car-manager-v2`.

---

## 3. nginx 프록시 (Phase 2)

준비된 파일: [platform/nginx/apps.amoeba.site.prod.conf](../../platform/nginx/apps.amoeba.site.prod.conf). `<V2_PROD_RENDER_HOST>` **2곳**을 prod Render 호스트(예: `car-manager-prod.onrender.com`)로 치환 후:

```bash
# prod 서버에서 (amb-production), 변경 전 백업 필수
sudo cp /etc/nginx/conf.d/apps.amoeba.site.conf{,.bak-20260603}
sudo cp apps.amoeba.site.prod.conf /etc/nginx/conf.d/apps.amoeba.site.conf
sudo nginx -t && sudo systemctl reload nginx
```

핵심: `proxy_pass`는 Render 호스트, `Host`는 Render 호스트(SNI), **`X-Forwarded-Host $host`**(=apps.amoeba.site)로 보내야 v2가 공개 origin 기준 쿠키/리다이렉트 생성(INTEGRATION §6.3). `proxy_ssl_server_name on` 필수(Render SNI).

---

## 4. 검증 커맨드

```bash
# 3. Render 직접 (prod 서비스 헬스) — BASE_PATH 설정했으므로 prefix 포함
curl -s https://<prod-host>.onrender.com/app-car-manager-v2/api/v1/health      # → {"success":true}

# 6. 공개 도메인(프록시 경유)
curl -s https://apps.amoeba.site/app-car-manager-v2/api/v1/health              # → {"success":true}

# CSP 확인 (ama.amoeba.site 포함되어야 함, stg-ama 없어야 함)
curl -sI https://apps.amoeba.site/app-car-manager-v2/dashboard | grep -i content-security-policy
# 기대: frame-ancestors 'self' https://ama.amoeba.site

# 인증서 SNI (이미 통과 — *.amoeba.site 와일드카드)
echo | openssl s_client -servername apps.amoeba.site -connect apps.amoeba.site:443 2>/dev/null \
  | openssl x509 -noout -ext subjectAltName
```

---

## 5. AMA Postgres 시드 (Phase 3 — 단계적)

파일: [scripts/seed-ama-entity-custom-app.FILLED-20260601.sql](../../apps/app-car-manager-v2/scripts/seed-ama-entity-custom-app.FILLED-20260601.sql)
`eca_url`은 이미 `https://apps.amoeba.site/app-car-manager-v2`로 prod 정합. 멱등(`ON CONFLICT (ent_id, eca_code)`).

- **Step 7a (카나리아)**: DEMO(`00000000-…-010`) 1행만 먼저 INSERT → 로그인→iframe→CSP→세션만료 복귀 검증.
- **Step 7b**: 검증 OK → CARGO434 / UIT327 / VN01 나머지 3행.
- 대상 DB: **AMA Postgres**(`amb-postgres-production`) — Neon/MySQL 아님.

---

## 6. 실행 전 게이트 (반드시 전부 통과 — PLAN §7)

- [ ] **G1 시크릿 패리티**: prod AMA(`amb-api-production`) `JWT_SECRET` 지문 == Render prod `JWT_SECRET` *(불일치 → 중단)*
- [ ] **G2 Neon prod 브랜치** 분리 확인 (staging 미공유)
- [ ] **G3 `DEMO_AUTO_LOGIN=false`** (Render prod)
- [x] **G4 인증서 SNI**: `*.amoeba.site` 와일드카드 커버 — ✅ 2026-06-03 외부 확인 완료
- [ ] **G5 nginx 백업 존재 + `nginx -t` 통과**
- [ ] **G6 BASE_PATH=/app-car-manager-v2** (Render prod, nginx 경로 일치)
- [ ] **G7 DEMO 1개 검증 후에만** 나머지 시드 (단계적 롤아웃)

---

## 7. 롤백 절차 (무중단)

1. **즉시 숨김** (사용자 영향 즉시 차단): `UPDATE amb_entity_custom_apps SET eca_is_active=false WHERE eca_code='app-car-manager-v2';`
2. **프록시 제거**: 백업 복원 `sudo cp …conf.bak-20260603 …conf` → `nginx -t` → reload
3. **서비스 중지**: Render prod 서비스 suspend

> 1번만으로 전 엔티티 노출 차단. 코드/인프라 무변경.

---

## 8. 막힌 의존성 (현재 Claude 단독 실행 불가 — 사용자 액션 필요)

| # | 필요 | 누가 |
|---|---|---|
| 1 | Render prod 서비스 생성 + 시크릿 env 입력 | 사용자 (Render 대시보드) |
| 2 | Neon prod 브랜치 + `DATABASE_URL` 확보 | 사용자 (Neon 대시보드) |
| 3 | prod AMA `JWT_SECRET` 지문 확인 (G1) | prod SSH 명시 승인 |
| 4 | prod Render 호스트명 전달 | 사용자 → Claude가 nginx conf 채움 |
| 5 | prod 서버 nginx 교체/reload (Phase 2) | prod SSH 명시 승인 |
| 6 | AMA Postgres 접근정보 (Phase 3 시드) | 사용자 |

**Claude가 받아서 즉시 할 수 있는 것**: 호스트명 받으면 nginx conf 완성 / prod URL 받으면 마이그레이션 / 공개 도메인 검증(curl) / 시드 SQL 정리.
