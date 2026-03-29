# 세션 로그 — OAuth 2.0 AMA SSO 연동 요구사항분석 + 작업계획서

## 사용자 요청
- `apps.amoeba.site/apps/login` 로그인 페이지에서 AMA OAuth 2.0 Authorization Code Flow로 인증
- AMA OAuth 엔드포인트 정보 제공됨:
  - `/api/v1/oauth/authorize` → 인증 요청
  - `/api/v1/oauth/authorize/consent` → 동의 → auth code 발급
  - `/api/v1/oauth/token` → code → access_token/refresh_token 교환
  - `/api/v1/oauth/userinfo` → 사용자 정보 조회
  - `/api/v1/oauth/revoke` → 토큰 무효화
- 요구사항 분석서 + 작업계획서 작성 요청

## 수행 작업
1. AS-IS 현황 탐색 — 3개 앱(platform, car-manager, stock-management) 전체 인증 코드 분석
2. 요구사항분석서 작성: `docs/analysis/REQ-20260329-OAuth2-AMA-SSO-연동.md`
3. 작업계획서 작성: `docs/plan/PLAN-20260329-OAuth2-AMA-SSO-연동.md`

## 변경 파일
- `docs/analysis/REQ-20260329-OAuth2-AMA-SSO-연동.md` (신규)
- `docs/plan/PLAN-20260329-OAuth2-AMA-SSO-연동.md` (신규)

## 핵심 분석 결과
### AS-IS 문제점:
- Platform auth.controller.ts: 하드코딩 비밀번호 (`amoeba1!`) 인증 → 자체서명 JWT 발급
- AppsLoginPage.tsx: 직접 폼 로그인 (ent_id + email + password)
- No OAuth 연동, No refresh token, No real AMA SSO

### TO-BE 구현 계획:
- Phase 1 (Backend): OAuthService, Entity, DTOs, Controller 수정 (6개 파일)
- Phase 2 (Frontend): OAuthCallbackPage, Login 수정, Auth Store, API Client (6개 파일)
- Phase 3 (i18n): 3개 언어 번역 키 추가
- Total: 6 new + 13 modified = 19 files

## 미완료 항목
- 구현 착수 대기 중 (사용자 검토 후)
- AMA OAuth client_id/client_secret 등록 필요 (AMA 서버 관리자 작업)
