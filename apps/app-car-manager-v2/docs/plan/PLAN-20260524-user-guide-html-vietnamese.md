# PLAN-20260524 — User Guide HTML (Việt + Hàn) cho App Car Manager v2

> **Yêu cầu gốc:** Viết user guide HTML cho `app-car-manager-v2`, kèm screenshot step-by-step theo **role** và theo **module**, **tiếng Việt + tiếng Hàn**, kỹ lưỡng đầy đủ, screenshot chính xác.
>
> **Quyết định đã chốt (cập nhật 2026-05-24):**
> - Format: **Multi-page static HTML site** (sidebar nav + search, dễ điều hướng/in/deploy)
> - Screenshot: **Playwright tự động** (tái tạo được khi UI đổi) — **chụp cả 2 ngôn ngữ vi + ko**
> - Scope đợt 1: **Full 9 modules × 3 roles × 2 ngôn ngữ (vi + ko)**
> - Output: **`apps/app-car-manager-v2/apps/web/public/docs/user-guide/`** (serve trực tiếp qua Next.js static, URL `https://stg-apps.amoeba.site/app-car-manager-v2/docs/user-guide/`)
> - Tenant demo: **"Amoeba"**
> - Tên người demo: **Việt + Hàn song song** (mỗi locale dùng tên locale tương ứng — vi: Nguyễn Thanh An / Lê Hoàng / Nguyễn Văn Tú · ko: Park Joon-ho / Kim Min-soo / Lee Tuấn)
> - Footer feedback: **dev@amoeba.group**

---

## 1. Hiện trạng & ràng buộc

### 1.1 App đã có sẵn
- Next.js 15 standalone Turborepo bên trong `apps/app-car-manager-v2/`
- **3 role local**: `ADMIN` · `MANAGER` · `DRIVER` (mapping từ AMA — xem CLAUDE.md §4.6)
- **27 page** chia 4 nhóm route (xem mục 4 bên dưới)
- **3 ngôn ngữ** i18n (vi/en/ko) — `vi` là default, đúng yêu cầu
- **Dev login** sẵn ở `apps/web/src/app/dev-login/` cho phép mint JWT cục bộ với role tùy ý (bật bằng `DEMO_AUTO_LOGIN=true`)
- **Seed script** `scripts/db-seed.mjs` đã có 1 tenant + 1 Admin + 3 Driver + 3 vehicle + 5 trip — nhưng **thiếu Manager, thiếu expense, thiếu maintenance alert** cho doc

### 1.2 Asset đã có
- Logo + favicon trong `apps/web/public/icons/` (192/512 PWA icon, maskable)
- Toss palette + Pretendard font (design tokens trong `apps/web/src/app/globals.css`)
- Design reference 24 màn `resources/claude-design/` (gitignored, chỉ để tham khảo visual)

### 1.3 Chưa có
- ❌ Không có user guide tiếng Việt sẵn
- ❌ Không có Playwright config (mặc dù stack đã list — chưa init)
- ❌ Seed data không đủ (cần 1 Manager, ≥10 trip phủ đủ state, ≥15 expense phủ 8 loại, ≥3 maintenance alert)
- ❌ Không có pipeline screenshot

### 1.4 Ràng buộc
- **Không hard-code text app** — nhưng doc HTML thì viết thẳng tiếng Việt (đây không phải component i18n)
- **Không commit `.env`** — Playwright dùng `.env.user-guide` riêng (gitignored)
- **Không sửa code app** chỉ để chụp screenshot — nếu cần data placeholder thì seed qua script, không chèn `data-screenshot-only` vào component
- Screenshot phải dùng **dữ liệu giả tiếng Việt** (tên xe `51K-238.91`, tên người `Park Joon-ho` → đổi/bổ sung `Nguyễn Văn An`, `Trần Thị Hoa` …)

---

## 2. Kiến trúc output

### 2.1 Cấu trúc thư mục (đã cập nhật cho bilingual + static deploy)

```
apps/app-car-manager-v2/
├── apps/web/public/docs/user-guide/         ← OUTPUT (commit, serve qua Next.js)
│   ├── index.html                           ← Landing global: chọn ngôn ngữ vi/ko
│   ├── vi/                                  ← Toàn bộ trang tiếng Việt
│   │   ├── index.html                       ← Landing VI + chọn role
│   │   ├── common/
│   │   │   ├── 00-gioi-thieu.html
│   │   │   ├── 01-dang-nhap.html
│   │   │   ├── 02-dieu-huong.html
│   │   │   ├── 03-ngon-ngu.html
│   │   │   ├── 04-thong-bao.html
│   │   │   └── 99-thuat-ngu.html
│   │   ├── admin/ (11 trang 00→10)          ← xem mục 4.2
│   │   ├── manager/ (7 trang 00→06)         ← xem mục 4.3
│   │   └── driver/ (8 trang 00→07)          ← xem mục 4.4
│   ├── ko/                                  ← Toàn bộ trang tiếng Hàn (cấu trúc đối xứng)
│   │   ├── index.html                       ← KO 랜딩 + 역할 선택
│   │   ├── common/
│   │   │   ├── 00-소개.html
│   │   │   ├── 01-로그인.html
│   │   │   ├── 02-탐색.html
│   │   │   ├── 03-언어.html
│   │   │   ├── 04-알림.html
│   │   │   └── 99-용어집.html
│   │   ├── admin/ (11 trang)
│   │   ├── manager/ (7 trang)
│   │   └── driver/ (8 trang)
│   └── assets/                              ← Shared cho cả 2 locale
│       ├── css/main.css                     ← Toss palette + Pretendard
│       ├── css/print.css
│       ├── js/sidebar.js                    ← Collapsible nav + active state
│       ├── js/search.js                     ← Client-side fuzzy (lunr.js bundled)
│       ├── js/lang-switch.js                ← Switch vi↔ko giữ nguyên trang đang xem
│       ├── js/lightbox.js                   ← Zoom screenshot khi click
│       ├── img/logo.svg
│       ├── img/icons/                       ← Icon trang trí (lucide static SVG)
│       └── img/screenshots/                 ← PNG do Playwright sinh
│           ├── vi/                          ← Screenshot UI tiếng Việt
│           │   ├── common/
│           │   ├── admin/
│           │   ├── manager/
│           │   └── driver/                  ← Mobile viewport
│           └── ko/                          ← Screenshot UI tiếng Hàn (cấu trúc đối xứng)
│               ├── common/
│               ├── admin/
│               ├── manager/
│               └── driver/
│
├── scripts/user-guide/                      ← Pipeline sinh screenshot (commit, không deploy)
│   ├── package.json                         ← @playwright/test, sharp (resize), tsx, js-yaml
│   ├── playwright.config.ts                 ← projects: [vi, ko] × [desktop, mobile]
│   ├── seed-user-guide.mjs                  ← Seed tenant "Amoeba" với data song ngữ
│   ├── annotate.ts                          ← Vẽ mũi tên/số bước lên PNG (text overlay theo locale)
│   ├── shots/
│   │   ├── _helpers.ts                      ← loginAs(role,locale), setLocale, waitForReady
│   │   ├── common.spec.ts                   ← login, navigation, language switch
│   │   ├── admin.spec.ts                    ← 10 scenario × 2 locale
│   │   ├── manager.spec.ts                  ← 6 scenario × 2 locale
│   │   ├── driver.spec.ts                   ← 7 scenario × 2 locale (mobile)
│   │   └── annotations/                     ← *.shot.yml — caption song ngữ trong cùng file
│   └── README.md                            ← Hướng dẫn maintainer
│
└── docs/plan/PLAN-20260524-user-guide-html-vietnamese.md   ← FILE NÀY
```

**Quy ước URL khi deploy:**
- `https://stg-apps.amoeba.site/app-car-manager-v2/docs/user-guide/` → landing (chọn ngôn ngữ)
- `…/docs/user-guide/vi/admin/05-quan-ly-chuyen-di.html` → trang Admin tiếng Việt
- `…/docs/user-guide/ko/admin/05-trip-management.html` → tương đương tiếng Hàn
- Mỗi trang có **language switch button** ở topbar (gọi `lang-switch.js`) để chuyển vi↔ko giữ đúng trang đang xem.

**Slug filename tiếng Hàn:** dùng **English transliteration** (vd `05-trip-management.html`) thay vì Hangul để tránh URL encoding lằng nhằng. Title trong HTML vẫn là Hangul.

### 2.2 Lý do multi-page (không single-file, không Docusaurus)
- **Multi-page**: in từng phần dễ, share link riêng cho từng module, lazy-load ảnh nhanh, dễ deploy như static asset của Next.js (`/docs/user-guide/index.html`).
- **Không single-file**: > 100 screenshot → file > 30 MB, browser khựng.
- **Không Docusaurus/VitePress**: thêm build step, npm install nặng, không cần feature versioning lúc này. Có thể migrate sau nếu cần.

### 2.3 Trang HTML — layout chung
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] App Car Manager v2 — Hướng dẫn  [vi▾]  [🔍 Search]   │  ← header sticky
├──────────────┬──────────────────────────────────────────────┤
│ ▾ Chung      │  ## 5. Quản lý chuyến đi                     │
│   Giới thiệu │                                              │
│   Đăng nhập  │  ### 5.1 Tạo chuyến đi mới                  │
│   Điều hướng │  Bước 1: Vào menu **Chuyến đi** trong sidebar│
│ ▾ Admin      │  ![Bước 1](../assets/img/.../trip-step1.png) │
│   Dashboard  │  Bước 2: Bấm nút **+ Tạo chuyến đi mới**…    │
│   ▸ Xe       │  …                                           │
│   ▸ Tài xế   │  > ℹ️ Mẹo: Có thể bỏ trống tài xế, Admin sẽ │
│   ▸ Chuyến   │  >    gán sau.                               │
│ ▸ Manager    │                                              │
│ ▸ Driver     │  [← Trang trước]              [Trang sau →]  │
└──────────────┴──────────────────────────────────────────────┘
```

---

## 3. Pipeline sinh screenshot (Playwright)

### 3.1 Concept

```
┌─────────────────────────────────────────────────────────┐
│ 1. seed-user-guide.mjs                                  │
│    → Tạo tenant demo "Công ty TNHH Amoeba VN" (ent_id) │
│    → 1 Admin (Park An), 1 Manager (Lê Hoàng), 3 Driver │
│      (Nguyễn Văn Tú, Trần Văn Hùng, Phạm Minh Đức)     │
│    → 3 xe (51K-238.91, 30A-556.07, 51F-712.34)         │
│    → 12 trip phủ 7 state, kèm stopover                 │
│    → 18 expense phủ 8 loại + đủ 4 trạng thái approval  │
│    → 3 maintenance alert (oil due, oil overdue,        │
│      inspection due)                                   │
└─────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Khởi động Next.js dev server                         │
│    DEMO_AUTO_LOGIN=true npm run -w apps/web dev         │
│    → http://localhost:3000                             │
└─────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Playwright `npm run shots`                           │
│    → chạy 4 spec (common/admin/manager/driver)         │
│    → mỗi spec: loginAs(role) → goto(page) →            │
│        page.screenshot({ path: 'admin/01.png' })       │
│    → driver.spec.ts dùng device profile iPhone 14      │
│      (390×844, deviceScaleFactor 3) cho PWA shot       │
└─────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────┐
│ 4. annotate.ts (post-process)                          │
│    → đọc YAML khai báo annotation                      │
│    → vẽ mũi tên đỏ + ô số bước (sharp + svg overlay)   │
│    → resize 2× → 1× để file < 200KB / shot             │
└─────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Output: docs/user-guide/assets/img/screenshots/...  │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Auth strategy

Dùng `/dev-login` route đã có sẵn (chỉ bật khi `DEMO_AUTO_LOGIN=true`):

```ts
// scripts/user-guide/shots/_helpers.ts
export async function loginAs(page: Page, role: 'ADMIN'|'MANAGER'|'DRIVER', userId: string) {
  await page.goto(`/dev-login?role=${role}&userId=${userId}&entId=${DEMO_ENT_ID}`);
  await page.waitForURL(/\/(dashboard|today)/);   // role-aware redirect
}
```

→ Không cần mock JWT, không cần stub middleware, dùng đúng flow production.

### 3.3 Annotation pattern

Mỗi shot có file `.shot.yml` đi kèm khai báo annotation:

```yaml
# shots/admin/05-tao-chuyen-di-buoc-2.shot.yml
target: docs/user-guide/assets/img/screenshots/admin/trip-step2.png
viewport: { w: 1440, h: 900 }
annotations:
  - { type: arrow, from: [320, 80], to: [400, 180], color: '#FF3B30' }
  - { type: number, at: [410, 175], label: '1' }
  - { type: box, rect: [600, 200, 800, 480], color: '#3182F6' }
caption: "Bấm nút '+ Tạo chuyến đi mới' (vùng số 1)"
```

→ Khi UI đổi, chỉ cần chạy lại `npm run shots` — không cần Photoshop.

### 3.4 Mobile shots (Driver)

```ts
test.use({ ...devices['iPhone 14'] });
test('driver-today', async ({ page }) => {
  await loginAs(page, 'DRIVER', DEMO_DRIVER_ID);
  await page.goto('/today');
  await page.screenshot({ path: 'shots/raw/driver/today.png', fullPage: true });
});
```

PWA install prompt thì dùng Chrome flag `--use-fake-device-for-media-stream` + trigger `beforeinstallprompt` thủ công.

---

## 4. Nội dung từng trang — đề cương chi tiết

> Mỗi trang HTML đi theo cấu trúc: **Mục tiêu** → **Điều kiện trước** → **Các bước (numbered + screenshot)** → **Kết quả mong đợi** → **Trường hợp lỗi thường gặp** → **Liên kết liên quan**

### 4.1 Phần CHUNG (5 trang)

| Trang | Mục đích | Screenshot |
|---|---|---|
| `00-gioi-thieu.html` | Tổng quan hệ thống, 3 role, 9 module, lợi ích | 1 hero shot |
| `01-dang-nhap.html` | SSO từ AMA → click app icon → auto login | 4 shot (AMA → click → loading → home) |
| `02-dieu-huong.html` | Sidebar, top bar, breadcrumb, role-aware redirect | 6 shot |
| `03-ngon-ngu.html` | Đổi vi/en/ko trong Settings → Me | 3 shot |
| `04-thong-bao.html` | Inbox, badge count, mark as read | 4 shot |
| `99-thuat-ngu.html` | Glossary 30 thuật ngữ (Trip, Stopover, Odometer, Ent ID…) | 0 |

### 4.2 Phần ADMIN (11 trang, ~120 screenshot)

| # | Trang | Module chính | Số shot ước tính |
|---|---|---|---|
| 00 | Tổng quan vai trò Admin | — | 2 |
| 01 | Dashboard + calendar view | Dashboard | 8 |
| 02 | Quản lý xe (CRUD, status, odometer, chu kỳ dầu/đăng kiểm) | Vehicle | 14 |
| 03 | Quản lý tài xế (CRUD, bằng lái, expiry) | Driver | 10 |
| 04 | Quản lý người dùng (Invite, đổi role, soft delete) | User | 8 |
| 05 | Quản lý chuyến đi (Tạo → Gán → Theo dõi → Hủy) | Trip | 18 |
| 06 | Phê duyệt chi phí (Queue → Review → Approve/Reject + note) | Expense | 14 |
| 07 | Cảnh báo bảo dưỡng (Đọc alert → Tạo expense OIL → Auto-resolve) | Maintenance | 8 |
| 08 | Báo cáo + export Excel/PDF | Report | 10 |
| 09 | Cấu hình hệ thống (Approval rule, tenant settings) | Settings | 8 |
| 10 | Audit log (filter, payload viewer) | Audit | 6 |

### 4.3 Phần MANAGER (7 trang, ~50 screenshot)

| # | Trang | Số shot |
|---|---|---|
| 00 | Tổng quan vai trò Manager | 2 |
| 01 | Dashboard cá nhân (web/mobile) | 6 |
| 02 | Đặt xe (tạo trip cho bản thân/team) | 10 |
| 03 | Theo dõi chuyến đi + hủy | 8 |
| 04 | Ghi chi phí | 10 |
| 05 | Phê duyệt phân cấp (nếu cấu hình) | 8 |
| 06 | Báo cáo cá nhân | 6 |

### 4.4 Phần DRIVER (8 trang, ~60 screenshot — mobile)

| # | Trang | Số shot |
|---|---|---|
| 00 | Tổng quan vai trò Driver | 2 |
| 01 | Cài đặt PWA (iOS Safari + Android Chrome) | 8 |
| 02 | Today screen (lịch ngày, next trip card) | 6 |
| 03 | Xác nhận / Từ chối chuyến | 8 |
| 04 | Bắt đầu / Kết thúc chuyến + ghi odometer | 10 |
| 05 | Ghi chi phí 8 loại (FUEL/OIL/MEAL/REPAIR/ACCIDENT/PARKING/TOLL/INSPECTION) + upload ảnh | 16 |
| 06 | Đọc cảnh báo bảo dưỡng | 6 |
| 07 | Hành vi offline (P5 — note "sắp ra mắt") | 4 |

**Tổng cộng (mỗi locale): ~280 screenshot** chia 4 thư mục.
**Tổng grand: ~560 screenshot** (vi + ko).
**Tổng trang HTML: ~64 trang** (32 mỗi locale).

---

## 5. Phân kỳ thực thi (cập nhật cho bilingual)

### Chiến lược A — VI trước, KO sau (8 phase, đề xuất mặc định)
| Phase | Mục tiêu | Ước lượng |
|---|---|---|
| **P0** Bootstrap pipeline (Playwright + seed + annotate + 1 shot mẫu × 2 locale) | 1 session |
| **P1** Phần CHUNG **VI** (6 trang + ~15 shot) + template HTML chuẩn | 1 session |
| **P2** Driver guide **VI** (8 trang + ~60 mobile shot) | 1 session |
| **P3** Manager guide **VI** (7 trang + ~50 shot) | 1 session |
| **P4** Admin guide **VI** (11 trang + ~120 shot) | 2 session |
| **P5** Polish VI: search + print + lang-switch stub + landing | 1 session |
| **P6** Mirror toàn bộ sang **KO** (translate + chụp lại ~280 shot KO) | 2 session |
| **P7** Polish KO + landing global + deploy verify | 1 session |

→ **Ưu điểm:** User có bản VI dùng được sau P5 (sớm), không bị "double work" làm gãy nhịp.
→ **Nhược điểm:** Bản KO ra muộn hơn (~3 session).

### Chiến lược B — VI + KO song song (6 phase)
| Phase | Mục tiêu | Ước lượng |
|---|---|---|
| **P0** Bootstrap (như A) | 1 session |
| **P1** Phần CHUNG **vi + ko** (12 trang + ~30 shot) + template | 1.5 session |
| **P2** Driver **vi + ko** (16 trang + ~120 shot) | 2 session |
| **P3** Manager **vi + ko** (14 trang + ~100 shot) | 1.5 session |
| **P4** Admin **vi + ko** (22 trang + ~240 shot) | 3 session |
| **P5** Polish + landing global + search bilingual + deploy verify | 1 session |

→ **Ưu điểm:** Đi đến đâu **xong hoàn chỉnh 2 ngôn ngữ** đến đó, dễ giữ đồng bộ caption.
→ **Nhược điểm:** Phải đợi lâu hơn để có "phần Admin VI bản đầu" — user không thử nghiệm sớm được.

**Tổng thời gian 2 chiến lược tương đương** (~9 session), khác nhau ở **thứ tự ra hàng**.

> Mỗi phase kết thúc với 1 commit + screenshot demo có thể mở bằng `file://` để user review trước khi đi phase sau.

---

## 6. Danh sách file thay đổi

### 6.1 File MỚI

| Khu vực | Số file | Ghi chú |
|---|---|---|
| `docs/user-guide/index.html` | 1 | Landing |
| `docs/user-guide/{common,admin,manager,driver}/*.html` | ~32 | HTML pages |
| `docs/user-guide/assets/css/*` | 2 | main.css + print.css |
| `docs/user-guide/assets/js/*` | 3 | sidebar, search, lightbox |
| `docs/user-guide/assets/img/screenshots/...` | ~280 | PNG (sinh tự động) |
| `scripts/user-guide/*` | ~10 | Pipeline + spec |
| `scripts/user-guide/package.json` | 1 | Workspace nhỏ, chỉ chứa Playwright deps |
| `docs/plan/PLAN-20260524-user-guide-html-vietnamese.md` | 1 | File này |

### 6.2 File SỬA

| File | Lý do |
|---|---|
| `apps/app-car-manager-v2/.gitignore` | Thêm `.env.user-guide`, `scripts/user-guide/.playwright-cache/`, `scripts/user-guide/shots/raw/` |
| `apps/app-car-manager-v2/package.json` | Thêm script `"shots": "cd scripts/user-guide && npm run shots"`, `"guide:build": "..."` |
| `apps/app-car-manager-v2/README.md` | Thêm section "User Guide" với link và quy trình cập nhật |
| (tùy chọn) `apps/app-car-manager-v2/apps/web/next.config.mjs` | Thêm rewrite `/docs/user-guide/*` → static asset nếu muốn serve qua Next.js |

### 6.3 File KHÔNG đụng
- ❌ Bất kỳ component/page nào của `apps/web/src/` (không sửa app chỉ để chụp ảnh)
- ❌ Schema DB (không thêm bảng mới chỉ cho doc)
- ❌ i18n locale files (doc HTML viết thẳng tiếng Việt)

---

## 7. Phân tích sai lệch / rủi ro

| # | Rủi ro | Khả năng | Tác động | Giảm thiểu |
|---|---|---|---|---|
| R1 | UI thay đổi → screenshot lệch text | Cao (P4 đang in-progress) | Trung | Re-run `npm run shots` mỗi sprint. Annotation YAML tách rời, ít hỏng. |
| R2 | Seed data conflict với data dev hiện có | Trung | Cao | Seed dùng `ent_id` riêng `DEMO-GUIDE-VN`, tách hẳn với `ent_id` của dev cá nhân |
| R3 | Playwright headless render khác production (font, color) | Thấp | Trung | Pretendard load qua jsdelivr CDN — Playwright fetch ok. Test trên 1 máy chuẩn (Windows + Chrome 120) |
| R4 | Mobile shot bị emulator artifacts (status bar giả) | Trung | Thấp | Dùng `devices['iPhone 14']` chuẩn của Playwright, crop status bar trong post-process |
| R5 | Bundle ảnh ~280 PNG nặng | Thấp | Thấp | Mỗi shot ≤ 200 KB sau sharp resize → tổng ~50 MB. Git LFS không cần (vẫn dưới 100 MB repo cap). |
| R6 | Doc viết xong nhưng app feature đổi → doc lạc hậu | Cao | Cao | Mỗi phase chốt git tag `user-guide-v{n}` để biết doc tương ứng commit code nào. Thêm footer "Cập nhật: 2026-05-24 (commit b876f5d)" mỗi trang. |
| R7 | PWA install prompt khó chụp tự động | Trung | Thấp | Phase Driver-01: nếu Playwright không trigger được prompt thì dùng shot thật từ thiết bị iOS/Android (chụp manual 1 lần, sau đó cố định) |
| R8 | Sidebar có placeholder page chưa làm (vd `/costs` placeholder) → user theo doc bị lạc | Cao | Trung | Phần Admin-06 ghi rõ "Trang `/costs` hiện tại là placeholder — dùng `/expenses` cho approval queue thực tế cho đến khi P4 hoàn tất" |

---

## 8. Quy trình maintain dài hạn

```
Khi sửa UI app:
  1. Sửa code app như thường
  2. cd apps/app-car-manager-v2/scripts/user-guide
  3. npm run shots  (chụp lại 280 ảnh, ~5 phút)
  4. git diff docs/user-guide/assets/img/screenshots/  → review diff
  5. Nếu text thay đổi → sửa HTML doc tương ứng
  6. Commit chung với code change
```

→ Doc luôn đồng bộ với code, không phải maintain song song.

---

## 9. Các quyết định đã chốt với user (2026-05-24)

| # | Câu hỏi | Quyết định |
|---|---|---|
| Q1 | Tên tenant demo trong screenshot? | **"Amoeba"** |
| Q2 | Tên người demo & screenshot ngôn ngữ? | **Việt + Hàn song song** — vi shot dùng tên Việt (Nguyễn Thanh An, Lê Hoàng, Nguyễn Văn Tú, Trần Văn Hùng, Phạm Minh Đức) · ko shot dùng tên Hàn (Park Joon-ho, Kim Min-soo, Lee Sung-jae…) |
| Q3 | Doc có cần phiên bản KO không? | **Có** — viết cả Việt và Hàn |
| Q4 | Deploy như thế nào? | **Next.js tĩnh** — đặt source vào `apps/web/public/docs/user-guide/`, serve trực tiếp qua basePath `/app-car-manager-v2/docs/user-guide/` |
| Q5 | Tự `npm install` Playwright? | **Có** — chạy luôn trong P0 |
| Q6 | Footer feedback link? | **dev@amoeba.group** |
| Q7 | Chiến lược phase VI-trước hay song song? | **Strategy A — VI trước, KO sau** (8 phase, anh có bản VI dùng được sau P5) |

---

## 10. Định nghĩa "Done"

Đợt 1 hoàn tất khi:
- [ ] Tất cả phase commit riêng, xanh
- [ ] Mở `apps/web/public/docs/user-guide/index.html` bằng browser → chọn ngôn ngữ → click qua **toàn bộ ~64 trang** (32 vi + 32 ko) không 404
- [ ] Tất cả **~560 screenshot** render đúng (không bị missing image), text trên screenshot khớp ngôn ngữ của trang
- [ ] Search box hoạt động cả 2 locale (vi: "tạo chuyến đi" → Admin-05 + Manager-02; ko: "운행 생성" → tương tự)
- [ ] Language switch button: từ trang VI bấm `KO` → nhảy đúng trang tương ứng tiếng Hàn
- [ ] `npm run shots` chạy lại sạch sẽ (chụp được cả 2 locale)
- [ ] Print preview 1 trang Admin → A4 layout đúng (không cắt screenshot)
- [ ] Build Next.js xanh + deploy staging xanh — truy cập `https://stg-apps.amoeba.site/app-car-manager-v2/docs/user-guide/` được
- [ ] README.md root của v2 có section "User Guide" + hướng dẫn cập nhật
- [ ] Báo cáo `docs/implementation/RPT-20260524-user-guide-html-vietnamese.md` ghi rõ số trang/shot/file đã tạo cho mỗi locale
