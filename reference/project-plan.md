---
document_id: APPSTORE-PLAN-1.0.0
version: 1.0.0
status: Draft
created: 2026-03-27
updated: 2026-03-27
author: Kim Igyong
---

# ambAppStore — Project Execution Plan
# (프로젝트수행계획서)

---

## 1. Project Overview (프로젝트 개요)

| Item | Content |
|------|---------|
| **Project Name** | ambAppStore (AMA 파트너 커스텀 앱 플랫폼) |
| **Host** | apps.amoeba.site |
| **Staging** | apps.amoeba.site (스테이징 → 프로덕션 전용 예정) |
| **GitHub** | git@github.com:KimIgyong/ambAppStore.git |
| **Parent System** | AMA (AI Management Assistant) — ama.amoeba.site |
| **PM** | Kim Igyong |
| **Dev Team** | Amoeba Company KR/VN |
| **Start Date** | 2026-04-01 |

### 1.1 목표

1. AMA 생태계 위에서 동작하는 **커스텀 앱 4종** 개발 및 운영 환경 구축
2. 클린 아키텍처 + MSA 기반의 **앱 간 완전 격리** 플랫폼 확립
3. Docker 컨테이너 기반 **독립 배포·롤백** 체계 수립
4. 향후 외부 파트너 개발자가 앱을 추가할 수 있는 **확장 가능한 플랫폼** 기반 마련

---

## 2. Scope (프로젝트 범위)

### 2.1 In Scope (범위 내)

| # | App | Description |
|---|-----|-------------|
| 1 | **car-manager** | 법인차량 등록, 배차, 운행일지, 유지보수, 비용 관리 |
| 2 | **app-hscode** | HS Code 검색, 세율 조회, 품목 분류 지원 도구 |
| 3 | **app-sales-report** | SocialBean 매출 현황 대시보드, 채널별 리포트 |
| 4 | **app-stock-forecast** | SocialBean 재고 현황 관리 및 AI 기반 수요 예측 |

**공통 플랫폼 작업**:
- 모노레포(Turborepo) 구성 및 공유 패키지 세팅
- Nginx 라우팅, SSL 설정
- GitHub Actions CI/CD 파이프라인
- Docker Compose 앱별 격리 환경

### 2.2 Out of Scope (범위 외)

- AMA 메인 시스템(ama.amoeba.site) 코드 수정
- 외부 파트너 온보딩 UI (별도 Phase)
- 모바일 앱(iOS/Android) 빌드
- SocialBean 내부 ERP/WMS 직접 연동 (API 연동만 허용)

---

## 3. Team & Roles (팀 구성 및 역할)

| Role | Name | Responsibility |
|------|------|----------------|
| PM / Platform Owner | Kim Igyong | 전체 계획, PR 리뷰, 배포 승인, 아키텍처 결정 |
| Full-Stack Dev (KR) | TBD | car-manager, 플랫폼 인프라 |
| Full-Stack Dev (VN) | TBD | app-hscode, app-sales-report |
| Full-Stack Dev (VN) | TBD | app-stock-forecast |
| DevOps | Kim Igyong (겸) | Docker, Nginx, CI/CD, 서버 관리 |

---

## 4. WBS (Work Breakdown Structure)

### Phase 0 — 플랫폼 기반 구축 (2주, 2026-04-01 ~ 04-11)

| Task ID | Task | Owner | Est. | Depends |
|---------|------|-------|------|---------|
| T-001 | 모노레포 초기화 (Turborepo + npm workspaces) | PM | 0.5d | — |
| T-002 | 공유 패키지 구성 (eslint-config, tsconfig, ui-kit stub) | PM | 1d | T-001 |
| T-003 | 앱 Scaffolding 템플릿 생성 (FE + BE) | PM | 1d | T-002 |
| T-004 | Nginx 설정 (4개 앱 라우팅 + SSL) | PM | 0.5d | T-001 |
| T-005 | Docker Compose 템플릿 작성 (BFF 격리 구조) | PM | 0.5d | T-001 |
| T-006 | GitHub Actions CI 파이프라인 (lint + build + secret scan) | PM | 1d | T-003 |
| T-007 | GitHub Actions CD 파이프라인 (develop → stg 자동 배포) | PM | 1d | T-006 |
| T-008 | MySQL 인스턴스 세팅 (apps 서버), DB/유저 4개 생성 | PM | 0.5d | — |
| T-009 | CODEOWNERS, Branch Protection Rule 설정 | PM | 0.5d | T-001 |

### Phase 1 — car-manager 개발 (4주, 2026-04-14 ~ 05-09)

| Task ID | Task | Owner | Est. | Depends |
|---------|------|-------|------|---------|
| T-101 | DB 스키마 설계 및 마이그레이션 (`db_app_car`) | KR Dev | 1d | T-008 |
| T-102 | NestJS BFF 프로젝트 세팅 (Clean Architecture 구조) | KR Dev | 1d | T-003 |
| T-103 | 차량 CRUD API 구현 | KR Dev | 2d | T-102 |
| T-104 | 배차 신청/승인 API 구현 | KR Dev | 2d | T-103 |
| T-105 | 운행일지 CRUD API 구현 | KR Dev | 2d | T-103 |
| T-106 | 유지보수/비용 관리 API 구현 | KR Dev | 2d | T-103 |
| T-107 | React FE — 차량 목록/등록/상세 화면 | KR Dev | 2d | T-103 |
| T-108 | React FE — 배차 화면 | KR Dev | 2d | T-104 |
| T-109 | React FE — 운행일지/비용 화면 | KR Dev | 2d | T-105, T-106 |
| T-110 | React FE — 대시보드 (차량 현황 요약) | KR Dev | 1d | T-107 |
| T-111 | Docker 컨테이너 빌드 + 스테이징 배포 | PM | 0.5d | T-110 |
| T-112 | 테스트 및 버그 수정 | KR Dev | 2d | T-111 |

### Phase 2 — app-hscode 개발 (3주, 2026-04-14 ~ 05-02)

| Task ID | Task | Owner | Est. | Depends |
|---------|------|-------|------|---------|
| T-201 | DB 스키마 설계 (`db_app_hscode`) + 초기 HS Code 데이터 적재 | VN Dev 1 | 2d | T-008 |
| T-202 | NestJS BFF 세팅 + HS Code 검색 API | VN Dev 1 | 2d | T-003 |
| T-203 | 세율/협정 조회 API 구현 | VN Dev 1 | 2d | T-202 |
| T-204 | AI 품목 분류 지원 API (AMA AI 연동 또는 자체 Claude API) | VN Dev 1 | 2d | T-202 |
| T-205 | React FE — 검색/결과 화면 | VN Dev 1 | 2d | T-202 |
| T-206 | React FE — 세율 상세/비교 화면 | VN Dev 1 | 1.5d | T-203 |
| T-207 | React FE — AI 분류 도우미 화면 | VN Dev 1 | 1.5d | T-204 |
| T-208 | 스테이징 배포 + 테스트 | VN Dev 1 | 1d | T-207 |

### Phase 3 — app-sales-report 개발 (3주, 2026-05-12 ~ 05-30)

| Task ID | Task | Owner | Est. | Depends |
|---------|------|-------|------|---------|
| T-301 | SocialBean 데이터 연동 방식 협의 (API / DB dump / 파일 업로드) | PM | 1d | — |
| T-302 | DB 스키마 설계 (`db_app_sales`) | VN Dev 1 | 1d | T-301 |
| T-303 | 데이터 수집/집계 파이프라인 API 구현 | VN Dev 1 | 3d | T-302 |
| T-304 | 채널별 매출 API 구현 | VN Dev 1 | 2d | T-303 |
| T-305 | React FE — 매출 대시보드 (차트: Recharts) | VN Dev 1 | 3d | T-304 |
| T-306 | React FE — 채널별 리포트 화면 | VN Dev 1 | 2d | T-304 |
| T-307 | Excel 리포트 다운로드 기능 | VN Dev 1 | 1d | T-305 |
| T-308 | 스테이징 배포 + 테스트 | VN Dev 1 | 1d | T-307 |

### Phase 4 — app-stock-forecast 개발 (4주, 2026-05-12 ~ 06-06)

| Task ID | Task | Owner | Est. | Depends |
|---------|------|-------|------|---------|
| T-401 | DB 스키마 설계 (`db_app_stock`) | VN Dev 2 | 1d | T-008 |
| T-402 | NestJS BFF 세팅 + 재고 CRUD API | VN Dev 2 | 2d | T-003 |
| T-403 | 입출고 관리 API | VN Dev 2 | 2d | T-402 |
| T-404 | AI 수요 예측 API (Claude API 연동) | VN Dev 2 | 3d | T-402 |
| T-405 | 발주 추천 로직 구현 | VN Dev 2 | 2d | T-404 |
| T-406 | React FE — 재고 현황 화면 | VN Dev 2 | 2d | T-402 |
| T-407 | React FE — 입출고 화면 | VN Dev 2 | 2d | T-403 |
| T-408 | React FE — AI 예측 대시보드 | VN Dev 2 | 3d | T-404 |
| T-409 | React FE — 발주 추천/실행 화면 | VN Dev 2 | 2d | T-405 |
| T-410 | 스테이징 배포 + 테스트 | VN Dev 2 | 1d | T-409 |

---

## 5. Milestones (마일스톤)

| Milestone | Date | Criteria |
|-----------|------|----------|
| **M-0** Phase 0 완료 — 플랫폼 기반 | 2026-04-11 | CI/CD, Docker, Nginx, DB 환경 완비 |
| **M-1** car-manager 스테이징 배포 | 2026-05-09 | 핵심 기능(차량/배차/운행) 동작 확인 |
| **M-2** app-hscode 스테이징 배포 | 2026-05-02 | HS Code 검색 + AI 분류 동작 확인 |
| **M-3** app-sales-report 스테이징 배포 | 2026-05-30 | SocialBean 데이터 연동 + 대시보드 동작 |
| **M-4** app-stock-forecast 스테이징 배포 | 2026-06-06 | 재고 관리 + AI 예측 동작 확인 |
| **M-5** 전체 프로덕션 전환 | 2026-06-20 | 4개 앱 통합 검증 + 운영 이관 |

---

## 6. Schedule Summary (일정 요약)

```
2026-04  ████████████░░░░░░░░░░░░░░░░░░░░
          Phase 0 (기반)
          Phase 1 시작 (car-manager)
          Phase 2 시작 (hscode) — 병행

2026-05  ░░░░░████████████████████████████
          Phase 1 완료 (car-manager)
          Phase 2 완료 (hscode)
          Phase 3 시작 (sales-report)
          Phase 4 시작 (stock-forecast) — 병행

2026-06  ░░░░░░░░░░░░░░░░░░░░████████████
          Phase 3 완료 (sales-report)
          Phase 4 완료 (stock-forecast)
          전체 통합 검증 → 프로덕션 전환
```

---

## 7. Risk Management (리스크 관리)

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| R-001 | SocialBean 데이터 연동 방식 미확정 → T-301 지연 | 중 | 높음 | Phase 3 착수 전 2주 내 협의 완료 |
| R-002 | AI 예측 모델 정확도 기대치 미달 | 중 | 중간 | Phase 1에서 간단한 통계 모델로 시작, AI는 단계적 적용 |
| R-003 | 서버 리소스 부족 (4개 Docker BFF 동시 운영) | 낮음 | 중간 | 메모리 모니터링, 필요 시 경량 앱은 BFF 제거 |
| R-004 | 파트너 개발자 Amoeba 컨벤션 미준수 | 중 | 중간 | ESLint 자동 차단 + PR 리뷰 체크리스트 의무화 |
| R-005 | MySQL 데이터 누적으로 인한 앱 성능 저하 | 낮음 | 중간 | 인덱스 설계 선행, 데이터 보존 정책 수립 |

---

## 8. Definition of Done (완료 기준)

각 앱의 스테이징 배포 완료 기준:

- [ ] 핵심 기능 요구사항(FR) 100% 구현
- [ ] ESLint, TypeScript 빌드 오류 0건
- [ ] Docker 컨테이너 정상 기동 + Health Check 통과
- [ ] Nginx 라우팅 정상 동작 (`/app-slug/*` 경로)
- [ ] PR 코드 리뷰 승인 (PM)
- [ ] 기본 기능 테스트 시나리오 통과

---

*Document ID: APPSTORE-PLAN-1.0.0 | Author: Kim Igyong | 2026-03-27*
