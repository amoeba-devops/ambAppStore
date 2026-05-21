# TC-20260520 — Driver Shell Split Test Cases

> **REQ**: REQ-20260520 · **PLAN**: PLAN-20260520 · **Date**: 2026-05-20

## Pre-conditions
- Driver, Manager, Admin accounts exist
- AMA dev-login wired (dev-login page)
- Browser PWA cache cleared before test

## Test cases

### TC-F1.1 — DriverShellClient renders for DRIVER role
| Step | Expected |
|---|---|
| 1. Login as Driver | App loads `/today` |
| 2. Inspect DOM | No sidebar (`aside[aria-label="Điều hướng chính"]` absent) |
| 3. Inspect DOM | DriverTopBar present (`header` with brand + locale + logout) |
| 4. Inspect DOM | BottomTabNav present with 4 driver tabs |

### TC-F1.2 — ConsoleShellClient unchanged for ADMIN/MANAGER
| Step | Expected |
|---|---|
| 1. Login as Admin | Sidebar visible on md+ |
| 2. Sidebar has all admin items | Dashboard / Trips / Costs / Vehicles / Drivers / Reports / Users / Settings / Audit |
| 3. Login as Manager | Sidebar items per `STAFF` role filter |
| 4. BottomTabNav (mobile) shows | Today / Trips / Costs / Settings (console default labels) |

### TC-F1.3 — DriverTopBar functions
| Step | Expected |
|---|---|
| 1. Tap locale dropdown | Shows VI / EN / KO options |
| 2. Pick EN | UI text switches to English |
| 3. Tap logout | Calls `logoutAction`, redirects `/session-expired` |
| 4. Brand area shows | "Fleet" + tenant short name |

### TC-F2.1 — Middleware blocks driver from non-allowed routes
| Step | Route | Expected |
|---|---|---|
| 1. Driver types | `/vehicles` | 307 redirect → `/today` |
| 2. Driver types | `/users` | 307 → `/today` |
| 3. Driver types | `/reports` | 307 → `/today` |
| 4. Driver types | `/audit` | 307 → `/today` |
| 5. Driver types | `/settings` (without `/me`) | 307 → `/today` |
| 6. Driver types | `/costs` | 307 → `/today` |
| 7. Driver types | `/trips/new` | 307 → `/today` |
| 8. Driver types | `/trips/abc/edit` | 307 → `/today` |

### TC-F2.2 — Middleware allows driver to allowed routes
| Step | Route | Expected |
|---|---|---|
| 1. Driver visits | `/` | Renders /today (no extra redirect) |
| 2. Driver visits | `/today` | Renders driver Today |
| 3. Driver visits | `/trips` | Renders DriverTripsList |
| 4. Driver visits | `/trips/abc-trip-id` | Renders trip detail driver view |
| 5. Driver visits | `/expenses/new` | Renders expense submit form |
| 6. Driver visits | `/settings/me` | Renders Me page |

### TC-F2.3 — Admin / Manager unaffected by driver guard
| Step | Expected |
|---|---|
| 1. Admin visits `/vehicles` | Page renders |
| 2. Manager visits `/users` | Existing role gating applies (probably 403/redirect), NOT driver-redirect |
| 3. Admin visits `/today` | Renders console version of today page |

### TC-F3.1 — DriverTripsList renders correctly
| Step | Expected |
|---|---|
| 1. Driver opens `/trips` | DriverTripsList visible |
| 2. Default tab "Đang xử lý" active | Cards show trips with status CONFIRMED/IN_PROGRESS/PENDING_DRIVER_CONFIRMATION |
| 3. Tap "Hoàn tất" tab | Cards swap to COMPLETED/CANCELLED/REJECTED_BY_DRIVER |
| 4. Empty tab | EmptyState shown |
| 5. Tap card | Navigate `/trips/[id]` |
| 6. No FAB / no "New trip" button | Not rendered for driver |
| 7. No driver column in cards | Driver name absent (it's themselves) |

### TC-F3.2 — Mobile-only card layout
| Step | Expected |
|---|---|
| 1. View at 375px width | Card list |
| 2. View at 1024px width | Card list (NOT table) |
| 3. Each card height ≥ 80px | Touch target met |

### TC-F4.1 — Bottom tabs driver variant
| Step | Expected |
|---|---|
| 1. Driver sees 4 tabs | Hôm nay / Chuyến của tôi / Chi phí / Tôi |
| 2. Tap "Chuyến của tôi" | Navigate `/trips`, tab indicator active |
| 3. Tap "Chi phí" | Navigate `/expenses/new` |
| 4. Tap "Tôi" | Navigate `/settings/me` |
| 5. Locale switch | Labels update in all 3 langs |

### TC-F4.2 — Console bottom tabs unchanged
| Step | Expected |
|---|---|
| 1. Admin mobile view | Bottom tabs: Today / Trips / Expenses / Me |
| 2. Manager mobile view | Same |
| 3. "Expenses" tab links to `/costs` (admin approval queue) | Yes |

### TC-F5.1 — `/settings/me` for driver
| Step | Expected |
|---|---|
| 1. Driver visits `/settings/me` | Page renders with DriverPageHeader |
| 2. MeProfileCard shows | Avatar, name, email, role badge "Tài xế" |
| 3. MeLicenseCard shows | License number, class, expiry date, status badge |
| 4. License expiring <30d | Warning color badge |
| 5. MeLanguageCard | 3 chips, current locale highlighted |
| 6. Tap EN chip | Locale switches, page re-renders |
| 7. App section | "Install Fleet" prompt if not installed |
| 8. Logout button | Bottom of page, danger variant |
| 9. Tap logout | Calls logoutAction, redirects |

### TC-F5.2 — `/settings/me` for manager/admin
| Step | Expected |
|---|---|
| 1. Admin visits `/settings/me` | Page renders with PageHeader (not DriverPageHeader) |
| 2. MeProfileCard shows | Role badge "Admin" |
| 3. MeLicenseCard NOT shown | (admin doesn't have driver record) |
| 4. MeLanguageCard + logout works | OK |

### TC-F6.1 — DriverPageHeader behavior
| Step | Expected |
|---|---|
| 1. Driver opens `/today` | DriverPageHeader at top, title "Hôm nay" |
| 2. No breadcrumb | Absent |
| 3. Sticky top while scrolling | Header stays |
| 4. Safe-area-inset-top respected | iOS PWA test |
| 5. `back` prop present | Back button shows ChevronLeft |
| 6. Tap back | Navigate to `back` href |

### TC-F7.1 — Density / padding consistency
| Step | Expected |
|---|---|
| 1. All driver pages | content container `px-4 py-3` or similar compact |
| 2. Admin pages | content container `px-7 py-6` (unchanged) |

## Cross-cutting

### TC-X1 — Typecheck pass
- `npx tsc --noEmit -p apps/web/tsconfig.json` exit 0

### TC-X2 — Lint pass
- `npx next lint` 0 warnings

### TC-X3 — Build pass
- `npm run build` succeeds, no new routes broken

### TC-X4 — i18n parity
- All new keys exist in vi/en/ko at same paths

### TC-X5 — A11y
- DriverTopBar buttons have aria-label
- DriverPageHeader has `role="banner"` implicit via `<header>`
- BottomTabNav `aria-current="page"` on active tab
- All form controls in /settings/me labelled

### TC-X6 — PWA standalone
- Driver login via PWA standalone window stays within app
- BottomTabNav respects safe-area-inset-bottom

### TC-X7 — Manager regression
- Manager pages (vehicles, drivers, reports, costs approval) all still work
- Manager NOT redirected to `/today`

### TC-X8 — Performance
- No additional First Load JS regression > 10kB on existing routes
- New routes (`/settings/me`) reasonable bundle

## Acceptance criteria
- [ ] All TC-F1.x pass
- [ ] All TC-F2.x pass (middleware guard correct)
- [ ] All TC-F3.x pass (driver trips list)
- [ ] All TC-F4.x pass (bottom tabs)
- [ ] All TC-F5.x pass (settings/me)
- [ ] All TC-F6.x pass (header)
- [ ] All TC-X pass
- [ ] No regression on admin/manager flows
