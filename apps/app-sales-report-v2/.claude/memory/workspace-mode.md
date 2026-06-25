---
name: Workspace mode
description: v2 là standalone Turborepo trong folder app-sales-report-v2, không tích hợp vào ambAppStore root workspaces
type: project
---

**Quyết định**: v2 có `turbo.json` + `package.json` + `node_modules` riêng trong folder `app-sales-report-v2/`. Mọi command (`npm install`, `npm run dev`, `drizzle-kit migrate`) chạy được khi `cd` vào folder này.

**Why**: User yêu cầu "đảm bảo tất cả sẽ work trong folder app-sales-report-v2" (2026-05-11). Lý do tránh integrate vào root:
- Root ambAppStore đang dùng MySQL stack v1, dependency conflict với Neon/Drizzle
- Cô lập node_modules giảm rủi ro version mismatch
- Có thể deploy riêng lẻ lên Vercel mà không build cả monorepo

**How to apply**:
- KHÔNG thêm v2 vào `apps/*` workspace của root `package.json`
- Path `import` chỉ từ trong `app-sales-report-v2/` (alias `@v2/*`)
- CI workflow filter `paths: apps/app-sales-report-v2/**` — không trigger build khi đụng app khác
- Khi viết import ngoài folder → cảnh báo và refactor
