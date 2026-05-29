---
document_id: TR-20260529-debug-context-panel
version: 1.0.0
status: Phase 1~6 Complete (Pre-deploy)
created: 2026-05-29
author: 김익용 (Gray)
related:
  - apps/app-car-manager-v2/docs/analysis/REQ-20260529-debug-context-panel.md
  - apps/app-car-manager-v2/docs/plan/PLN-20260529-debug-context-panel.md
  - apps/app-car-manager-v2/docs/test/TC-20260529-debug-context-panel.md
---

# app-car-manager-v2 — Debug Context Panel 테스트 완료 보고서

## 1. 실행 요약

| 항목 | 결과 |
|------|------|
| 환경 | local (huy/develop-car-manager-v2 branch) |
| TypeScript typecheck | ✅ Pass (`tsc --noEmit` exit 0) |
| Lint | ✅ Pass (`next lint` — No ESLint warnings or errors) |
| i18n 키 정합 | ✅ Pass (3 locale × 24 keys 동일) |
| Production 빌드 | ✅ Pass (`next build`) |
| Tree-shake (TC-S-04) | ✅ Pass (chunk 7.2KB → **835B**, panel 식별자 0 hits) |
| Dev runtime 검증 | ⏳ Pending (browser 직접 확인) |
| Production runtime 검증 | ⏳ Pending (스테이징 배포 후) |

---

## 2. 정적 검증 결과 (TC-S-*)

### TC-S-01 — Typecheck

```bash
$ npm run typecheck
> tsc --noEmit
(exit 0, 0 errors)
```
→ **Pass** — 본 작업 신규 3 파일 (decode-jwt, debug-context-panel, debug-context-provider) 0 에러
→ React 19 호환을 위해 `Promise<JSX.Element | null>` 반환 타입 → 추론 사용으로 정정

### TC-S-02 — Lint

```bash
$ npm run lint
> next lint
✔ No ESLint warnings or errors
```
→ **Pass**

### TC-S-03 — i18n 키 정합

```bash
$ node -e "['ko','en','vi'].forEach(l => { const k = Object.keys(require('./messages/'+l+'.json').debug).sort(); console.log(l + ': ' + k.length + ' keys') })"
ko: 24 keys
en: 24 keys
vi: 24 keys
```

3 locale 모두 동일 24개 키 (`amaRole, amaTokenInUrl, collapse, cookieExpired, cookieExpiresAt, cookieExpiresIn, cookiePresent, copied, copy, entId, expand, no, queryParams, referer, role, sectionBrowser, sectionCookie, sectionDecoded, sectionSession, title, unitMinutes, unitSeconds, userId, yes`).

→ **Pass**

### TC-S-04 — Production 번들 tree-shake ★ 핵심

**1차 시도 (단순 dynamic import)**: ❌ Fail
- `await import('./debug-context-panel')` 만으로는 RSC client manifest 가 chunk reference 유지
- `.next/static/chunks/app/session-expired/page-*.js` (7.2KB) 에 `DebugContextPanel`, `debug-context-panel`, `expand`, `collapse`, `sectionBrowser` 잔존

**2차 시도 (page 레벨 정적 NODE_ENV 분기)**: ✅ Pass

```tsx
// page.tsx
const DebugContextProvider =
  process.env.NODE_ENV !== 'production'
    ? (await import('@/components/dev/debug-context-provider')).DebugContextProvider
    : null;
```

webpack 의 DCE 가 `process.env.NODE_ENV !== 'production'` 을 빌드 시점에 false 로 치환 → import 표현식 자체 제거.

검증:
```bash
$ NODE_ENV=production npm run build
$ grep -rl "DebugContextPanel\|debug-context-panel\|DebugContextProvider" .next/static/chunks/
(empty)
$ ls -la .next/static/chunks/app/session-expired/*.js
-rw-r--r-- 835 bytes  ← panel 코드 완전 제거 (이전 7,207 → 835 bytes)
```

→ **Pass**

---

## 3. 환경변수 정합

### env 추가

`.env.example` 에 `DEBUG_PANEL_ENABLED=false` 라인 추가 (Provider 의 runtime 게이트 — staging 활성화 후속 옵션용. 현 구현에선 NODE_ENV 정적 분기가 1차 차단).

---

## 4. 미실시 항목 (배포·런타임 단계)

### 자동 검증 어려운 항목 — 사용자 검수 필요

| TC | 내용 | 사유 |
|----|------|------|
| TC-D-01~08 | Dev 환경 panel 노출·토글·복사·i18n | `next dev` 서버 + 브라우저 직접 조작 필요 |
| TC-E-01~04 | cookie 없음/만료/verify 실패/locale fallback | dev runtime 검증 |
| TC-G-01~02 | Staging emulation | **트레이드오프 발생** — §5 참조 |
| TC-P-01~04 | Production 보안 (DOM/Network 미노출) | 정적 grep 으로 panel 코드 부재 확인됨 — runtime 노출 가능성 0 |
| TC-R-01~03 | Session-expired/dev-login/AMA SSO 흐름 회귀 | 스테이징 배포 후 |

---

## 5. ⚠️ 트레이드오프 사항 (TC-G-01 미충족)

### PLN 명세 (D-3)
- dev: 활성화
- **staging (NODE_ENV=production + DEBUG_PANEL_ENABLED=true): 활성화**
- production: 비활성화

### 실제 구현 결과
NODE_ENV 정적 분기를 채택하여 TC-S-04 (tree-shake) 통과를 우선했더니, NODE_ENV=production 빌드에서 panel chunk 자체가 제거됨. 즉 **staging(NODE_ENV=production)에서도 DEBUG_PANEL_ENABLED=true 설정만으로는 활성화 불가**.

### 보안 vs Staging troubleshooting 균형

| 채택 옵션 | 보안 (panel chunk 부재) | Staging 활성화 |
|----------|------------------------|---------------|
| A. 런타임 게이트만 | ❌ chunk 잔존 (7.2KB) | ✅ DEBUG_PANEL_ENABLED=true |
| **B. NODE_ENV 정적 분기 (채택)** | ✅ chunk 제거 (835B) | ❌ 별도 빌드 필요 |
| C. NEXT_PUBLIC_DEBUG_PANEL_ENABLED (빌드 시점 변수) | △ 빌드 별 선택 가능 | ✅ NEXT_PUBLIC_DEBUG_PANEL_ENABLED=true 로 staging 빌드 |

→ **현 PR 은 옵션 B (보안 우선)**. Staging troubleshooting 필요 시:
1. 임시 `NODE_ENV=development` 로 별도 빌드 후 staging 배포
2. 또는 후속 PR 로 옵션 C (NEXT_PUBLIC_* 변수) 도입

---

## 6. 코드 변경 통계

| 분류 | 개수 |
|------|------|
| 신규 파일 (`apps/web/src/components/dev/`) | 3 (`decode-jwt.ts`, `debug-context-panel.tsx`, `debug-context-provider.tsx`) |
| 수정 파일 | 5 (`session-expired/page.tsx`, `messages/{ko,en,vi}.json`, `.env.example`) |
| LOC (추가) | ~370 줄 (코드 + i18n) |
| Production 번들 영향 | **0 (DCE 로 완전 제거)** |
| Dev 번들 영향 | +7KB (session-expired client chunk) |

---

## 7. 합격 판정

| 항목 | 상태 |
|------|------|
| TC-S-01 typecheck | ✅ |
| TC-S-02 lint | ✅ |
| TC-S-03 i18n 정합 | ✅ |
| TC-S-04 tree-shake | ✅ |
| TC-D-* (dev runtime) | ⏳ 사용자 검수 |
| TC-G-* (staging emul) | ⚠️ 트레이드오프 (§5) — 별도 빌드 또는 후속 PR |
| TC-P-* (prod 보안) | ✅ 정적 grep 으로 보안 확보 (chunk 부재) |
| TC-E-* (edge) | ⏳ 사용자 검수 |
| TC-R-* (회귀) | ⏳ 스테이징 배포 후 |

→ **Phase 1~6 (구현·정적검증) 완료**. Runtime/배포 검증은 사용자 단계.
