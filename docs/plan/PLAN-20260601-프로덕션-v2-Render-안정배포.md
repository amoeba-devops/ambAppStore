# PLAN-20260601 — 프로덕션 v2 안정 배포 (Render 분리 + 얇은 nginx 프록시)

> 목적: 프로덕션 `ama.amoeba.site` 사용자에게 `app-car-manager-v2`를 **안정적으로** 제공한다.
> 운영 안정성(장애 전파 최소화)을 1순위로, 공유 AMA 서버에 추가 컨테이너 0개로 구성한다.
>
> 대안 비교: 풀 자체호스팅 안은 [PLAN-20260601-프로덕션-앱스토어-배포.md](PLAN-20260601-프로덕션-앱스토어-배포.md) 참고.
> 본 문서가 **권장안**이다.
>
> ⚠️ 계획만 수립. 실제 프로덕션 변경은 §7 게이트 통과 + 승인 후 진행.
> ⚠️ 배포 원칙: 스테이징 검증 구성만 프로덕션 반영 (CLAUDE.md).

---

## 0. 핵심 방침 (Why this design)

| 판단 기준 | 결론 |
|---|---|
| v2 DB | Neon(외부) → 로컬 MySQL과 LAN 이점 없음 → 자체호스팅 명분 없음 |
| 트래픽 | 법인차량 3대 규모 → 관리형(Render)이 운영부담·안정성 우위 |
| 장애 전파 | AMA 프로덕션과 **같은 서버/같은 nginx** → 추가 컨테이너·DB를 얹을수록 위험 ↑ |
| 따라서 | **v2를 공유 서버에서 분리(Render) + nginx는 프록시 1개만** + 카탈로그/구독 스택은 보류 |

목표 토폴로지:
```
사용자 ─iframe─► ama.amoeba.site (기존, 무변경)
                   │ custom-apps 클릭 → JWT(prod AMA secret) 발급
                   ▼
   apps.amoeba.site/app-car-manager-v2/   ← nginx location 1개 추가
                   │ proxy_pass (+X-Forwarded-Host)
                   ▼
   v2 = Render 프로덕션 서비스 (관리형: 헬스체크/자동재시작/롤아웃/로그)
        APP_URL=apps.amoeba.site · BASE_PATH=/app-car-manager-v2
        JWT_SECRET=prod AMA값 · Neon prod 브랜치 · DEMO_AUTO_LOGIN=false
```

---

## 1. 시스템 개발 현황 분석

### 1.1 프로덕션 서버 (18.138.206.18, SSH `amb-production`, 2026-06-01 점검)
- 도는 컨테이너: `amb-web-production`(8080), `amb-api-production`(3019), `amb-portal-*`(8081/3020), **`amb-postgres-production`(prod AMA DB)**, `production-web-1`/`api-1`
- nginx: **호스트 실행**. `apps.amoeba.site.conf` = 정적 루트(`/var/www/apps_amoeba`, `try_files =404`)뿐, 프록시 전무
- `ama.amoeba.site.conf`: `/api→127.0.0.1:3019`, `/→127.0.0.1:8080`, CSP `frame-ancestors 'self' *.amoeba.site`
- SSL: `/etc/nginx/ssl/amoeba.site.crt|.key` (와일드카드 공용)
- 앱스토어 플랫폼/v2: **미배포**

### 1.2 v2 현황 (스테이징/Render)
- INTEGRATION.md §5: v2는 **Staging Docker(stg-apps)** + **Render(car-manager-staging.onrender.com)** 이중 타깃. 둘 다 동일 코드/JWT, `BASE_PATH`·`APP_URL`만 분기.
- 쿠키: prod에서 `HttpOnly, SameSite=None`(§8). iframe CSP는 `NEXT_PUBLIC_AMA_ORIGIN`로 제어(§5.1).
- JWT 계약(§7): HS256, `app_code=car-manager-v2`, `iss=amb-management`, `aud=car-manager-v2`.
- 스테이징 JWT_SECRET 지문: `sha256=5575a8ec558c` len 35 (stg v2 == stg platform).

### 1.3 제약사항
| # | 제약 | 영향 |
|---|---|---|
| C1 | **JWT_SECRET 일치 필수** | v2 Render = 프로덕션 AMA(`amb-api-production`) 시크릿 동일해야 로그인. 불일치 → `/session-expired` 401 |
| C2 | **빌드타임 인라인** | `APP_URL`/`BASE_PATH`/`NEXT_PUBLIC_*` 번들 박제 → prod 값으로 **별도 빌드** 필수 (스테이징 이미지 재사용 불가) |
| C3 | **Neon 분리** | v2 prod는 스테이징과 다른 Neon 브랜치 → 데이터 격리 |
| C4 | **nginx 호스트모드** | `proxy_pass`는 호스트 접근 가능 대상(Render 도메인)으로 |
| C5 | **CSP/쿠키** | v2 `NEXT_PUBLIC_AMA_ORIGIN`에 `https://ama.amoeba.site` 포함, prod 쿠키 SameSite=None |
| C6 | **공유 nginx 리스크** | reload가 ama vhost에 영향 → `nginx -t`+백업 필수 |

---

## 2. 단계별 구현 계획

### Phase 0 — 사전 게이트 (코드/인프라 변경 없음)
- **Step 0.1** 프로덕션 AMA `JWT_SECRET` 지문 확보 → v2 Render에 동일 값 설정 결정.
  └─ 사이드 임팩트: 불일치 시 전 엔티티 401. **§7 게이트 — 통과 전 다음 단계 금지.**
- **Step 0.2** Neon prod 브랜치 생성 + `DATABASE_URL` 확보.
  └─ 사이드 임팩트: 스테이징 공유 시 운영/테스트 데이터 혼선.
- **Step 0.3** apps.amoeba.site 와일드카드 인증서가 SNI 커버하는지 확인 (이미 정적 서빙 중이므로 커버 추정).

### Phase 1 — v2 Render 프로덕션 서비스
- **Step 1.1** Render에 prod 서비스 생성 (스테이징과 별개). env:
  `BASE_PATH=/app-car-manager-v2`, `APP_URL=https://apps.amoeba.site`,
  `JWT_SECRET`=prod AMA값, `NEXT_PUBLIC_AMA_ORIGIN=https://ama.amoeba.site`,
  `DATABASE_URL`=Neon prod, `DEMO_AUTO_LOGIN=false`, `NEXT_PUBLIC_APP_CODE=car-manager-v2`.
  └─ 사이드 임팩트: Render 대시보드 env가 render.yaml보다 우선 — 잔존 값 정리(§5.1 ⚠).
- **Step 1.2** prod Neon 마이그레이션 `npm run db:migrate`(prod URL).
- **Step 1.3** Render 직접 헬스 확인: `https://<v2-prod>.onrender.com/api/v1/health`.

### Phase 2 — nginx 프록시 (location 1개)
- **Step 2.1** `apps.amoeba.site.conf` 백업 후 location 추가 (§부록 A). proxy_pass = v2 prod Render URL, `X-Forwarded-Host $host` 포함.
  └─ 사이드 임팩트: 잘못된 conf reload 시 ama 포함 전체 영향 → C6 절차 엄수.
- **Step 2.2** `sudo nginx -t` → `sudo systemctl reload nginx`.
- **Step 2.3** `curl https://apps.amoeba.site/app-car-manager-v2/api/v1/health` → `{success:true}`.

### Phase 3 — 데이터 시드 (단계적 롤아웃)
- **Step 3.1** prod AMA Postgres(`amb-postgres-production`)에 **DEMO 1개만** 먼저 시드 (`eca_url=https://apps.amoeba.site/app-car-manager-v2`).
- **Step 3.2** DEMO 계정 로그인 → custom-apps 노출 → 클릭 → 쿠키/대시보드 검증.
- **Step 3.3** 검증 OK → 나머지 3개(CARGO434, UIT327, VN01) 시드.
  └─ 사이드 임팩트: 문제 시 `eca_is_active=false`로 즉시 숨김(롤백).

### Phase 4 — 운영 안정화
- **Step 4.1** Render 헬스체크/알림 설정, 로그 확인 경로 문서화.
- **Step 4.2** 롤백 절차 명문화(§6).
- **Step 4.3** (보류) 카탈로그/구독 셀프서비스가 필요해지면 별도 과제로 플랫폼 스택 분리 검토.

---

## 3. 변경 파일 목록

| 구분 | 파일/대상 | 변경유형 |
|---|---|---|
| Infra(Render) | v2 prod 서비스 + env | 신규 |
| Infra(nginx) | `/etc/nginx/conf.d/apps.amoeba.site.conf` (prod 서버) | 수정(백업 후 location 1개 추가) |
| Infra(repo, 선택) | `platform/nginx/apps.amoeba.site.prod.conf` (참조용) | 신규 |
| DB(v2 Neon prod) | 마이그레이션 | 신규(분리) |
| DB(AMA PG) | `amb_entity_custom_apps` (DEMO→나머지 3) | 신규(INSERT, 단계적) |
| 시드파일 | `apps/app-car-manager-v2/scripts/seed-ama-entity-custom-app.FILLED-20260601.sql` (eca_url을 prod로 수정) | 수정 |

> **애플리케이션 소스 변경 없음. 신규 컨테이너 0개. MySQL/BFF/카탈로그 미배포.**

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 | 완화 |
|---|---|---|---|
| AMA 프로덕션 가용성 | **낮음** | 추가 부하/컨테이너 없음. 변경은 nginx location 1개 | `nginx -t`+백업, reload만 |
| 로그인(JWT) | 높음 | C1 미충족 시 401 | §7 시크릿 패리티 게이트 |
| iframe/쿠키 | 중 | SameSite=None + CSP | `NEXT_PUBLIC_AMA_ORIGIN`, X-Forwarded-Host |
| Render 의존 | 중 | 외부 가용성 의존 | 단일 박스 결합보다 격리상 유리, 필요시 별도 인스턴스 변형 |
| 데이터 | 낮음 | Neon prod 분리 | Step 0.2 |
| 빌드 일관성 | 중 | 빌드타임 URL | prod 전용 빌드(C2) |

---

## 5. DB 마이그레이션
- **v2 Neon prod**: `npm run db:migrate` (prod `DATABASE_URL`). synchronize 비활성 유지.
- **AMA Postgres(`amb-postgres-production`)**: `seed-ama-entity-custom-app.FILLED-20260601.sql` 멱등 INSERT
  (`ON CONFLICT (ent_id, eca_code)`), **eca_url을 `https://apps.amoeba.site/app-car-manager-v2`로 수정 후** 단계적 적용.
- **MySQL/plt_apps**: 본 안에서 **불필요** (custom-apps 직접 iframe 경로). 카탈로그 도입 시 별도.

---

## 6. 롤백 절차 (무중단)
1. **즉시 숨김**: `UPDATE amb_entity_custom_apps SET eca_is_active=false WHERE eca_code='app-car-manager-v2';` (코드/인프라 무변경)
2. **프록시 제거**: `apps.amoeba.site.conf`에서 location 삭제 → 백업 복원 → `nginx -t`+reload
3. **서비스 중지**: Render prod 서비스 suspend
> 1번만으로 사용자 영향 즉시 차단 가능.

---

## 7. 실행 전 게이트 (반드시 통과)
- [ ] **시크릿 패리티**: prod AMA `JWT_SECRET` 지문 == v2 Render `JWT_SECRET` (불일치 → 중단)
- [ ] Neon **prod 브랜치** 분리 확인 (스테이징 미공유)
- [ ] `DEMO_AUTO_LOGIN=false` (Render prod)
- [ ] apps.amoeba.site 인증서 SNI 커버
- [ ] `apps.amoeba.site.conf` 백업 존재 + `nginx -t` 통과
- [ ] DEMO 1개 검증 후에만 나머지 시드 (단계적 롤아웃)

---

## 부록 A — apps.amoeba.site.conf 변경 초안 (호스트모드)

기존 정적 `location /`는 유지하거나 플랫폼 도입 시 교체. v2만 추가하는 최소 변경:
```nginx
# apps.amoeba.site — add v2 reverse proxy to Render prod service
location /app-car-manager-v2/ {
    proxy_pass         https://<v2-prod-service>.onrender.com;  # Render prod URL
    proxy_set_header   Host               <v2-prod-service>.onrender.com;  # SNI/Host for Render
    proxy_set_header   X-Forwarded-Host   $host;                # v2 getRequestOrigin → apps.amoeba.site
    proxy_set_header   X-Forwarded-Proto  $scheme;
    proxy_set_header   X-Real-IP          $remote_addr;
    proxy_set_header   X-Forwarded-For    $proxy_add_x_forwarded_for;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade            $http_upgrade;
    proxy_set_header   Connection         "upgrade";
    proxy_ssl_server_name on;             # Render는 SNI 필요
    proxy_read_timeout 60s;
}
# CSP: AMA iframe 허용 (ama.conf와 별개로 apps 응답에도 필요 시)
add_header Content-Security-Policy "frame-ancestors 'self' https://ama.amoeba.site" always;
```
> 주: `proxy_pass`가 Render 도메인이므로 `Host`는 Render 호스트로, **`X-Forwarded-Host`만 `$host`**(apps.amoeba.site)로 보내 v2가 공개 origin 기준으로 쿠키/리다이렉트를 만들게 한다(INTEGRATION.md §6.3 원리).
> 대안(zero-touch): nginx를 건드리지 않고 `eca_url`을 Render 도메인으로 직접 지정 가능 — URL이 onrender.com으로 노출되고 SameSite=None 쿠키 의존. 깔끔한 동일-origin을 위해 위 프록시안을 권장.
