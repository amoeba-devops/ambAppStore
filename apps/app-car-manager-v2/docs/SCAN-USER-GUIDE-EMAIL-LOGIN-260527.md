# Scan Report — User Guide: Phone-Login → Email-Login Migration

**Date**: 2026-05-27
**Scope**: `apps/web/public/docs/user-guide/{vi,ko}/**/*.html`
**Trigger**: Commit [`7de1a0c`](../../..) `feat(car-v2): onboarding sync + email login + RBAC fixes …` — Wave 3 swapped login form from phone → email, but published user-guide HTML still describes phone-login flow.
**Status**: ❌ 2 pages (login + admin-users) carry stale phone copy and stale screenshots in both VI and KO.

---

## 1. Source of truth (current app state)

| Surface | Field shown | Code reference |
|---|---|---|
| `/login` form (web + PWA) | **email** (`type="email"`, `Mail` icon) | [apps/web/src/app/login/page.tsx](../apps/web/src/app/login/page.tsx) lines 90-111 |
| `/api/auth/login` payload | `ent_code` + `email` (proxied to AMA `/auth/email-login`) | [apps/web/src/app/api/auth/login/route.ts](../apps/web/src/app/api/auth/login/route.ts) |
| `/users/new` add-member form | **email** (AMA `POST /entity-settings/members/email-add`) | [apps/web/src/app/(app)/users/new/_components/add-member-form.tsx](../apps/web/src/app/(app)/users/new/_components/add-member-form.tsx) |
| `/users` list row | **email** column (`u.usrEmail`, line 99) | [apps/web/src/app/(app)/users/page.tsx](../apps/web/src/app/(app)/users/page.tsx) |
| `car_users` DB schema | `usr_email VARCHAR(255)` — no `usr_phone` column at all | [packages/db/src/schema/users.schema.ts](../packages/db/src/schema/users.schema.ts) |
| `car_drivers` DB schema | `drv_phone VARCHAR(20)` — kept for driver contact (Admin to call) | [packages/db/src/schema/drivers.schema.ts](../packages/db/src/schema/drivers.schema.ts) |
| i18n `login.*` keys | `emailLabel`, `emailPlaceholder`, `emailHint`, `errInvalid` (mentions email) | [apps/web/messages/{vi,ko,en}.json](../apps/web/messages) lines 1174-1194 |

**Implication**: User authenticates by email. Driver entity still has a phone field (contact info — admin clicks-to-call, not for login). Member onboarding template should now say "email" instead of "phone number".

---

## 2. Distinction — which mentions to change vs. keep

| Mention | Action |
|---|---|
| Phone as **login credential** (entered on `/login`, in admin onboarding messages) | ❌ **CHANGE → email** |
| Phone as **member contact** (`/users` list row, click-to-call) | ❌ **CHANGE → email** (because `car_users` no longer carries phone) |
| Phone as **driver contact** (`/drivers/[id]`, admin recording driver's mobile to call) | ✅ **KEEP** (`drv_phone` still in schema) |
| Phone as **device** ("on your phone", "mobile push", "PWA on phone") | ✅ **KEEP** (just means physical device, no relation to login) |

---

## 3. Files to update

### 3.1 `common/01-dang-nhap.html` — Login page (CORE FIX)

**VI** ([vi/common/01-dang-nhap.html](../apps/web/public/docs/user-guide/vi/common/01-dang-nhap.html)):

| Line | Current | New |
|---:|---|---|
| 142 | `Form đăng nhập trên web — nhập mã doanh nghiệp và số điện thoại để xác minh` | `Form đăng nhập trên web — nhập mã doanh nghiệp và email để xác minh` |
| 160 (step 2) | `Nhập <strong>Số điện thoại</strong> đã đăng ký với Amoeba (định dạng quốc tế: <code>+84 90 123 4567</code>).` | `Nhập <strong>Email</strong> đã đăng ký với Amoeba (VD: <code>ban@congty.com</code>). Phân biệt hoa thường không quan trọng.` |
| 174 (warning) | `Nếu không nhớ Mã doanh nghiệp hoặc Số điện thoại không khớp, liên hệ <strong>Admin doanh nghiệp của bạn</strong>…` | `Nếu không nhớ Mã doanh nghiệp hoặc Email không khớp với hệ thống AMA, liên hệ <strong>Admin doanh nghiệp của bạn</strong>…` |
| 192 (table cell) | `<strong>Số điện thoại của bạn</strong>` | `<strong>Email của bạn</strong>` |
| 193 (example) | `<code>+84 90 555 8819</code>` | `<code>ban@congty.com</code>` |
| 194 (note) | `Số đã đăng ký với Amoeba khi tham gia doanh nghiệp. <strong>Phải khớp chính xác</strong> với hệ thống AMA.` | `Email Admin đã đăng ký cho bạn trên AMA. <strong>Phải khớp chính xác</strong> (hoa/thường không phân biệt).` |
| 208 (template msg) | `3. Số điện thoại: số điện thoại của bạn (đã đăng ký với Amoeba)` | `3. Email: email của bạn (đã đăng ký trên AMA)` |
| 213 (template footer) | `Cần hỗ trợ liên hệ: [Admin tên / số điện thoại]` | `Cần hỗ trợ liên hệ: [Admin tên / email hoặc số điện thoại]` |
| 227-228 (admin note) | `liên hệ bộ phận nhân sự đăng ký số điện thoại + vai trò vào AMA … Số điện thoại nhập trong app phải khớp với số trên AMA.` | `liên hệ bộ phận nhân sự đăng ký email + vai trò vào AMA … Email nhập trong app phải khớp với email trên AMA.` |

**KO** ([ko/common/01-dang-nhap.html](../apps/web/public/docs/user-guide/ko/common/01-dang-nhap.html)):

| Line | Current | New |
|---:|---|---|
| 123 | `웹에서 본 로그인 폼 — 회사 코드와 전화번호로 인증` | `웹에서 본 로그인 폼 — 회사 코드와 이메일로 인증` |
| 138 (step 2) | `Amoeba에 등록된 <strong>전화번호</strong>를 국제 형식으로 입력합니다 (<code>+84 90 123 4567</code>).` | `Amoeba에 관리자가 등록한 <strong>이메일</strong>을 입력합니다 (예: <code>you@company.com</code>). 대소문자 구분 없음.` |
| 149 (warning) | `회사 코드를 모르거나 전화번호가 일치하지 않으면 개발팀이 아닌 <strong>회사 관리자</strong>에게 확인하세요.` | `회사 코드를 모르거나 이메일이 AMA에 등록된 것과 일치하지 않으면 개발팀이 아닌 <strong>회사 관리자</strong>에게 확인하세요.` |
| 167 (table cell) | `<strong>본인 전화번호</strong>` | `<strong>본인 이메일</strong>` |
| 168 (example) | `<code>+84 90 555 8819</code>` | `<code>you@company.com</code>` |
| 169 (note) | `회사 등록 시 Amoeba에 입력한 번호. AMA 시스템과 <strong>정확히 일치</strong>해야 함.` | `AMA에서 관리자가 등록한 이메일. <strong>정확히 일치</strong>해야 함 (대소문자 구분 없음).` |
| 183 (template) | `3. 전화번호: 본인 전화번호 (Amoeba 등록 번호)` | `3. 이메일: 본인 이메일 (AMA 등록 주소)` |
| 188 (template footer) | `지원 문의: [관리자 이름 / 전화번호]` | `지원 문의: [관리자 이름 / 이메일 또는 전화번호]` |
| 202-203 (admin note) | `<em>먼저</em> 전화번호 + 역할을 AMA에 등록한 후 … 앱에 입력하는 전화번호는 AMA에 등록된 번호와 일치해야 합니다.` | `<em>먼저</em> 이메일 + 역할을 AMA에 등록한 후 … 앱에 입력하는 이메일은 AMA에 등록된 주소와 일치해야 합니다.` |

### 3.2 `admin/04-quan-ly-nguoi-dung.html` — Admin user list/onboarding (CORE FIX)

**VI** ([vi/admin/04-quan-ly-nguoi-dung.html](../apps/web/public/docs/user-guide/vi/admin/04-quan-ly-nguoi-dung.html)):

| Line | Current | New |
|---:|---|---|
| 73 | `<li><strong>Số điện thoại</strong> (bấm gọi)</li>` | `<li><strong>Email</strong></li>` |
| 87-88 (callout) | `… qua kênh liên lạc cá nhân (SMS / Zalo / Telegram / email), sau đó thành viên tự đăng nhập ở <code>/login</code> với số điện thoại của mình.` | `… qua kênh liên lạc cá nhân (SMS / Zalo / Telegram / email), sau đó thành viên tự đăng nhập ở <code>/login</code> với email của mình.` |
| 110 (template) | `3. Số điện thoại: số điện thoại của bạn (đã đăng ký với Amoeba)` | `3. Email: email của bạn (đã đăng ký trên AMA)` |
| 115 | `Cần hỗ trợ liên hệ: [Admin tên / số điện thoại]` | `Cần hỗ trợ liên hệ: [Admin tên / email hoặc số điện thoại]` |
| 118 | `Khi thành viên truy cập <code>/login</code> với mã doanh nghiệp + SĐT của họ, …` | `Khi thành viên truy cập <code>/login</code> với mã doanh nghiệp + email của họ, …` |
| 128-131 (warn) | `số điện thoại thành viên phải đã được Amoeba đăng ký <em>trước</em> với vai trò trong tổ chức của bạn.` | `email thành viên phải đã được Amoeba đăng ký <em>trước</em> với vai trò trong tổ chức của bạn.` |

**KO** ([ko/admin/04-quan-ly-nguoi-dung.html](../apps/web/public/docs/user-guide/ko/admin/04-quan-ly-nguoi-dung.html)):

| Line | Current | New |
|---:|---|---|
| 74 | `<li><strong>전화번호</strong> (클릭 시 전화 연결)</li>` | `<li><strong>이메일</strong></li>` |
| 88 (callout) | `멤버가 본인 전화번호로 <code>/login</code>에서 직접 로그인합니다.` | `멤버가 본인 이메일로 <code>/login</code>에서 직접 로그인합니다.` |
| 103-115 (template) | template still in Vietnamese (legacy KO of admin/04 copies VI block). Replace template body to localized KO + email. | replace whole `<pre>` block — see §4 below |
| 118 | `멤버가 기업 코드 + 본인 전화번호로 <code>/login</code>에 접속하면…` | `멤버가 기업 코드 + 본인 이메일로 <code>/login</code>에 접속하면…` |
| 128-130 (warn) | `필수 조건: 멤버의 전화번호가 본인 조직의 역할로 Amoeba에 <em>먼저</em> 등록되어 있어야 합니다.` | `필수 조건: 멤버의 이메일이 본인 조직의 역할로 Amoeba에 <em>먼저</em> 등록되어 있어야 합니다.` |

---

## 4. Files NOT to touch

| File | Phone mention | Why keep |
|---|---|---|
| `{vi,ko}/admin/03-quan-ly-tai-xe.html` | driver phone (lines 73/74 + 105/106) | `drv_phone` is driver contact info, not login |
| `{vi,ko}/driver/00-tong-quan.html` | "operate on phone" | physical device, not auth |
| `{vi,ko}/driver/01-cai-pwa.html` | "install PWA on phone" | physical device |
| `{vi,ko}/driver/02-today-screen.html` | "push notification from phone" | physical device |
| `{vi,ko}/driver/07-ngoai-tuyen.html` | "shoot receipt with phone camera" | physical device |
| `{vi,ko}/manager/01-dashboard.html` | "viewed on phone" | physical device |
| `{vi,ko}/manager/03-theo-doi-chuyen-di.html` | "on phone" | physical device |
| `{vi,ko}/common/00-gioi-thieu.html` | "Web + phone" device column | physical device |
| `{vi,ko}/common/04-thong-bao.html` | "push on phone" | physical device |
| `{vi,ko}/common/99-thuat-ngu.html` | "PWA = web app installable to phone" | physical device |
| `{vi,ko}/admin/09-cau-hinh-he-thong.html` | "Push on browser/phone" | physical device |
| `index.html` (vi/ko + root) | "use on phone" | physical device |

---

## 5. Screenshots to regenerate

The login screenshots show the **old phone-input form**. App now shows the email-input form, so the screenshots are obsolete.

| Asset | Locale | Device | Path |
|---|---|---|---|
| `01-login-form.png` | vi | desktop | `apps/web/public/docs/user-guide/assets/img/screenshots/vi/common/01-login-form.png` |
| `01-login-form.png` | ko | desktop | `apps/web/public/docs/user-guide/assets/img/screenshots/ko/common/01-login-form.png` |
| `01-login-form-mobile.png` | vi | mobile (iPhone 14) | `…/vi/common/01-login-form-mobile.png` |
| `01-login-form-mobile.png` | ko | mobile (iPhone 14) | `…/ko/common/01-login-form-mobile.png` |

Optional (low priority — admin/04 has user list screenshots that show email already if seed has emails populated):

| Asset | Locale | Path | Reason |
|---|---|---|---|
| `04-users-list.png` | vi/ko | `…/{vi,ko}/admin/04-users-list.png` | Column header changed phone → email |
| `04-user-invite.png` | vi/ko | `…/{vi,ko}/admin/04-user-invite.png` | `/users/new` form is now email-based |

### 5.1 Regeneration command

The Playwright pipeline already exists ([scripts/user-guide/](../scripts/user-guide)):

```powershell
# from apps/app-car-manager-v2/
cd scripts/user-guide
npx playwright test --project=vi-desktop --project=ko-desktop \
  --project=vi-mobile  --project=ko-mobile \
  --grep "Form đăng nhập|로그인 폼"
```

### 5.2 Production-mode run (no Next.js dev indicator visible)

Pipeline currently expects `APP_URL=http://localhost:3001` running via `next dev`. The dev indicator at the bottom-right corner is baked into screenshots. To suppress it, run `next start` (production build) instead:

```powershell
# from apps/app-car-manager-v2/
cd apps/web
npm run build
# .env already has DEMO_AUTO_LOGIN=true (required by /dev-login)
npx dotenv -e ../../.env -- next start --port 3001
# (separate terminal)
cd ../../scripts/user-guide
npx playwright test --grep "Form đăng nhập|로그인 폼"
```

This is the only production-vs-dev difference that affects screenshot fidelity. The bundled-app DOM, layout, and styles are identical — `next start` just drops the dev indicators (HMR ping, route loader spinner, "N" floating button in Next 15).

---

## 6. Estimated effort

| Phase | Effort |
|---|---|
| Edit 2 files × 2 locales (login + admin-users) | ~30 min |
| Build production bundle + restart on port 3001 | ~3 min |
| Regenerate 4 login screenshots via Playwright | ~2 min |
| Visual diff + commit | ~10 min |
| **Total** | **< 1 hour** |

---

**Report generated**: 2026-05-27 by Claude Code
**Next action**: Apply edits in §3.1–3.2, then regenerate screenshots per §5.
