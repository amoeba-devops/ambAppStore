---
name: Hosting — Render.com (resolved)
description: Deploy lên Render.com (3 services: Web + Background Worker + Cron). KHÔNG Vercel.
type: project
---

**Resolved** 2026-05-11: deploy lên **Render.com**.

**Architecture**: 3 services per env (staging + production):
- `sales-report-v2-web` — Next.js Web Service (RSC + Server Actions + API routes)
- `sales-report-v2-worker` — Background Worker (Excel parse + CM calc với DB queue)
- `sales-report-v2-cron` — Cron Jobs (daily AMA user sync, retry failed)

**Why Render over Vercel**:
- Web Service không có 30s function timeout (Vercel có) → đỡ phải workaround cho parse Excel
- Background Worker là first-class service type (Vercel cần Inngest external)
- Cron Jobs first-class (Vercel Cron limited)
- $40/mo total (web $7 + worker $7 + cron $1 + Neon $19 + S3 $5) — comparable Vercel Pro
- Fewer tools = less hallucination (Claude không bịa Vercel-specific features)

**Trade-off**:
- KHÔNG có preview env per PR (Vercel auto, Render manual)
- KHÔNG có edge runtime (Render runs Node only) — Next.js middleware vẫn OK với Node runtime
- Cold start nếu free tier — dùng Starter $7 paid để always-on

**How to apply**:
- Xem [docs/architecture/DEPLOYMENT.md](../../docs/architecture/DEPLOYMENT.md) cho full config
- `render.yaml` ở root scaffold (cần tạo khi scaffold code)
- Mọi reference Vercel trong docs/code → phải refactor sang Render
- Env vars set qua Render dashboard, KHÔNG commit
