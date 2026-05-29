---
document_id: TC-20260529-debug-context-panel
version: 1.0.0
status: Draft
created: 2026-05-29
author: 김익용 (Gray)
related:
  - apps/app-car-manager-v2/docs/analysis/REQ-20260529-debug-context-panel.md
  - apps/app-car-manager-v2/docs/plan/PLN-20260529-debug-context-panel.md
---

# app-car-manager-v2 — Debug Context Panel 테스트케이스

## 1. 테스트 범위

| 영역 | 범위 |
|------|------|
| Build & Static | typecheck, lint, build green |
| Functional (Dev) | session-expired 페이지에서 panel 노출, i18n, 토글, 복사 |
| Functional (Staging Emul) | DEBUG_PANEL_ENABLED=true + NODE_ENV=production 활성화 |
| Security (Production) | panel 미노출, 번들에 식별자 없음 |
| Edge Cases | cookie 없음 / cookie 만료 / verify 실패 |
| i18n | 3 locale (ko/en/vi) 키 정합 |
| Regression | session-expired 기존 UX, AMA SSO 흐름 |

---

## 2. 정적 검증 (TC-S-*)

### TC-S-01 — TypeScript typecheck

| 항목 | 내용 |
|------|------|
| 수행 | `cd apps/app-car-manager-v2/apps/web && pnpm typecheck` (또는 `tsc --noEmit`) |
| 기대 | exit 0, 에러 0 |
| 실패 시 | RSC boundary 위반(Server 에서 client hook 사용 등) 점검 |

### TC-S-02 — Lint

| 항목 | 내용 |
|------|------|
| 수행 | `pnpm lint` |
| 기대 | 신규 3 파일 에러 0 |
| 실패 시 | react-hooks / next/no-html-link-for-pages 규칙 점검 |

### TC-S-03 — i18n 키 정합

| 항목 | 내용 |
|------|------|
| 수행 | `node -e "['ko','en','vi'].forEach(l => console.log(l, Object.keys(require('./apps/web/messages/'+l+'.json').debug).sort().join(',')))"` |
| 기대 | 3 locale 의 `debug.*` 키가 정확히 동일 |
| 실패 시 | 누락 키 보강 |

### TC-S-04 — Production 번들에서 panel 식별자 부재

| 항목 | 내용 |
|------|------|
| 수행 | `pnpm build` 후 `grep -r "DebugContextPanel" .next/static/chunks/ \| head -5` |
| 기대 | **0 hits** (dead code 제거됨) |
| 실패 시 | `next/dynamic({ ssr: false, loading: () => null })` 또는 별도 분기로 보강 |

---

## 3. Dev 환경 기능 테스트 (TC-D-*)

전제: `NODE_ENV=development`, `DEBUG_PANEL_ENABLED` 미설정 (기본 비활성, 단 NODE_ENV가 dev 이므로 활성)

### TC-D-01 — session-expired 도달 시 panel 노출

| 항목 | 내용 |
|------|------|
| 수행 | `pnpm dev` 실행 후 브라우저로 `http://localhost:3000/session-expired` 접속 |
| 기대 | 페이지 하단(Card 내) 노란 dashed border + Bug 아이콘 + "디버그 컨텍스트" 타이틀 표시 |

### TC-D-02 — Referrer / URL Query 표시

| 항목 | 내용 |
|------|------|
| 수행 | 외부 페이지(예: `https://example.com`)에서 `/session-expired?foo=bar&locale=en` 으로 이동 |
| 기대 | "Referrer" = `https://example.com/`, "URL Query" = `foo=bar&locale=en` |

### TC-D-03 — Server context (`ent_id`, `userId`, `role`)

| 항목 | 내용 |
|------|------|
| 전제 | `?ama_token=<valid-JWT>` 으로 진입하여 cookie 발급된 상태에서 `/session-expired` 로 임의 이동 |
| 기대 | "ent_id", "userId", "role" 필드에 cookie JWT 의 claims 값 표시 |
| 비고 | cookie 만료 시점에는 verify 실패로 cookie 삭제됨 → 빈 값 표시 (TC-E-02 참고) |

### TC-D-04 — Cookie 메타 (exp 까지 남은 시간)

| 항목 | 내용 |
|------|------|
| 전제 | TC-D-03 직후 |
| 기대 | "Cookie 만료까지" 필드에 남은 초 또는 분 (예: "3540s" 또는 "59분") |

### TC-D-05 — JWT decoded claims 표시

| 항목 | 내용 |
|------|------|
| 전제 | cookie 발급 직후 |
| 기대 | "디코드된 Payload" 섹션에 `sub`, `email`, `entityId`, `appCode`, `scope`, `exp` 표시 |

### TC-D-06 — 토글 (펼치기/접기)

| 항목 | 내용 |
|------|------|
| 수행 | panel 헤더 클릭 (ChevronDown/Up 아이콘) |
| 기대 | 토글마다 본문 영역 노출/숨김, 아이콘 회전 |

### TC-D-07 — 복사 버튼 (`ent_id` 값)

| 항목 | 내용 |
|------|------|
| 수행 | ent_id 옆 Copy 아이콘 클릭 |
| 기대 | clipboard 에 ent_id 복사됨, 아이콘이 일시적으로 Check 로 변경 (2~3초), "복사됨" 텍스트 표시 |

### TC-D-08 — i18n locale 전환

| 항목 | 내용 |
|------|------|
| 수행 | locale 쿠키/URL 로 `ko/en/vi` 각각 적용 |
| 기대 | 각 locale 의 `debug.*` 메시지가 정확히 표시. vi 임시 영문 fallback 도 허용 |

---

## 4. Staging Emulation 테스트 (TC-G-*)

전제: production 빌드 + 명시 활성화

### TC-G-01 — DEBUG_PANEL_ENABLED=true 활성화

| 항목 | 내용 |
|------|------|
| 수행 | `pnpm build && NODE_ENV=production DEBUG_PANEL_ENABLED=true pnpm start` 후 `/session-expired` 접근 |
| 기대 | panel 노출 (Dev 와 동일 UX) |

### TC-G-02 — DEBUG_PANEL_ENABLED=true 빌드 시 번들 포함 확인

| 항목 | 내용 |
|------|------|
| 수행 | 위 빌드 결과 `.next/server/app/session-expired/page.js` 와 client chunk grep |
| 기대 | panel 식별자 **포함됨** (활성화 빌드이므로 정상) |

---

## 5. Production 보안 회귀 (TC-P-*) ★ 핵심

전제: production 빌드, `DEBUG_PANEL_ENABLED` 미설정

### TC-P-01 — Panel DOM 미노출

| 항목 | 내용 |
|------|------|
| 수행 | `pnpm build && NODE_ENV=production pnpm start` 후 `/session-expired` 접근 |
| 기대 | DOM 에 `[data-testid="debug-context-panel"]` 부재, "디버그 컨텍스트" 텍스트 부재 |
| 실패 시 | **Critical** — Provider 게이팅 로직 즉시 재점검 |

### TC-P-02 — Network response 에 디버그 정보 미포함

| 항목 | 내용 |
|------|------|
| 수행 | DevTools Network 로 `/session-expired` 응답 본문 검사 |
| 기대 | `ent_id`, `userId`, `JWT decoded claims` 등 디버그 정보 응답에 부재 |

### TC-P-03 — Client bundle 에 식별자 부재 (TC-S-04 재실행)

`production` + `DEBUG_PANEL_ENABLED` 미설정 빌드.

### TC-P-04 — DEBUG_PANEL_ENABLED=false 명시 빌드 동일 결과

| 항목 | 내용 |
|------|------|
| 수행 | `NODE_ENV=production DEBUG_PANEL_ENABLED=false pnpm start` |
| 기대 | TC-P-01 ~ P-03 동일 결과 |

---

## 6. Edge Case (TC-E-*)

### TC-E-01 — cookie 없음 (첫 진입)

| 항목 | 내용 |
|------|------|
| 수행 | cookie 삭제 후 `/session-expired` 접근 (`?ama_token=` 없음) |
| 기대 | panel 노출, "Cookie" 섹션에 "없음" 표시, ent_id/userId/role 빈 값 |

### TC-E-02 — cookie 있으나 verify 실패

| 항목 | 내용 |
|------|------|
| 수행 | 잘못된 JWT 를 `amb_session` cookie 에 수동 주입 → `/session-expired` 접근 |
| 기대 | middleware 가 cookie 삭제 → panel 은 TC-E-01 과 동일 빈 값 |

### TC-E-03 — `?ama_token=` 직접 query (middleware 가 정리 전)

| 항목 | 내용 |
|------|------|
| 수행 | middleware 의 정리 흐름 우회 — 임의로 `/session-expired?ama_token=xxx` 접근 (middleware 가 verify 후 redirect 하지만 invalid token 이면 401) |
| 기대 | invalid token 시 401, valid token 이면 redirect 되어 panel 진입 시 query 비어있음 |
| 비고 | URL query 캡처는 mount 시점이라 redirect 이후엔 empty. 실효성 낮음 — Decoded claims 가 주력 |

### TC-E-04 — locale=vi 한글 영문 fallback

| 항목 | 내용 |
|------|------|
| 수행 | `/session-expired` + locale=vi |
| 기대 | `debug.*` 키가 vi.json 에 정의돼 있으면 vi 표시, 임시 영문 fallback 도 허용 (검수 전) |

---

## 7. 회귀 (TC-R-*)

### TC-R-01 — session-expired 기존 UX 유지

| 항목 | 내용 |
|------|------|
| 수행 | `/session-expired` 의 LogIn 버튼 클릭 |
| 기대 | `process.env.NEXT_PUBLIC_AMA_ORIGIN` 으로 이동 — 기존 동작 유지 |

### TC-R-02 — dev-login 흐름 유지

| 항목 | 내용 |
|------|------|
| 수행 | `DEMO_AUTO_LOGIN=true` + `/dev-login?role=OWNER` 접근 |
| 기대 | cookie 발급 + `/` 로 redirect — 기존 동작 유지. session-expired 페이지의 dev-login 버튼도 정상 |

### TC-R-03 — AMA SSO 토큰 교환 흐름 유지

| 항목 | 내용 |
|------|------|
| 수행 | `?ama_token=<valid>` 진입 |
| 기대 | middleware 가 verify → cookie 발급 → URL clean redirect → `/` 도달 (또는 원래 경로) — 기존 동작 유지 |

---

## 8. 합격 기준

다음 항목 모두 통과 시 합격:

- ☐ TC-S-01 ~ TC-S-04 (정적) 전체 통과
- ☐ TC-D-01 ~ TC-D-08 (Dev 기능) 전체 통과
- ☐ TC-G-01 ~ TC-G-02 (Staging emulation) 전체 통과
- ☐ **TC-P-01 ~ TC-P-04 (Production 보안) 전체 통과** — 1건이라도 실패 시 작업 보류
- ☐ TC-E-01 ~ TC-E-04 (Edge) 전체 통과 (E-03 은 비고대로 실효성 낮음)
- ☐ TC-R-01 ~ TC-R-03 (회귀) 전체 통과

위 합격 후 → `docs/test/TR-20260529-debug-context-panel.md` 작성 → `docs/implementation/RPT-20260529-debug-context-panel.md` 작성 → 스테이징/프로덕션 배포.

---

## 9. 책임 매트릭스

| 단계 | 책임자 | 비고 |
|------|--------|------|
| TC-S-* (정적) | 구현자 (Claude) | 자동 |
| TC-D-* (Dev) | 구현자 + 사용자 검수 | 브라우저 직접 확인 권장 |
| TC-G-* (Staging emul) | 구현자 | 로컬 build/start 시뮬 |
| TC-P-* (Prod 보안) | 구현자 ★ Critical ★ | 모두 통과 필수 |
| TC-E-* (Edge) | 구현자 | |
| TC-R-* (회귀) | 사용자 | 스테이징 배포 후 |
