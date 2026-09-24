# ==============================================================================
# Dockerfile for ACCA Backend API (NestJS)
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

# Copy root monorepo metadata and ALL workspace definitions
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install dependencies for monorepo
RUN npm ci --legacy-peer-deps

# Copy Prisma schema and generate client
COPY apps/api/prisma ./apps/api/prisma
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
RUN npx prisma generate --schema=./apps/api/prisma/schema.prisma

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build NestJS API
RUN npm run build --workspace=apps/api

# ── 3. Production Runner Stage ────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3007

# Create non-root system user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash -m nestjs

# Copy built application and node_modules
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared ./packages/shared
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

USER nestjs

EXPOSE 3007

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3007/api/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
