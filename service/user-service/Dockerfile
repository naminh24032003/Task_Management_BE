# NOTE: This Dockerfile MUST be built from the PROJECT ROOT.
# Command: docker build -t user-service -f service/user-service/Dockerfile .

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies first for better caching
COPY service/user-service/package*.json ./service/user-service/
RUN cd service/user-service && npm install

# Copy source code and protos
COPY service/user-service ./service/user-service
COPY packages/proto ./packages/proto

# Build the app
RUN cd service/user-service && npm run build

# Remove development dependencies
RUN cd service/user-service && npm prune --production

# --- Stage 2: Production ---
FROM node:20-alpine

WORKDIR /app

# Copy production files
COPY --from=builder /app/service/user-service/dist ./service/user-service/dist
COPY --from=builder /app/service/user-service/node_modules ./service/user-service/node_modules
COPY --from=builder /app/service/user-service/package*.json ./service/user-service/
COPY --from=builder /app/packages/proto ./packages/proto

# Set environment variables so the app can find the protos
ENV PROTO_PATH=/app/packages/proto/user/v1/user.proto
ENV GRPC_URL=0.0.0.0:50051

EXPOSE 50051

WORKDIR /app/service/user-service
CMD ["npm", "run", "start:prod"]
