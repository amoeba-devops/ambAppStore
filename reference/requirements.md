---
document_id: APPSTORE-REQ-1.0.0
version: 1.0.0
status: Draft
created: 2026-03-27
updated: 2026-03-27
author: Kim Igyong
---

# ambAppStore — Requirements Definition
# (요구사항정의서)

---

## 1. Overview (개요)

본 문서는 ambAppStore 플랫폼에서 개발되는 **4개 커스텀 앱**의 기능 요구사항(FR) 및
비기능 요구사항(NFR)을 정의한다.

**우선순위 정의**:

| Level | Meaning |
|-------|---------|
| P0 | 필수 — 없으면 서비스 불가 |
| P1 | 중요 — MVP에 포함 |
| P2 | 선택 — 추후 단계 |

---

## 2. Platform Common Requirements (플랫폼 공통 요구사항)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-PLT-001 | 각 앱은 독립된 Vite 빌드 단위로 구성 (`base: '/{slug}'`) | P0 |
| FR-PLT-002 | 각 앱 BFF는 독립 Docker 컨테이너로 격리 운영 | P0 |
| FR-PLT-003 | 앱별 독립 MySQL DB (`db_app_{slug}`) 사용 — AMA PostgreSQL 직접 접근 불가 | P0 |
| FR-PLT-004 | 모든 API는 `/api/v1` base path 준수, 표준 응답 포맷 적용 | P0 |
| FR-PLT-005 | 표준 응답 형식: `{ success, data, error?: { code, message }, timestamp }` | P0 |
| FR-PLT-006 | NestJS BFF — Clean Architecture (domain / application / infrastructure / presentation) 4계층 적용 | P0 |
| FR-PLT-007 | 인증: AMA JWT 토큰 검증 미들웨어 (Bearer Token) 또는 자체 JWT | P1 |
| FR-PLT-008 | Health Check 엔드포인트: `GET /health` → `{ status: 'ok' }` | P0 |
| FR-PLT-009 | HTTPS 강제 (Nginx SSL, Let's Encrypt) | P0 |
| FR-PLT-010 | UI 텍스트 i18n 적용 (KO 필수, EN 권장) | P1 |
| FR-PLT-011 | Soft Delete 패턴 적용 (`{prefix}_deleted_at`) | P0 |
| FR-PLT-012 | 모든 PK는 UUID v4 사용 | P0 |

---

## 3. App 1 — car-manager (법인차량관리)

### 3.1 Background (배경)

아메바컴퍼니 한국/베트남 법인의 업무용 차량을 통합 관리한다.
차량 배차 프로세스의 디지털화, 운행 기록 자동화, 유지보수 비용 추적을 목표로 한다.

### 3.2 User Types (사용자 유형)

| Type | Description |
|------|-------------|
| Admin (관리자) | 차량 등록/수정/삭제, 전체 배차 승인, 리포트 조회 |
| Driver (운전자) | 배차 신청, 운행일지 작성, 자신의 배차 이력 조회 |
| Viewer (조회자) | 차량 현황 및 배차 일정 조회만 가능 |

### 3.3 Functional Requirements (기능 요구사항)

#### 3.3.1 차량 관리

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CAR-001 | 차량 등록: 차량번호, 제조사, 모델, 연식, 색상, 연료유형, 최대 탑승인원, 사진 | P0 |
| FR-CAR-002 | 차량 수정 및 소프트 삭제 | P0 |
| FR-CAR-003 | 차량 목록 조회: 상태별 필터(가용/배차중/정비중), 검색(차량번호/모델명) | P0 |
| FR-CAR-004 | 차량 상세 조회: 기본 정보 + 현재 배차 상태 + 최근 운행 이력 | P0 |
| FR-CAR-005 | 차량 상태 변경: 가용(AVAILABLE) / 배차중(IN_USE) / 정비중(MAINTENANCE) / 폐차(DISPOSED) | P0 |
| FR-CAR-006 | 차량 사진 업로드 (최대 5장) | P1 |
| FR-CAR-007 | 차량 보험 만료일 알림 (D-30, D-7) | P2 |

#### 3.3.2 배차 관리

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CAR-010 | 배차 신청: 차량 선택, 사용 목적, 출발지, 목적지, 시작/종료 예정일시, 동승자 | P0 |
| FR-CAR-011 | 배차 신청 시 동일 시간대 차량 중복 배차 방지 (충돌 검사) | P0 |
| FR-CAR-012 | 배차 승인/반려 (Admin) — 반려 시 사유 입력 필수 | P0 |
| FR-CAR-013 | 배차 취소 (신청자 본인 또는 Admin) | P0 |
| FR-CAR-014 | 배차 일정 캘린더 뷰 (차량별, 월별) | P1 |
| FR-CAR-015 | 배차 상태: PENDING / APPROVED / IN_USE / COMPLETED / CANCELLED / REJECTED | P0 |
| FR-CAR-016 | 배차 완료 처리 시 실제 반납 일시 기록 | P0 |

#### 3.3.3 운행일지

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CAR-020 | 운행일지 작성: 출발/도착 주행거리, 운행 목적, 경유지, 연료 주입 여부 | P0 |
| FR-CAR-021 | 운행일지는 배차 완료 후 작성 가능 (배차 건과 1:1 연결) | P0 |
| FR-CAR-022 | 차량별 누적 주행거리 자동 계산 | P0 |
| FR-CAR-023 | 운행일지 목록 조회: 기간 필터, 차량 필터, 운전자 필터 | P1 |

#### 3.3.4 유지보수 / 비용 관리

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CAR-030 | 유지보수 기록 등록: 유형(엔진오일/타이어/보험/기타), 날짜, 비용, 메모, 영수증 첨부 | P0 |
| FR-CAR-031 | 차량별 유지보수 이력 조회 | P0 |
| FR-CAR-032 | 연료비 기록: 주유량, 단가, 금액, 주유소 | P1 |
| FR-CAR-033 | 차량별 월간/연간 비용 집계 (유지보수 + 연료비) | P1 |
| FR-CAR-034 | 비용 내역 Excel 다운로드 | P2 |

---

## 4. App 2 — app-hscode (HS Code 검색·분류 도구)

### 4.1 Background (배경)

수출입 업무 담당자가 물품에 맞는 HS Code를 빠르게 찾고,
관세율 및 협정세율(FTA)을 조회하며,
AI를 활용해 품목 분류를 지원받을 수 있는 도구이다.

### 4.2 User Types (사용자 유형)

| Type | Description |
|------|-------------|
| User | HS Code 검색, 세율 조회, AI 분류 요청, 즐겨찾기 저장 |
| Admin | HS Code 데이터 업데이트, 사용 통계 조회 |

### 4.3 Functional Requirements (기능 요구사항)

#### 4.3.1 HS Code 검색

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-HSC-001 | 키워드 검색: 품목 설명(한국어/영어), HS Code 번호로 검색 | P0 |
| FR-HSC-002 | 검색 결과: HS Code, 품목 설명(KO/EN), 세율, 단위 표시 | P0 |
| FR-HSC-003 | HS Code 계층 탐색: 류(2자리) → 호(4자리) → 소호(6자리) → 국내세번(10자리) | P0 |
| FR-HSC-004 | 자동완성 검색 (debounce 300ms, 최소 2자 입력) | P1 |
| FR-HSC-005 | 최근 검색 이력 저장 (로컬 스토리지, 최대 20건) | P1 |
| FR-HSC-006 | 즐겨찾기 등록/해제 및 즐겨찾기 목록 조회 (로그인 필요) | P1 |

#### 4.3.2 세율 조회

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-HSC-010 | 기본 관세율 조회 (MFN Rate) | P0 |
| FR-HSC-011 | FTA 협정세율 조회 (한-미, 한-EU, 한-베트남 등 주요 협정) | P0 |
| FR-HSC-012 | 국가별 세율 비교 테이블 | P1 |
| FR-HSC-013 | 수입 요건 및 규제 정보 표시 (허가, 검역 등) | P2 |

#### 4.3.3 AI 품목 분류 지원

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-HSC-020 | 품목 설명 텍스트 입력 → AI가 HS Code 후보 3~5개 추천 | P0 |
| FR-HSC-021 | AI 추천 결과에 신뢰도 점수 및 분류 근거 표시 | P0 |
| FR-HSC-022 | 제품 이미지 업로드 → AI 품목 분류 지원 (Claude Vision 활용) | P2 |
| FR-HSC-023 | AI 분류 이력 저장 (로그인 사용자) | P1 |

#### 4.3.4 데이터 관리 (Admin)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-HSC-030 | HS Code 데이터 CSV 일괄 업로드 | P1 |
| FR-HSC-031 | HS Code 개별 수정/추가 | P1 |
| FR-HSC-032 | 검색/조회 통계 대시보드 | P2 |

---

## 5. App 3 — app-sales-report (매출리포트)

### 5.1 Background (배경)

경영진이 다양한 판매 채널(자사몰, 쿠팡, 네이버, 인스타그램 등)의
매출 데이터를 한 곳에서 조회하고 분석할 수 있는 리포트 플랫폼이다.

### 5.2 User Types (사용자 유형)

| Type | Description |
|------|-------------|
| Executive (경영진) | 전체 매출 대시보드, 채널별/기간별 리포트 조회, Excel 다운로드 |
| Manager (담당자) | 데이터 업로드, 집계 실행, 리포트 설정 |

### 5.3 Functional Requirements (기능 요구사항)

#### 5.3.1 데이터 수집

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SAL-001 | CSV/Excel 파일 업로드로 채널 매출 데이터 수집 | P0 |
| FR-SAL-002 | 채널 매핑 설정: 업로드 파일 컬럼 → 시스템 표준 필드 매핑 | P0 |
| FR-SAL-003 | 데이터 업로드 이력 관리 (업로드 일시, 건수, 담당자) | P1 |
| FR-SAL-004 | 채널별 API 자동 연동 (쿠팡, 네이버 등) — Phase 2 | P2 |

#### 5.3.2 매출 대시보드

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SAL-010 | 기간별 총 매출 조회 (일/주/월/분기/연 단위) | P0 |
| FR-SAL-011 | 채널별 매출 비중 파이차트 | P0 |
| FR-SAL-012 | 매출 추이 라인 차트 (기간 비교 가능) | P0 |
| FR-SAL-013 | 전월/전년 동기 대비 증감율 표시 | P0 |
| FR-SAL-014 | 상품별 매출 순위 TOP 20 | P1 |
| FR-SAL-015 | 채널별 매출 목표 대비 달성율 | P1 |

#### 5.3.3 리포트

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SAL-020 | 채널별 상세 리포트 페이지 | P0 |
| FR-SAL-021 | 기간/채널 조건으로 데이터 필터링 | P0 |
| FR-SAL-022 | 리포트 Excel 다운로드 | P0 |
| FR-SAL-023 | 리포트 PDF 출력 | P2 |
| FR-SAL-024 | 정기 리포트 이메일 발송 (주간/월간) | P2 |

---

## 6. App 4 — app-stock-management (재고관리시스템)

### 6.1 Background (배경)

운영팀이 다중 채널 판매에 따른 재고를 통합 관리하고,
AI 기반 수요 예측으로 발주 시점과 발주량을 최적화하여
품절과 과재고를 동시에 방지하는 시스템이다.

### 6.2 User Types (사용자 유형)

| Type | Description |
|------|-------------|
| Manager (재고 담당자) | 재고 입출고 처리, 발주 실행, 전체 기능 |
| Viewer | 재고 현황, 예측 결과 조회만 가능 |

### 6.3 Functional Requirements (기능 요구사항)

#### 6.3.1 상품/재고 관리

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-STK-001 | 상품 등록: SKU, 상품명, 카테고리, 바코드, 단가, 안전재고량, 최소발주량 | P0 |
| FR-STK-002 | 상품 수정/소프트 삭제 | P0 |
| FR-STK-003 | 재고 현황 목록: 현재 재고량, 안전재고 대비 상태(정상/부족/위험) 표시 | P0 |
| FR-STK-004 | 창고별 재고 관리 (다중 창고 지원) | P1 |
| FR-STK-005 | 바코드 스캔 입력 지원 (웹 카메라 또는 스캐너) | P2 |

#### 6.3.2 입출고 관리

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-STK-010 | 입고 처리: 발주 연결 또는 단독 입고, 수량, 입고일, 단가, 메모 | P0 |
| FR-STK-011 | 출고 처리: 채널 판매 출고, 반품 입고, 폐기 처리 | P0 |
| FR-STK-012 | 입출고 이력 조회: 기간/상품/유형 필터 | P0 |
| FR-STK-013 | 재고 실사 기능: 실사 수량 입력 → 장부 재고 대비 차이 표시 | P1 |
| FR-STK-014 | CSV 일괄 입출고 처리 | P1 |

#### 6.3.3 AI 수요 예측

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-STK-020 | 상품별 과거 판매 데이터 기반 향후 30/60/90일 수요 예측 | P0 |
| FR-STK-021 | 예측 결과: 예상 판매량, 신뢰 구간, 예측 근거 표시 | P0 |
| FR-STK-022 | 계절성/이벤트 요인 반영 예측 (프로모션 일정 입력 가능) | P1 |
| FR-STK-023 | 예측 모델 정확도 리포트 (예측 vs 실제 비교) | P1 |
| FR-STK-024 | Claude API 연동 — 예측 결과 자연어 해석 제공 | P1 |

#### 6.3.4 발주 관리

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-STK-030 | AI 기반 발주 추천: 발주 필요 상품 목록 + 추천 발주량 자동 산출 | P0 |
| FR-STK-031 | 발주서 생성: 공급사, 상품, 수량, 단가, 납기일 | P0 |
| FR-STK-032 | 발주 상태 관리: DRAFT / ORDERED / PARTIAL_RECEIVED / COMPLETED | P0 |
| FR-STK-033 | 발주 Excel 출력 | P1 |

---

## 7. Non-Functional Requirements (비기능 요구사항)

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-001 | Performance | 페이지 초기 로드 3초 이내 (LCP 기준) |
| NFR-002 | Performance | API 응답 시간 500ms 이내 (95th percentile) |
| NFR-003 | Availability | 서비스 가용성 99% 이상 (월 기준) |
| NFR-004 | Security | HTTPS 강제, XSS/SQL Injection 방어 |
| NFR-005 | Security | 환경변수 내 시크릿 하드코딩 금지 — CI secret scan 적용 |
| NFR-006 | Isolation | 한 앱의 오류가 타 앱 서비스에 영향 없음 |
| NFR-007 | Maintainability | 클린 아키텍처 4계층 준수 — 레이어 간 의존성 역전 원칙 적용 |
| NFR-008 | Scalability | 앱별 독립 Docker 컨테이너로 수평 확장 가능 구조 |
| NFR-009 | Compatibility | Chrome, Edge, Safari 최신 2버전 지원 |
| NFR-010 | Compatibility | 모바일 반응형 (768px 이상 주요 대상, 320px 최소 지원) |
| NFR-011 | Data | MySQL 8.0, UTF8MB4 문자셋, 소프트 삭제 패턴 |
| NFR-012 | Code | Amoeba 코드 컨벤션 준수 — ESLint 자동 검사 |

---

## 8. Constraints (제약 사항)

| ID | Constraint |
|----|-----------|
| CON-001 | 프론트엔드 프레임워크: React 18 + TypeScript 5 만 허용 |
| CON-002 | 백엔드 프레임워크: NestJS 10 만 허용 |
| CON-003 | DB: MySQL 8.0 — AMA PostgreSQL 직접 접근 불가 |
| CON-004 | 빌드 도구: Vite 5 — Webpack 불허 |
| CON-005 | 각 앱은 `apps/{app-slug}/` 디렉토리 내에서만 코드 작성 |
| CON-006 | 타 앱 디렉토리 및 `platform/`, `packages/` 직접 수정 불가 |
| CON-007 | develop 브랜치 직접 push 불가 — PR 필수 |

---

*Document ID: APPSTORE-REQ-1.0.0 | Author: Kim Igyong | 2026-03-27*
