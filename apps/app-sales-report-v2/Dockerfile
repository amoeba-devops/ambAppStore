# syntax=docker/dockerfile:1.6
# ============================================================================
# app-sales-report-v2 — Docker image for staging server deploy
#
# Topology: ONE container that serves both UI (RSC) and API routes — Next.js
# 15 is fullstack, no separate BFF. nginx on the staging host reverse-proxies
# /app-sales-report-v2/* to this container's port 3001.
#
# This image builds ONLY the web workspace (@v2/web). The worker and cron
# workspaces (@v2/worker, @v2/cron) are not included — they run on Render
# directly against the same Neon Postgres. No double-processing.
#
# BASE_PATH is INLINED at build time (Next.js bakes it into the JS bundle).
# Override via `--build-arg BASE_PATH=...` if deploying under a different
# prefix. Default matches the production nginx route.
#
# Render deploy ignores this Dockerfile entirely (uses render.yaml's
# buildCommand). Same code, same Neon DB, same JWT_SECRET — two runtime
# hosts, no divergence.
# ============================================================================

# ---- Stage 1: builder ----
FROM node:20-alpine AS builder

# next-intl + sharp need libc6-compat on alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY apps/cron/package.json ./apps/cron/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

RUN npm ci --include=dev

# Copy source after install (so deps cache survives src edits)
COPY . .

# Build-time env: basePath must be present when `next build` runs
ARG BASE_PATH=/app-sales-report-v2
ENV BASE_PATH=${BASE_PATH}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build --workspace @v2/web

# Drop devDependencies before copying into runner
RUN npm prune --omit=dev


# ---- Stage 2: runner ----
FROM node:20-alpine AS runner

RUN apk add --no-cache wget libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy production artifacts only
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/next.config.ts ./apps/web/next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/packages ./packages

USER nextjs
EXPOSE 3001

# Note: with BASE_PATH set, Next.js serves under that prefix.
# Health endpoint becomes /app-sales-report-v2/api/v1/health (not /api/v1/health).
CMD ["npm", "start", "--workspace=@v2/web"]
