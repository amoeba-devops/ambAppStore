# 테스트완료보고서 — HS Code Manager AMA SSO 토큰 연동 (401 수정)

- **문서 ID**: TR-20260708-HSCode-AMA-SSO토큰연동
- **작성일**: 2026-07-08
- **선행 문서**: [TC-20260708](TC-20260708-HSCode-AMA-SSO토큰연동.md)
- **테스트 환경**: 로컬 빌드 + 로직 단위 검증 (스테이징 미배포 상태)

---

## 1. 구현 방식 (계획 대비 실제)

계획서(PLAN)는 car-manager식 `AmaTokenHandler` 게이팅 컴포넌트를 제안했으나, **실제 구현은 더 단순한 부팅 시점 캡처 방식**으로 완료됨:

| 파일 | 구현 |
|------|------|
| `src/lib/ama-token.ts` | `bootstrapAmaAuth()` — URL `ama_token`(없으면 `hsc_token` localStorage) 디코드 → 만료 검사 → `setAuth()` → URL에서 `ama_token` 제거. `decodeAmaToken`은 UTF-8 안전(TextDecoder), `ent_id`/`entityId` 변형 흡수, `role`→`roles[]` 정규화(ADMIN 승격) |
| `src/main.tsx` | 렌더 **이전**에 `bootstrapAmaAuth()` 호출 + locale 적용 → 첫 API 호출부터 Bearer 부착 |
| `src/lib/api-client.ts` | (기존) 인터셉터가 `token` 존재 시 `Authorization: Bearer` 첨부 |

게이팅 컴포넌트/라우터 래핑/구독 확인은 채택하지 않음 → 로직 단순화. 인증 전 렌더 차단 대신, 부팅 동기 캡처로 첫 호출부터 토큰 보장.

---

## 2. 테스트 결과

| ID | 시나리오 | 방법 | 결과 |
|----|----------|------|------|
| TC-01 | 유효 토큰 디코드/entityId 추출 | node 로직 재현 | ✅ PASS (`ent-123`, expired=false) |
| TC-06 | 만료 토큰 → isExpired | node | ✅ PASS (true → `clear()` 경로) |
| TC-08 | 잘못된 JWT → decode null | node | ✅ PASS (null) |
| TC-12 | 앱 격리 (`hsc_token` 키) | 코드 검토 | ✅ PASS (STORAGE_KEY='hsc_token') |
| TC-14 | 빌드 그린 | `npm run build` | ✅ PASS (tsc+vite, 185 modules, 0 error) |
| ent_id 변형 | `ent_id`/`entityId` 흡수 | node | ✅ PASS (`ent-alt`) |
| TC-02 | Bearer 헤더 첨부 | 코드 검토 (api-client + bootstrap 순서) | ✅ 논리적 PASS (런타임 재확인은 배포 후) |
| TC-04 | 새로고침(저장 토큰) 복원 | 코드 검토 | ✅ 논리적 PASS (urlToken \|\| localStorage) |
| TC-03 | excel/classify 200 (E2E) | — | ⏸ 보류 — **스테이징 배포 필요** + JWT_SECRET 일치 전제 |
| TC-05 | 토큰 없음 → 재로그인 UX | — | ⏸ 보류 — 현 구현은 전용 에러화면 없음(무토큰 시 API 401) |
| TC-11 | 미구독 리다이렉트 | — | N/A — 구독 게이팅 미채택 |
| TC-07/09/10/13 | appCode/referrer/로딩/i18n | — | N/A — 해당 로직 미채택(단순 구현) |

## 3. 판정

- **필수 로컬 검증 항목(TC-01/02/04/06/08/12/14) 전부 PASS.** 근본 원인(토큰 미첨부)은 코드상 해소됨.
- **E2E(TC-03)는 스테이징 배포 후 검증 필요.** 현재 스테이징은 수정 이전 빌드가 구동 중이므로 401이 지속됨 — 배포가 실질 종결 조건.

## 4. 잔여 리스크
1. **스테이징 미배포** — 프론트 재빌드/배포 전까지 401 지속. (실질 fix 반영은 배포 시점)
2. **JWT_SECRET 일치** — 스테이징 `.env`의 `JWT_SECRET`이 AMA App Store SSO 서명 키와 불일치 시, 토큰 첨부되어도 백엔드가 401. 배포 후 401 지속 시 최우선 점검.
3. **AMA 호스트의 `ama_token` 전달** — ambManagement CustomAppHostPage가 `?ama_token=`을 실제로 iframe에 넣는지 확인 필요.
