# NOTE: Build from PROJECT ROOT
# docker build -t bff-service -f service/bff-service/Dockerfile .

# ─────────────────────────────────────────────────────────────
# Proto Strategy:
#   Source of truth: packages/proto (shared across services)
#   Runtime artifact: service/bff-service/proto (copied at build)
# ─────────────────────────────────────────────────────────────

# ============================================
# Build Stage
# ============================================
FROM node:20-alpine AS builder

# Maintain same directory structure as local dev for relative paths
WORKDIR /build/service/bff-service

# Copy package files
COPY service/bff-service/package*.json ./
COPY service/bff-service/tsconfig*.json ./
COPY service/bff-service/nest-cli.json ./

# Install dependencies
# Using npm install instead of npm ci since package-lock.json may be gitignored/out of sync
RUN npm install

# ─────────────────────────────────────────────────────────────
# Copy proto files from source of truth BEFORE build
# This replaces the sync-proto.sh script in Docker context
# ─────────────────────────────────────────────────────────────
COPY packages/proto/user ./proto/user
COPY packages/proto/task ./proto/task
COPY packages/proto/google ./proto/google

# Copy source code
COPY service/bff-service/src/ ./src/

# Build the application (skip prebuild hook since proto already copied)
RUN npx nest build

# ============================================
# Production Stage
# ============================================
FROM node:20-alpine AS production

# Optional but recommended
RUN apk add --no-cache dumb-init

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV APP_PORT=4000
ENV APP_METRICS_PORT=9092

# Copy package files and install production dependencies
COPY service/bff-service/package*.json ./
RUN npm install --only=production && npm cache clean --force

# Copy built files
COPY --from=builder /build/service/bff-service/dist ./dist

# ─────────────────────────────────────────────────────────────
# RUNTIME PROTO: Copy from source of truth (packages/proto)
# Same structure as local dev: ./proto/user/v1/user.proto
# ─────────────────────────────────────────────────────────────
COPY packages/proto/user ./proto/user
COPY packages/proto/task ./proto/task
COPY packages/proto/google ./proto/google

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Change ownership
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose ports
# GraphQL API
EXPOSE 4000
# Metrics endpoint
EXPOSE 9092

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9092/health || exit 1

ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
