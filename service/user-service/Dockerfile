# NOTE: Build from PROJECT ROOT
# docker build -t user-service -f service/user-service/Dockerfile .

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app/service/user-service

# Copy package files first (cache-friendly)
COPY service/user-service/package*.json ./

# Install full deps (include dev)
RUN npm ci

# Copy source code
COPY service/user-service ./


# Build TS -> JS
RUN npm run build


# ---------- Stage 2: Production ----------
FROM node:20-alpine

WORKDIR /app/service/user-service

# Runtime invariant env only
ENV NODE_ENV=production

# Copy package files
COPY service/user-service/package*.json ./

# Install production deps only
RUN npm ci --omit=dev \
  && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/service/user-service/dist ./dist

# Copy proto definitions (required at runtime for gRPC)
COPY packages/proto/user ./proto/user

# gRPC port (documentation purpose)
EXPOSE 50051

# Start app
CMD ["node", "dist/main.js"]



# ---------- Stage 1: Build ----------
# FROM node:20-alpine AS builder

# WORKDIR /app/service/user-service

# COPY service/user-service/package*.json ./
# RUN npm ci

# COPY service/user-service ./
# RUN npm run build

# # ---------- Stage 2: Production ----------
# FROM node:20-alpine

# # add dumb-init
# RUN apk add --no-cache dumb-init

# # non-root user
# RUN addgroup -S app && adduser -S app -G app

# WORKDIR /app/service/user-service

# ENV NODE_ENV=production

# COPY service/user-service/package*.json ./
# RUN npm ci --omit=dev && npm cache clean --force

# COPY --from=builder /app/service/user-service/dist ./dist
# COPY packages/proto/user ./proto/user

# USER app

# EXPOSE 50051

# ENTRYPOINT ["dumb-init", "--"]
# CMD ["node", "dist/main.js"]
