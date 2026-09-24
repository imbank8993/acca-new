# ==============================================================================
# Dockerfile for ACCA Web Frontend (Next.js)
# Context: Root monorepo directory (.)
# ==============================================================================

# ── 1. Base Stage ─────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── 2. Dependencies & Build Stage ─────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Disable Next.js telemetry & skip puppeteer browser download during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

# Copy root monorepo metadata and ALL workspace definitions
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

# Install dependencies (--ignore-scripts avoids C++ compilation of canvas)
RUN npm ci --legacy-peer-deps --ignore-scripts

# Ensure Linux x64 native binaries for Tailwind CSS 4 & LightningCSS are present
RUN npm install @tailwindcss/oxide-linux-x64-gnu@4.1.18 lightningcss-linux-x64-gnu@1.30.2 --no-save || true

# Direct-link native binaries into their parent packages to ensure instant loading
RUN cp -f node_modules/@tailwindcss/oxide-linux-x64-gnu/*.node node_modules/@tailwindcss/oxide/ 2>/dev/null || true
RUN cp -f node_modules/lightningcss-linux-x64-gnu/*.node node_modules/lightningcss/ 2>/dev/null || true

# Test & verify native bindings (fails fast if anything is missing)
RUN node -e "require('@tailwindcss/oxide'); require('lightningcss'); console.log('✅ Tailwind CSS 4 & LightningCSS native bindings verified successfully!')"

# Copy Prisma schema and generate client for Next.js server actions / API
COPY apps/api/prisma ./apps/api/prisma
RUN npx prisma generate --schema=./apps/api/prisma/schema.prisma

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build Next.js
WORKDIR /app/apps/web
RUN npm run build
WORKDIR /app

# ── 3. Production Runner Stage ────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3006
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root system user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash -m nextjs

# Copy dependencies, built artifacts, and configs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared ./packages/shared
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/next.config.ts ./apps/web/next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3006/api/health || curl -f http://localhost:3006 || exit 0

CMD ["npm", "run", "start", "--workspace=apps/web"]
