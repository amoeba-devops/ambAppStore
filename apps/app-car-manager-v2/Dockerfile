# syntax=docker/dockerfile:1.6
# ============================================================================
# app-car-manager-v2 — Docker image for staging server deploy
#
# Topology: ONE container that serves both UI (RSC) and API routes — Next.js
# 15 is fullstack, no separate BFF. nginx on the staging host reverse-proxies
# /app-car-manager-v2/* to this container's port 3001.
#
# BASE_PATH is INLINED at build time (Next.js bakes it into the JS bundle).
# Override via `--build-arg BASE_PATH=...` if deploying under a different
# prefix. Default matches the production nginx route.
#
# Render deploy ignores this Dockerfile entirely (uses render.yaml's
# buildCommand instead). Same code, same Neon DB, same JWT — two runtime
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
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

RUN npm ci --include=dev

# Alpine (musl) build: optionalDependencies only pin the glibc SWC variant,
# so the gnu binary lands in node_modules but fails to load at runtime
# (`__register_atfork: symbol not found`). Pull the musl variant explicitly —
# `next build` then finds a native SWC and skips the WASM fallback path
# (which triggers a yarn-based lockfile patch that chokes on the corepack
# `packageManager: npm@10.9.4` field, since the image ships yarn 1.22.22
# and Corepack is not enabled).
RUN npm install --no-save --no-package-lock @next/swc-linux-x64-musl@15.5.18

# Copy source after install (so deps cache survives src edits)
COPY . .

# Build-time env: basePath + all NEXT_PUBLIC_* vars must be present when
# `next build` runs (Next.js inlines them into the client bundle). Runtime
# env_file in docker-compose comes too late — bundle is already frozen.
ARG BASE_PATH=/app-car-manager-v2
ARG NEXT_PUBLIC_APP_CODE
ARG NEXT_PUBLIC_DEFAULT_LOCALE
ARG NEXT_PUBLIC_AMA_ORIGIN
ARG NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY
ARG NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC
ARG NEXT_PUBLIC_BASE_PATH
ENV BASE_PATH=${BASE_PATH}
ENV NEXT_PUBLIC_APP_CODE=${NEXT_PUBLIC_APP_CODE}
ENV NEXT_PUBLIC_DEFAULT_LOCALE=${NEXT_PUBLIC_DEFAULT_LOCALE}
ENV NEXT_PUBLIC_AMA_ORIGIN=${NEXT_PUBLIC_AMA_ORIGIN}
ENV NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY}
ENV NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC=${NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC}
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build --workspace @car-v2/web

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
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/src/i18n ./apps/web/src/i18n
COPY --from=builder --chown=nextjs:nodejs /app/packages ./packages

USER nextjs
EXPOSE 3001

# Note: with BASE_PATH set, Next.js serves under that prefix.
# Health endpoint becomes /app-car-manager-v2/api/v1/health (not /api/v1/health).
CMD ["npm", "start", "--workspace=@car-v2/web"]
