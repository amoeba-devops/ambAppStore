# REQ-20260512 — UI/UX Full Restyle (CCMS)

> 작성일: 2026-05-12 · 작성자: dev@amoeba.group + Claude Code
> 관련 문서: [PRD.md](../../PRD.md) · [REQ-20260512-prd-srs-audit.md](REQ-20260512-prd-srs-audit.md)
> 후속 문서: [PLAN-20260512-ui-restyle.md](../plan/PLAN-20260512-ui-restyle.md)

---

## 1. 요구사항 요약

| # | 요구사항 | 유형 |
|---|----------|------|
| R1 | 현재 Toss-clone 스타일을 폐기하고, **Swiss Modernism 2.0 + Minimalism** 기반 디자인 시스템으로 풀 리스타일 | UI/UX |
| R2 | 디자인 토큰(컬러/타이포/스페이싱/라운드/섀도)을 `packages/ui` 모노레포 패키지로 이전, 모든 앱이 재사용 가능하게 구성 | Architecture |
| R3 | 컴포넌트 라이브러리를 shadcn 패턴(cva + Radix-free wrapper)으로 재구축. Button, Card, Input, Label, Select, Checkbox, Radio, Textarea, Badge/Pill, Table, Dialog, Tabs, Toast, EmptyState, Skeleton 포함 | Component |
| R4 | 레이아웃 템플릿 5종 (Dashboard / List+Filter / Detail / Form Wizard / Approval Queue) + Mobile Driver 템플릿 2종 (Today / Receipt Capture) 제공 | Layout |
| R5 | 다국어 렌더링 품질 보장 — Pretendard(KR+Latin) + Be Vietnam Pro(VN diacritics) + Inter(fallback) 폰트 스택, 모든 UI 텍스트는 next-intl `t()` 사용 | i18n |
| R6 | 접근성 WCAG AA 이상 (focus-visible, keyboard nav, color contrast 4.5:1, prefers-reduced-motion) | A11y |
| R7 | 차트 라이브러리를 커스텀 SVG에서 **Recharts**로 통합. 8 expense category 컬러 시퀀스는 색맹 안전(red+green 대비 회피) | Data Viz |
| R8 | Dark mode **미구현** (사용자 명시 — 향후 phase로 연기) | Scope |
| R9 | 기존 `apps/web/src/components/{primitives,dashboard,layout}/` 일괄 폐기, 새 컴포넌트로 13개 페이지 모두 마이그레이션 | Migration |
| R10 | 폰트는 self-host(`/public/fonts/`)로 전환. CDN 의존성 제거 — 이유: iframe 환경 + 사내망 접속 시 CDN 차단 가능성 | Infrastructure |

---

## 2. AS-IS 현황 분석

### 2.1 디자인 시스템 — Toss-clone (폐기 대상)

**파일**: [apps/web/tailwind.config.ts](../../apps/web/tailwind.config.ts) (78 줄)
- 컬러: `brand-{50..900}` (Toss blue `#3182f6` 계열) + `neutral-{0..900}` (cool gray + 0/25/75/150 같은 비표준 키)
- 폰트: Pretendard Variable + JetBrains Mono (CDN: `cdn.jsdelivr.net/gh/orioncactus/pretendard`)
- 시맨틱 컬러: success/warning/danger/purple/teal 모두 `-{50,100,500,600,700}` 5단계로 정의

**파일**: [apps/web/src/app/globals.css](../../apps/web/src/app/globals.css)
- Pretendard + JetBrains Mono를 외부 CDN에서 `@import`로 로드 → **CDN 의존**
- 본문 컬러: `text-neutral-800 bg-neutral-50` 하드코드

**문제점**:
- ❌ 50/75/100/150 같은 비표준 neutral 키는 추후 유지보수 시 혼란
- ❌ 다크 모드 토큰 없음 (이번 스코프 OK이나 구조가 토큰화 안 됨)
- ❌ CDN 폰트 — iframe(AMA host) 환경에서 CSP/방화벽 차단 위험
- ❌ "Toss-inspired" 스타일은 차량 관리 SaaS의 정보 밀도 패턴과 불일치

### 2.2 컴포넌트 — primitives 15개

**파일**: [apps/web/src/components/primitives/](../../apps/web/src/components/primitives/)

| 파일 | 라인 수(추정) | 폐기 사유 |
|---|---|---|
| `btn.tsx` | ~100 | 자체 variant 체계 (`primary/soft/ghost`), 디자인 시스템과 강결합 |
| `card.tsx` | ~50 | Toss 스타일 카드 헤더 |
| `kpi.tsx` | ~80 | 대시보드 전용, 토큰 변경 시 종속 |
| `spark.tsx` | ~60 | 커스텀 SVG sparkline → Recharts로 대체 |
| `donut.tsx` | ~80 | 커스텀 SVG donut → Recharts로 대체 |
| `data-table.tsx` | ~120 | shadcn Table 패턴 미적용 |
| `input.tsx`, `select.tsx`, `textarea.tsx`, `field.tsx` | ~200 | 폼 컴포넌트 — RHF 통합 패턴 부족 |
| `avatar.tsx`, `empty-state.tsx`, `icon.tsx`, `phase-gate.tsx`, `status-pill.tsx`, `tabs.tsx` | ~300 | 기타 — 모두 Toss 토큰 의존 |

**총**: ~1,200 줄, 모두 마이그레이션 후 삭제

### 2.3 컴포넌트 — dashboard/layout 디렉토리

**파일**: [apps/web/src/components/dashboard/](../../apps/web/src/components/dashboard/) — 4개
- `action-item.tsx`, `fleet-card.tsx`, `stacked-spend.tsx`, `week-calendar.tsx`
- 대시보드 페이지 전용 위젯. 새 디자인 시스템으로 리빌드 필요.

**파일**: [apps/web/src/components/layout/](../../apps/web/src/components/layout/) — 11개
- `app-frame.tsx`, `sidebar.tsx`, `topbar.tsx`, `nav-list.tsx`, `nav-config.ts`, `logo.tsx`
- `detail-page-shell.tsx`, `form-page-shell.tsx`, `list-page-shell.tsx`, `page-content.tsx`, `section.tsx`
- 현재 단일 레이아웃 셸이 데스크탑 사이드바만 가정. Mobile Driver PWA 미지원.

### 2.4 페이지 — 13개 라우트

```
apps/web/src/app/
├── page.tsx                    # Dashboard (Admin)
├── trips/page.tsx
├── trips/new/page.tsx
├── trips/[id]/page.tsx
├── vehicles/page.tsx
├── vehicles/[id]/page.tsx
├── drivers/page.tsx
├── drivers/[id]/page.tsx
├── costs/page.tsx
├── reports/page.tsx
├── users/page.tsx
├── settings/page.tsx
├── audit/page.tsx
└── session-expired/page.tsx
```

- 모두 sample data hardcode. 서버 액션 미연결 (P0 단계). UI 마이그레이션과 데이터 wiring은 별도 phase로 분리 가능.

### 2.5 모노레포 packages — 현재 상태

| 패키지 | 내용 | 비고 |
|---|---|---|
| `packages/db` | Drizzle schema + Neon client | 변경 없음 |
| `packages/shared` | Zod schema + types + errors | 변경 없음 |
| `packages/ui` | **`cn.ts` + `index.ts`만 존재** — 비어있음 | ⭐ 이번 작업의 메인 호스트 |

**현재 `packages/ui/package.json`** dependencies: `clsx`, `tailwind-merge`만. CVA는 `apps/web`에 있음 → 이전 필요.

### 2.6 i18n — 현재 상태

**파일**: [apps/web/messages/{vi,en,ko}.json](../../apps/web/messages/)
- 네임스페이스 구조 존재 (`nav`, `actions`, `company`, `screens.dashboardA`, ...)
- UI 텍스트는 대부분 `t()` 사용 중. 새 컴포넌트도 동일 패턴 유지.
- 새 컴포넌트(EmptyState, Skeleton, ErrorAlert 등)에 추가 키 필요.

### 2.7 의존성 — 추가 필요

| 패키지 | 용도 | 비고 |
|---|---|---|
| `recharts` | 차트 (KPI sparkline, donut, stacked bar) | ~280KB tree-shaken |
| `@radix-ui/react-dialog` | Modal (accessible) | shadcn 표준 |
| `@radix-ui/react-dropdown-menu` | Dropdown | |
| `@radix-ui/react-tabs` | Tabs | |
| `@radix-ui/react-toast` 또는 `sonner` | Toast | sonner 권장 (lightweight) |
| `tailwindcss-animate` | 애니메이션 유틸리티 | shadcn 의존성 |
| `cmdk` | Combobox (선택사항, 검색형 select) | |

---

## 3. TO-BE 요구사항

### 3.1 디자인 시스템 (요약 — 상세는 PLAN 문서)

| 영역 | TO-BE |
|---|---|
| **스타일** | Swiss Modernism 2.0 + Minimalism (Linear/Stripe Dashboard inspired) |
| **컬러** | Primary `#0F172A` (slate-900) · CTA `#0369A1` (sky-700) · 시맨틱 success/warning/danger/info/purple · 차트 시퀀스 8색 (색맹 안전) |
| **타이포** | Pretendard + Be Vietnam Pro + Inter + JetBrains Mono (self-host) |
| **사이즈 스케일** | xs 12 / sm 13 / base 14 / md 15 / lg 17 / xl 20 / 2xl 24 / 3xl 30 / 4xl 36 |
| **라운드** | sm 4 / DEFAULT 6 / md 8 / lg 12 / xl 16 |
| **섀도** | xs / sm / md / lg / pop — **모달/팝오버 외엔 보더 사용** |
| **모션** | duration 150-180ms 기본, prefers-reduced-motion 비활성 |

### 3.2 AS-IS → TO-BE 매핑

| 영역 | AS-IS | TO-BE | 변경 사유 |
|---|---|---|---|
| 컬러 토큰 위치 | `tailwind.config.ts` 하드코드 | `packages/ui/src/tokens.css` (CSS vars) + tailwind extend | 다중 앱 공유 + 향후 다크 모드 확장 가능 구조 |
| 컴포넌트 위치 | `apps/web/src/components/primitives/` | `packages/ui/src/components/` | 모노레포 공유 가능 |
| 컴포넌트 패턴 | 자체 변형 패턴 | cva + Radix primitives + forwardRef | shadcn 표준, 접근성 우수 |
| 차트 | 커스텀 SVG (`spark.tsx`, `donut.tsx`) | Recharts 컴포넌트 | 유지보수성, 표준 |
| 폰트 로딩 | CDN | self-host `/public/fonts/` + Next.js `next/font` | iframe 안정성 |
| 레이아웃 | 데스크탑 사이드바 단일 | 데스크탑(Sidebar) + 모바일(BottomTab) 반응형 | Mobile Driver 페르소나 지원 |
| 폼 | 자체 `field.tsx` 래퍼 | shadcn Form + RHF + Zod 표준 패턴 | 보일러플레이트 감소, 타입 안전 |
| 다크 모드 | 없음 | **본 스코프 제외** | 사용자 명시, 향후 phase |

### 3.3 신규 컴포넌트 (모두 `packages/ui/src/components/` 배치)

**Primitives** (15개):
`button`, `card`, `input`, `label`, `textarea`, `select`, `checkbox`, `radio`, `switch`, `badge` (status pill), `separator`, `skeleton`, `spinner`, `avatar`, `tooltip`

**Composed** (10개):
`dialog`, `sheet` (mobile drawer), `tabs`, `dropdown-menu`, `command` (search combobox), `toast` (sonner wrapper), `pagination`, `data-table` (TanStack-free, props-driven), `empty-state`, `alert`

**Charts** (Recharts wrappers, 5개):
`kpi-card`, `sparkline`, `donut-chart`, `stacked-bar-chart`, `line-chart`

**Layout** (`apps/web/src/components/layout/` — 앱별이므로 monorepo가 아님):
`app-shell`, `sidebar-nav`, `bottom-tab-nav`, `page-header`, `filter-bar`, `breadcrumbs`

### 3.4 UI 비즈니스 룰

| 규칙 | 적용 위치 |
|---|---|
| Trip status 7개 → semantic pill 색상 매핑 | `<StatusBadge status={trip.status}>` |
| Expense 8 category → 차트 시퀀스 8색 1:1 매핑 | Recharts series colors |
| Approval 우선순위 (Accident > Repair > Meal threshold) → 카드 prominence | Approval queue list |
| Mobile Driver 터치 타깃 ≥44×44 | Button size `xl` (h-11) 강제 적용 |
| 페이지 헤더에 breadcrumb 필수 (Tenant > Module > Page) | `<PageHeader breadcrumbs=[]>` |
| URL이 필터/탭/페이지 상태 반영 (`?status=PENDING&page=2`) | `useSearchParams` 기반 |

---

## 4. 갭 분석

### 4.1 변경 범위 요약표

| 영역 | 현재 | 변경 | 영향도 |
|---|---|---|---|
| Tailwind config | 78 줄 (Toss tokens) | ~120 줄 (CSS var 참조 + 새 토큰) | High — 모든 페이지 |
| globals.css | CDN 폰트 | self-host 폰트 + CSS var 정의 | High |
| `packages/ui` 컴포넌트 | 2개 (cn, index) | ~30개 컴포넌트 | High (신규) |
| `apps/web/src/components/primitives/` | 15개 | **삭제** | Medium — 13페이지 import 변경 |
| `apps/web/src/components/dashboard/` | 4개 | 리빌드 (Recharts 기반) | Medium — 1페이지(Dashboard) |
| `apps/web/src/components/layout/` | 11개 | 리빌드 (AppShell + BottomTab) | High — 모든 페이지 |
| 페이지 (13개) | 기존 import + JSX | import 변경 + 컴포넌트 prop 마이그레이션 | High |
| i18n 키 | 기존 네임스페이스 | EmptyState/Skeleton/Alert 등 신규 키 추가 | Low — 3개 JSON × ~10키 |
| Recharts 의존성 | 없음 | 추가 | Low |
| 폰트 파일 | CDN | `/public/fonts/` ~6 파일 | Low |

### 4.2 파일 변경 목록 (요약 — 상세는 PLAN §3)

**신규 생성** (~40개):
- `packages/ui/src/tokens.css` · `packages/ui/src/components/{button,card,...}.tsx` × 30 · `apps/web/src/components/layout/{app-shell,sidebar-nav,bottom-tab-nav,page-header,filter-bar,breadcrumbs}.tsx` × 6
- `apps/web/public/fonts/pretendard/*` · `apps/web/public/fonts/be-vietnam-pro/*` · `apps/web/public/fonts/inter/*`

**수정** (~17개):
- `apps/web/tailwind.config.ts` · `apps/web/src/app/globals.css` · `apps/web/src/app/layout.tsx`
- 13개 `page.tsx` 파일
- `apps/web/messages/{vi,en,ko}.json` (key 추가)

**삭제** (~30개):
- `apps/web/src/components/primitives/*` (15 파일)
- `apps/web/src/components/dashboard/*` (4 파일)
- `apps/web/src/components/layout/*` (11 파일, 새 6개로 대체)

### 4.3 DB 마이그레이션

**없음** — 본 작업은 순수 UI/UX 리팩토링.

---

## 5. 사용자 플로우

### 5.1 Admin 데스크탑 (변경 없음 — UI만 교체)
```
[Login] → [Dashboard] → [Sidebar: Trips/Vehicles/Drivers/Costs/Reports/Users/Settings/Audit]
                              ↓
            [List+Filter] ──→ [Detail]
                              [Form Wizard]
                              [Approval Queue]
```

### 5.2 Manager/Director 데스크탑
```
[Login] → [Dashboard] → [Trips/New] → [Form Wizard] → submit
                  └── [Trips List (filter by myUserId)] → [Trip Detail]
```

### 5.3 Driver 모바일 PWA (신규 레이아웃)
```
[Login PWA] ─→ [Today]   (next trip card, accept/reject CTA)
                  ├─→ [Trip In-Progress] (start/end, add stopover)
                  ├─→ [Trips History tab]
                  ├─→ [Expenses tab] ─→ [Receipt Capture] (camera viewfinder)
                  └─→ [Me tab] (profile, language switch, logout)
```
하단 4개 탭 고정: Today · Trips · Expenses · Me

---

## 6. 기술 제약사항

| 항목 | 제약 |
|---|---|
| **호환성** | Next.js 15 App Router · React 19 (RSC default) · Tailwind 3.4 · TypeScript strict + `noUncheckedIndexedAccess` |
| **iframe** | CSP `frame-ancestors`로 AMA 호스트 허용 — 폰트/리소스는 self-host 필수 |
| **PWA** | Driver는 installable PWA (P5 단계에서 service worker 추가). 본 작업은 PWA 기반 모바일 레이아웃까지만 |
| **성능** | LCP < 2.5s (NFR-1). Recharts는 dynamic import. 폰트는 `font-display: swap` |
| **a11y** | WCAG AA (NFR-8). focus-visible 필수, 색상 단독 정보 전달 금지 |
| **i18n** | next-intl, 모든 텍스트 `t()` 경유. RTL 미지원(현재 언어 모두 LTR) |
| **보안** | XSS — Tailwind는 untrusted CSS 비허용. 사용자 입력 렌더링 시 `dangerouslySetInnerHTML` 금지 |
| **유지보수** | 컴포넌트는 stateless + props-driven. 상태는 서버(RSC) 또는 form library에 위임 |
| **모노레포** | `packages/ui` 변경 시 dependents(`@car-v2/web`) 자동 빌드 (Turborepo) |
| **레거시** | 본 작업과 동시에 진행 중인 다른 PR과 충돌 가능성 — 작업 전 main 동기화 필수 |

---

## 7. Open Questions (수동 확인 필요)

1. **Driver 모바일 PWA 범위**: 본 REQ에서는 *반응형 레이아웃 + 컴포넌트*까지만. PWA manifest + service worker는 별도 REQ(P5)에서 다룰지?
2. **사이드바 collapse 상태 영속화**: localStorage 저장 vs 매 세션 리셋 — 어느 쪽?
3. **차트 인터랙티브 깊이**: 호버 툴팁만 vs 클릭하면 드릴다운(필터링 페이지로 이동) — MVP는 hover만?
4. **Toast 정책**: 모든 mutation 후 success toast 자동 표시 vs 사용자 명시적 피드백만? (현재 시스템엔 없음 — 신규 도입)
