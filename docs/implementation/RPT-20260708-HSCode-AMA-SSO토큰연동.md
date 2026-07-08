# 작업완료보고서 — HS Code Manager AMA SSO 토큰 연동 (401 수정)

- **문서 ID**: RPT-20260708-HSCode-AMA-SSO토큰연동
- **작성일**: 2026-07-08
- **대상 앱**: HS Code Manager (`/app-hscode`)
- **관련 문서**: [REQ](../analysis/REQ-20260708-HSCode-AMA-SSO토큰연동.md) · [PLAN](../plan/PLAN-20260708-HSCode-AMA-SSO토큰연동.md) · [TC](../test/TC-20260708-HSCode-AMA-SSO토큰연동.md) · [TR](../test/TR-20260708-HSCode-AMA-SSO토큰연동.md)

---

## 1. 증상 및 근본 원인

- **증상**: `stg-apps.amoeba.site/app-hscode/api/v1/excel/classify` → **401**.
- **근본 원인**: excel 엔드포인트 결함이 아니라, **HS Code 프론트엔드가 AMA `ama_token`을 수신·저장하지 않아** 모든 `@Auth()` 엔드포인트에 `Authorization: Bearer` 헤더가 첨부되지 않음. `setAuth` 미호출 → `token` 영구 null. (classify는 사용자가 처음 부딪힌 엔드포인트일 뿐)

## 2. 조치 내용 (구현)

부팅 시점 토큰 캡처 방식으로 해소:

| 파일 | 변경 | 내용 |
|------|------|------|
| `frontend/src/lib/ama-token.ts` | 신규 | `bootstrapAmaAuth()`: URL `ama_token`(없으면 `hsc_token`) → 디코드(UTF-8 안전, `ent_id`/`entityId` 변형 흡수, role→roles[] ADMIN 정규화) → 만료 검사 → `setAuth()`/`clear()` → URL에서 `ama_token` 제거 |
| `frontend/src/main.tsx` | 수정 | `RouterProvider` 렌더 **이전** `bootstrapAmaAuth()` 호출 + locale 적용 → 첫 API 호출부터 Bearer 보장 |
| `frontend/src/lib/api-client.ts` | (기존) | 요청 인터셉터가 토큰 존재 시 Bearer 첨부 |

- **백엔드/DB 변경 없음.**
- 계획서의 `AmaTokenHandler` 게이팅 컴포넌트/구독 확인은 **미채택** — 부팅 동기 캡처로 목적 달성, 로직 단순화.

## 3. 검증

- `npm run build` (tsc + vite) **그린** — 185 modules, 0 error (TC-14 PASS).
- 디코드/만료/`ent_id` 변형 로직 단위 검증 PASS (TC-01/06/08 + variant).
- Bearer 첨부·새로고침 복원 코드 검토 PASS (TC-02/04).
- E2E(TC-03 classify 200)는 **스테이징 배포 후 검증 대상**.

## 4. 배포 (잔여 — 실질 종결 조건)

현재 스테이징은 수정 이전 빌드 구동 중 → **재빌드·배포 전까지 401 지속**.

```bash
# (커밋/푸시 후)
ssh ambAppStore@stg-apps.amoeba.site "cd ~/ambAppStore && git pull origin main && bash platform/scripts/deploy-staging.sh"
```
- 프론트 정적 SPA(VITE base `/app-hscode/`) 변경 → `web-app-hscode` 재빌드 필수(빌드 시점 인라인).
- 배포 후: `stg-apps.amoeba.site/app-hscode/?ama_token=<유효JWT>` 진입 → excel/classify 200 확인.

## 5. 잔여 리스크 / 후속 점검

1. **JWT_SECRET 일치** — 배포 후에도 401 지속 시, 스테이징 `.env`의 `JWT_SECRET`이 AMA App Store SSO 서명 키와 일치하는지 최우선 점검.
2. **AMA 호스트 토큰 전달** — ambManagement CustomAppHostPage가 iframe에 `?ama_token=`을 실제로 주입하는지 확인.
3. **무토큰 UX** — 토큰 없이 접근 시 전용 안내 화면 없음(API 401만). 필요 시 후속 개선(에러 바운더리/재로그인 유도).

## 6. 결론

근본 원인(토큰 미첨부)은 **코드상 해소·빌드 그린**. 실질 반영은 **스테이징 재배포**로 종결되며, 배포 후 E2E 200 및 JWT_SECRET 일치 확인이 남은 검증 항목이다.
