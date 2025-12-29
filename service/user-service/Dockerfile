# NOTE: Build from PROJECT ROOT
# docker build -t user-service -f service/user-service/Dockerfile .

# ─────────────────────────────────────────────────────────────
# Proto Strategy:
#   Source of truth: packages/proto (shared across services)
#   Runtime artifact: service/user-service/proto (copied at build)
# ─────────────────────────────────────────────────────────────

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app/service/user-service

# Copy package files first (cache-friendly)
COPY service/user-service/package*.json ./

# Install full deps (including dev)
RUN npm ci

# ─────────────────────────────────────────────────────────────
# Copy proto files from source of truth BEFORE build
# This replaces the sync-proto.sh script in Docker context
# ─────────────────────────────────────────────────────────────
COPY packages/proto/user ./proto/user
COPY packages/proto/common ./proto/common

# Copy source code
COPY service/user-service ./

# Build TS -> JS (run nest build directly, skip prebuild hook since proto already synced)
RUN npx nest build


# ---------- Stage 2: Production ----------
FROM node:20-alpine

# Optional but recommended
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app/service/user-service

ENV NODE_ENV=production

# Copy package files
COPY service/user-service/package*.json ./

# Install prod deps only
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/service/user-service/dist ./dist

# ─────────────────────────────────────────────────────────────
# RUNTIME PROTO: Copy from source of truth (packages/proto)
# Same structure as local dev: ./proto/user/v1/user.proto
# ─────────────────────────────────────────────────────────────
COPY packages/proto/user ./proto/user

USER app

EXPOSE 50051

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
