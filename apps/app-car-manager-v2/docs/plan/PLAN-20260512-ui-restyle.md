# PLAN-20260512 — UI/UX Full Restyle 구현 계획

> 작성일: 2026-05-12 · 작성자: dev@amoeba.group + Claude Code
> 선행 문서: [REQ-20260512-ui-restyle.md](../analysis/REQ-20260512-ui-restyle.md)
> 후속 문서(예정): `docs/test/TC-20260512-ui-restyle.md` · `docs/implementation/RPT-20260512-ui-restyle.md`

---

## 1. 시스템 개발 현황 분석

### 1.1 디렉토리 구조 (현재)

```
app-car-manager-v2/
├── apps/web/
│   ├── public/                       (fonts 폴더 없음 — 신규 생성 필요)
│   ├── messages/{vi,en,ko}.json
│   ├── src/
│   │   ├── app/                      (13 페이지 라우트)
│   │   ├── components/
│   │   │   ├── primitives/  ← 15 파일 (삭제 예정)
│   │   │   ├── dashboard/   ← 4 파일 (리빌드)
│   │   │   └── layout/      ← 11 파일 (6개로 재구성)
│   │   ├── i18n/
│   │   ├── lib/
│   │   └── middleware.ts
│   ├── tailwind.config.ts            ← 교체
│   └── package.json                  ← 의존성 추가
└── packages/
    ├── db/, shared/
    └── ui/
        └── src/  cn.ts + index.ts    ← ⭐ 메인 호스트 (현재 비어있음)
```

### 1.2 기술 스택 (CLAUDE.md §2 — 변경 불가)

- Next.js 15 App Router · React 19 · TypeScript 5.7 strict
- Tailwind 3.4 · clsx · tailwind-merge · class-variance-authority (이미 `apps/web`에 설치됨 → `packages/ui`로 이전)
- next-intl 3.26 · react-hook-form 7.54 · zod 3.24 · lucide-react 0.469
- Turborepo 2.3 monorepo

### 1.3 기존 코드 상황

- ✅ 13개 페이지에 sample data hardcode — UI만 변경하면 됨 (서버 액션 wiring은 별도 phase)
- ✅ i18n 키 구조 이미 존재 — 새 컴포넌트 키만 추가
- ✅ TypeScript path alias `@/*` 설정됨
- ⚠️ `packages/ui`는 빈 상태 — 디자인 시스템 전체를 새로 채워야 함
- ⚠️ `apps/web/tailwind.config.ts`의 `content` 배열에 이미 `'../../packages/ui/src/**/*.{ts,tsx}'` 포함됨 — 별도 처리 불필요

### 1.4 제약사항

- **다른 작업과의 동시성**: 현재 브랜치 `huy/setup-local-step`에서 진행 가능. 메인 머지 전 충돌 없는지 확인 필요.
- **iframe 환경**: 모든 외부 리소스 self-host 필수 (CDN 폰트 제거)
- **다국어 렌더링**: VN 다이아크리틱 위(̂ ̛) + KR 자모 둘 다 동일 라인 높이 유지 필요

---

## 2. 단계별 구현 계획

> **8 단계** 순차 실행. 각 단계는 typecheck + dev server smoke test 통과 후 commit.

### Phase D0 — 디자인 토큰 & 인프라

#### D0-S1: 폰트 self-host
- 다운로드: Pretendard Variable, Be Vietnam Pro, Inter, JetBrains Mono
- 배치: `apps/web/public/fonts/{pretendard,be-vietnam-pro,inter,jetbrains-mono}/`
- `apps/web/src/app/layout.tsx`: `next/font/local` 로 로드, CSS variable로 노출
- 라이선스 파일 함께 커밋 (SIL OFL)
- └─ 사이드 임팩트: 빌드 산출물 크기 약 +1MB (정적 폰트). LCP 영향 최소(font-display: swap)

#### D0-S2: 디자인 토큰 (CSS variables)
- 신규: `packages/ui/src/tokens.css`
  - 컬러 (bg, surface, surface-2, border, text, primary, accent, success, warning, danger, info, purple, chart-1~8)
  - **light 모드 only**. `.dark` selector는 본 스코프 제외
- 신규: `packages/ui/src/tokens.ts` — TypeScript 토큰 export (chart 컬러 hex 문자열 등 JS에서 사용)
- └─ 사이드 임팩트: 토큰 변경 시 즉시 모든 컴포넌트 영향 — `tokens.css`는 단일 소스

#### D0-S3: Tailwind 설정 교체
- 수정: `apps/web/tailwind.config.ts`
  - 기존 `brand`, `neutral`, `success-{50..700}` 등 삭제
  - 새 시맨틱 컬러 (`bg`, `surface`, `text.muted`, `accent`, `chart.1`...) — CSS var 참조 (`hsl(var(--accent) / <alpha-value>)`)
  - fontFamily: Pretendard 우선, Be Vietnam Pro → Inter → system-ui
  - fontSize 스케일 9단계 재정의
  - borderRadius / boxShadow 토큰
  - plugins: `tailwindcss-animate`
- 수정: `apps/web/src/app/globals.css`
  - CDN `@import` 제거
  - `@import '@car-v2/ui/tokens.css';` 추가
  - body 기본 컬러 — `text-text bg-bg`
- └─ 사이드 임팩트: 모든 페이지 즉시 흰 배경 + 새 폰트 적용. 기존 컴포넌트 색상 클래스(`bg-brand-500` 등)는 모두 깨짐 → D2-D5에서 교체.

#### D0-S4: 의존성 추가
- `apps/web/package.json`: `recharts`, `tailwindcss-animate`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@radix-ui/react-checkbox`, `@radix-ui/react-radio-group`, `@radix-ui/react-switch`, `@radix-ui/react-select`, `@radix-ui/react-label`, `@radix-ui/react-slot`, `@radix-ui/react-separator`, `@radix-ui/react-toast` 또는 `sonner`
- `packages/ui/package.json`: `class-variance-authority`, `lucide-react`, `react` (peer)
- └─ 사이드 임팩트: node_modules ~+30MB. Radix는 tree-shake 됨.

---

### Phase D1 — `packages/ui` 코어 컴포넌트 빌드

> 모두 shadcn 패턴: cva variants + forwardRef + `cn()` 머지. **export는 named only** (default export 금지).

#### D1-S1: Primitive components (15개)
파일 경로 `packages/ui/src/components/`:

| # | 파일 | 컴포넌트 | 비고 |
|---|---|---|---|
| 1 | `button.tsx` | Button | cva: primary/accent/secondary/ghost/danger/link × sm/md/lg/icon/xl |
| 2 | `card.tsx` | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter | outline / elevated |
| 3 | `input.tsx` | Input | size · error state · iconLeft slot |
| 4 | `label.tsx` | Label | Radix Label wrapper |
| 5 | `textarea.tsx` | Textarea | auto-resize 옵션 |
| 6 | `select.tsx` | Select (Trigger/Content/Item) | Radix Select |
| 7 | `checkbox.tsx` | Checkbox | Radix Checkbox + lucide Check icon |
| 8 | `radio.tsx` | RadioGroup, RadioItem | Radix RadioGroup |
| 9 | `switch.tsx` | Switch | Radix Switch |
| 10 | `badge.tsx` | Badge (status pill) | tone: neutral/info/success/warning/danger/accent/purple |
| 11 | `separator.tsx` | Separator | Radix Separator |
| 12 | `skeleton.tsx` | Skeleton | `animate-pulse bg-surface-2 rounded` |
| 13 | `spinner.tsx` | Spinner | lucide Loader2 + spin animation |
| 14 | `avatar.tsx` | Avatar, AvatarImage, AvatarFallback | initials 자동 |
| 15 | `tooltip.tsx` | Tooltip (Provider/Trigger/Content) | Radix Tooltip, delayDuration 300 |

└─ 사이드 임팩트: 각 컴포넌트 ~50-80 줄. 모든 페이지에서 import.

#### D1-S2: Composed components (10개)

| # | 파일 | 컴포넌트 | 비고 |
|---|---|---|---|
| 1 | `dialog.tsx` | Dialog (Root/Trigger/Content/Header/Footer/Title/Description) | Radix Dialog |
| 2 | `sheet.tsx` | Sheet (side="left/right/bottom") | Radix Dialog with slide animation — 모바일 drawer |
| 3 | `tabs.tsx` | Tabs (Root/List/Trigger/Content) | Radix Tabs |
| 4 | `dropdown-menu.tsx` | DropdownMenu (Root/Trigger/Content/Item/Separator) | Radix Dropdown |
| 5 | `command.tsx` | Command (cmdk 래퍼) | 검색형 select — 선택사항 |
| 6 | `toast.tsx` | Toaster, toast() | sonner 래퍼 |
| 7 | `pagination.tsx` | Pagination (Root/Item/Previous/Next/Ellipsis) | URL-based state |
| 8 | `data-table.tsx` | DataTable, useDataTable | props-driven (columns, data, onSort, onPageChange) — TanStack 미사용 |
| 9 | `empty-state.tsx` | EmptyState | icon · title · description · action slot |
| 10 | `alert.tsx` | Alert, AlertTitle, AlertDescription | variant: info/success/warning/danger |

└─ 사이드 임팩트: cmdk는 선택사항이라 D1에서 제외 가능 (D4 필요시 추가)

#### D1-S3: Chart components (5개, Recharts 래퍼)

| 파일 | 비고 |
|---|---|
| `kpi-card.tsx` | label · value · delta · sparkline 슬롯 (선택) · accent color |
| `sparkline.tsx` | Recharts Line (no axes, single stroke) |
| `donut-chart.tsx` | Recharts PieChart + Donut (innerRadius) + center label |
| `stacked-bar-chart.tsx` | Recharts BarChart stacked + rounded |
| `line-chart.tsx` | Recharts LineChart + Area 옵션 |

└─ 사이드 임팩트: Recharts는 dynamic import 권장 (~80KB). KPI 카드는 sparkline 옵셔널.

#### D1-S4: `packages/ui/src/index.ts` re-export
- 모든 컴포넌트 named export
- `export { cn } from './cn';`
- `export * from './tokens';` (chart colors JS 사용)

#### D1-S5: Storybook 미도입 (스코프 제외)
- 대신: `apps/web/src/app/dev/components/page.tsx` (개발 전용) 같은 검증 페이지 작성 옵션 — 시간 남으면.

---

### Phase D2 — 레이아웃 셸

#### D2-S1: 새 `apps/web/src/components/layout/`
파일 (6개 신규):

| 파일 | 책임 |
|---|---|
| `app-shell.tsx` | 데스크탑(sidebar+content) / 모바일(bottom-tab+content) 분기. `useMediaQuery` 기반. Client component. |
| `sidebar-nav.tsx` | 좌측 사이드바 240px → 64px collapse. nav groups (Operations / Costs / Admin). active state. |
| `bottom-tab-nav.tsx` | 모바일 하단 4 탭 (Today / Trips / Expenses / Me). |
| `page-header.tsx` | breadcrumbs + title + subtitle + actions slot |
| `filter-bar.tsx` | search + segmented control + chips |
| `breadcrumbs.tsx` | next-intl 기반 segment 자동화 |

#### D2-S2: 기존 레이아웃 파일 삭제
- 삭제 대상: `app-frame.tsx`, `sidebar.tsx`, `topbar.tsx`, `nav-list.tsx`, `nav-config.ts`, `logo.tsx`, `detail-page-shell.tsx`, `form-page-shell.tsx`, `list-page-shell.tsx`, `page-content.tsx`, `section.tsx`
- 단, `nav-config.ts`의 메뉴 데이터 구조는 `sidebar-nav.tsx`로 흡수

#### D2-S3: `apps/web/src/app/layout.tsx` 업데이트
- `<AppShell>` wrapper로 모든 페이지 감쌈
- 폰트 variable 클래스 `<html className={fontVariables}>`
- next-intl provider 유지

└─ 사이드 임팩트: 모든 페이지가 새 셸 안에서 렌더. `useMediaQuery`는 클라이언트에서만 작동 — SSR fallback은 데스크탑 가정.

---

### Phase D3 — 페이지 1: Dashboard 리스타일 (POC)

#### D3-S1: 새 Dashboard 페이지 빌드
- `apps/web/src/app/page.tsx`:
  - `<PageHeader title="Dashboard" actions={[ExportBtn, NewTripBtn]} />`
  - 4 KPI 카드 row (`<KpiCard>` × 4)
  - Fleet status (3 vehicles) + Spend mix donut (2-col grid)
  - Schedule calendar (Week view) + Action queue (2-col grid)
  - Stacked spend chart + Top users list (2-col grid)
- 모든 sample data 유지 (서버 wiring은 후속 작업)

#### D3-S2: i18n 키 검증
- 기존 `screens.dashboardA.*` 키 재사용
- 새로 필요한 키: `screens.dashboardA.kpi.*`, `screens.dashboardA.empty.*`

└─ 사이드 임팩트: Dashboard만 새 시스템. 다른 페이지는 D4까지 깨진 상태 — 사용자에게 알림 필요.

---

### Phase D4 — 페이지 2~13 마이그레이션

각 페이지 단위로 PR 분리 가능 (한번에 1~2 페이지).

| # | 페이지 | 템플릿 | 우선순위 |
|---|---|---|---|
| 1 | `trips/page.tsx` | List+Filter | High |
| 2 | `trips/new/page.tsx` | Form Wizard | High |
| 3 | `trips/[id]/page.tsx` | Detail | High |
| 4 | `vehicles/page.tsx` | List+Filter | Medium |
| 5 | `vehicles/[id]/page.tsx` | Detail | Medium |
| 6 | `drivers/page.tsx` | List+Filter | Medium |
| 7 | `drivers/[id]/page.tsx` | Detail | Medium |
| 8 | `costs/page.tsx` | Approval Queue (split-pane) | High |
| 9 | `reports/page.tsx` | Dashboard variant + filters | Medium |
| 10 | `users/page.tsx` | List+Filter | Low |
| 11 | `settings/page.tsx` | Form sections | Low |
| 12 | `audit/page.tsx` | List (mono font, dense) | Low |
| 13 | `session-expired/page.tsx` | EmptyState fullscreen | Low |

└─ 사이드 임팩트: 페이지 단위 commit. 한 페이지 break가 다른 페이지에 영향 안 줌.

---

### Phase D5 — 모바일 Driver 뷰 (반응형 레이아웃)

#### D5-S1: 모바일 라우트 그룹 (선택사항)
- 옵션 A: 기존 라우트 그대로, 반응형 CSS만 — 추천
- 옵션 B: `app/(driver)/today/page.tsx` 별도 라우트 그룹 — Driver 페르소나 명시적

#### D5-S2: 모바일 전용 컴포넌트
- `today-trip-hero.tsx` (next trip 카드, accept/reject CTA, fullbleed)
- `trip-progress-controls.tsx` (start/end trip + stopover 추가)
- `receipt-capture.tsx` (camera viewfinder UI — 실제 카메라 API는 P5 PWA에서)
- `bottom-action-bar.tsx` (sticky bottom CTA)

#### D5-S3: 모바일 텍스트 사이즈 검증
- mobile에서 `text-base` = 15px (데스크탑 14 → 모바일 16 자동 미디어 쿼리)
- Tailwind에 `@media (max-width: 640px)` text scale override

└─ 사이드 임팩트: 모바일 뷰포트에서만 효과. 데스크탑 영향 없음. **PWA manifest + service worker는 별도 phase**.

---

### Phase D6 — Empty / Loading / Error states

- 모든 페이지에 `<EmptyState>` 적용 (데이터 0 case)
- 모든 페이지에 `<Suspense fallback={<Skeleton />}>` 적용
- 모든 페이지에 `error.tsx` 추가 (Next.js error boundary)
- Global `<Toaster />` 마운트

└─ 사이드 임팩트: UX 일관성 확보. 코드 양 ~+200 줄.

---

### Phase D7 — 접근성 & 다국어 검증

- Lighthouse a11y ≥ 95
- axe DevTools 통과 (violations 0)
- 키보드 탐색: Tab만으로 모든 페이지 작업 가능
- VN/KO/EN 텍스트 over-truncation 검사 (특히 nav, button labels)
- `prefers-reduced-motion` 적용 확인

└─ 사이드 임팩트: 일부 컴포넌트 padding/min-width 조정. 큰 변경 없음.

---

### Phase D8 — 클린업

- `apps/web/src/components/primitives/` **폴더 삭제**
- `apps/web/src/components/dashboard/` **폴더 삭제** (또는 D3에서 이미 삭제)
- 사용하지 않는 i18n 키 정리 (옵션)
- README 업데이트: 새 디자인 시스템 사용법 1페이지

└─ 사이드 임팩트: 코드 정리. 빌드 산출물 ~-50KB.

---

## 3. 변경 파일 목록

### 3.1 Backend / DB
> **변경 없음** — UI/UX 작업.

### 3.2 신규 (UI 시스템)

| 구분 | 파일 | 변경 유형 |
|---|---|---|
| Token | `packages/ui/src/tokens.css` | 신규 |
| Token | `packages/ui/src/tokens.ts` | 신규 |
| Primitive | `packages/ui/src/components/button.tsx` | 신규 |
| Primitive | `packages/ui/src/components/card.tsx` | 신규 |
| Primitive | `packages/ui/src/components/input.tsx` | 신규 |
| Primitive | `packages/ui/src/components/label.tsx` | 신규 |
| Primitive | `packages/ui/src/components/textarea.tsx` | 신규 |
| Primitive | `packages/ui/src/components/select.tsx` | 신규 |
| Primitive | `packages/ui/src/components/checkbox.tsx` | 신규 |
| Primitive | `packages/ui/src/components/radio.tsx` | 신규 |
| Primitive | `packages/ui/src/components/switch.tsx` | 신규 |
| Primitive | `packages/ui/src/components/badge.tsx` | 신규 |
| Primitive | `packages/ui/src/components/separator.tsx` | 신규 |
| Primitive | `packages/ui/src/components/skeleton.tsx` | 신규 |
| Primitive | `packages/ui/src/components/spinner.tsx` | 신규 |
| Primitive | `packages/ui/src/components/avatar.tsx` | 신규 |
| Primitive | `packages/ui/src/components/tooltip.tsx` | 신규 |
| Composed | `packages/ui/src/components/dialog.tsx` | 신규 |
| Composed | `packages/ui/src/components/sheet.tsx` | 신규 |
| Composed | `packages/ui/src/components/tabs.tsx` | 신규 |
| Composed | `packages/ui/src/components/dropdown-menu.tsx` | 신규 |
| Composed | `packages/ui/src/components/toast.tsx` | 신규 |
| Composed | `packages/ui/src/components/pagination.tsx` | 신규 |
| Composed | `packages/ui/src/components/data-table.tsx` | 신규 |
| Composed | `packages/ui/src/components/empty-state.tsx` | 신규 |
| Composed | `packages/ui/src/components/alert.tsx` | 신규 |
| Chart | `packages/ui/src/components/kpi-card.tsx` | 신규 |
| Chart | `packages/ui/src/components/sparkline.tsx` | 신규 |
| Chart | `packages/ui/src/components/donut-chart.tsx` | 신규 |
| Chart | `packages/ui/src/components/stacked-bar-chart.tsx` | 신규 |
| Chart | `packages/ui/src/components/line-chart.tsx` | 신규 |
| Layout | `apps/web/src/components/layout/app-shell.tsx` | 신규 |
| Layout | `apps/web/src/components/layout/sidebar-nav.tsx` | 신규 |
| Layout | `apps/web/src/components/layout/bottom-tab-nav.tsx` | 신규 |
| Layout | `apps/web/src/components/layout/page-header.tsx` | 신규 |
| Layout | `apps/web/src/components/layout/filter-bar.tsx` | 신규 |
| Layout | `apps/web/src/components/layout/breadcrumbs.tsx` | 신규 |
| Asset | `apps/web/public/fonts/pretendard/*.woff2` | 신규 |
| Asset | `apps/web/public/fonts/be-vietnam-pro/*.woff2` | 신규 |
| Asset | `apps/web/public/fonts/inter/*.woff2` | 신규 |
| Asset | `apps/web/public/fonts/jetbrains-mono/*.woff2` | 신규 |
| Error | `apps/web/src/app/error.tsx` | 신규 (글로벌 error boundary) |
| Error | `apps/web/src/app/not-found.tsx` | 신규 |

### 3.3 수정

| 구분 | 파일 | 변경 유형 |
|---|---|---|
| Config | `apps/web/tailwind.config.ts` | 전체 교체 |
| Config | `apps/web/src/app/globals.css` | 전체 교체 |
| Config | `apps/web/src/app/layout.tsx` | 폰트 + AppShell wrap |
| Config | `apps/web/package.json` | 의존성 추가 |
| Config | `packages/ui/package.json` | 의존성 추가 |
| Config | `packages/ui/src/index.ts` | re-export |
| Page | `apps/web/src/app/page.tsx` (Dashboard) | 전체 재작성 |
| Page | `apps/web/src/app/trips/page.tsx` | 전체 재작성 |
| Page | `apps/web/src/app/trips/new/page.tsx` | 전체 재작성 |
| Page | `apps/web/src/app/trips/[id]/page.tsx` | 전체 재작성 |
| Page | `apps/web/src/app/vehicles/page.tsx` | 전체 재작성 |
| Page | `apps/web/src/app/vehicles/[id]/page.tsx` | 전체 재작성 |
| Page | `apps/web/src/app/drivers/page.tsx` | 전체 재작성 |
| Page | `apps/web/src/app/drivers/[id]/page.tsx` | 전체 재작성 |
| Page | `apps/web/src/app/costs/page.tsx` | 전체 재작성 |
| Page | `apps/web/src/app/reports/page.tsx` | 전체 재작성 |
| Page | `apps/web/src/app/users/page.tsx` | 전체 재작성 |
| Page | `apps/web/src/app/settings/page.tsx` | 전체 재작성 |
| Page | `apps/web/src/app/audit/page.tsx` | 전체 재작성 |
| Page | `apps/web/src/app/session-expired/page.tsx` | 전체 재작성 |
| i18n | `apps/web/messages/vi.json` | 키 추가 |
| i18n | `apps/web/messages/en.json` | 키 추가 |
| i18n | `apps/web/messages/ko.json` | 키 추가 |

### 3.4 삭제

| 폴더 | 파일 수 |
|---|---|
| `apps/web/src/components/primitives/` | 15 |
| `apps/web/src/components/dashboard/` | 4 |
| `apps/web/src/components/layout/` (기존) | 11 (새 6개로 대체) |

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 | 완화책 |
|---|---|---|---|
| 전체 페이지 시각 | **High** | D0-S3 머지 시점부터 D3 완료 전까지 모든 페이지 컬러 깨짐 | D0-S3와 D3-S1을 한 commit으로 묶거나, D0-D3 사이엔 dev branch 비공유 |
| `packages/ui` 빌드 | **High** | 다른 앱(`app-sales-report-v2` 등)에서 `@car-v2/ui` 사용 시 충돌. 현재 v2 모노레포는 standalone이라 영향 없음. | standalone 확인됨 — 영향 없음 |
| 폰트 로딩 성능 | Medium | 초기 4개 폰트 패밀리 → woff2 7-10 파일. LCP 영향. | `font-display: swap` + preload 필요한 weight만 |
| Recharts 번들 크기 | Medium | Recharts 미니파이드 ~280KB | dynamic import (`next/dynamic`) — Dashboard 차트 lazy load |
| Radix accessibility tree | Low | Radix는 portal 사용 — iframe에서 dialog 위치 이슈 가능 | `<DialogPortal container={...}>` 명시적 지정으로 회피 |
| i18n 키 누락 | Low | 새 컴포넌트 키 누락 시 prod에서 raw key 노출 | next-intl `getMessageFallback` 설정으로 디폴트 |
| 모바일 미디어 쿼리 SSR | Medium | `useMediaQuery`는 클라 전용 — SSR 시 데스크탑 hydrate → 모바일 hydrate flash 가능 | `useMediaQuery` 대신 CSS-only 미디어 쿼리로 사이드바 vs 바텀탭 토글 |
| 다른 PR과 충돌 | Medium | 같은 `apps/web` 파일 다른 PR 변경 시 머지 충돌 | 시작 전 main rebase + 페이지 단위 PR로 분리 |
| 테스트 코드 | Low | 현재 테스트 거의 없음 → 깨질 코드 없음 | P6에서 Playwright 추가 |
| 배포 환경 | Low | Render.com build 시 추가 파일 다운로드 없음 (모두 git 트래킹) | — |

---

## 5. DB 마이그레이션

**없음** — 본 작업은 UI/UX 리팩토링이며 DB 스키마 변경 없음.

---

## 6. 일정 추정 (실측 가능 단위)

| Phase | 단계 | 예상 시간 | 누적 |
|---|---|---|---|
| D0 | 토큰 + Tailwind + 폰트 + 의존성 | 3h | 3h |
| D1 | 30개 컴포넌트 (primitive + composed + chart) | 8-10h | 13h |
| D2 | 레이아웃 셸 6개 | 3h | 16h |
| D3 | Dashboard POC | 4h | 20h |
| D4 | 12개 페이지 마이그레이션 | 8-10h | 30h |
| D5 | 모바일 Driver 뷰 (반응형 + 컴포넌트) | 6h | 36h |
| D6 | Empty/Loading/Error states | 3h | 39h |
| D7 | A11y + 다국어 검증 | 3h | 42h |
| D8 | 클린업 + README | 1h | 43h |

**총: ~40-45h 솔로 작업 = 1주~1.5주 풀타임**

---

## 7. 체크포인트 (커밋 단위)

각 phase 종료 시:
1. `npm run typecheck` 통과
2. `npm run lint` 통과
3. `npm run dev` 띄워 영향 페이지 1회 수동 확인
4. 영향 페이지 i18n 3개 언어 토글 확인
5. commit message: `feat(ui): Dn-Sn <단계 제목>`

PR 머지 단위:
- D0 + D1 + D2 = 1 PR (foundation, but pages still broken)
- D3 = 1 PR (Dashboard live)
- D4는 페이지별 또는 2~3개 묶음으로 PR
- D5-D8은 각각 1 PR

---

## 8. 롤백 전략

- Branch 보호: `huy/ui-restyle-d{0..8}` 형태로 phase별 브랜치
- D0-D2가 미완 머지된 상태에서 문제 발견 시: `git revert <merge commit>`
- 페이지별 PR이라 D4 이후 단일 페이지 롤백 가능
- `packages/ui` 컴포넌트 단위 롤백은 어려움 (cross-page dependency) — 전체 D0-D3 묶음 롤백 권장
