# 테스트케이스 — HS Code Manager AMA SSO 토큰 연동 (401 수정)

- **문서 ID**: TC-20260708-HSCode-AMA-SSO토큰연동
- **작성일**: 2026-07-08
- **선행 문서**: [PLAN-20260708](../plan/PLAN-20260708-HSCode-AMA-SSO토큰연동.md)
- **대상**: HS Code Manager 프론트엔드 SSO 토큰 처리

---

## 1. 테스트 범위

프론트엔드 AMA `ama_token` 수신 → 저장 → API Bearer 첨부 → `@Auth()` 엔드포인트 401 해소. 백엔드/DB 변경 없음.

## 2. 사전 조건
- `apps/app-hscode-manager/frontend` 빌드 그린.
- 목업 JWT: `entityId` 포함, `appCode='app-hscode'`, `exp` 미래. (서명은 프론트 검증 안 함)
- 백엔드 `JWT_SECRET`이 목업 JWT 서명 키와 일치(엔드투엔드 200 검증 시).

---

## 3. 테스트 케이스

| ID | 시나리오 | 입력/절차 | 기대 결과 | 유형 |
|----|----------|-----------|-----------|------|
| TC-01 | 정상 진입 토큰 저장 | `/app-hscode/?ama_token=<유효JWT>&locale=ko` 진입 | `localStorage.hsc_token` 저장, `useAuthStore.token` 세팅, URL에서 `ama_token`/`locale` 제거 | 단위/통합 |
| TC-02 | Bearer 헤더 첨부 | TC-01 후 임의 API 호출(예: reference 목록) | 요청 헤더에 `Authorization: Bearer <token>` 존재 | 통합 |
| TC-03 | excel/classify 200 | TC-01 후 엑셀 업로드→classify 호출 | 401 아님(200/정상 응답). 백엔드 JWT_SECRET 일치 전제 | E2E |
| TC-04 | 토큰 없이 새로고침(저장 有) | localStorage에 유효 `hsc_token` 존재, URL param 없이 진입 | 게이팅 통과(ready), 저장 토큰으로 API 정상 | 통합 |
| TC-05 | 토큰 없음·저장 없음 | param·localStorage 모두 없음 | 본문 렌더는 되나 API 401 → 재로그인 안내 UX(에러 코드 표시) | 통합 |
| TC-06 | 만료 토큰 | `exp` 과거인 `ama_token` | 에러 화면(`auth.tokenExpired`), setAuth 미호출 | 단위 |
| TC-07 | appCode 불일치 | `appCode='app-car-manager'` 토큰 | 에러 화면(`auth.invalidAccess`), setAuth 미호출 | 단위 |
| TC-08 | 잘못된 JWT 형식 | `ama_token=garbage` | `decodeAmaToken` null → 에러 화면, setAuth 미호출 | 단위 |
| TC-09 | referrer soft 검증 | `document.referrer` 빈 값으로 진입 | 통과(리다이렉트 없음) | 단위 |
| TC-10 | 게이팅 로딩 표시 | `ama_token` 존재, 구독확인 지연 | 처리 완료 전 로딩 스피너, 본문 미렌더 | 통합 |
| TC-11 | 미구독 처리 | 구독 status ≠ ACTIVE | 플랫폼 앱 상세 리다이렉트(또는 soft 통과 — 구현 플래그에 따름) | 통합 |
| TC-12 | 앱 간 토큰 격리 | car-manager `ama_token` 키와 분리 | HS Code는 `hsc_token`만 사용, 상호 오염 없음 | 단위 |
| TC-13 | i18n 3개 언어 | ko/en/vi 각 `auth.*` 키 렌더 | 하드코딩 없이 번역 표시 | 단위 |
| TC-14 | 빌드 그린 | `npm run build` | tsc + vite 에러 0 | 빌드 |

---

## 4. 회귀 확인
- 기존 페이지(qa/barcode/attribute/result/reference/admin) 라우팅 정상.
- `isAdmin()` 등 기존 스토어 소비자 무영향.

## 5. 판정 기준
- TC-01~04, TC-06~09, TC-12~14 **필수 PASS**.
- TC-03/TC-05/TC-11은 백엔드 `JWT_SECRET` 및 구독 등록 상태에 의존 → 조건부 검증(TR에 환경 명시).
