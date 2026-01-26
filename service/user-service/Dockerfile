# NOTE: Build from PROJECT ROOT
# docker build -t user-service -f service/user-service/Dockerfile .

# ─────────────────────────────────────────────────────────────
# Proto Strategy:
#   Source of truth: packages/proto (shared across services)
#   Runtime artifact: service/user-service/proto (copied at build)
# ─────────────────────────────────────────────────────────────

# ---------- Stage 1: Build Shared Package ----------
FROM node:20-alpine AS shared-builder

WORKDIR /app/packages/shared/ts

# Copy shared package files
COPY packages/shared/ts/package*.json ./
COPY packages/shared/ts/tsconfig.json ./

# Install shared deps
RUN npm ci

# Copy shared source and build
COPY packages/shared/ts/src ./src
RUN npm run build

# ---------- Stage 2: Build User Service ----------
FROM node:20-alpine AS builder

# Maintain same directory structure as local dev for relative paths
WORKDIR /build

# Copy shared package FIRST to correct relative path (../../packages/shared/ts)
# This must happen before npm ci since package.json references it
COPY --from=shared-builder /app/packages/shared/ts /build/packages/shared/ts

WORKDIR /build/service/user-service

# Copy package files
COPY service/user-service/package*.json ./

# Install full deps (including dev) - shared package is at correct relative path
# Using npm install instead of npm ci since package-lock.json may be gitignored/out of sync
RUN npm install

# ─────────────────────────────────────────────────────────────
# Copy proto files from source of truth BEFORE build
# This replaces the sync-proto.sh script in Docker context
# ─────────────────────────────────────────────────────────────
COPY packages/proto/user ./proto/user
COPY packages/proto/common ./proto/common
COPY packages/proto/google ./proto/google

# Copy source code (only src, not node_modules or other files)
COPY service/user-service/src ./src
COPY service/user-service/tsconfig*.json ./
COPY service/user-service/nest-cli.json ./

# Build TS -> JS (run nest build directly, skip prebuild hook since proto already synced)
RUN npx nest build


# ---------- Stage 3: Production ----------
FROM node:20-alpine

# Optional but recommended
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Copy shared package FIRST (before npm ci)
COPY --from=shared-builder /app/packages/shared/ts /app/packages/shared/ts

# Maintain same directory structure for relative paths
WORKDIR /app/service/user-service

ENV NODE_ENV=production

# Copy package files
COPY service/user-service/package*.json ./

# Install prod deps only (shared package is at correct relative path)
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /build/service/user-service/dist ./dist

# ─────────────────────────────────────────────────────────────
# RUNTIME PROTO: Copy from source of truth (packages/proto)
# Same structure as local dev: ./proto/user/v1/user.proto
# ─────────────────────────────────────────────────────────────
COPY packages/proto/user ./proto/user
COPY packages/proto/google ./proto/google

USER app

EXPOSE 50051
EXPOSE 9090

# OpenTelemetry environment variables
ENV OTEL_SERVICE_NAME=user-service
ENV OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.tracing.svc.cluster.local:4317
ENV OTEL_TRACES_SAMPLER=always_on

ENTRYPOINT ["dumb-init", "--"]
# Load OpenTelemetry instrumentation before main.js
CMD ["node", "-r", "./dist/instrumentation.js", "dist/main.js"]
