# HS Code Manager — 배포 가이드 (Phase 6)

> **배포 원칙(CLAUDE.md)**: 스테이징 먼저, 프로덕션 직접 배포 금지. DB는 수동 SQL 마이그레이션(`synchronize=false`).

## 1. 구성 요약
| 컴포넌트 | 컨테이너 | 포트 | 비고 |
|----------|----------|------|------|
| BFF (NestJS) | `bff-app-hscode` | 3102 | `/api/v1` prefix |
| Web (정적 SPA) | `web-app-hscode` | 5202→80 | base `/app-hscode/` |
| DB | `postgres-hscode` | 5433→5432 | **pgvector/pgvector:pg15** |
| Queue | `redis-hscode` | 6380→6379 | BullMQ |

네트워크: `amb-apps-network` (external, 플랫폼과 공유).

## 2. Nginx 라우팅 (이미 플랫폼에 존재)
`platform/nginx/apps.amoeba.site.conf` 에 다음이 이미 설정되어 있음:
```
location /app-hscode/      { alias /usr/share/nginx/html/app-hscode/; try_files ... /app-hscode/index.html; }
location /app-hscode/api/  { proxy_pass http://bff-app-hscode:3102/api/; }
```
→ 프론트는 `/app-hscode/api/v1/*` 로 호출(빌드 base·api-client이 자동 정렬). 추가 수정 불필요.

## 3. 로컬/스테이징 기동
```bash
# 1) 네트워크 (최초 1회)
docker network create amb-apps-network || true

# 2) 환경변수 준비
cp backend/.env.example backend/.env   # 값 채우기 (JWT_SECRET, DB_PASSWORD, SETTINGS_ENC_KEY 등)

# 3) 빌드 & 기동 (DB 최초 기동 시 sql/hscode-manager-schema.sql 자동 적용)
docker compose -f docker-compose.app-hscode.yml up -d --build

# 4) 헬스체크
curl http://localhost:3102/api/v1/health
```

## 4. DB 마이그레이션 (스테이징/프로덕션 = 수동)
최초 기동 시 compose가 `sql/hscode-manager-schema.sql`을 initdb로 적용한다(extension `vector`/`pgcrypto` 포함).
기존 DB에 적용 시 수동 실행:
```bash
psql -h <host> -U hscode_app -d db_hsm -f sql/hscode-manager-schema.sql
```
- 임베딩 차원(`vector(1024)`)은 `.env EMBEDDING_DIMENSIONS`와 일치해야 함. 변경 시 인덱스 재생성 + 재임베딩 필요.

## 5. 시드 / RAG 코퍼스
1. 전역 참조 시드: `hsm_gpc_hs_maps`, `hsm_hs_country_extensions` (매핑 편집 UI 또는 SQL).
2. 면장리스트 import: 관리자 → 참조(Reference) → 가져오기 (`POST /api/v1/reference/imports`).
3. 임베딩 공급자(`EMBEDDING_PROVIDER`/`EMBEDDING_API_KEY`) 설정 시 import 시점에 pgvector 적재 → 의미검색 활성. 미설정 시 키워드 폴백.

## 6. 플랫폼 통합 배포 (web 정적)
프로덕션은 단독 `web-app-hscode` 대신 플랫폼 web-platform nginx가 `html/app-hscode/`에서 정적 서빙한다.
배포 스크립트가 `frontend/dist`를 web-platform html로 복사하는 방식(타 앱과 동일). 단독 검증 시에만 `web-app-hscode` 사용.

## 7. 미해결 선행 과제
- 임베딩 공급자 PoC 확정 (C-2) → 차원 N 고정
- 외부 L2(GS1)/L4(AI 분류) API 프로비저닝 (Feature B 후속)
- ToKhai/VMSG 어댑터 실파일 컬럼 매핑 검증
