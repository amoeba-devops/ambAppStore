---
name: Tech stack v2 (simplified)
description: Stack tối giản — Turbo + Next.js + Neon + Drizzle + S3 + Render.com. KHÔNG có Vercel/Inngest/Sentry để tránh hallucination.
type: project
---

**Stack fixed** (revised 2026-05-11 — simplified for anti-hallucination):

- **Monorepo**: Turborepo standalone
- **Framework**: Next.js 15 App Router fullstack (RSC + Server Actions + Route Handlers)
- **Language**: TypeScript 5 strict
- **DB**: Neon Postgres + Drizzle ORM (`@neondatabase/serverless` HTTP driver)
- **Storage**: AWS S3 (presigned URL)
- **Auth**: jose verify AMA JWT
- **UI**: Tailwind 3 + shadcn/ui + Recharts + React Hook Form + next-intl
- **Background**: Render Background Worker + DB queue (KHÔNG Inngest)
- **Cron**: Render Cron Jobs (KHÔNG Vercel Cron)
- **Test**: Vitest + Playwright
- **Deploy**: **Render.com** — Web Service + Background Worker + Cron Jobs (KHÔNG Vercel)

**Why simplified** (user request 2026-05-11):
- Fewer tools = less hallucination surface (Claude không bịa Vercel-specific features khi run on Render)
- Render Web Service không có 30s timeout (Vercel có) → đỡ phải workaround
- DB queue đủ cho scale v2 (1-5 users, 52 weeks/year) — không cần Redis/BullMQ
- Render built-in logs/alerts thay thế Sentry/Axiom cho MVP

**KHÔNG dùng (explicit reject)**:
- ❌ Vercel — thay bằng Render.com
- ❌ Inngest / Trigger.dev — thay bằng Render Background Worker
- ❌ Sentry / Axiom / Datadog — dùng Render logs
- ❌ Redis / BullMQ — DB-based queue đủ
- ❌ Prisma — đã chốt Drizzle
- ❌ tRPC, SWR, React Query — Server Actions + RSC đủ
- ❌ NextAuth — passthrough JWT từ AMA only

**How to apply**: Mọi tech choice mới phải fit stack core này. KHÔNG introduce mới (vd Bun, Hono, Bull, Redis, Vercel) trừ khi MVP done + có lý do nghiệp vụ rõ ràng. Nếu Claude suggest tool ngoài list → reject + revert.
