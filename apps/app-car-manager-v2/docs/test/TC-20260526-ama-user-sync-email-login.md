# TC-20260526 — AMA user sync + Email login + Driver flow

> **Linked REQ**: [REQ-20260526-ama-user-sync-email-login.md](../analysis/REQ-20260526-ama-user-sync-email-login.md)
> **Linked PLAN**: [PLAN-20260526-ama-user-sync-email-login.md](../plan/PLAN-20260526-ama-user-sync-email-login.md)
> **Status**: Draft

---

## Test environments

| Env | URL | DB | AMA endpoint |
|---|---|---|---|
| Local | http://localhost:3000 | Neon dev branch | `http://localhost:3009/api/v1` (AMA local) |
| Staging | car-v2 staging URL | Neon staging branch | AMA staging |
| Prod | car-v2 prod URL | Neon prod | AMA prod |

## Test data prerequisites

| ID | Setup |
|---|---|
| **TD-1** | Test tenant với 120 users (50 ACTIVE, 50 INACTIVE, 20 SUSPENDED) để verify pagination + status filtering |
| **TD-2** | Test user `admin@test.car-v2.local` (role MASTER), `manager@test.car-v2.local` (role MANAGER), `driver@test.car-v2.local` (role MEMBER) |
| **TD-3** | Cross-entity admin (`ADMIN_LEVEL`) member trong test tenant |
| **TD-4** | 5 driver candidates trong tenant chưa link `car_drivers` |
| **TD-5** | 3 existing drivers (đã link `car_drivers`) cho regression test |

---

## Wave 1 — Driver flow refactor

### TC-W1-01 — `/drivers/new` hiển thị 1 mode duy nhất

| | |
|---|---|
| **Pre** | Login admin (TD-2). Tenant có >0 candidate (TD-4) |
| **Steps** | 1. Nav `/drivers/new`<br>2. Quan sát UI<br>3. URL bar |
| **Expected** | • KHÔNG có toggle "+ Tạo tài xế mới / Chọn user có sẵn"<br>• Form trực tiếp render `DriverForm` với select user<br>• URL `/drivers/new` (không có `?mode=`) |
| **Priority** | P0 |

### TC-W1-02 — Empty state khi không có candidate

| | |
|---|---|
| **Pre** | Tenant fresh chưa có user, hoặc tất cả users đã link driver (TD-5 với count = entity total) |
| **Steps** | 1. Nav `/drivers/new`<br>2. Quan sát empty state |
| **Expected** | • Hiển thị empty card "Chưa có user nào sẵn sàng làm tài xế"<br>• CTA button `→ Tạo user mới` link tới `/users/new`<br>• Form license vẫn render nhưng select user disabled với message empty |
| **Priority** | P0 |

### TC-W1-03 — Tạo driver với existing user

| | |
|---|---|
| **Pre** | TD-4 candidate có email + name |
| **Steps** | 1. `/drivers/new`<br>2. Chọn user từ select<br>3. Nhập license number `B2-9999999`, class `B2`, expiry `2028-12-31`<br>4. Submit |
| **Expected** | • Toast success "Đã thêm tài xế"<br>• Redirect `/drivers/:newDrvId`<br>• `car_drivers` row có `drv_user_id = selectedUserId`, `drv_phone` = user phone từ AMA (auto-sync)<br>• `car_audit_logs` thêm row `DRIVER.CREATE` |
| **Priority** | P0 |

### TC-W1-04 — KHÔNG có route `/drivers/new?mode=inline`

| | |
|---|---|
| **Steps** | 1. Manually navigate `/drivers/new?mode=inline`<br>2. Quan sát |
| **Expected** | • Render giống `/drivers/new` (mode param bị ignore)<br>• Không có `InlineDriverForm` component trong DOM |
| **Priority** | P1 |

### TC-W1-05 — `createDriverWithUserAction` không còn export

| | |
|---|---|
| **Steps** | Run `grep -r "createDriverWithUserAction" apps/app-car-manager-v2/apps/web/src/` |
| **Expected** | Không có match (function + import đều đã xóa) |
| **Priority** | P0 |

### TC-W1-06 — Edit existing driver vẫn hoạt động

| | |
|---|---|
| **Pre** | TD-5 driver có sẵn |
| **Steps** | 1. `/drivers/:id/edit`<br>2. Đổi license_expiry sang `2030-01-01`<br>3. Submit |
| **Expected** | • Form load với data hiện tại<br>• Submit thành công<br>• Phone field hiện đọc-only hoặc bị bỏ (xem TC-W3-08 cho Wave 3)<br>• Audit log `DRIVER.UPDATE` |
| **Priority** | P0 |

### TC-W1-07 — i18n keys mode đã bị xóa

| | |
|---|---|
| **Steps** | Run `grep -r "modeInline\\|modeExisting" apps/app-car-manager-v2/apps/web/messages/` |
| **Expected** | Không match (3 file vi/en/ko đều đã clean) |
| **Priority** | P2 |

### TC-W1-08 — Typecheck + build clean

| | |
|---|---|
| **Steps** | `cd apps/app-car-manager-v2/apps/web && npm run build` |
| **Expected** | • Exit 0<br>• Không có TS error<br>• Không có warning import unused |
| **Priority** | P0 |

---

## Wave 2 — Onboarding sync + pagination

### TC-W2-01 — Fresh tenant: admin redirect `/onboarding`

| | |
|---|---|
| **Pre** | Tenant fresh (`tns_users_synced_at IS NULL`); login admin (TD-2) |
| **Steps** | 1. Login<br>2. Quan sát URL bar |
| **Expected** | • Middleware redirect `/` → `/onboarding`<br>• Render screen "Chào mừng… Đồng bộ user từ AMA"<br>• Có nút "Bắt đầu đồng bộ" |
| **Priority** | P0 |

### TC-W2-02 — Driver login KHÔNG redirect onboarding

| | |
|---|---|
| **Pre** | Tenant fresh (`tns_users_synced_at IS NULL`); login driver (TD-2 `driver@…`) |
| **Steps** | 1. Login<br>2. Quan sát URL |
| **Expected** | • Vào `/today` như flow login bình thường<br>• `ensureCarUser` tạo row driver trong car_users<br>• `tns_users_synced_at` vẫn NULL (driver không trigger onboarding) |
| **Priority** | P0 |

### TC-W2-03 — Bắt đầu đồng bộ: bulk fetch 120 users

| | |
|---|---|
| **Pre** | TD-1 (tenant 120 users ở AMA); admin ở `/onboarding` |
| **Steps** | 1. Click "Bắt đầu đồng bộ"<br>2. Đợi xong<br>3. Inspect DB `SELECT COUNT(*) FROM car_users WHERE ent_id = '…'` |
| **Expected** | • Action chạy thành công, hiển thị "Đã đồng bộ N user" (N ~120, trừ cross-entity)<br>• `car_users` chứa đủ users<br>• `tns_users_synced_at` = NOW(), `tns_users_synced_count` = N<br>• Audit log `TENANT.ONBOARDING_SYNC` được tạo |
| **Priority** | P0 |

### TC-W2-04 — Bypass onboarding sau khi sync xong

| | |
|---|---|
| **Pre** | TC-W2-03 vừa chạy xong |
| **Steps** | 1. Logout, login lại admin<br>2. Access `/` |
| **Expected** | • Vào `/` thẳng, KHÔNG qua `/onboarding`<br>• Cache middleware hit nếu trong 60s |
| **Priority** | P0 |

### TC-W2-05 — Cross-entity ADMIN_LEVEL bị filter

| | |
|---|---|
| **Pre** | TD-3 (cross-entity admin trong AMA tenant) |
| **Steps** | 1. Onboarding sync<br>2. Check `/users` table |
| **Expected** | • Cross-entity user KHÔNG xuất hiện ở `/users`<br>• `car_users` không chứa row cho user đó<br>• Nếu admin đó login → `ensureCarUser` tạo lazy (test riêng) |
| **Priority** | P1 |

### TC-W2-06 — Re-sync idempotent

| | |
|---|---|
| **Pre** | TC-W2-03 chạy xong |
| **Steps** | 1. Bấm Refresh trên `/users` (sau khi admin AMA thêm 1 user mới)<br>2. Inspect DB |
| **Expected** | • Sync action chạy lại<br>• `car_users` thêm 1 row mới<br>• `tns_users_synced_at` cập nhật<br>• `tns_users_synced_count` tăng 1<br>• Audit log `TENANT.ONBOARDING_SYNC` row 2 |
| **Priority** | P0 |

### TC-W2-07 — Race condition: 2 admin click sync cùng lúc

| | |
|---|---|
| **Pre** | 2 admin cùng tenant đăng nhập 2 browser khác nhau |
| **Steps** | 1. Cả 2 cùng ở `/onboarding`<br>2. Cả 2 click "Bắt đầu" gần như đồng thời |
| **Expected** | • Không lỗi crash<br>• Cả 2 thấy success state<br>• `car_users` không duplicate (ON CONFLICT DO UPDATE)<br>• `tns_users_synced_at` = thời điểm of last writer |
| **Priority** | P1 |

### TC-W2-08 — AMA pagination loop fetch đủ pages

| | |
|---|---|
| **Pre** | TD-1 tenant 120 user, limit/page = 100 |
| **Steps** | 1. Trigger sync<br>2. Inspect server log `[listEntityMembersFromAma]` |
| **Expected** | • Log thấy fetch page=1 (100 user) + page=2 (20 user) + stop<br>• Tổng members ở action = 120 |
| **Priority** | P0 |

### TC-W2-09 — Safety guard runaway loop

| | |
|---|---|
| **Pre** | Mock AMA trả `pagination.total: 99999` |
| **Steps** | Trigger sync |
| **Expected** | • Loop dừng sau page 50<br>• Warn log "hit max page guard"<br>• Sync vẫn complete với 5000 user partial<br>• `tns_users_synced_count = 5000` |
| **Priority** | P2 |

### TC-W2-10 — Middleware cache invalidate sau sync

| | |
|---|---|
| **Pre** | Fresh tenant, redirect đã trigger 1 lần |
| **Steps** | 1. Admin sync xong<br>2. Reload trang ngay |
| **Expected** | • Reload không bị redirect lại `/onboarding`<br>• Cache tag `tenant:${entId}:synced` đã invalidate trong action |
| **Priority** | P1 |

### TC-W2-11 — `/users` page load từ local DB, không gọi AMA

| | |
|---|---|
| **Pre** | Tenant đã onboard |
| **Steps** | 1. Mở `/users`<br>2. Inspect network tab + server log |
| **Expected** | • KHÔNG có request đi tới AMA `/entity-settings/members`<br>• Render dựa trên `listUsers(entId)` query local<br>• Footer hiển thị "Cập nhật cuối: X phút trước" |
| **Priority** | P0 |

### TC-W2-12 — AMA endpoint 401 trong onboarding → graceful fail

| | |
|---|---|
| **Pre** | Force cookie `amb_ama_access` expire trước khi click sync |
| **Steps** | Click "Bắt đầu đồng bộ" |
| **Expected** | • Action trả error CAR-E0101<br>• UI hiển thị "Phiên AMA hết hạn, vui lòng đăng nhập lại"<br>• Không update `tns_users_synced_at`<br>• Admin có thể retry sau khi re-login |
| **Priority** | P1 |

---

## Wave 3 — Email login + sync

### TC-W3-01 — Login page chỉ có email field

| | |
|---|---|
| **Steps** | 1. Logout<br>2. `/login`<br>3. Inspect form HTML |
| **Expected** | • Field `name="ent_code"` (giữ)<br>• Field `name="email"` `type="email"` `autoComplete="email"`<br>• KHÔNG có field `name="phone"`<br>• Mobile keyboard hiện email layout (test iOS Safari + Android Chrome) |
| **Priority** | P0 |

### TC-W3-02 — Email login thành công

| | |
|---|---|
| **Pre** | TD-2 user `admin@test.car-v2.local` |
| **Steps** | 1. Nhập ent_code + email<br>2. Submit |
| **Expected** | • POST `/api/auth/login` → AMA `/auth/email-login`<br>• Cookie `amb_session`, `amb_ama_access`, `amb_ama_refresh` set<br>• Redirect `/` (admin) |
| **Priority** | P0 |

### TC-W3-03 — Email login fail — wrong email

| | |
|---|---|
| **Steps** | 1. Nhập ent_code valid + email không tồn tại<br>2. Submit |
| **Expected** | • Redirect `/login?error=invalid`<br>• Banner "Email không hợp lệ hoặc không thuộc công ty này"<br>• Console log masked email (hash prefix) |
| **Priority** | P0 |

### TC-W3-04 — Email login — rate limit

| | |
|---|---|
| **Steps** | Submit login form 10 lần liên tiếp với email không tồn tại |
| **Expected** | • Sau 5 lần, AMA return 429<br>• Redirect `/login?error=rate_limit`<br>• Banner "Quá nhiều yêu cầu, vui lòng thử lại sau" |
| **Priority** | P1 |

### TC-W3-05 — Tạo user mới (`/users/new`)

| | |
|---|---|
| **Pre** | Login admin |
| **Steps** | 1. `/users/new`<br>2. Nhập name `Test User`, email `newuser@test.car-v2.local`, role MEMBER<br>3. Submit |
| **Expected** | • POST AMA `/entity-settings/members/email-add`<br>• `amb_users` thêm row với `usr_email = newuser@...`<br>• Success card hiện template email + nút "Mở Gmail" / "Copy"<br>• KHÔNG còn nút Zalo / SMS template |
| **Priority** | P0 |

### TC-W3-06 — Tạo user duplicate email → reject

| | |
|---|---|
| **Pre** | Email `existing@test.car-v2.local` đã có trong tenant |
| **Steps** | Tạo user mới với cùng email |
| **Expected** | • AMA return 400 "Email đã được dùng trong công ty này"<br>• Toast error<br>• Form không clear, user sửa lại |
| **Priority** | P0 |

### TC-W3-07 — Đổi email user (`/users/:id/edit`)

| | |
|---|---|
| **Pre** | TD-2 user `driver@test.car-v2.local` |
| **Steps** | 1. `/users/:id/edit`<br>2. Đổi email sang `driver2@test.car-v2.local`<br>3. Submit |
| **Expected** | • Confirm dialog "Đổi email = đổi login key" hiện ra<br>• Click "Xác nhận"<br>• PATCH AMA `/members/:userId` body `{ email: '...' }`<br>• Toast success<br>• Driver login với email cũ → fail; với email mới → success |
| **Priority** | P0 |

### TC-W3-08 — Driver page hiển thị email + phone (contact)

| | |
|---|---|
| **Pre** | TD-5 driver có cả email + phone |
| **Steps** | 1. `/drivers/:id`<br>2. Quan sát header |
| **Expected** | • Hiển thị email (icon Mail) làm identity chính<br>• Phone hiện bên dưới (icon Phone), tap-to-call work<br>• KHÔNG có warning "SĐT đăng nhập" hay icon KeyRound đỏ |
| **Priority** | P1 |

### TC-W3-09 — Driver form edit — phone là contact, không phải login

| | |
|---|---|
| **Pre** | TD-5 driver |
| **Steps** | 1. `/drivers/:id/edit`<br>2. Quan sát field phone |
| **Expected** | • Field phone editable<br>• KHÔNG có banner đỏ KeyRound<br>• KHÔNG có confirm dialog "Xác nhận đổi SĐT đăng nhập"<br>• Submit: phone update inline mà không gọi AMA `update-member` (vì phone là contact thuần) |
| **Priority** | P0 |

### TC-W3-10 — DB migration: `usr_email NOT NULL UNIQUE`

| | |
|---|---|
| **Steps** | 1. Pre-check: `SELECT COUNT(*) FROM car_users WHERE usr_email IS NULL AND usr_deleted_at IS NULL` → 0<br>2. Pre-check duplicate `(ent_id, usr_email)` → 0<br>3. Run migration SQL<br>4. Post-check: try INSERT row với usr_email NULL → expect error |
| **Expected** | • Migration commit thành công<br>• Constraint enforce: NULL insert fail "null value in column usr_email"<br>• Duplicate insert trong cùng ent fail "duplicate key uniq_car_users_ent_email" |
| **Priority** | P0 |

### TC-W3-11 — Migration rollback test (staging only)

| | |
|---|---|
| **Steps** | 1. Apply migration<br>2. Run rollback SQL<br>3. Try INSERT row với usr_email NULL |
| **Expected** | • Rollback thành công<br>• NULL insert work lại<br>• Index `uniq_car_users_ent_email` không còn |
| **Priority** | P1 |

### TC-W3-12 — Trip view: driver contact (phone tap-to-call)

| | |
|---|---|
| **Pre** | Trip đã assign driver với phone |
| **Steps** | 1. `/trips/:id` (admin view)<br>2. Tap phone link |
| **Expected** | • Phone hiện ra cạnh driver name<br>• Tap → mở dialer (mobile) hoặc telephony app handler (desktop)<br>• KHÔNG có icon KeyRound / banner login |
| **Priority** | P2 |

### TC-W3-13 — Session compatibility — phone-login token chưa expire

| | |
|---|---|
| **Pre** | Trước deploy Wave 3: login bằng phone, lưu cookie<br>Sau deploy Wave 3 |
| **Steps** | 1. Mở app với cookie cũ<br>2. Thực hiện action bình thường (xem `/trips`)<br>3. Sau 1h, browser tự refresh token<br>4. Verify refresh thành công |
| **Expected** | • Cookie cũ vẫn valid<br>• `/api/auth/refresh` work với refresh token cũ (AMA backend giữ phone-login session compat 7 ngày)<br>• Sau 7 ngày: user phải re-login bằng email |
| **Priority** | P0 |

### TC-W3-14 — PWA service worker cache không hold phone login

| | |
|---|---|
| **Pre** | Driver PWA install trên iPhone với client cũ |
| **Steps** | 1. Update SW version (bump) → push deploy<br>2. Mở PWA<br>3. Trigger `skipWaiting`<br>4. Reload `/login` |
| **Expected** | • Login page hiển thị email field (mới)<br>• Không có cache cũ phone field |
| **Priority** | P1 |

### TC-W3-15 — i18n complete cho 3 ngôn ngữ

| | |
|---|---|
| **Steps** | 1. Switch sang `en`<br>2. Mở `/login`, `/users`, `/users/new`, `/users/:id/edit`<br>3. Repeat cho `ko`<br>4. Check console missing key warning |
| **Expected** | • Tất cả text email-related render đúng ngôn ngữ<br>• Không có raw key như `login.emailLabel`<br>• Console không có `MISSING_MESSAGE` warning |
| **Priority** | P0 |

### TC-W3-16 — Audit log entry cho email change

| | |
|---|---|
| **Pre** | TC-W3-07 vừa chạy xong |
| **Steps** | Query: `SELECT * FROM car_audit_logs WHERE entity = 'User' AND action = 'USER.EMAIL_CHANGE' ORDER BY aud_created_at DESC LIMIT 1` |
| **Expected** | • Row tồn tại<br>• `before.email`, `after.email` đúng giá trị<br>• `aud_user_id` = admin actor |
| **Priority** | P1 |

---

## Regression suite

| TC | Mô tả | Priority |
|---|---|---|
| **REG-01** | Trip CRUD (create/assign/start/end) không bị ảnh hưởng | P0 |
| **REG-02** | Expense flow không break | P0 |
| **REG-03** | Maintenance alert work | P1 |
| **REG-04** | PWA install + offline cache (driver) | P1 |
| **REG-05** | Dashboard A/B render đúng | P1 |
| **REG-06** | Excel/PDF export | P2 |
| **REG-07** | DEMO_AUTO_LOGIN flow (dev only) | P2 |

---

## Sign-off matrix

| Phase | QA owner | Dev owner | Release manager |
|---|---|---|---|
| Wave 1 | (TBD) | Huy | Huy |
| Wave 2 | (TBD) | Huy | Huy |
| Wave 3 | (TBD) | Huy | Huy |
