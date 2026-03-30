# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Base image with pnpm
# ============================================
FROM node:24-alpine AS base

# Install pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ============================================
# Stage 2: Install dependencies
# ============================================
FROM base AS deps

# Copy workspace configuration files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json files for all workspace packages needed by client
COPY apps/client/package.json ./apps/client/
COPY packages/prettier-config/package.json ./packages/prettier-config/

# Install all dependencies
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================
# Stage 3: Build the application
# ============================================
FROM deps AS builder

# Copy source files
COPY apps/client ./apps/client

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application with standalone output
RUN pnpm --filter=@apps/client build

# ============================================
# Stage 4: Production runner
# ============================================
FROM node:24-alpine AS runner

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy public assets
COPY --from=builder /app/apps/client/public ./public

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/apps/client/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/client/.next/static ./apps/client/.next/static

USER nextjs

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# The standalone output creates a server.js in the app directory
CMD ["node", "apps/client/server.js"]
