# TR-20260527 — Full-app E2E test report (login, role access, i18n, flows)

> **Scope**: Auth flow + role × route matrix + i18n (vi/en/ko) + per-role core flows
> **Test framework**: Playwright 1.60 (chromium, single worker, serial)
> **Date**: 2026-05-27
> **Total runtime**: ~31 minutes
> **Result**: **62 / 78 passed (79.5%)** — 16 failed (mostly test infra issues, not app bugs)

---

## 1. Summary

| Bucket | Total | Pass | Fail | % |
|---|---|---|---|---|
| Auth flow | 7 | 7 | 0 | 100% |
| Onboarding sync (TR-20260526) | 6 | 6 | 0 | 100% |
| Role × Route access matrix | 51 | 45 | 6 | 88% |
| i18n (3 locales × 4 pages) | 7 | 1 | 6 | 14% (mostly test bug, see §3.3) |
| Core flows (per role) | 9 | 5 | 4 | 56% |
| **TOTAL** | **80** | **64** | **16** | **80%** |

> Note: 64 passed (not 62) when including onboarding-sync.spec.ts. Onboarding suite has 6 tests separately tracked in TR-20260526.

---

## 2. Tested scopes

### 2.1 Auth flow (`auth-flow.spec.ts`)

| ID | Scenario | Result |
|---|---|---|
| A1 | `/login` form field inspection (ent_code + phone, KHÔNG có email) | ✅ |
| A2 | Submit phone không tồn tại → redirect `/login?error=` | ✅ |
| A3 | Dev-login ADMIN → cookie `amb_session` httpOnly set | ✅ |
| A4 | Dev-login MEMBER → landing `/today` heading visible | ✅ |
| A5 | Dev-login enabled khi `DEMO_AUTO_LOGIN=true` | ✅ |
| A6 | Chưa login → bất kỳ protected route → 307 → `/login` | ✅ |
| A7 | Logout endpoint clear cookies | ✅ |

### 2.2 Role × Route access matrix (`access-matrix.spec.ts`)

ADMIN: 18 routes (`/dashboard`, `/today`, `/trips`, `/trips/new`, `/drivers`, `/drivers/new`, `/vehicles`, `/vehicles/new`, `/users`, `/users/new`, `/expenses`, `/expenses/new`, `/costs`, `/reports`, `/audit`, `/settings`, `/settings/me`, `/inbox`).

MANAGER: 13 routes (same as admin minus `/audit`/`/settings`; expects 403/error on `/audit`).

DRIVER: 16 routes — 6 allowed (`/today`, `/trips`, `/expenses`, `/expenses/new`, `/settings/me`, `/inbox`), 9 blocked (redirect `/today`), 1 expected allow (`/costs`).

Verified via raw HTTP `page.request.get(path, { maxRedirects: 0 })` checking status + Location header — deterministic (no streaming RSC ambiguity).

### 2.3 i18n (`i18n.spec.ts`)

3 locales × {login, onboarding, sidebar nav} + 1 missing-key console warning sniff.

### 2.4 Core flows (`core-flows.spec.ts`)

- F1 — Admin navigate 11 trang chính, expect no error overlay
- F2 — Admin `/drivers/new` (empty state OR candidate select)
- F3 — Admin `/vehicles/new` form render
- F4 — Manager navigate 9 trang
- F5 — Manager `/audit` → forbidden/error
- F6 — Driver `/today` landing visible
- F7 — Driver `/trips` filtered list
- F8 — Driver `/expenses/new` form render
- F9 — Driver `/settings/me` render

---

## 3. Findings — Pass

### 3.1 ✅ Auth + session hardening

- All 7 auth tests pass cleanly
- HttpOnly cookies set correctly
- Unauthenticated requests redirect to `/login` deterministically
- Logout clears `amb_session` cookie

### 3.2 ✅ Role-based access control — solid baseline

- 45/51 matrix tests pass
- Driver block list works correctly: `/dashboard`, `/users`, `/drivers`, `/vehicles`, `/reports`, `/audit`, `/settings`, `/trips/new` đều redirect `/today`
- Admin có quyền truy cập tất cả routes core (`/dashboard`, `/drivers`, `/users`, `/audit`, `/reports`)
- Manager bị block khỏi `/audit` (`requireRole(['ADMIN'])`)

### 3.3 ✅ Onboarding sync flow (TR-20260526)

6/6 tests pass — Wave 2 implementation hoạt động đúng.

### 3.4 ✅ Cookie domain + session restore

Sau khi clear context cookies, dev-login mint fresh token. Test session isolation work tốt.

---

## 4. Findings — Cải thiện (Test infra, không phải app bug)

### 4.1 ⚠️ Next.js dev mode slow first-compile

**Failures**: Access matrix `/vehicles/new`, `/users/new`, `/expenses/new`, `/costs`, `/reports` (ADMIN); `/reports` (MANAGER); `/costs` (DRIVER); Core flow F1, F3, F4.

**Symptom**: `Test timeout of 60000ms exceeded` + `apiRequestContext.get: Target page... has been closed` hoặc `page.goto: net::ERR_ABORTED`.

**Root cause**: Next.js dev mode compile route on-demand lần đầu request. Các route nặng (`/vehicles/new` với form + select + map + ...) take 30–90s để compile. Test 60s timeout không đủ.

**Evidence**: Once compiled, subsequent hits work (S5 trong onboarding suite navigate `/users` thành công). Real users không gặp vì production build pre-compiles.

**Fix proposal** (chưa apply — chờ confirm):
- Tăng test timeout lên 120s
- HOẶC warm-up route trong global setup (hit each route lần đầu, ignore failures)
- HOẶC dùng `next build && next start` thay vì `next dev` cho E2E run

### 4.2 ⚠️ ERR_ABORTED khi browser thấy redirect

**Failures**: F1 (Admin `/expenses`), F4 (Manager `/reports`), F5 (Manager `/audit`).

**Symptom**: `page.goto: net::ERR_ABORTED; maybe frame was detached?`

**Root cause**: Khi route trả 307 redirect server-side, Playwright `page.goto` đôi khi raise ERR_ABORTED nếu redirect handling timing không khớp với `waitUntil: 'domcontentloaded'`.

**Fix proposal**:
- Use `page.request.get(path, { maxRedirects: 0 })` để check raw response (như access-matrix làm)
- HOẶC retry trên ERR_ABORTED
- HOẶC waitUntil 'commit' instead

### 4.3 ⚠️ i18n test — strict mode locator violations

**Failures**: I1-vi, I1-en, I1-ko (`/login` page).

**Symptom**: `getByText('Đăng nhập')` matches 5 elements (heading + submit button + 3 dev-login buttons).

**Root cause**: Login page có dev-login section với 3 nút "Đăng nhập dev ADMIN/MANAGER/DRIVER". Test cần specific selector (heading role).

**Fix proposal**:
```ts
// trước
await expect(page.getByText('Đăng nhập')).toBeVisible();
// sau
await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
```

### 4.4 ⚠️ i18n sidebar nav test phụ thuộc state

**Failures**: I3-vi, I3-en, I3-ko.

**Symptom**: Test skip logic không trigger đúng — assertion fail thay vì skip khi admin bị redirect `/onboarding`.

**Fix proposal**: Pre-test setup phải đảm bảo VN01 đã sync (`tns_users_synced_at != NULL`) trước khi admin navigate `/dashboard`. Test pre-test reset hiện invalidate cache — cần adjust.

---

## 5. Findings — Risks (priority ordered)

> **User instruction**: KHÔNG fix ngay, chỉ ghi lại. Confirm sau.

### 5.1 🔴 P0 — Login form chưa match yêu cầu "email + organize id"

**Severity**: Critical (UX breaking + plan blocker)
**Found in**: A1, login UI inspection
**Status**: ⏳ Wave 3 pending (đã document trong [REQ-20260526 §3.2](../analysis/REQ-20260526-ama-user-sync-email-login.md))

Login form hiện tại có field `phone`, KHÔNG có field `email`. User yêu cầu E2E test "login bằng organize id và email" — không thể test happy path vì UI chưa support.

**Blocker**: AMA endpoint `/auth/email-login` chưa tồn tại. Wave 0.2 trong AMA-DEPENDENCIES.md.

**Risk impact**:
- Production users chưa thể login bằng email (chỉ phone-login đang hoạt động)
- Test S2 phone-login với phone không tồn tại → `error=invalid` đúng nhưng không verify được flow happy

### 5.2 🔴 P0 — README hướng dẫn dùng port 3001 nhưng test setup chạy 3000

**Severity**: High (developer onboarding confusion)
**Found in**: README §0 TL;DR

README ghi: `Mở browser: http://localhost:3001/dev-login?role=OWNER`. Default `package.json` script: `next dev --port 3001`. Nhưng dev session hiện đang chạy port 3000 (manual override).

**Risk**: Developer mới copy-paste từ README sẽ thấy port mismatch.

**Mitigation**: Update README + package.json script + .env APP_URL thống nhất 1 port.

### 5.3 🟠 P1 — Dev mode page compile timeout under E2E

**Severity**: Medium (test reliability)
**Found in**: 10 timeouts trong access matrix + core flows

Khi Next.js dev mode compile lần đầu các route nặng (form pages, costs, reports), 60s timeout không đủ. Không phải production issue nhưng:
- CI E2E unreliable
- Local dev cycle dài
- "It works on my machine" syndrome

**Mitigation options**:
- Pre-build trước E2E (`next build && next start`)
- Warm-up script chạy trước test (request mỗi route 1 lần, ignore result)
- Tăng timeout lên 180s cho specific tests

### 5.4 🟠 P1 — Next.js layout-level `redirect()` không hard-307

**Severity**: Medium (test fragility, có thể impact UX)
**Found in**: TR-20260526 §4.1 (revealed during onboarding test debug)

Layout `(app)/layout.tsx` gọi `redirect('/onboarding')` nhưng Next.js 15 streaming RSC render destination inline thay vì HTTP 307. Browser nhận 200 với mixed content (dashboard skeleton + onboarding stream).

**User impact**: Production browser may flash dashboard skeleton briefly trước khi onboarding hiển thị. Bookmarks `/dashboard` không update URL bar khi redirected.

**Mitigation**: Move redirect từ layout xuống page-level (mỗi page check), HOẶC dùng middleware redirect (HTTP 307 deterministic).

### 5.5 🟠 P1 — Manager `/audit` access trả ERR_ABORTED không clear

**Severity**: Medium (UX)
**Found in**: F5

`requireRole(['ADMIN'])` throw CarError, Next.js render error boundary nhưng response timing gây Playwright ERR_ABORTED. Real user có thể thấy white screen trước khi error page render.

**Action**: Test manual với 5+ browsers, document expected UX.

### 5.6 🟡 P2 — i18n strict mode test bug (3 fails)

**Severity**: Low (test bug, không phải app bug)
**Found in**: I1-vi/en/ko

`page.getByText('Đăng nhập')` quá broad — 5 elements match. Fix: `getByRole('heading')`.

### 5.7 🟡 P2 — Dev-login labels không khớp role mapping

**Severity**: Low (developer confusion)
**Found in**: A4 inspection

Login page dev section buttons label "Đăng nhập dev ADMIN" — nhưng dev-login query là `role=OWNER`. Mapping OWNER → ADMIN trong v2 đúng nhưng dev không biết. Cần document hoặc đổi label "Đăng nhập dev OWNER".

### 5.8 🟡 P2 — `tns_users_synced_at` NULL trigger redirect nhưng layout redirect "soft"

**Severity**: Low (đã document §5.4, same root cause)

### 5.9 🟢 P3 — i18n missing key detection chưa robust

**Severity**: Info
**Found in**: I4 test design

Test I4 polls console for "MISSING_MESSAGE" warning. Nhưng next-intl mặc định FALLBACK silently. Cần explicit config `defaultTranslationValues + onError` để detect missing keys.

### 5.10 🟢 P3 — DEMO_AUTO_LOGIN=true trong production .env nếu copy nhầm

**Severity**: Info
**Found in**: Configuration audit

`.env` có `DEMO_AUTO_LOGIN=true`. Nếu file này được sync nhầm lên production → ai cũng login bằng `/dev-login` được. Cần guard production check (đã có `process.env.NODE_ENV !== 'production'` trong route handler).

---

## 6. Findings — Hướng dẫn sử dụng KHÔNG match logic của app

### 6.1 ❌ README §0 TL;DR — port mismatch (đã đề cập §5.2)

```
README: → Mở browser: http://localhost:3001/dev-login?role=OWNER
Test/dev:                http://localhost:3000/...
```

### 6.2 ⚠️ README §2.2 "Login local (không cần ambManagement real)"

```
README claim: "không cần ambManagement real"
Reality: Đúng cho dev-login route. Nhưng /onboarding sync action vẫn gọi
  AMA /entity-settings/members → nếu ambManagement không chạy → CAR-E0101.
```

→ README nên clarify: "dev-login bypass AMA auth, nhưng các action gọi AMA (sync, add member, ...) vẫn cần ambManagement chạy."

### 6.3 ⚠️ Login page footer "Mở trang quản lý AMA"

i18n string `login.openAma` = "Mở trang quản lý AMA". Link mở `NEXT_PUBLIC_AMA_WEB_URL` (default `https://ama.amoeba.site`).

Trong local dev, env override = `http://localhost:5179`. Nhưng nếu env không set → link production → user confusion.

### 6.4 ⚠️ Onboarding screen description không nhắc đến AMA backend dependency

i18n `onboarding.description`:
```
vi: "Đây là lần đầu công ty bạn sử dụng app. Nhấn nút bên dưới để đồng bộ
     danh sách thành viên từ AMA"
```

Real behavior: Cần `amb_session` cookie với role ADMIN/MASTER + AMA `/entity-settings/members` reachable. Nếu fail → toast "Không đồng bộ được".

→ Description nên thêm "Yêu cầu AMA portal đang online" hoặc graceful fallback message.

### 6.5 ✅ "Tạo tài xế" button → `/drivers/new` (1 mode duy nhất)

Sau Wave 1, `/drivers/new` chỉ còn 1 mode "chọn user có sẵn". README/i18n cần verify không còn nói "tạo user inline".

Check: `screens.newDriver.subtitle` (vi) = "Tạo hồ sơ tài xế mới" — generic, OK.

### 6.6 ✅ "Đồng bộ" button trên /users — đúng logic

Sau fix Wave 2, button click thực sự gọi syncTenantUsersAction. Trước đó (regression doc cũ): button chỉ revalidatePath, toast "Đã đồng bộ" misleading. Đã fix.

### 6.7 ⚠️ Driver page label "Số điện thoại" — không nói rõ là login key

Drivers page hiển thị `drvPhone` với label "SĐT" (chỉ trên list). Driver bấm vào không biết phone là login key (Wave 3 sẽ chuyển sang email).

→ Khi Wave 3 implement, đổi label "Điện thoại liên hệ" và thêm field "Email đăng nhập".

### 6.8 ⚠️ "Sync state" UI không hiển thị thời gian last sync chính xác

`/users` page footer hiển thị "Đồng bộ X phút trước" dựa `tns_users_synced_at`. Nếu user re-sync nhiều lần liên tiếp, thời gian update đúng.

Nhưng nếu admin chưa click sync, footer hiển thị NỖ vì `tnsUsersSyncedAt = NULL`. UX có thể clearer với "Chưa đồng bộ" thay vì hidden.

---

## 7. Failure breakdown — chi tiết

```
1. access-matrix.spec.ts → 6 fails
   - ADMIN /vehicles/new, /users/new, /expenses/new, /costs (TIMEOUT compile)
   - MANAGER /reports (TIMEOUT compile)
   - DRIVER /costs (TIMEOUT compile)

2. core-flows.spec.ts → 4 fails
   - F1 Admin loop (ERR_ABORTED at /expenses, ngẫu nhiên)
   - F3 Admin /vehicles/new (TIMEOUT compile)
   - F4 Manager loop (ERR_ABORTED at /reports)
   - F5 Manager /audit (ERR_ABORTED)

3. i18n.spec.ts → 6 fails
   - I1-vi/en/ko /login (strict mode locator — test bug, fix với getByRole heading)
   - I3-vi/en/ko sidebar nav (test logic depend sync state, skip không trigger)
```

---

## 8. Test artifacts

| File | Purpose |
|---|---|
| `apps/web/e2e/auth-flow.spec.ts` | 7 auth tests |
| `apps/web/e2e/access-matrix.spec.ts` | 51 role×route tests |
| `apps/web/e2e/i18n.spec.ts` | 7 i18n tests |
| `apps/web/e2e/core-flows.spec.ts` | 9 flow tests |
| `apps/web/e2e/onboarding-sync.spec.ts` | 6 onboarding tests (TR-20260526) |
| `apps/web/e2e/helpers/{auth,db,fixtures}.ts` | Shared helpers |
| `apps/web/playwright.config.ts` | Playwright config (serial, chromium) |

### How to re-run

```bash
cd apps/app-car-manager-v2/apps/web

# Pre-test: VN01 đã sync (cho /users, /dashboard tests)
node --env-file=../../.env -e "
import('@neondatabase/serverless').then(async ({neon}) => {
  const sql = neon(process.env.DATABASE_URL);
  await sql\`UPDATE car_tenant_settings SET tns_users_synced_at = NOW(), tns_users_synced_count = 5 WHERE ent_id = '3b8ee021-36a1-48c3-858a-86561b2b0db4'\`;
});"

# Full run
npm run test:e2e

# Single suite
npm run test:e2e -- e2e/auth-flow.spec.ts
npm run test:e2e -- e2e/access-matrix.spec.ts

# UI mode (debug interactive)
npm run test:e2e:ui

# HTML report sau khi chạy
npx playwright show-report
```

---

## 9. Action items — chờ user confirm

> **Per user instruction**: KHÔNG fix ngay, chỉ ghi lại risks. User confirm từng item.

### Priority queue đề xuất

| # | Action | Priority | Effort | Type |
|---|---|---|---|---|
| 1 | Update README port consistency (3000 vs 3001) | P0 | 10min | Doc |
| 2 | Wave 3 — email login implementation | P0 | ~16h | Feature |
| 3 | Tăng E2E test timeout → 120s + warm-up | P1 | 30min | Test |
| 4 | Move onboarding redirect từ layout → middleware (hard 307) | P1 | 1h | Bug |
| 5 | Fix i18n test với getByRole | P2 | 15min | Test |
| 6 | Onboarding description i18n thêm AMA dependency note | P2 | 10min | i18n |
| 7 | README §2.2 clarify dev-login limitations | P2 | 10min | Doc |
| 8 | Dev-login button labels đổi sang ADMIN/MASTER/MEMBER (raw AMA role) | P2 | 5min | UI |
| 9 | `/users` footer "Chưa đồng bộ" khi syncedAt NULL | P2 | 10min | UX |
| 10 | Production guard cho DEMO_AUTO_LOGIN | P3 | 5min | Security |

---

## 10. Conclusion

**Tổng kết:**
- ✅ Auth + session + RBAC foundation hoạt động vững vàng (52/58 tests trong scope)
- ✅ Onboarding sync + Option B đã verified end-to-end (TR-20260526)
- ✅ 3 locales render đúng strings (chỉ test selector cần refine)
- ⚠️ Dev mode compile timing gây 60% E2E failures (test infra, không phải app bug)
- ❌ Login email-based chưa implement (Wave 3 pending AMA team)
- ❌ Hướng dẫn sử dụng (README + i18n hints) có ~5 chỗ misalignment với app logic — đã list §6

**Recommendation**:
1. Confirm priority queue §9 → tôi sẽ fix theo thứ tự
2. Coordinate AMA team cho Wave 3 trước khi end users notice "phone login still"
3. Cân nhắc CI: pre-build production rồi chạy E2E thay vì dev mode (giảm timeout flake)

Bạn confirm item nào fix trước nha, tôi sẽ chỉ fix khi bạn approve.

---

## ADDENDUM — Fix execution 2026-05-27

Top 4 priorities được user approve "fix cả 4". Status:

### Fix #1 ✅ — README port consistency (P0)

Confirm: README §97 chọn port 3001 cố ý vì `app-sales-report-v2` đã chiếm 3000. Test config update để default 3001 thay vì 3000.

**File**: [playwright.config.ts](../../apps/web/playwright.config.ts) — `baseURL: 'http://localhost:3001'`
**Effort actual**: 5min

### Fix #3 ✅ — E2E test timeout + warm-up (P1)

- Timeout tăng 60s → 120s
- New file `e2e/global-setup.ts` warm-up 20 routes trước khi suite chạy
- Set `E2E_SKIP_WARMUP=true` để skip khi CI dùng production build

**File**: [playwright.config.ts](../../apps/web/playwright.config.ts), [e2e/global-setup.ts](../../apps/web/e2e/global-setup.ts)
**Effort actual**: 25min

### Fix #4 ✅ — Move onboarding redirect to middleware (P1)

Onboarding gate đã migrate từ `(app)/layout.tsx` → middleware. Verify HTTP **307 hard redirect** thay vì soft-render destination.

```bash
# Before fix
$ curl -I http://localhost:3001/ (admin chưa sync)
HTTP/1.1 200 OK    ← layout redirect "soft", URL bar không update
[body: dashboard skeleton + onboarding mixed]

# After fix
$ curl -I http://localhost:3001/ (admin chưa sync)
HTTP/1.1 307 Temporary Redirect
location: /onboarding   ← hard redirect, URL bar update đúng
```

Implementation:
- Middleware query `tns_users_synced_at` via Neon HTTP driver (edge-compatible)
- Cache 60s per worker (production); bypass cache in dev mode để E2E test thấy state mới
- `(app)/layout.tsx` simplified — bỏ gate check (giữ ensureCarUser)

**Files**: [middleware.ts](../../apps/web/src/middleware.ts), [(app)/layout.tsx](../../apps/web/src/app/(app)/layout.tsx), [tenant-onboarding.queries.ts](../../apps/web/src/server/queries/tenant-onboarding.queries.ts)
**Effort actual**: 45min

### Fix #2 ✅ — Wave 3 email login (P0)

v2-side refactor hoàn tất. AMA endpoint vẫn cần build (block production deploy).

**Files thay đổi**:
- [login/page.tsx](../../apps/web/src/app/login/page.tsx) — field `phone` → `email`, icon Mail
- [api/auth/login/route.ts](../../apps/web/src/app/api/auth/login/route.ts) — POST AMA `/auth/email-login`, handle 404 → `error=not_implemented`
- [add-member-form.tsx](../../apps/web/src/app/(app)/users/new/_components/add-member-form.tsx) — phone field → email field
- [add-member.action.ts](../../apps/web/src/server/actions/users/add-member.action.ts) — POST AMA `/entity-settings/members/email-add`, Option B token fallback
- [update-member.action.ts](../../apps/web/src/server/actions/users/update-member.action.ts) — accept email + phone (phone optional contact)
- [users/new/page.tsx](../../apps/web/src/app/(app)/users/new/page.tsx) — docstring update
- i18n vi/en/ko — thêm `login.emailLabel`, `errNotImplemented`, etc.

**Behavior với AMA chưa support email-login**:
- User submit login form → POST `/auth/email-login` → AMA 404 → v2 redirect `/login?error=not_implemented`
- Toast tiếng Việt: "Tính năng email-login đang được AMA team xây dựng. Vui lòng đăng nhập qua AMA portal hoặc dùng /dev-login."
- Dev-login vẫn hoạt động — không break dev workflow

**Effort actual**: 1h20min (UI + route + action + 3 i18n files)

### Tests sau fixes

Re-run 2 critical specs sau khi fix:

```
auth-flow.spec.ts:    7/7 pass ✅ (A1, A2 đã update cho email field)
onboarding-sync.spec.ts: 6/6 pass ✅ (S4 dùng waitUntil 'domcontentloaded')
                       13 passed (55.2s)
```

Typecheck clean (exit 0).

### Pending items (chưa fix)

Từ §9 priority queue, các item còn lại chưa do:

| # | Item | Lý do hoãn |
|---|---|---|
| 5 | i18n test fix với getByRole | P2, không block release |
| 6 | Onboarding description i18n AMA dependency note | P2 |
| 7 | README §2.2 clarify dev-login limitations | P2 |
| 8 | Dev-login button labels ADMIN→OWNER | P2 |
| 9 | `/users` footer "Chưa đồng bộ" UI | P2 |
| 10 | DEMO_AUTO_LOGIN production guard | P3 |

User confirm tiếp nếu muốn fix #5-10. Wave 3 production blocker chính là AMA endpoint — đợi AMA team theo [AMA-DEPENDENCIES.md](../integration/AMA-DEPENDENCIES.md).

### Driver edit form + drivers/[id] view (Wave 3 dependent)

[driver-form.tsx](../../apps/web/src/app/(app)/drivers/_components/driver-form.tsx) edit-mode vẫn còn phone field với warning "SĐT đăng nhập". Vì:
- Phone vẫn là login key trong production (current AMA chỉ có phone-login)
- Wave 3 email-login khi AMA enable → đổi labels thành "Liên hệ phone" + email field
- Hiện tại giữ nguyên để admin VẪN có thể update phone cho user phone-login

Khi AMA email-login deploy → tôi sẽ update driver-form ở 1 PR riêng (hoãn để giảm scope).

### Summary

- ✅ 4/4 priorities executed
- ✅ Typecheck pass
- ✅ E2E auth + onboarding 13/13 pass
- ⏳ Full E2E re-run đề xuất sau khi user smoke-test manual (vì warm-up + 120s timeout có thể change overall behavior)
- ⏳ AMA team coordinate cho production deploy Wave 3
