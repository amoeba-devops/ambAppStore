---
document_id: HSCM-IMPL-RPT-M1-OPS-READY
version: 1.0.0
status: Done
created: 2026-05-13
updated: 2026-05-13
app: app-hscode-manager
milestone: M1 (MVP) — 운영 진입 준비
---

# HS Code Manager — M1 운영 진입 준비 완료 보고서

> Phase 4 완료(M1 코드 레벨 달성) 후 *실 런타임 검증·운영 진입* 을 위한 인프라·문서·시드 데이터 준비를 마쳤다.
> 이제 *DB·AMA·Claude 환경* 만 준비되면 즉시 스테이징 시연 가능.

---

## 1. 완료 범위

| 항목 | 산출물 | 결과 |
|------|--------|------|
| Deploy 스크립트 hscode 분기 | `platform/scripts/deploy-staging.sh` (수정) | ✔ bash 구문 통과 |
| DB 통합 마이그레이션 러너 | `apps/app-hscode-manager/db-migrations/00_apply_all.sh` (신규) | ✔ Phase 0~4 + 시드 통합 |
| AMA SSO 역할 발급 가이드 | `apps/app-hscode-manager/docs/AMA-SSO-ROLES.md` (신규) | ✔ 5종 역할 매핑 표 |
| 확장 시드 데이터 | `seed-phase3-authority-extended.sql` + `seed-phase1-demo-exporters-fta.sql` (신규 2종) | ✔ 50 + 5 + 27 건 |
| M1 회귀 시연 가이드 | `docs/test/TR-20260513-HSCode매니저-M1-회귀시연-가이드.md` (신규) | ✔ 9단계 + 보안 검증 + 부하 테스트 |

---

## 2. 신규/수정 파일

### 2.1 인프라
- **수정**: [platform/scripts/deploy-staging.sh](../../platform/scripts/deploy-staging.sh)
  - `APP_DIRS[hscode]` / `APP_COMPOSE` / `APP_BFF_PORT=3102` / `APP_WEB_PORT=5202` 추가
  - `ALL_APPS=(platform car-manager stock sales hscode)`
  - 사용법 메시지에 `hscode` 옵션 추가
- **신규**: [apps/app-hscode-manager/db-migrations/00_apply_all.sh](../../apps/app-hscode-manager/db-migrations/00_apply_all.sh)
  - Phase 0~4 SQL 통합 적용 (idempotent — CREATE IF NOT EXISTS / INSERT IGNORE / ALTER 컬럼 존재 검증)
  - `SEED_DEMO_DATA=true` 환경변수로 확장 시드 함께 적재

### 2.2 시드 데이터 (3개 SQL)
- **기존 유지**: `seed-phase1.sql` (수입국 6 / 수출국 8 / 외부소스 2)
- **기존 유지**: `seed-phase3-authority.sql` (BIEU THUE 8건 + KCS 1건 — 기본 데모)
- **신규**: [seed-phase3-authority-extended.sql](../../apps/app-hscode-manager/db-migrations/seed-phase3-authority-extended.sql)
  - BIEU THUE 추가 **42건** = 누적 50건 (STEEL 15 / CHEMICAL 13 / EQUIPMENT 10 / 모호 4)
- **신규**: [seed-phase1-demo-exporters-fta.sql](../../apps/app-hscode-manager/db-migrations/seed-phase1-demo-exporters-fta.sql)
  - 데모 Exporter **5건** (`ent_id: ent-test-001` 헤더 인증 시연용)
  - FTA 매트릭스 **27건** (VKFTA/AKFTA/RCEP/AJCEP/ATIGA 5개 협정)

### 2.3 문서 (2개)
- **신규**: [AMA-SSO-ROLES.md](../../apps/app-hscode-manager/docs/AMA-SSO-ROLES.md)
  - 5종 역할 정의 (ADMIN / MANAGER / EXPERT_LOCAL / EXPERT_INTERNAL / VIEWER)
  - JWT 클레임 요구사항
  - 운영 체크리스트 + 예외 시나리오 5종
  - 임시 대안 (`ALLOW_ENTITY_HEADER_AUTH=true`)
- **신규**: [TR-20260513-HSCode매니저-M1-회귀시연-가이드.md](../test/TR-20260513-HSCode매니저-M1-회귀시연-가이드.md)
  - 환경 부트스트랩 (로컬 / 스테이징)
  - 9단계 회귀 시나리오 cURL 스크립트
  - UI 시연 스크립트
  - 보안 검증 3종 (멀티테넌시 / 불변성 / 감사로그)
  - k6 부하 테스트 (NFR-PF-02 검증)
  - 트러블슈팅 7종

---

## 3. 운영 진입 체크리스트

[RPT-Phase4-M1](RPT-20260513-HSCode매니저-Phase4-컨펌영속화-M1.md) §7 의 미완료 항목을 채운다:

| 항목 | 상태 | 후속 |
|------|------|------|
| Phase 0~4 P0 TC 100% (코드) | ✅ | — |
| 회귀 시나리오 9단계 코드 | ✅ | — |
| NFR 보안·정합성·다국어 | ✅ | — |
| **deploy-staging.sh hscode 분기** | ✅ | 완료 (이 보고서) |
| **DB 통합 마이그레이션 스크립트** | ✅ | 완료 (이 보고서) |
| **AMA SSO 역할 발급 가이드** | ✅ | 완료 (이 보고서). *실제 발급은 운영팀 협조* |
| **시드 데이터 확장** | ✅ | 50건 + Exporter 5 + FTA 27 (이 보고서). *운영 진입 시 500+건으로 교체 필요* |
| **M1 시연 가이드** | ✅ | 완료 (이 보고서) |
| 부하 테스트 (NFR-PF-01·02) | ⏳ | 가이드 §6에 k6 스크립트 — 환경 준비 후 실행 |
| 스테이징 첫 배포 + 시연 | ⏳ | 가이드 §1.2 ~ §5 따라 진행 |

---

## 4. 운영 진입 명령 1줄 요약

```bash
# (1) DB 마이그레이션 + 데모 시드
DB_HOST=localhost DB_USER=root DB_PASS=xxx SEED_DEMO_DATA=true \
  bash apps/app-hscode-manager/db-migrations/00_apply_all.sh

# (2) 로컬 BE/FE 기동
cd apps/app-hscode-manager/backend && cp ../.env.example .env && npm install && npm run dev &
cd apps/app-hscode-manager/frontend && npm install && npm run dev &

# (3) 또는 스테이징 배포
ssh ambAppStore@stg-apps.amoeba.site \
  "cd ~/ambAppStore && git pull origin main && \
   SEED_DEMO_DATA=true bash apps/app-hscode-manager/db-migrations/00_apply_all.sh && \
   bash platform/scripts/deploy-staging.sh full hscode"

# (4) 헬스체크
curl http://localhost:3102/api/v1/health
# 또는: curl https://stg-apps.amoeba.site/app-hscode/api/v1/health
```

---

## 5. 변경 사이드 임팩트

| 범위 | 영향 | 상태 |
|------|------|------|
| 다른 앱 (platform / car-manager / stock / sales) | deploy 스크립트의 `ALL_APPS` 배열에 hscode 추가됨 — `full` 모드 시 hscode도 함께 빌드/기동 | ✔ — 기존 4앱 동작 변경 없음 (별도 컨테이너) |
| Docker 네트워크 | `amb-apps-network` 외부 네트워크 공유 — hscode가 합류 | ✔ |
| Nginx 라우팅 | `/app-hscode/` 와 `/app-hscode/api/` 이미 매핑됨 (Phase 0에서 확인) | ✔ |
| DB 서버 | `db_app_hscode` 별도 DB — 기존 DB와 격리 | ✔ |
| AMA SSO | 역할 발급 흐름 *합의 필요* — `AMA-SSO-ROLES.md` 가 합의 문서 역할 | ⚠ 운영팀 협조 |
| 시드 데이터 | `ent-test-001` 데모 Exporter — 실제 운영 ent_id로 교체 필요. `SEED_DEMO_DATA=false` (기본) 시 적재 안 됨 | ⚠ 시연 후 정리 |

---

## 6. 누적 산출물 통계 (Phase 0~M1 운영 준비)

| 카테고리 | 수량 |
|----------|------|
| Backend 소스 파일 | ~80개 (도메인 14개 모듈) |
| Frontend 페이지 | 15개 (S01~S11, S17 6탭) |
| API 엔드포인트 | 45개 |
| DB 테이블 | 15개 |
| DB 마이그레이션 SQL | 4 + 3 시드 = **7개** |
| i18n 네임스페이스 | common / admin / inquiry / intake / matching / classification = **6개** × 3언어 |
| 실행 가이드 / 분석서 / 계획서 / TC | 18개 (분석·계획·TC·5개 Phase RPT·M1 가이드 등) |

---

## 7. 회고

- **잘 된 점**:
  - `00_apply_all.sh` 가 4개 Phase의 DDL + ALTER + 시드를 단일 명령으로 idempotent 적용 — 운영 진입의 가장 큰 마찰점이 제거됨
  - `SEED_DEMO_DATA=true` 환경변수로 데모/운영 시드를 분리 — 실수로 운영에 데모 데이터가 들어가지 않음
  - AMA-SSO-ROLES.md 가 *프로그래밍 측 요구사항을 운영팀에 전달하는 합의 문서* 역할 — Phase 1·2·3·4 공통 리스크를 해소하는 마지막 piece
  - M1 시연 가이드의 9단계가 *cURL 한 줄씩* 실행 가능 — 통합 테스트 자동화의 기반
- **개선 여지**:
  - `deploy-staging.sh` 가 macOS bash 3.x 비호환 (기존 문제 — `declare -A`). Linux 서버에서만 동작. macOS에서 로컬 시연 시 별도 명령 필요
  - DB 마이그레이션 러너가 idempotent하지만 *순서 변경/리네임 시* 대응 안 됨 — Phase 5+에서 TypeORM migration 도구 도입 검토
  - 데모 시드의 `composition_hash` 가 정규화 v0.1.0 기준 — Phase 5에서 v0.2.0 출시 시 재계산 필요
- **위험**:
  - 운영팀의 AMA SSO 역할 발급 일정이 미정 — 가이드는 작성했으나 *합의 회의* 가 필요
  - 첫 스테이징 배포 시 외부 네트워크 / 환경변수 / DB 권한 등의 *조합 이슈* 가능성 — 시연 가이드 §7 트러블슈팅이 1차 대응. Phase 5 진입 전 1회 실시연 권장

---

## 8. 다음 단계

추천 진행 순서대로 정렬:

1. **M1 회귀 시연 1회 실시** — 가이드 따라 cURL 또는 UI 통과 (DB 환경 준비 + 약 30분)
2. **k6 부하 테스트** (NFR-PF-01·02) — 가이드 §6
3. **AMA SSO 역할 발급 회의** — `AMA-SSO-ROLES.md` 를 합의 문서로 사용
4. **첫 스테이징 배포** — `deploy-staging.sh full hscode`
5. **Phase 5 시작** — 검증·피드백 루프 (2주, M2 마일스톤)

운영 환경 준비는 코드 측에서 할 수 있는 모든 작업을 완료했다. 다음은 *실 환경 시연* 또는 *Phase 5 개발* 진행이 가능하다.
