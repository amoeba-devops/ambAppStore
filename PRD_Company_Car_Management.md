# PRD — Company Car Management System

**Tên hệ thống:** Hệ thống Quản lý Xe Công ty (Company Car Management System)
**Phân hệ:** Quản lý Điều xe & Kiểm soát Chi phí Nội bộ
**Tài liệu nguồn:** Software Requirements Specification (SRS)
**Phiên bản PRD:** 2.1 — Next.js + Render + Neon
**Mục đích tài liệu:** Chuyển thể SRS thành PRD chi tiết để Claude Code (hoặc developer) implement đúng yêu cầu trên stack Next.js + Turborepo, deploy lên Render.

> ⚠️ **Hướng dẫn cho Claude Code:** Đọc toàn bộ tài liệu trước khi code. Tuân thủ chính xác data model ở §6, business rules ở §7, và API contract ở §8. Khi gặp xung đột với assumption riêng, ưu tiên tài liệu này.

> 🔄 **Thay đổi so với v2.0:** Hosting đổi từ **Vercel → Render**. File storage đổi từ **Vercel Blob → Cloudflare R2**. Cron jobs đổi từ **Vercel Cron → Render Cron Jobs**. Email vẫn Resend. Business logic, data model, business rules, API contract **KHÔNG đổi**. Web Next.js trên Render chạy dạng **long-running Node.js server** (không serverless) → không có cold start cho web; chỉ Neon DB còn cold start nếu bật scale-to-zero.

---

## 1. Tổng quan & Mục tiêu

### 1.1 Bối cảnh

Công ty hiện đang quản lý **3 xe công ty** phục vụ di chuyển cho cấp quản lý và giám đốc. Quy trình hiện tại được vận hành qua **nhóm chat**, dẫn đến:

- Khó tra cứu lịch sử chuyến đi.
- Không kiểm soát được chi phí phát sinh (xăng, sửa chữa, tai nạn, ăn uống...).
- Trùng lịch xe, thiếu xác nhận chính thức từ tài xế.
- Không có dữ liệu để báo cáo & ra quyết định.

### 1.2 Mục tiêu sản phẩm

| # | Mục tiêu | Cách đo (Success Metric) |
|---|---|---|
| 1 | Số hóa quy trình đăng ký & điều xe | 100% chuyến đi được tạo qua hệ thống, không qua chat |
| 2 | Minh bạch trong vận hành | Mọi chuyến đi đều có trạng thái rõ ràng và lịch sử thao tác |
| 3 | Kiểm soát chi phí toàn diện | Mọi khoản chi liên quan đến xe đều được ghi nhận và phê duyệt |
| 4 | Hỗ trợ ra quyết định | Có dashboard & báo cáo theo xe / người dùng / kỳ |

### 1.3 Phạm vi (Scope)

**In-scope:**
- **Web App** (Next.js — cho Admin, Manager) + **Mobile App** (Expo — chủ yếu cho Driver, Manager dùng được khi di chuyển).
- Cả hai gọi chung **một bộ Route Handlers** trong Next.js (`/api/*`).
- Quản lý 3 xe hiện tại, **kiến trúc phải hỗ trợ scale** thêm xe trong tương lai.
- Tích hợp **Google Maps** (chia sẻ đường đi, tính lộ trình, gợi ý địa điểm).
- Đa ngôn ngữ: **Tiếng Anh (en) và Tiếng Hàn (ko)** — cần i18n từ ngày đầu.

**Out-of-scope (giai đoạn 1):**
- Tích hợp GPS realtime trên xe.
- Thanh toán/ví điện tử cho tài xế.
- Tích hợp ERP/kế toán.
- Offline mode cho mobile (queue request khi offline).

---

## 2. Personas & Vai trò người dùng

| Vai trò (System Name) | Tên hiển thị | Mô tả | Quyền hạn chính |
|---|---|---|---|
| `ADMIN` | Quản lý hệ thống | Người quản lý toàn bộ hệ thống, thường là Admin văn phòng | Toàn quyền: cấu hình hệ thống, quản lý người dùng/xe/tài xế, phê duyệt chi phí, xem mọi báo cáo, phân công lại tài xế |
| `MANAGER` | Người sử dụng xe | Manager / Director của công ty | Tạo yêu cầu chuyến đi, xem lịch sử chuyến của chính mình, nhận thông báo trạng thái |
| `DRIVER` | Tài xế | Tài xế công ty | Xem lịch của mình, **xác nhận / từ chối** chuyến đi được phân công, ghi nhận chi phí phát sinh, cập nhật trạng thái chuyến (đang đi, hoàn tất) |

> 💡 Một user có thể chỉ thuộc **một** vai trò chính. Không hỗ trợ multi-role trong giai đoạn 1.

**Mapping vai trò ↔ ứng dụng:**
- `ADMIN`, `MANAGER`: dùng **Web App** là chính, mobile xem được trip cá nhân.
- `DRIVER`: dùng **Mobile App** là chính (xác nhận, ghi chi phí ngoài đường); web là fallback.

---

## 3. Stack & Phạm vi nền tảng

### 3.1 Tech stack chính thức

| Tầng | Công nghệ | Phiên bản tối thiểu | Ghi chú |
|---|---|---|---|
| **Monorepo tool** | **Turborepo** + **pnpm workspaces** | turbo 2.x, pnpm 9.x | Quản lý apps/web, apps/mobile, packages/* |
| **Web (Frontend + API)** | **Next.js** (App Router) | 15.x | Cả UI và Route Handlers nằm trong cùng app này |
| **Mobile** | **Expo** (React Native) | SDK 51+ | **Expo Router** cho file-based routing |
| **Database** | **Neon Postgres** (serverless) | PG 16 | Dùng `@neondatabase/serverless` driver |
| **ORM** | **Drizzle ORM** + **drizzle-kit** | latest | Type-safe, hợp serverless, migration bằng SQL |
| **Auth** | **Auth.js v5** (NextAuth) | beta/stable v5 | Web: cookie session. Mobile: JWT (xem §3.4) |
| **Validation** | **Zod** | 3.x | Schema dùng chung web + mobile qua `packages/api-types` |
| **UI (Web)** | **Tailwind CSS** + **shadcn/ui** | latest | shadcn/ui copy components vào repo |
| **UI (Mobile)** | **NativeWind** (Tailwind cho RN) + **gluestack-ui** hoặc **tamagui** | latest | Cùng triết lý utility-first với web |
| **i18n (Web)** | **next-intl** | latest | Routing đa ngôn ngữ `[locale]` |
| **i18n (Mobile)** | **i18next** + **expo-localization** | latest | Cùng cấu trúc message với web |
| **File storage** | **Cloudflare R2** | — | S3-compatible, **free egress**, rẻ ($0.015/GB/tháng). Upload trực tiếp từ client qua **presigned URL** |
| **Push notification** | **Expo Push Notifications** (mobile) + **Web Push API** (web) | — | |
| **Email** | **Resend** | — | Có template React Email, không phụ thuộc hosting |
| **Background jobs** | **Render Cron Jobs** | — | Service type riêng trên Render, gọi vào `/api/cron/*` của Web service bằng curl + `CRON_SECRET` |
| **Maps** | **Google Maps Platform** | — | Places API, Directions API, Maps JS SDK (web), `react-native-maps` (mobile) |
| **Hosting** | **Render** (Web Service cho Next.js + Cron Jobs) + **Expo EAS** (mobile build) | — | Web chạy long-running Node.js (Standard plan trở lên cho prod) |
| **Logging** | **Render Logs** + **Better Stack** hoặc **Axiom** (optional) | — | JSON structured logs |

> 💡 **Lý do chọn Drizzle thay Prisma:** Prisma có cold start chậm hơn Drizzle trên serverless do client lớn hơn; Drizzle hợp Neon serverless driver hơn. Nếu team quen Prisma có thể đổi nhưng nhớ enable `previewFeatures = ["driverAdapters"]`.

> 💡 **Lý do chọn Cloudflare R2 thay Vercel Blob:** Render không có blob storage built-in. R2 có **API tương thích S3** (dùng `@aws-sdk/client-s3` được), **không tính phí egress** (rất quan trọng vì app sẽ serve nhiều ảnh tai nạn/hoá đơn), và rẻ hơn S3 đáng kể. Alternative: Backblaze B2 cũng OK nhưng ít phổ biến hơn.

> 💡 **Render Web Service vs Vercel:** Render chạy Next.js dưới dạng **container Node.js luôn-bật**. Khác Vercel ở chỗ:
> - ✅ **Không cold start** cho web (request đầu nhanh)
> - ✅ **Không giới hạn function timeout** (Vercel là 60s/300s)
> - ✅ **Pricing predictable** (flat monthly fee)
> - ⚠️ **Không scale-to-zero** → trả tiền 24/7 kể cả không có traffic
> - ⚠️ **Không có edge network mặc định** → cần CDN riêng (Cloudflare) nếu muốn tối ưu cho user xa region.

### 3.2 Cấu trúc Monorepo (Turborepo)

```
company-car/
├── apps/
│   ├── web/                          # Next.js 15 App Router — UI + API
│   │   ├── app/
│   │   │   ├── [locale]/             # next-intl: /en, /ko
│   │   │   │   ├── (auth)/           # /login, /sso-callback
│   │   │   │   ├── (dashboard)/      # /dashboard, /trips, /costs, /vehicles
│   │   │   │   └── layout.tsx
│   │   │   ├── api/                  # ROUTE HANDLERS — cả web và mobile gọi vào đây
│   │   │   │   ├── auth/             # Auth.js + mobile auth
│   │   │   │   ├── trips/
│   │   │   │   ├── costs/
│   │   │   │   ├── vehicles/
│   │   │   │   ├── drivers/
│   │   │   │   ├── users/
│   │   │   │   ├── reports/
│   │   │   │   ├── notifications/
│   │   │   │   ├── settings/
│   │   │   │   ├── audit-logs/
│   │   │   │   └── cron/             # Cron endpoints (gọi từ Render Cron Jobs)
│   │   │   └── layout.tsx
│   │   ├── components/               # UI components (shadcn/ui + custom)
│   │   ├── lib/
│   │   │   ├── db/                   # Drizzle client, schema, queries
│   │   │   │   ├── schema.ts         # Single source of truth cho DB
│   │   │   │   ├── client.ts         # Drizzle + Neon client
│   │   │   │   └── queries/          # Tách query theo entity
│   │   │   ├── auth/                 # Auth.js config + mobile-jwt utils
│   │   │   ├── services/             # Business logic (trip-service, cost-service…)
│   │   │   ├── validators/           # Re-export từ @repo/api-types
│   │   │   ├── notifications/        # Push + email senders
│   │   │   └── maps/                 # Google Maps URL builder, directions
│   │   ├── messages/                 # en.json, ko.json (next-intl)
│   │   ├── drizzle/
│   │   │   └── migrations/           # SQL migrations sinh bởi drizzle-kit
│   │   ├── drizzle.config.ts
│   │   ├── middleware.ts             # Auth + i18n middleware
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   └── mobile/                       # Expo (React Native) — Driver-first
│       ├── app/                      # Expo Router (file-based)
│       │   ├── (auth)/login.tsx
│       │   ├── (driver)/
│       │   │   ├── trips/
│       │   │   ├── costs/
│       │   │   └── profile.tsx
│       │   └── _layout.tsx
│       ├── components/
│       ├── lib/
│       │   ├── api-client.ts         # Wrapper fetch tới apps/web /api/*
│       │   ├── auth.ts               # Lưu token bằng expo-secure-store
│       │   └── i18n.ts
│       ├── locales/                  # en.json, ko.json (i18next)
│       ├── app.json                  # Expo config
│       └── package.json
│
├── packages/
│   ├── api-types/                    # ⭐ TRUNG TÂM — share giữa web & mobile
│   │   ├── src/
│   │   │   ├── trips.ts              # Zod schemas + TS types cho trip
│   │   │   ├── costs.ts
│   │   │   ├── users.ts
│   │   │   ├── vehicles.ts
│   │   │   ├── drivers.ts
│   │   │   ├── reports.ts
│   │   │   ├── enums.ts              # TripStatus, CostType, Role…
│   │   │   └── index.ts
│   │   └── package.json
│   ├── eslint-config/                # ESLint config chung
│   ├── tsconfig/                     # tsconfig base, next, expo
│   └── ui-tokens/                    # (optional) Design tokens chia sẻ
│
├── turbo.json                        # Turborepo pipeline
├── pnpm-workspace.yaml
├── package.json                      # Root scripts
├── render.yaml                       # ⭐ Render Blueprint — định nghĩa Web service + Cron Jobs
├── .env.example
└── README.md
```

**Nguyên tắc chia package:**

1. **Single source of truth cho data shape** ở `packages/api-types`. Web và mobile import cùng Zod schema → request/response shape không bao giờ lệch.
2. **Drizzle schema** ở `apps/web/lib/db/schema.ts` — chỉ web/API động vào. Mobile **không** cần biết DB schema.
3. **Business logic** trong `apps/web/lib/services/*`. Route handlers chỉ nên là tầng mỏng: parse → validate → call service → return response.
4. **Không expose Drizzle types** ra ngoài `apps/web`. Mobile chỉ dùng types từ `@repo/api-types`.

### 3.3 Turborepo pipeline (`turbo.json` snapshot)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^lint"] },
    "type-check": { "dependsOn": ["^build"] },
    "db:generate": { "cwd": "apps/web", "cache": false },
    "db:migrate":  { "cwd": "apps/web", "cache": false },
    "db:studio":   { "cwd": "apps/web", "cache": false, "persistent": true }
  }
}
```

**Root `package.json` scripts đề xuất:**
```json
{
  "scripts": {
    "dev": "turbo dev",
    "dev:web": "turbo dev --filter=web",
    "dev:mobile": "turbo dev --filter=mobile",
    "build": "turbo build",
    "lint": "turbo lint",
    "db:generate": "turbo db:generate",
    "db:migrate": "turbo db:migrate"
  }
}
```

### 3.4 Auth strategy (web + mobile dùng chung backend)

Đây là điểm cần thiết kế cẩn thận vì web và mobile có cách lưu credential khác nhau.

| | Web | Mobile |
|---|---|---|
| Lưu credential | **HttpOnly cookie** (do Auth.js set) | **JWT trong `expo-secure-store`** |
| Cách gửi request | Cookie tự động kèm | `Authorization: Bearer <accessToken>` |
| Login flow | Auth.js `signIn()` → cookie session | `POST /api/mobile/auth/login` → trả JWT pair |
| Refresh | Auth.js tự handle | `POST /api/mobile/auth/refresh` |

**Implementation:**
- Auth.js config với `session: { strategy: "jwt" }` để session cookie cũng là JWT (tiện middleware xác thực).
- Custom helper `getAuthFromRequest(req)` trong `apps/web/lib/auth/`:
  - Đọc cookie session (Auth.js) HOẶC
  - Đọc `Authorization: Bearer` header → verify JWT mobile.
  - Trả `{ userId, role, language }` hoặc `null`.
- Middleware bảo vệ route trên Next.js (`middleware.ts`) áp dụng cho cả `/dashboard/*` và `/api/*` (trừ auth endpoints).
- Mobile JWT: `accessToken` exp 15 phút, `refreshToken` exp 7 ngày, lưu refresh hash trong bảng `refresh_tokens` để revoke được.

> ⚠️ **CSRF:** Web dùng cookie → cần CSRF token cho các POST/PATCH/DELETE từ HTML form. Auth.js v5 lo việc này nếu dùng `signIn`. Khi mobile gọi `/api/*` thì dùng JWT header → miễn CSRF.

---

## 4. Kiến trúc tổng quan

```
┌──────────────────────┐                ┌────────────────────┐
│    Web App           │                │   Mobile App       │
│ (Next.js — Admin,    │                │   (Expo —          │
│  Manager)            │                │    Driver)         │
│                      │                │                    │
│  RSC + Client + API  │                │  React Native +    │
│  routes ALL trong    │                │  fetch tới         │
│  cùng deployment     │                │  apps/web /api/*   │
└──────────┬───────────┘                └─────────┬──────────┘
           │                                      │
           │  Cookie session                      │  Bearer JWT
           │                                      │
           └──────────────────┬───────────────────┘
                              │
                              ▼  HTTPS
                ┌──────────────────────────────┐
                │   Next.js Route Handlers     │
                │   (apps/web/app/api/*)       │
                │                              │
                │   Render Web Service —       │
                │   long-running Node.js       │
                │   container (always-on)      │
                │                              │
                │   Middleware: auth + i18n    │
                │   Service layer (lib/        │
                │     services/*)              │
                └──────┬───────────────────────┘
                       │
       ┌───────────────┼─────────────────┬────────────────┐
       ▼               ▼                 ▼                ▼
┌────────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐
│  Neon      │  │ Cloudflare   │  │ Resend      │  │ Render Cron    │
│  Postgres  │  │ R2           │  │ (email)     │  │ Jobs (curl     │
│  (Drizzle) │  │ (S3-compat   │  │             │  │  /api/cron/*)  │
│            │  │  blob,       │  │             │  │                │
│            │  │  free egress)│  │             │  │                │
└────────────┘  └──────────────┘  └─────────────┘  └────────┬───────┘
                                                            │
                                                            ▼
                                               ┌─────────────────────┐
                                               │  Expo Push API +    │
                                               │  Google Maps API    │
                                               └─────────────────────┘
```

**Triết lý:** Một workspace Render duy nhất gồm 1 Web Service (Next.js) + nhiều Cron Job services. Mobile app là client thuần, kết nối qua URL `https://your-app.onrender.com/api/*`.

---

## 5. Yêu cầu chức năng theo Module

> Phần này không thay đổi so với v1.0 vì business logic không phụ thuộc stack. Giữ nguyên để Claude Code có đủ context.

### MODULE 1 — Đăng ký & Quản lý chuyến đi

#### 5.1 Đăng ký chuyến đi *(SRS §2.1)*

User thuộc vai trò `MANAGER` (hoặc `ADMIN` thay mặt) tạo yêu cầu sử dụng xe.

**Form fields:**

| # | Field (UI) | Field name (API) | Required | Kiểu dữ liệu | Validation / Ghi chú |
|---|---|---|---|---|---|
| 1 | Người sử dụng xe | `passengerId` | ✅ | UUID (FK → users) | Dropdown chọn từ danh sách user role MANAGER |
| 2 | Ngày đi | `tripDate` | ✅ | Date (ISO `YYYY-MM-DD`) | Date picker. **Không cho chọn ngày trong quá khứ** |
| 3 | Giờ đi | `tripTime` | ✅ | Time (`HH:MM`, 24h) | Time picker, hiển thị `HH:MM` |
| 4 | Điểm đón | `pickupLocation` | ✅ | Object `{address, lat, lng, placeId?}` | Nhập tay HOẶC Google Places Autocomplete |
| 5 | Điểm đến | `destination` | ✅ | Object như trên | Như trên |
| 6 | Điểm ghé | `stopovers` | ❌ | Array of location objects | Có thể thêm **nhiều** điểm ghé, sắp xếp lại được |
| 7 | Tài xế | `driverId` | ✅ | UUID (FK → drivers) | Chỉ hiển thị tài xế **available** |
| 8 | Loại xe | `vehicleId` | ✅ | UUID (FK → vehicles) | Hiển thị **biển số + loại xe** trong dropdown |
| 9 | Link Google Maps | `mapsUrl` | ❌ (auto) | String URL | **Hệ thống tự sinh** sau khi có pickup + destination + stopovers |
| 10 | Ghi chú | `note` | ❌ | Text (max 1000 chars) | |

**Acceptance criteria:**
- AC1: Form validate inline (Zod + react-hook-form); nút Submit disable khi field bắt buộc trống.
- AC2: Submit thành công → `trips.status = PENDING_DRIVER_CONFIRM`.
- AC3: Sau submit, hệ thống **tự sinh `mapsUrl`** từ pickup + stopovers + destination (dùng Google Maps URL scheme: `https://www.google.com/maps/dir/?api=1&...`).
- AC4: Nếu phát hiện xung đột lịch (xem §5.2) → **chặn submit**, hiển thị cảnh báo cụ thể.
- AC5: Tạo notification (push + email) tới driver (xem §5.4).

#### 5.2 Kiểm tra xung đột lịch *(SRS §2.2)*

**Quy tắc xung đột:** Hai chuyến đi cùng `vehicleId` HOẶC cùng `driverId` mà thời gian trùng lặp → conflict.

**Định nghĩa "trùng giờ":**
- Mỗi chuyến cần ước lượng `endTime`. Nếu chưa biết, mặc định `endTime = tripTime + 4 giờ` (cấu hình được trong settings).
- Hai khoảng `[startA, endA]` và `[startB, endB]` trùng khi `startA < endB AND startB < endA`.

**Behavior:**
- Khi user thay đổi `tripDate` / `tripTime` / `vehicleId` / `driverId`, gọi `GET /api/trips/conflicts?...` (debounce 300ms).
- Conflict → hiển thị cụ thể: *"Xe ABC-12345 đã có chuyến từ 09:00–13:00 ngày 12/05 (Manager Nguyen)"*.
- Admin có quyền **override** xung đột (cần xác nhận lần 2).

#### 5.3 Xác nhận / Từ chối chuyến *(SRS §2.2)*

**Driver flow:**
1. Driver nhận push notification → mở mobile app.
2. Xem chi tiết chuyến → bấm **Confirm** hoặc **Reject** (kèm lý do nếu reject).
3. Status chuyển:
   - `PENDING_DRIVER_CONFIRM` → `CONFIRMED` (confirm)
   - `PENDING_DRIVER_CONFIRM` → `DRIVER_REJECTED` (reject)

**Admin flow khi bị reject:**
- Admin nhận notification.
- Admin **phân công lại tài xế khác** → trạng thái về `PENDING_DRIVER_CONFIRM` với driver mới.

**Lifecycle đầy đủ:**

```
PENDING_DRIVER_CONFIRM
        │
        ├──► CONFIRMED ──► IN_PROGRESS ──► COMPLETED
        │                                        │
        │                                        └──► CLOSED (sau khi chi phí được duyệt)
        │
        ├──► DRIVER_REJECTED ──► (Admin reassign) ──► PENDING_DRIVER_CONFIRM
        │
        └──► CANCELLED (do Manager hoặc Admin huỷ)
```

**UI string i18n:**
- `PENDING_DRIVER_CONFIRM`: "Chưa xác nhận" / "Pending confirmation" / "확인 대기 중"
- `CONFIRMED`: "Đã xác nhận" / "Confirmed" / "확인됨"
- `DRIVER_REJECTED`: "Tài xế từ chối" / "Rejected by driver" / "기사 거절"
- `IN_PROGRESS`: "Đang đi" / "In progress" / "진행 중"
- `COMPLETED`: "Hoàn tất" / "Completed" / "완료"
- `CANCELLED`: "Đã huỷ" / "Cancelled" / "취소됨"

#### 5.4 Notification

| Sự kiện | Người nhận | Kênh |
|---|---|---|
| Manager tạo chuyến mới | Driver được phân công | Push + Email |
| Driver confirm chuyến | Manager + Admin | Push + Email |
| Driver reject chuyến | Admin | Push + Email |
| Admin reassign driver | Driver mới + Manager | Push + Email |
| Chuyến bắt đầu trước 30 phút | Driver | Push |
| Chi phí được phê duyệt / từ chối | Driver gửi | Push + Email |

> 💡 **Implementation:** Push web dùng Web Push API (VAPID); push mobile dùng Expo Push API. Wrapper service `lib/notifications/send.ts` quyết định kênh dựa trên platform của device đã đăng ký.

---

### MODULE 2 — Quản lý Chi phí & Bảo dưỡng

#### 5.5 Ghi nhận chi phí vận hành *(SRS §2.4)*

Driver hoặc Admin ghi nhận chi phí, gắn với một chuyến đi cụ thể HOẶC một xe (cho chi phí định kỳ).

**Các loại chi phí:**

| # | Loại (`type`) | Required fields | Ghi chú |
|---|---|---|---|
| 1 | `FUEL` (Đổ xăng) | `date`, `liters`, `unitPrice`, `gasStation`, `vehicleId` | `currentKm` để tính khoảng cách; `totalAmount = liters × unitPrice` |
| 2 | `OIL_CHANGE` (Thay dầu) | `date`, `oilType`, `amount`, `currentKm`, `vehicleId` | Hệ thống cảnh báo khi gần hạn (§5.6) |
| 3 | `ACCIDENT` (Tai nạn) | `date`, `description`, `photos[]`, `amount`, `vehicleId` | **Bắt buộc** ảnh; **bắt buộc** Admin duyệt |
| 4 | `MEAL` (Ăn uống) | `date`, `numberOfPeople`, `amount`, `receiptPhoto`, `tripId` | Phải gắn với `tripId` |
| 5 | `REPAIR_MAINTENANCE` (Sửa chữa) | `date`, `itemDescription`, `provider`, `amount`, `vehicleId` | **Pre-approval** workflow (§5.7) |

**Common fields cho mọi loại:** `id`, `type`, `vehicleId`, `tripId?`, `submittedById`, `attachments[]`, `status`, `createdAt`, `updatedAt`, `metadata` (JSON chứa field đặc thù theo type).

#### 5.6 Cảnh báo bảo dưỡng

- Mỗi xe có `oilChangeIntervalKm` (mặc định 5000 km). Khi `currentKm - lastOilChangeKm >= interval - warning_km` → cảnh báo dashboard + push Admin.
- Mở rộng được: kiểm định, thay lốp.
- Implementation: **Render Cron Job** chạy daily, curl vào `/api/cron/maintenance-check` với header `Authorization: Bearer $CRON_SECRET`.

#### 5.7 Phê duyệt chi phí *(SRS §2.5)*

**Workflow chuẩn (post-approval):**
```
[DRIVER ghi nhận] → status: SUBMITTED
        │
        ├─► (auto-approve nếu < ngưỡng) → APPROVED
        │
        └─► [ADMIN review] → APPROVED hoặc REJECTED (kèm reason)
```

**Workflow đặc biệt (pre-approval — REPAIR_MAINTENANCE và ACCIDENT lớn):**
```
[DRIVER tạo request, có amount estimate] → PENDING_APPROVAL
        ▼
[ADMIN approve] → APPROVED_TO_PROCEED
        ▼
[DRIVER thực hiện & cập nhật amount thực + chứng từ] → SUBMITTED
        ▼
[ADMIN review] → APPROVED hoặc REJECTED
```

**Auto-approve threshold (lưu trong `system_settings`, không hard-code):**
- `FUEL`: ≤ 1,000,000 VND
- `MEAL`: ≤ 500,000 VND
- `OIL_CHANGE`: ≤ 2,000,000 VND
- `ACCIDENT`, `REPAIR_MAINTENANCE`: **không bao giờ** auto-approve.

**Cost status enum:** `DRAFT` / `PENDING_APPROVAL` / `APPROVED_TO_PROCEED` / `SUBMITTED` / `APPROVED` / `REJECTED`.

---

### MODULE 3 — Báo cáo & Thống kê

#### 5.8 Dashboard quản lý *(SRS §2.7)*

Admin home (`/[locale]/dashboard`) hiển thị:

**Khu vực 1 — Tổng quan xe (cards):**
- Số xe đang chạy (có trip `IN_PROGRESS`)
- Số xe sẵn sàng (`status = ACTIVE`, không có trip đang chạy)
- Số xe bảo trì (`status = MAINTENANCE`)

**Khu vực 2 — Calendar view:**
- Lịch điều xe theo **tuần / tháng** (toggle).
- Mỗi event là 1 chuyến, color-coded theo xe.
- Click event → mở detail dialog.

**Khu vực 3 — Số liệu kỳ (filter ngày):**
- Tổng số chuyến đi.
- Tổng chi phí (tách theo loại).
- Top 5 người sử dụng xe nhiều nhất.
- Bar chart chi phí theo xe.
- Line chart chi phí theo thời gian.

> 💡 **Implementation tip:** Dùng **React Server Components** để render dashboard ban đầu, fetch data trực tiếp từ Drizzle (không qua HTTP). Charts dùng **Recharts** hoặc **Tremor**.

#### 5.9 Báo cáo xuất file *(SRS §2.8)*

Hỗ trợ xuất **Excel (.xlsx)** và **PDF**:

| Báo cáo | Filter | Nội dung |
|---|---|---|
| Chi phí theo xe | Khoảng ngày, vehicleId | Chi tiết từng khoản, tổng theo loại |
| Chi phí theo tháng | Tháng/năm | Tổng theo xe, theo loại, biểu đồ |
| Chi phí theo người dùng | Khoảng ngày, userId | Số chuyến, tổng chi phí |
| Lịch sử chuyến đi | Khoảng ngày, optional vehicleId/driverId/userId | Đầy đủ thông tin |
| Tai nạn | Khoảng ngày | Riêng `ACCIDENT` kèm ảnh |
| Sửa chữa | Khoảng ngày | Riêng `REPAIR_MAINTENANCE` |

**Implementation:**
- Excel: `exceljs`.
- PDF: render React component với **`@react-pdf/renderer`** (server-side trong Route Handler). Hoặc **Puppeteer** (Render là long-running container, không bị giới hạn function timeout như Vercel — Puppeteer chạy được tốt cho báo cáo phức tạp).
- Báo cáo phải hỗ trợ **i18n**: nhận `?lang=en|ko` để chọn header/label.

---

### MODULE 4 — Quản lý Hệ thống

#### 5.10 Quản lý xe *(SRS §2.9)*
CRUD xe: `licensePlate` (unique), `vehicleType`, `manufactureYear`, `color`, `photos[]`, `currentKm`, `oilChangeIntervalKm`, `lastOilChangeKm`, `status` (`ACTIVE`/`MAINTENANCE`/`INACTIVE`), `assignedDriverId` (optional). Khoá xe → `status = MAINTENANCE` → không cho tạo trip.

#### 5.11 Quản lý tài xế *(SRS §2.9)*
CRUD: `fullName`, `licenseNumber` (unique), `licenseClass`, `licenseExpiryDate`, `phone`, `avatar`, `userId`, `status`. Cảnh báo GPLX hết hạn trong 30 ngày → notify Admin (Render Cron).

#### 5.12 Quản lý tài khoản người dùng *(SRS §2.10)*
CRUD user: `email` (unique), `passwordHash`, `fullName`, `position`, `role`, `language`, `status`. Auth: email/password (bcrypt cost ≥ 12) HOẶC SSO Google (flag `sso_google_enabled` trong settings).

#### 5.13 Audit log
Ghi mọi hành động quan trọng (login, CRUD trip/cost/vehicle/driver/user, approve/reject) vào bảng `audit_logs`. Implementation: middleware hoặc decorator trong `lib/services/*` ghi vào DB.

---

## 6. Data Model — Drizzle Schema

> File: `apps/web/lib/db/schema.ts`. Dùng PostgreSQL (Neon). UUID cho mọi PK. Mọi bảng có `created_at`, `updated_at`.

### 6.1 Enums

```ts
import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['ADMIN', 'MANAGER', 'DRIVER']);
export const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'DISABLED']);
export const vehicleStatusEnum = pgEnum('vehicle_status', ['ACTIVE', 'MAINTENANCE', 'INACTIVE']);
export const driverStatusEnum = pgEnum('driver_status', ['ACTIVE', 'INACTIVE']);
export const tripStatusEnum = pgEnum('trip_status', [
  'PENDING_DRIVER_CONFIRM', 'CONFIRMED', 'DRIVER_REJECTED',
  'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
]);
export const costTypeEnum = pgEnum('cost_type', [
  'FUEL', 'OIL_CHANGE', 'ACCIDENT', 'MEAL', 'REPAIR_MAINTENANCE'
]);
export const costStatusEnum = pgEnum('cost_status', [
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED_TO_PROCEED',
  'SUBMITTED', 'APPROVED', 'REJECTED'
]);
```

### 6.2 Bảng chính (mô tả; SQL chi tiết tự sinh từ Drizzle)

**`users`** — `id` UUID PK, `email` UNIQUE, `password_hash`, `full_name`, `position`, `role` (enum), `language` ('en'|'ko'), `status` (enum), `sso_provider`, `sso_id`, timestamps.

**`drivers`** — `id`, `user_id` FK→users, `full_name`, `license_number` UNIQUE, `license_class`, `license_expiry_date`, `phone`, `avatar_url`, `status`.

**`vehicles`** — `id`, `license_plate` UNIQUE, `vehicle_type`, `manufacture_year`, `color`, `photos` (JSONB array), `current_km`, `oil_change_interval_km` (default 5000), `last_oil_change_km`, `assigned_driver_id` FK→drivers (nullable), `status`.

**`trips`** — `id`, `passenger_id` FK→users, `driver_id` FK→drivers, `vehicle_id` FK→vehicles, `trip_date` (date), `trip_time` (time), `estimated_end_time` (time, nullable), `pickup_location` JSONB, `destination` JSONB, `stopovers` JSONB array, `maps_url` text, `note` text, `status` (enum, default `PENDING_DRIVER_CONFIRM`), `rejection_reason` text, `created_by` FK→users, timestamps.
**Indexes:** `(vehicle_id, trip_date)`, `(driver_id, trip_date)`, `(status)`.

**`costs`** — `id`, `type` (enum), `vehicle_id` FK→vehicles, `trip_id` FK→trips (nullable, required for MEAL), `cost_date`, `amount` decimal(15,2), `currency` (default 'VND'), `description`, `metadata` JSONB (chứa fields đặc thù theo type), `status` (enum, default `SUBMITTED`), `rejection_reason`, `submitted_by` FK→users, `approved_by` FK→users, `approved_at`, timestamps.
**Indexes:** `(vehicle_id, cost_date)`, `(status)`, `(type)`.

**`cost_attachments`** — `id`, `cost_id` FK→costs, `file_url` (Cloudflare R2 public URL hoặc presigned URL), `file_key` (R2 object key để xoá khi cần), `file_type`, `uploaded_by` FK→users, `created_at`.

**`notifications`** — `id`, `user_id` FK→users, `type` (string), `title`, `body`, `payload` JSONB, `read_at`, `created_at`.

**`device_tokens`** — `id`, `user_id` FK→users, `platform` ('web'|'ios'|'android'), `token`, `last_active_at`. Dùng để gửi push.

**`refresh_tokens`** — `id`, `user_id` FK→users, `token_hash`, `expires_at`, `revoked_at`. Cho mobile JWT refresh.

**`system_settings`** — `key` PK varchar(100), `value` JSONB, `description`, `updated_by`, `updated_at`.

Default seed:
```json
{
  "auto_approve_threshold_fuel": 1000000,
  "auto_approve_threshold_meal": 500000,
  "auto_approve_threshold_oil": 2000000,
  "default_trip_duration_hours": 4,
  "oil_change_warning_km": 500,
  "license_expiry_warning_days": 30,
  "sso_google_enabled": false
}
```

**`audit_logs`** — `id`, `user_id` FK→users, `action`, `entity_type`, `entity_id`, `old_value` JSONB, `new_value` JSONB, `ip_address`, `user_agent`, `created_at`.
**Indexes:** `(user_id, created_at)`, `(entity_type, entity_id)`.

### 6.3 Drizzle quy ước & migration

- Mỗi enum / bảng export rõ ràng từ `schema.ts`.
- Migration: `pnpm db:generate` (sinh SQL từ schema thay đổi) → `pnpm db:migrate` (apply lên Neon).
- Branch DB: với Neon, mỗi PR có thể dùng **Neon branch** để test migration trước khi merge.

---

## 7. Business Rules tổng hợp

| ID | Rule | Áp dụng tại |
|---|---|---|
| BR-01 | `trip_date + trip_time` không được trong quá khứ | Form validation §5.1 |
| BR-02 | Không cho tạo trip với vehicle `status = MAINTENANCE` | `POST /api/trips` |
| BR-03 | Không cho tạo trip với driver `status = INACTIVE` hoặc GPLX hết hạn | `POST /api/trips` |
| BR-04 | Phải kiểm tra conflict trước khi save | `POST /api/trips`, `PATCH /api/trips/:id` |
| BR-05 | Chỉ Admin mới override conflict được | Authorization |
| BR-06 | Driver chỉ confirm/reject được trip của chính mình | Authorization |
| BR-07 | Manager chỉ xem được trip do mình tạo (trừ Admin) | Authorization |
| BR-08 | Cost `ACCIDENT` bắt buộc ≥ 1 ảnh | Validation §5.5 |
| BR-09 | Cost `MEAL` bắt buộc có `tripId` | Validation §5.5 |
| BR-10 | `ACCIDENT` và `REPAIR_MAINTENANCE` không bao giờ auto-approve | Approval logic |
| BR-11 | `FUEL.amount` phải khớp `liters × unitPrice` | Validation |
| BR-12 | Cost APPROVED không cho sửa (trừ Admin "unlock") | `PATCH /api/costs/:id` |
| BR-13 | `vehicle.current_km - last_oil_change_km >= interval - warning_km` → notification | Render Cron daily |
| BR-14 | GPLX hết hạn trong 30 ngày → notify Admin | Render Cron daily |
| BR-15 | Mọi ghi/sửa/xoá entity quan trọng → log `audit_logs` | Service layer |

---

## 8. API Contract — Next.js Route Handlers

> Base path: `/api`. Mọi response dạng `{ data, error?, meta? }`. Auth: cookie session (web) HOẶC `Authorization: Bearer <jwt>` (mobile).

### 8.1 Auth

```
POST   /api/auth/[...nextauth]              # Auth.js endpoints (web)
POST   /api/mobile/auth/login                # mobile  → { accessToken, refreshToken, user }
POST   /api/mobile/auth/refresh              # mobile  → { accessToken }
POST   /api/mobile/auth/logout               # mobile  → revoke refresh token
POST   /api/auth/sso/google                  { idToken }  → web/mobile cùng dùng
GET    /api/auth/me                          → current user (cả web + mobile)
```

### 8.2 Users (Admin only)
```
GET    /api/users?role=&status=&q=
POST   /api/users
GET    /api/users/[id]
PATCH  /api/users/[id]
DELETE /api/users/[id]
```

### 8.3 Vehicles
```
GET    /api/vehicles?status=
POST   /api/vehicles                         (Admin)
GET    /api/vehicles/[id]
PATCH  /api/vehicles/[id]                    (Admin)
DELETE /api/vehicles/[id]                    (Admin)
PATCH  /api/vehicles/[id]/status             (Admin)
```

### 8.4 Drivers
```
GET    /api/drivers?status=&availableAt=YYYY-MM-DDTHH:mm
POST   /api/drivers                          (Admin)
GET    /api/drivers/[id]
PATCH  /api/drivers/[id]                     (Admin)
DELETE /api/drivers/[id]                     (Admin)
```

### 8.5 Trips
```
GET    /api/trips?from=&to=&driverId=&vehicleId=&passengerId=&status=&page=&limit=
POST   /api/trips                            (Manager / Admin)
GET    /api/trips/[id]
PATCH  /api/trips/[id]                       (creator / Admin, chỉ khi PENDING_DRIVER_CONFIRM)
DELETE /api/trips/[id]                       (Admin)
POST   /api/trips/[id]/confirm               (Driver — chỉ driver của trip)
POST   /api/trips/[id]/reject                (Driver) { reason }
POST   /api/trips/[id]/reassign              (Admin)  { driverId }
POST   /api/trips/[id]/start                 (Driver) → IN_PROGRESS
POST   /api/trips/[id]/complete              (Driver) → COMPLETED
POST   /api/trips/[id]/cancel                (Manager/Admin) { reason }
GET    /api/trips/conflicts?vehicleId=&driverId=&date=&time=&duration=
```

### 8.6 Costs
```
GET    /api/costs?type=&vehicleId=&tripId=&status=&from=&to=
POST   /api/costs                            (Driver / Admin)
GET    /api/costs/[id]
PATCH  /api/costs/[id]                       (chỉ khi DRAFT, REJECTED)
DELETE /api/costs/[id]                       (Admin)
POST   /api/costs/[id]/submit                → SUBMITTED
POST   /api/costs/[id]/approve               (Admin)
POST   /api/costs/[id]/reject                (Admin) { reason }
POST   /api/costs/[id]/attachments           # tạo presigned URL R2 để client upload trực tiếp
DELETE /api/costs/[id]/attachments/[attachmentId]
```

### 8.7 Reports
```
GET    /api/reports/dashboard?from=&to=
GET    /api/reports/export/costs?from=&to=&vehicleId=&format=excel|pdf
GET    /api/reports/export/trips?from=&to=&format=excel|pdf
GET    /api/reports/export/accidents?from=&to=&format=excel|pdf
GET    /api/reports/export/repairs?from=&to=&format=excel|pdf
```

### 8.8 Notifications & Devices
```
GET    /api/notifications?unread=true
POST   /api/notifications/[id]/read
POST   /api/notifications/read-all
POST   /api/devices/register                 { platform, token }   # mobile + web push
DELETE /api/devices/[id]
```

### 8.9 Settings & Audit
```
GET    /api/settings                         (Admin)
PATCH  /api/settings/[key]                   (Admin)
GET    /api/audit-logs?userId=&action=&from=&to=    (Admin)
```

### 8.10 Cron jobs (Render Cron Jobs — bảo vệ bằng `CRON_SECRET`)

Định nghĩa endpoint trong Next.js:
```
GET    /api/cron/maintenance-check           # daily 02:00 — cảnh báo thay dầu
GET    /api/cron/license-expiry-check        # daily 02:05 — GPLX hết hạn
GET    /api/cron/trip-reminder               # mỗi 15 phút — nhắc trip sắp diễn ra
```

Mỗi handler verify header `Authorization: Bearer $CRON_SECRET` trước khi chạy logic, trả 401 nếu sai.

Cấu hình `render.yaml` (Render Blueprint — đặt ở root monorepo):

```yaml
services:
  # Web service — Next.js fullstack
  - type: web
    name: company-car-web
    runtime: node
    plan: standard                # 2GB RAM, đủ cho Next.js + Puppeteer
    region: singapore             # gần Việt Nam; KHỚP region với Neon
    rootDir: apps/web
    buildCommand: cd ../.. && pnpm install --frozen-lockfile && pnpm --filter web build
    startCommand: cd apps/web && pnpm start
    healthCheckPath: /api/health  # endpoint trả 200 cho health check
    envVars:
      - key: NODE_VERSION
        value: 20
      - key: DATABASE_URL
        sync: false               # set thủ công trong dashboard
      - key: AUTH_SECRET
        sync: false
      - key: CRON_SECRET
        sync: false
      # ... các env khác từ §14.2

  # Cron jobs — gọi vào Web service
  - type: cron
    name: cron-maintenance-check
    runtime: docker               # dùng image alpine có curl
    schedule: "0 19 * * *"        # UTC; 02:00 GMT+7
    dockerCommand: |
      curl -fsSL -H "Authorization: Bearer $CRON_SECRET" \
        https://company-car-web.onrender.com/api/cron/maintenance-check
    envVars:
      - key: CRON_SECRET
        sync: false

  - type: cron
    name: cron-license-expiry
    runtime: docker
    schedule: "5 19 * * *"
    dockerCommand: |
      curl -fsSL -H "Authorization: Bearer $CRON_SECRET" \
        https://company-car-web.onrender.com/api/cron/license-expiry-check
    envVars:
      - key: CRON_SECRET
        sync: false

  - type: cron
    name: cron-trip-reminder
    runtime: docker
    schedule: "*/15 * * * *"
    dockerCommand: |
      curl -fsSL -H "Authorization: Bearer $CRON_SECRET" \
        https://company-car-web.onrender.com/api/cron/trip-reminder
    envVars:
      - key: CRON_SECRET
        sync: false
```

> 💡 **Schedule UTC**; `0 19 * * *` UTC = 02:00 GMT+7. Render dùng cron syntax chuẩn.

> 💡 **Tại sao curl thay vì chạy script trực tiếp?** Để cron logic tập trung trong Next.js codebase (test được, dùng chung service layer), không phải duplicate ở 2 nơi. Cron service chỉ làm task lập lịch + gọi HTTP.

---

## 9. User Flows chính

### 9.1 Đăng ký chuyến đi *(SRS §3.1)*
1. Manager đăng nhập web (`/[locale]/login`).
2. Vào `/[locale]/trips/new` → form theo §5.1.
3. Khi đủ 2 điểm → auto-generate `mapsUrl` và preview.
4. Khi chọn driver/vehicle → call `/api/trips/conflicts` (debounce).
5. Submit → tạo trip `PENDING_DRIVER_CONFIRM`, gửi push + email cho driver.
6. Driver mở **mobile app** → xem chi tiết → Confirm/Reject.
7. Manager + Admin nhận notification cập nhật.

### 9.2 Ghi nhận chi phí *(SRS §3.2)*
1. Driver vào trip vừa hoàn tất hoặc màn hình "Xe của tôi" trên mobile.
2. Bấm "Thêm chi phí" → chọn loại → form tương ứng §5.5.
3. Upload chứng từ (camera trên Expo → presigned URL Cloudflare R2).
4. Submit → auto-approve (nếu đủ điều kiện) hoặc gửi notify Admin.
5. Admin review trên web → Approve/Reject.
6. Driver nhận push kết quả.

### 9.3 Phê duyệt sửa chữa lớn (pre-approval)
1. Driver tạo cost `REPAIR_MAINTENANCE` với `amount` estimate → `PENDING_APPROVAL`.
2. Admin nhận notify → review → Approve to proceed → `APPROVED_TO_PROCEED`.
3. Driver mang xe đi sửa → quay lại app, update `amount` thực + upload hoá đơn → `SUBMITTED`.
4. Admin review chi phí thực → Approve hoặc Reject.

---

## 10. Yêu cầu phi chức năng

| Hạng mục | Yêu cầu |
|---|---|
| **Hiệu năng** | API p95 < 500ms (Render web không cold start; Neon DB cold start có thể spike request đầu nếu bật scale-to-zero). Dashboard load < 2s với RSC. |
| **Bảo mật** | HTTPS bắt buộc (Render auto cấp SSL). Bcrypt cost ≥ 12. JWT exp + rotation. Rate limit `/api/mobile/auth/login` 5/min/IP (dùng `@upstash/ratelimit` với Upstash Redis free tier). CSP header. SQL injection an toàn (Drizzle dùng prepared). CSRF lo bởi Auth.js cho web. |
| **Authorization** | Role-based ở mỗi route handler. Helper `requireRole(['ADMIN'])` ở đầu mỗi handler. Test coverage authz ≥ 90%. |
| **i18n** | Toàn bộ UI string + email template + báo cáo có file `en.json`, `ko.json`. Không hard-code chuỗi hiển thị. Mobile dùng cùng key namespace với web. |
| **Accessibility** | Web tuân WCAG 2.1 AA cơ bản. shadcn/ui đã handle phần lớn (focus ring, aria). |
| **Responsive** | Web responsive 360px → 1920px. |
| **Khả năng mở rộng** | Drizzle migrations versioned. Thêm xe/tài xế không cần đổi schema. Render scale ngang được (autoscaling) khi cần. |
| **Backup** | Neon **Point-in-Time Recovery** (PITR) — bật trên Launch tier (+$0.20/GB-month). Render Postgres KHÔNG dùng (đã chọn Neon). |
| **Logging** | Render Logs structured JSON; mỗi request có `requestId` (header `x-request-id`). Forward sang Better Stack/Axiom nếu cần lưu lâu hơn. |
| **Timezone** | Mặc định **Asia/Ho_Chi_Minh** (UTC+7). DB lưu UTC; convert ở UI dùng `date-fns-tz` hoặc `Intl.DateTimeFormat`. Render set `TZ=Asia/Ho_Chi_Minh` trong env nếu muốn server log theo giờ VN. |
| **Currency** | Mặc định **VND**, format theo locale. |
| **File upload** | Max 10MB/file. Chỉ `image/jpeg`, `image/png`, `application/pdf`. Cloudflare R2 presigned URL (TTL 5 phút). |
| **Cold start** | Render Web service **không cold start** (luôn-bật). Neon serverless scale-to-zero sau ~5 phút idle → request đầu chậm 300–500ms. Production khuyến cáo **tắt scale-to-zero** trên Neon (tốn thêm ~$10/tháng nhưng request luôn nhanh). |
| **Region** | **Singapore** (Render + Neon + R2 đều có) → latency thấp cho user VN/Hàn. **TRÁNH us-east-1** vì lịch sử outage 2025. |

---

## 11. Edge cases & Quy ước xử lý

| # | Trường hợp | Default xử lý |
|---|---|---|
| 1 | Manager tạo trip cho chính mình | **Cho phép**. |
| 2 | User role DRIVER không có `drivers` record | API trả 403. Admin phải link. |
| 3 | Trip bị reject 2 lần liên tiếp | Vẫn cho reassign. Không giới hạn. |
| 4 | Đổi vehicle/driver sau khi CONFIRMED | Không cho. Phải cancel + tạo lại. (Admin override được). |
| 5 | Cost cho trip đã CANCELLED | Không cho tạo cost với `tripId` của trip CANCELLED. |
| 6 | Xoá user/driver/vehicle đang có trip ACTIVE | Soft delete (set status), không hard delete. |
| 7 | Conflict timezone giữa user và data | Backend xử lý UTC; FE convert theo locale. |
| 8 | Mobile offline khi ghi cost | Out-of-scope giai đoạn 1. |
| 9 | Google Maps API quota hết | Fallback: cho user nhập địa chỉ tay, `mapsUrl` null. |
| 10 | 2 user cùng approve 1 cost | Optimistic locking bằng `updated_at`; người sau nhận 409. |
| 11 | Neon cold start làm timeout request đầu | Front-end retry tự động (1 lần) khi lỗi 504/timeout. Production nên tắt scale-to-zero. |
| 12 | Web Push không support trên iOS Safari cũ | Fallback chỉ email cho web user trên iOS Safari < 16.4. |
| 13 | Render web service restart (deploy mới) | Render zero-downtime deploy mặc định cho Standard plan trở lên. Health check `/api/health` quyết định khi nào instance mới sẵn sàng. |

---

## 12. Definition of Done

Một feature **Done** khi:

- [ ] Đáp ứng acceptance criteria ở section liên quan.
- [ ] Schema Zod ở `packages/api-types` (nếu có shape mới).
- [ ] Drizzle migration đã sinh và test trên Neon branch.
- [ ] Unit test cho service layer (target ≥ 70% coverage).
- [ ] Integration test cho route handler (Vitest + supertest).
- [ ] Authorization test cho endpoint nhạy cảm.
- [ ] String hiển thị có cả `en` và `ko` (cả web và mobile).
- [ ] Audit log được ghi cho hành động thay đổi data.
- [ ] Đã test trên web (Chrome, Safari) và mobile (Expo Go iOS + Android).
- [ ] OpenAPI / endpoint doc trong `apps/web/docs/api.md` (hoặc Swagger generated).
- [ ] README cập nhật nếu thay đổi setup.

---

## 13. Lộ trình implement

### Phase 0 — Bootstrap monorepo (½ ngày)

```bash
pnpm dlx create-turbo@latest company-car
cd company-car

# Tạo apps/web (Next.js 15)
cd apps && pnpm create next-app@latest web --ts --tailwind --app --src-dir=false

# Tạo apps/mobile (Expo)
pnpm create expo-app@latest mobile -t expo-router

# Tạo packages/api-types
mkdir -p packages/api-types/src && cd packages/api-types
pnpm init && pnpm add zod
```

Cấu hình:
- `pnpm-workspace.yaml` include `apps/*`, `packages/*`.
- `turbo.json` pipeline như §3.3.
- `render.yaml` ở root như §8.10.
- ESLint + tsconfig base ở `packages/eslint-config`, `packages/tsconfig`.
- `.env.example` (xem §14.2 cho danh sách đầy đủ).

### Phase 1 — Nền tảng (tuần 1–2)
- Setup Drizzle + Neon connection (`@neondatabase/serverless`).
- Schema cho `users`, `drivers`, `vehicles`, `system_settings`, `audit_logs`.
- Auth.js v5 cho web; `/api/mobile/auth/*` cho mobile (JWT).
- Middleware authz + i18n (next-intl).
- Seed data ban đầu (1 admin, 3 vehicles, 2 drivers test).
- Mobile shell với Expo Router + login screen.

### Phase 2 — Trip Module (tuần 3–4)
- Trip CRUD + conflict check (`POST /api/trips/conflicts`).
- Confirm/Reject/Reassign endpoints.
- Push notification setup (Expo Push + Web Push).
- Tích hợp Google Places Autocomplete (web + mobile).
- Calendar view trên web (dùng `react-big-calendar` hoặc `@fullcalendar/react`).

### Phase 3 — Cost Module (tuần 5–6)
- Cost CRUD theo 5 loại.
- Cloudflare R2 upload flow (mobile camera → presigned URL).
- Approval workflow + auto-approve thresholds đọc từ `system_settings`.
- Render Cron Jobs: `maintenance-check`, `license-expiry-check`.

### Phase 4 — Dashboard & Reports (tuần 7)
- Dashboard với RSC + Recharts.
- Excel export với `exceljs`.
- PDF export với `@react-pdf/renderer`.

### Phase 5 — Polish & Release (tuần 8)
- Audit log UI.
- Settings UI cho Admin.
- SSO Google (optional).
- QA, fix bugs, docs.
- Deploy:
  - **Web + Cron:** Push `render.yaml` lên GitHub → connect Render → "New Blueprint Instance" → tự động provision Web service + 3 Cron jobs.
  - **Database:** Tạo Neon project Singapore region, copy `DATABASE_URL` vào Render env.
  - **R2:** Tạo bucket Cloudflare R2, lấy `R2_*` credentials, paste vào Render env.
  - **Mobile:** EAS Build cho TestFlight (iOS) + Internal Testing (Android), set `EXPO_PUBLIC_API_URL` = URL Render web service.

---

## 14. Phụ lục

### 14.1 Glossary

| Thuật ngữ | Định nghĩa |
|---|---|
| Trip / Chuyến đi | Một lần sử dụng xe có đăng ký và tài xế xác nhận |
| Cost / Chi phí | Khoản chi phát sinh liên quan đến xe |
| Stopover | Địa điểm dừng giữa pickup và destination |
| Pre-approval | Phê duyệt trước khi thực hiện (cho repair lớn) |
| Auto-approve threshold | Ngưỡng số tiền tự động duyệt không cần Admin |
| RSC | React Server Components — Next.js 15 mặc định |
| Route Handler | API endpoint trong Next.js App Router (`app/api/*/route.ts`) |
| Neon branch | Database branch giống Git branch — dùng cho dev/preview |
| Render Blueprint | File `render.yaml` định nghĩa toàn bộ services (Web + Cron) — Infrastructure as Code |
| Presigned URL | URL có ký số tạm thời, cho phép client upload trực tiếp lên R2 mà không lộ credentials |

### 14.2 Biến môi trường (`.env.example`)

```bash
# Database (Neon)
DATABASE_URL=postgresql://...neon.tech/...?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://...   # cho migrations (drizzle-kit)

# Auth
AUTH_SECRET=...                       # openssl rand -base64 32
AUTH_URL=https://company-car-web.onrender.com
JWT_SECRET=...                        # cho mobile JWT (khác AUTH_SECRET)

# File Storage (Cloudflare R2)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=company-car-uploads
R2_PUBLIC_URL=https://pub-xxx.r2.dev   # hoặc custom domain

# Email
RESEND_API_KEY=...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Maps
GOOGLE_MAPS_API_KEY=...               # restrict theo domain ở GCP

# SSO (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Push
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
EXPO_ACCESS_TOKEN=...                 # cho server gọi Expo Push API

# Rate limit (Upstash Redis - free tier OK)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Cron
CRON_SECRET=...                       # openssl rand -hex 32

# Server
TZ=Asia/Ho_Chi_Minh
NODE_ENV=production

# Mobile (apps/mobile/.env)
EXPO_PUBLIC_API_URL=https://company-car-web.onrender.com
```

### 14.3 Lệnh setup nhanh

```bash
# Cài deps
pnpm install

# Drizzle
pnpm --filter web db:generate
pnpm --filter web db:migrate

# Dev cả hai
pnpm dev                              # chạy web + mobile song song

# Hoặc riêng
pnpm dev:web                          # chỉ Next.js
pnpm dev:mobile                       # chỉ Expo

# Build production
pnpm build
```

### 14.4 Lưu ý đọc tài liệu

- Mục **2.3** và **2.6** trong SRS gốc bị thiếu (nhảy số) → đã hợp nhất vào các mục liên quan.
- "Có thể cấu hình" → lưu trong `system_settings`, **không hard-code**.
- Enum định nghĩa **một lần** ở `packages/api-types/src/enums.ts`, web và mobile cùng import. Drizzle enum trong `schema.ts` phải khớp string với Zod enum.
- Tránh import trực tiếp Drizzle types vào `apps/mobile` — chỉ import từ `@repo/api-types`.

### 14.5 Ước lượng chi phí hosting (production)

| Service | Plan đề xuất | Chi phí/tháng |
|---|---|---|
| **Render Workspace** | Professional ($19/user) | $19 (1 dev), $38 (2 dev) |
| **Render Web Service** | Standard (2GB RAM, 1 CPU) | $25 |
| **Render Cron Jobs** (× 3) | Per-execution, < 1 phút/lần | ~$2–3 |
| **Neon Postgres** | Launch tier, scale-to-zero tắt | ~$15–20 |
| **Cloudflare R2** | <10GB storage, free egress | ~$0.50 |
| **Resend** | Free tier (3,000 email/tháng) | $0 |
| **Upstash Redis** | Free tier (10k command/ngày) | $0 |
| **Google Maps** | $200 free credit/tháng | $0–10 |
| **TỔNG (1 dev, 1 môi trường)** | | **~$60–75/tháng** |

> 💡 So với Vercel + Neon (~$25–30/tháng): Render đắt hơn ~2x do **per-seat workspace fee** + Web service Standard. Bù lại được predictable bill, không cold start cho web, function timeout không giới hạn (báo cáo PDF lớn, AI workload, long polling đều OK).

> 💡 **Tiết kiệm khi mới start:** Có thể bắt đầu với Render Hobby workspace (free) + Web Service Starter ($7) để test trước — nhưng **không khuyến cáo cho production** vì service spin-down sau 15 phút inactivity (cold start 30–60s lần đầu sau idle).

---

**Hết tài liệu PRD v2.1.** Khi implement, ưu tiên đúng business rules ở §7 và data model ở §6. Stack đã cố định ở §3, không tự ý thay thế trừ khi có lý do kỹ thuật rõ ràng — thông báo trước khi đổi.
