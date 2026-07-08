# HS Code Manager — 스테이징 배포 현황 & 전환(cutover) 작업 정리

작성: 2026-07-01 / 조사: 스테이징 서버(stg-apps.amoeba.site) 실측 + git/PR 상태

---

## 1. 현황 요약 (AS-IS)

### 스테이징에 이미 M1~M3(MySQL 계보)가 라이브 배포됨
| 항목 | 실측값 |
|------|--------|
| 컨테이너 | `bff-hscode-manager`, `web-hscode-manager` — **Up 6 days (healthy)** |
| 공개 URL | `https://stg-apps.amoeba.site/app-hscode/` → **200** |
| API 헬스 | `/app-hscode/api/v1/health` → `{"status":"ok","service":"hscode-manager-api"}` |
| DB | **MySQL** `mysql-apps:3306` / `db_app_hscode` |
| 배포 소스 | 브랜치 **`staging`** (origin/staging 기준) — main 아님 |
| compose | `docker-compose.app-hscode-manager.yml` |
| deploy-staging.sh | `hscode` = `bff-hscode-manager` / `web-hscode-manager` |

### M1~M3 데이터 (db_app_hscode)
마스터/시드만 존재, **운영 데이터 0행**:
- `hsc_authority_hs_codes`(27), `hsc_expert_keyword_dictionary`(11), `hsc_policy_thresholds`(10), `hsc_export_countries`(8), `hsc_import_countries`(6), `hsc_external_data_sources`(2)
- 운영 테이블(classifications / audit_logs / verification_events / excel_* / ai_recommendation_logs) = **0행**
- → 실사용자 데이터 없음 → **DB 손실 리스크 낮음**

### 신규 계보(PR #88, mockup + Postgres)
- 상태: **OPEN / BLOCKED / REVIEW_REQUIRED** (미머지). main 대상.
- origin/main·origin/staging 모두 아직 M1~M3 계보.

---

## 2. 갭 (M1~M3 → mockup+Postgres 전환)

| 항목 | 현재 (M1~M3) | 신규 (PR #88) | 전환 작업 |
|------|--------------|----------------|-----------|
| DB 엔진 | MySQL `db_app_hscode` | PostgreSQL 15 + pgvector (`postgres-hscode` 신규) | 신규 컨테이너 기동 + 스키마 적용 |
| 컨테이너 | bff/web-hscode-manager | bff/web-app-hscode | 구 컨테이너 down, 신규 up |
| compose | app-hscode-manager.yml | app-hscode.yml | deploy-staging.sh 엔트리 교체(PR #88 반영됨) |
| 도메인 | item/classification/inquiry/… | search-core/gtin/excel/… | 전면 교체 |
| 라우팅 target | bff-hscode-manager | bff-app-hscode | 활성 프록시 conf 갱신 |
| service 명 | hscode-manager-api | hscode-manager | (헬스 응답 차이) |
| Redis | 미사용 | redis-hscode(BullMQ) 신규 | 신규 컨테이너 |

---

## 3. 추가 작업 항목 (TO-DO)

### A. 머지 게이트 (선행)
- [ ] **PR #88 리뷰 승인 1건** (작성자 셀프 승인 불가) → main 머지
- [ ] **staging 브랜치 반영**: 스테이징은 `origin/staging` 기준 배포 → main 머지 후 staging 브랜치에도 동기화 필요 (배포 플로우 재확인)

### B. 배포 전환 (cutover)
- [ ] 신규 인프라 기동: `postgres-hscode`(pgvector/pg15) + `redis-hscode` (compose에 정의됨)
- [ ] 스키마 적용: `sql/hscode-manager-schema.sql` (initdb 자동, extension vector/pgcrypto 포함)
- [ ] 구 M1~M3 컨테이너/이미지 정리: `bff-hscode-manager`·`web-hscode-manager` down + 구 compose 제거
- [ ] `deploy-staging.sh` hscode 엔트리 = bff-app-hscode/app-hscode.yml (PR #88 수정본) → staging 브랜치에도 반영
- [ ] **라우팅 정합**: `/app-hscode/api` → `bff-app-hscode:3102` 로 갱신
      · main nginx conf는 이미 `bff-app-hscode` 기대 / 현재 활성 스테이징 프록시는 `bff-hscode-manager`로 라우팅 중 → **활성 리버스프록시 위치·conf 확인 후 갱신 필요** (web-platform conf.d에는 미발견)
- [ ] 정적 서빙 방식 결정: `web-app-hscode` 단독 컨테이너 vs web-platform `html/app-hscode` 통합

### C. 환경변수/시크릿 (staging `backend/.env`)
- [ ] DB: `DB_HOST=postgres-hscode` `DB_PORT=5432` `DB_DATABASE=db_hsm` `DB_USERNAME` `DB_PASSWORD`
- [ ] `REDIS_HOST=redis-hscode` `REDIS_PORT=6379`
- [ ] `JWT_SECRET`(AMA 검증) `SETTINGS_ENC_KEY`(설정 암호화)
- [ ] AI: `CLAUDE_API_KEY` `CLAUDE_MODEL_VERSION`
- [ ] 임베딩: `EMBEDDING_PROVIDER` `EMBEDDING_API_KEY` `EMBEDDING_DIMENSIONS`(=pgvector 차원)

### D. 데이터 / 시드 (계보가 달라 직접 이관 불가 → 재구성)
- [ ] 전역 참조 시드: `hsm_gpc_hs_maps`, `hsm_hs_country_extensions` (M1~M3 countries/thresholds 참고해 매핑)
- [ ] POL-001 임계치: `hsm_app_settings`(THRESHOLD) 또는 .env로 이관 (M1~M3 `hsc_policy_thresholds` 10건 참고)
- [ ] 면장리스트 코퍼스 import → `hsm_hs_references` (+ 임베딩)
- [ ] **임베딩 공급자 확정** (미설정 시 키워드 폴백으로 동작)

### E. 기능 갭 (신규 계보 후속)
- [ ] Feature B 외부 L2(GS1)/L4(Claude AI 분류) — 외부 API 프로비저닝 후
- [ ] SSE 스트리밍(Q&A) — 현재 POST 대체
- [ ] ToKhai/VMSG import 어댑터 — 실파일로 컬럼 매핑 검증

### F. 검증 (배포 후)
- [ ] 헬스/공개 라우팅/인증(401)/6화면 스모크
- [ ] TC 실측 → TR §4/§5 갱신, NFR(P95, Top-3 정확도) 측정
- [ ] 롤백 절차 확인 (구 M1~M3 재기동 경로 보존)

### G. Cosmetic (무해, 선택)
- [ ] repo-root 과거 문서(RPT-20260513·BUG-260625·PLAN-20260513)의 구 컨테이너명 참조 갱신

---

## 4. 리스크 / 주의
| 리스크 | 수준 | 완화 |
|--------|------|------|
| **라이브 서비스 교체** (M1~M3 6일째 서빙) | 중 | 운영데이터 0행이라 데이터 손실 리스크 낮음. 다운타임 창 + 롤백(구 compose 보존) |
| DB 엔진 이원화 (MySQL 유지 + PG 신규) | 중 | mysql-apps는 타앱 공용이라 유지. postgres-hscode 별도 추가 |
| staging 브랜치 플로우 (main 아님) | 중 | main→staging 동기화 절차 확인 후 배포 |
| 라우팅 불일치 (프록시 target) | 중 | 활성 프록시 conf 확인·갱신 필수 |
| 임베딩 미확정 → 검색 품질 | 중 | 공급자 확정 전엔 키워드 폴백으로 제한 동작 명시 |

---

## 5. 권장 순서
1. PR #88 승인·main 머지 → staging 브랜치 동기화
2. staging `backend/.env` 시크릿 준비
3. 유지보수 창에서 cutover: 신규 postgres/redis/bff/web 기동 → 라우팅 갱신 → 구 컨테이너 down
4. 시드(전역 ref/임계치) + 코퍼스 import → 스모크·TC 실측
5. 이상 시 구 M1~M3 compose로 롤백

---

## 6. 배포 완료 기록 (2026-07-01, 서버 오버레이 방식)

**결과: 성공.** mockup+Postgres 계보가 스테이징 라이브.
- `https://stg-apps.amoeba.site/app-hscode/` → 200 (내 빌드 자산), API `service: hscode-manager`, 보호라우트 401
- 컨테이너: `bff-app-hscode`(3102)·`web-app-hscode`(5202)·`postgres-hscode`(5433, hsm_ 10테이블)·`redis-hscode`(6380) — 전부 healthy
- 구 M1~M3(`bff-hscode-manager`/`web-hscode-manager`)는 **정지만**(삭제X) → 롤백 보존
- 호스트 nginx 변경 불필요: 기존 `/app-hscode/`→127.0.0.1:5202, `/app-hscode/api/`→127.0.0.1:3102 를 동일 포트로 승계
- backend/.env: 서버 생성(gitignore). JWT_SECRET은 구 bff에서 재사용(AMA SSO 호환), DB_PW/SETTINGS_ENC_KEY 신규 생성
- 배포 방식: git 우회 rsync 오버레이 (staging 브랜치 protected로 직접 push 불가)

### 롤백 절차 (M1~M3 복귀)
```bash
ssh ambAppStore@stg-apps.amoeba.site
cd ~/ambAppStore/apps/app-hscode-manager
docker compose --env-file backend/.env -f docker-compose.app-hscode.yml down   # 신규 정지(볼륨 유지)
docker start bff-hscode-manager web-hscode-manager                              # 구 M1~M3 재기동
# (파일 원복 필요 시) git checkout -- apps/app-hscode-manager
```

## 7. 남은 후속 작업 (post-deploy)
- [ ] **서버 git 드리프트**: rsync 오버레이로 `apps/app-hscode-manager`가 staging 브랜치 추적상태와 불일치. staging에 PR 병합(protected) 후 `git pull`로 정합화 필요. 그전까지 서버에서 hscode 경로 `git pull` 충돌 주의.
- [ ] **PR**: PR #88(main) + 필요 시 staging PR 로 배포를 git-tracked 화
- [ ] **호스트 nginx 업로드 한도**: `/app-hscode/api/`(→3102) 엑셀 업로드용 `client_max_body_size` 확인/상향(호스트 nginx conf, sudo)
- [ ] **임베딩 공급자 미설정** → 현재 키워드 폴백. 공급자 + `EMBEDDING_API_KEY` 설정 시 pgvector 검색 활성 (차원 1024 일치)
- [ ] **시드**: 전역 ref(hsm_gpc_hs_maps/hsm_hs_country_extensions) + 면장리스트 코퍼스 import (현재 DB 비어 검색 결과 없음)
- [ ] **CLAUDE_API_KEY** 미설정 (AI 분류/명확화 Claude 경로 비활성)
- [ ] 스모크 후 TC 실측 → TR/RPT 갱신
