# Company Car Management System

Hệ thống quản lý xe công ty — implement theo `PRD_Company_Car_Management.md` v2.1 (Next.js + Render + Neon).

## Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Web (Frontend + API):** Next.js 15 App Router + TailwindCSS + shadcn/ui
- **Mobile:** Expo (React Native) + Expo Router + NativeWind
- **DB:** Neon Postgres + Drizzle ORM
- **Auth:** Auth.js v5 (web cookie) + JWT (mobile)
- **Validation:** Zod (shared via `@repo/api-types`)
- **i18n:** next-intl (web), i18next (mobile) — en / ko / vi
- **Storage:** Cloudflare R2 (S3-compatible)
- **Email:** Resend
- **Push:** Web Push + Expo Push
- **Hosting:** Render (Web + Cron Jobs) + Expo EAS

## Cấu trúc

```
company-car/
├── apps/
│   ├── web/                  # Next.js 15 — UI + API routes
│   └── mobile/               # Expo — Driver-first
├── packages/
│   ├── api-types/            # Zod schemas + types share giữa web/mobile
│   ├── tsconfig/             # tsconfig base
│   └── eslint-config/        # ESLint shared
├── pnpm-workspace.yaml
├── turbo.json
├── render.yaml               # Render Blueprint (Web + 3 Cron jobs)
└── .env.example
```

## Setup

```bash
# 1. Cài deps
pnpm install

# 2. Cấu hình env
cp .env.example .env

# 3. Tạo Neon project + paste DATABASE_URL vào .env

# 4. Chạy migration
pnpm db:generate
pnpm db:migrate

# 5. Dev
pnpm dev          # web + mobile song song
pnpm dev:web      # chỉ Next.js  (http://localhost:3000)
pnpm dev:mobile   # chỉ Expo
```

## Phase progress

- [x] Phase 0 — Bootstrap monorepo
- [ ] Phase 1 — Foundation (Drizzle, schema cơ bản, Auth.js, i18n)
- [ ] Phase 2 — Trip Module
- [ ] Phase 3 — Cost Module
- [ ] Phase 4 — Dashboard & Reports
- [ ] Phase 5 — Polish & Release

## Tham khảo

- PRD: `../PRD_Company_Car_Management.md`
- Prototype tham khảo: `../apps/app-car-manager/` (KR-style fleet, NestJS+MySQL — chỉ tham khảo nghiệp vụ)
