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

# Copy package.json files for all workspace packages needed by server
COPY apps/server/package.json ./apps/server/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/prettier-config/package.json ./packages/prettier-config/

# Install all dependencies (including dev for building)
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================
# Stage 3: Build the application
# ============================================
FROM deps AS builder

# Copy source files
COPY packages/schemas ./packages/schemas
COPY apps/server ./apps/server

# Prisma config requires DATABASE_URL at generate-time.
# Build uses a placeholder URL; runtime value comes from compose env.
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/comm?schema=public

# Build workspace dependencies first (schemas)
RUN pnpm --filter=@packages/schemas build 2>/dev/null || true

# Generate Prisma client
RUN pnpm --filter=@apps/server db:generate

# Build the server
RUN pnpm --filter=@apps/server build

# ============================================
# Stage 4: Runtime dependencies
# ============================================
FROM base AS runtime-deps

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/prettier-config/package.json ./packages/prettier-config/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================
# Stage 5: Production runner
# ============================================
FROM node:24-alpine AS runner

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 server

WORKDIR /app

# Copy production node_modules
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=runtime-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=runtime-deps /app/packages/schemas/node_modules ./packages/schemas/node_modules

# Copy built application
COPY --from=builder /app/apps/server/build ./apps/server/build
COPY --from=builder /app/apps/server/package.json ./apps/server/

# Copy Prisma assets and runtime entrypoint
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/apps/server/prisma.config.ts ./apps/server/
COPY --from=builder /app/apps/server/docker-entrypoint.sh ./apps/server/

# Copy built schemas package
COPY --from=builder /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=builder /app/packages/schemas/package.json ./packages/schemas/

# Set ownership
RUN chmod +x /app/apps/server/docker-entrypoint.sh && chown -R server:nodejs /app

USER server

WORKDIR /app/apps/server

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
