# 운전자 추가 — AMA OAuth 2.0 Open API 연동 테스트케이스

**문서 ID**: TC-20260418-운전자추가-AMA-OAuth연동
**작성일**: 2026-04-18
**작성자**: Gray Kim
**참조**: PLAN-20260418-운전자추가-AMA-OAuth연동

---

## 테스트 범위

- 대상: OAuth 토큰 관리 (BE), Open API 프록시 (BE), OAuth 플로우 UI (FE), DriverFormModal (FE)
- 환경: 스테이징 (https://stg-apps.amoeba.site/app-car-manager)
- 사전 조건: AMA Partner App 등록 완료 (client_id/secret 발급), JWT 인증 완료

---

## A. Backend — OAuth 토큰 관리

### TC-001: OAuth 인가 URL 생성

- **연관**: Phase 2-2
- **사전 조건**: client_id/secret 환경변수 설정
- **테스트 단계**:
  1. `GET /api/v1/ama/oauth/authorize` 호출
- **기대 결과**:
  - `{ success: true, data: { url: "https://stg-ama.amoeba.site/oauth/authorize?client_id=...&scope=users:read&redirect_uri=...&response_type=code&state=..." } }`
  - URL에 client_id, scope, redirect_uri, state 파라미터 포함
- **우선순위**: 상

### TC-002: Authorization Code → Token 교환

- **연관**: Phase 2-2
- **사전 조건**: AMA OAuth 인가 완료 → code 수신
- **테스트 단계**:
  1. `GET /api/v1/ama/oauth/callback?code={valid_code}&state={state}` 호출
- **기대 결과**:
  - AMA에 `POST /oauth/token` 호출 (code + client_id + client_secret)
  - access_token, refresh_token 수신 및 서버 캐싱
  - `{ success: true, data: { connected: true } }` 응답
- **우선순위**: 상

### TC-003: 잘못된 code로 토큰 교환 실패

- **연관**: Phase 2-2
- **테스트 단계**:
  1. `GET /api/v1/ama/oauth/callback?code=invalid_code&state=xxx` 호출
- **기대 결과**:
  - AMA가 에러 반환 → car-manager가 에러 응답
  - `{ success: false, error: { code: "CAR-E9003", message: "..." } }`
  - 서버 크래시 없음
- **우선순위**: 상

### TC-004: OAuth 토큰 상태 확인 — 미연동

- **연관**: Phase 2-2
- **사전 조건**: OAuth 토큰 없는 상태
- **테스트 단계**:
  1. `GET /api/v1/ama/oauth/status` 호출
- **기대 결과**:
  - `{ success: true, data: { connected: false } }`
- **우선순위**: 상

### TC-005: OAuth 토큰 상태 확인 — 연동 완료

- **연관**: Phase 2-2
- **사전 조건**: TC-002 토큰 교환 성공 후
- **테스트 단계**:
  1. `GET /api/v1/ama/oauth/status` 호출
- **기대 결과**:
  - `{ success: true, data: { connected: true } }`
- **우선순위**: 상

### TC-006: Open API 멤버 조회 성공

- **연관**: Phase 2-1
- **사전 조건**: OAuth 토큰 캐싱 완료
- **테스트 단계**:
  1. `GET /api/v1/ama/members?search=kim` 호출
- **기대 결과**:
  - BE가 `GET {AMA}/api/v1/open/users?search=kim` 호출 (OAuth access_token 전달)
  - `{ success: true, data: [{ userId, name, email, department? }] }`
- **우선순위**: 상

### TC-007: 토큰 만료 시 자동 갱신

- **연관**: Phase 2-1
- **사전 조건**: access_token 만료, refresh_token 유효
- **테스트 단계**:
  1. `GET /api/v1/ama/members` 호출
- **기대 결과**:
  - AMA가 401 반환 → BE가 자동으로 refresh_token으로 갱신
  - 갱신 성공 → 재시도 → 멤버 목록 정상 반환
  - 사용자에게 에러 노출 없음
- **우선순위**: 중

### TC-008: refresh_token도 만료 시

- **연관**: Phase 2-1
- **사전 조건**: access_token, refresh_token 모두 만료
- **테스트 단계**:
  1. `GET /api/v1/ama/members` 호출
- **기대 결과**:
  - 갱신 실패 → `{ connected: false }` 상태로 전환
  - 멤버 빈 배열 반환 또는 재연동 필요 에러
- **우선순위**: 중

### TC-009: 인증 없이 OAuth 엔드포인트 호출

- **연관**: Phase 2-2
- **테스트 단계**:
  1. Authorization 헤더 없이 `GET /api/v1/ama/oauth/status` 호출
- **기대 결과**:
  - HTTP 401 Unauthorized
- **우선순위**: 중

---

## B. Frontend — OAuth 플로우 UI

### TC-010: 모달 열기 — OAuth 미연동 상태

- **연관**: Phase 3-3
- **사전 조건**: OAuth 토큰 없음
- **테스트 단계**:
  1. "운전자 추가" 클릭 → 모달 열림
- **기대 결과**:
  - "AMA 사용자 검색을 위해 연동이 필요합니다" 안내 메시지
  - "AMA 연동하기" 버튼 표시
  - 하단 "UUID 직접 입력" fallback 토글 유지
- **우선순위**: 상

### TC-011: AMA 연동하기 버튼 → OAuth 리다이렉트

- **연관**: Phase 3-3
- **사전 조건**: TC-010 모달 상태
- **테스트 단계**:
  1. "AMA 연동하기" 버튼 클릭
- **기대 결과**:
  - `GET /api/v1/ama/oauth/authorize` 호출
  - AMA OAuth 인가 페이지로 리다이렉트
  - 사용자 동의 화면 표시
- **우선순위**: 상

### TC-012: OAuth 콜백 처리

- **연관**: Phase 3-1
- **사전 조건**: AMA 동의 완료 → redirect_uri로 돌아옴
- **테스트 단계**:
  1. `/app-car-manager/oauth/callback?code=...&state=...` 진입
- **기대 결과**:
  - OAuthCallbackPage가 code를 BE에 전달
  - 토큰 교환 성공 → "연동 완료" 표시
  - 이전 페이지(운전자 목록 또는 차량 상세)로 자동 리다이렉트
- **우선순위**: 상

### TC-013: 모달 열기 — OAuth 연동 완료 상태

- **연관**: Phase 3-3
- **사전 조건**: OAuth 연동 완료 (TC-012)
- **테스트 단계**:
  1. "운전자 추가" 클릭 → 모달 열림
- **기대 결과**:
  - 검색 입력 필드 바로 표시 (OAuth 안내 없음)
  - 이름/이메일 검색 → 드롭다운 결과 표시
  - 기존 검색 UI 동작 동일
- **우선순위**: 상

### TC-014: 검색 → 선택 → 등록 (E2E)

- **연관**: Phase 3-3
- **사전 조건**: OAuth 연동 완료
- **테스트 단계**:
  1. 모달에서 이름 검색 (2글자 이상)
  2. 드롭다운에서 멤버 선택 → 칩 표시
  3. 역할 선택 → "등록" 클릭
- **기대 결과**:
  - `POST /api/v1/drivers` (ama_user_id = 선택된 userId)
  - 모달 닫힘 + 운전자 목록 갱신
- **우선순위**: 상

### TC-015: UUID 직접 입력 fallback (OAuth 미연동 시)

- **연관**: Phase 3-3
- **사전 조건**: OAuth 미연동
- **테스트 단계**:
  1. 모달에서 "UUID 직접 입력" 토글 클릭
  2. UUID 입력 + 역할 선택 → "등록"
- **기대 결과**:
  - UUID 검증 통과 → `POST /api/v1/drivers` → 등록 성공
  - OAuth 없이도 운전자 등록 가능
- **우선순위**: 상

### TC-016: OAuth 콜백 — 에러 처리

- **연관**: Phase 3-1
- **테스트 단계**:
  1. `/app-car-manager/oauth/callback?error=access_denied` 진입
- **기대 결과**:
  - "AMA 연동 실패" 에러 메시지 표시
  - 이전 페이지로 돌아가기 버튼
  - 서버 크래시 없음
- **우선순위**: 중

### TC-017: i18n 다국어 (OAuth UI)

- **연관**: Phase 4
- **사전 조건**: OAuth 미연동 상태 모달
- **테스트 단계**:
  1. KO → "AMA 사용자 검색을 위해 연동이 필요합니다" 확인
  2. EN 전환 → 영어 확인
  3. VI 전환 → 베트남어 확인
- **기대 결과**:
  - 3개 언어 모두 OAuth 안내/버튼 텍스트 정상 표시
- **우선순위**: 하

---

## 테스트 요약

| 우선순위 | 케이스 수 | 케이스 ID |
|---------|----------|----------|
| 상 | 11 | TC-001 ~ TC-006, TC-010 ~ TC-015 |
| 중 | 4 | TC-007 ~ TC-009, TC-016 |
| 하 | 1 | TC-017 |
| **합계** | **17** | |

---

## 사전 조건 체크리스트

- [ ] AMA Partner App 등록 완료 (`client_id`, `client_secret` 발급)
- [ ] `.env`에 `AMA_OAUTH_CLIENT_ID`, `AMA_OAUTH_CLIENT_SECRET`, `AMA_OAUTH_REDIRECT_URI` 설정
- [ ] AMA 스테이징 서버 정상 가동
- [ ] AMA OAuth authorize/token 엔드포인트 접근 가능
