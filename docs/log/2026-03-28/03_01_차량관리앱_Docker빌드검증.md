# 03:00 법인차량관리 앱 Docker 배포 + 빌드 검증 + 서버 시작 테스트

## 사용자 요청
이전 세션 이어서 작업계획서 순서대로 작업 진행

## 수행 작업

### 1. Docker 배포 파일 생성 (T-174)
- `apps/app-car-manager/backend/Dockerfile` — Multi-stage node:20-alpine, port 3101
- `apps/app-car-manager/frontend/Dockerfile` — Multi-stage node→nginx:alpine, VITE ARGs
- `apps/app-car-manager/frontend/nginx.conf` — SPA 라우팅 (/app-car-manager base)
- `apps/app-car-manager/docker-compose.app-car-manager.yml` — bff-car-manager(3101), web-car-manager(5201), mysql-apps
- `apps/app-car-manager/.env.staging.example` — 환경변수 템플릿

### 2. 의존성 설치
- 백엔드: `npm install` → 562 packages
- 프론트엔드: `npm install` → 610 packages

### 3. TypeScript 빌드 검증 — 에러 수정
1. **AmaJwtPayload 인터페이스**: `ent_id`, `sub` 등 JWT claim 속성 추가, jwt.strategy.ts에서 양방향 매핑
2. **Vehicle 서비스 import 경로**: `./entity/` → `../entity/`, `../../common/` → `../../../common/`
3. **VehicleStatus.UNAVAILABLE**: enum에 없는 값 → `DISPOSED`로 변경
4. **vite-env.d.ts**: `import.meta.env` 타입 선언 파일 추가
5. **TypeORM nullable string 컬럼**: `string | null` union type에 reflect-metadata가 Object 반환하는 문제 → 4개 컬럼에 `type: 'varchar'` 명시
   - vehicle.entity.ts: cvhColor, cvhVin, cvhDedicatedDept
   - maintenance-record.entity.ts: cmrShopName
6. **dispatch-request.entity.ts**: cdrActualUserName에 `type: 'varchar'` 명시
7. **app.module.ts**: ConfigModule envFilePath + TypeOrmModule.forRootAsync 변경 (.env 파일 확실히 로드)

### 4. DB 초기화
- `db_app_car` 데이터베이스 생성 (Docker mysql-apps 컨테이너)
- `init-db.sql` 실행 → 6개 테이블 생성 확인

### 5. 서버 시작 테스트
- `nest build` → 성공
- `node dist/main.js` → DB 연결 성공, 모든 라우트 매핑, 3101 포트 리스닝 확인
- 총 37개 API 엔드포인트 등록 확인

## 변경된 파일 목록
| 구분 | 파일 | 변경 유형 |
|------|------|----------|
| Docker | backend/Dockerfile | 신규 |
| Docker | frontend/Dockerfile | 신규 |
| Docker | frontend/nginx.conf | 신규 |
| Docker | docker-compose.app-car-manager.yml | 신규 |
| Config | .env.staging.example | 신규 |
| Config | backend/.env | 신규 (로컬 개발용) |
| Backend | auth/interfaces/ama-jwt-payload.interface.ts | 수정 |
| Backend | auth/jwt.strategy.ts | 수정 |
| Backend | domain/vehicle/service/vehicle.service.ts | 수정 (import 경로) |
| Backend | domain/vehicle/entity/vehicle.entity.ts | 수정 (varchar 타입 명시) |
| Backend | domain/dispatch/entity/dispatch-request.entity.ts | 수정 (varchar 타입 명시) |
| Backend | domain/maintenance/entity/maintenance-record.entity.ts | 수정 (varchar 타입 명시) |
| Backend | domain/monitor/service/monitor.service.ts | 수정 (UNAVAILABLE→DISPOSED) |
| Backend | app.module.ts | 수정 (ConfigService + forRootAsync) |
| Frontend | src/vite-env.d.ts | 신규 |

## 이슈 및 해결
1. MySQL 로컬 연결: Docker 내부 exec는 가능하나 호스트에서 mysql CLI 접근 불가 → node 앱은 .env 통해 정상 연결
2. TypeORM reflect-metadata: `string | null` union 타입 → reflect-metadata가 Object 반환 → 명시적 type 선언 필요
3. ConfigModule .env 로드 순서: 기존 `process.env.*` 직접 참조 → `TypeOrmModule.forRootAsync` + `ConfigService` 사용으로 변경

## 미완료 항목
- 프론트엔드 빌드 테스트 (`npm run build`)
- 프론트엔드 dev 서버 시작 테스트
- 전체 Docker Compose 테스트
- 작업 완료 보고서 작성
