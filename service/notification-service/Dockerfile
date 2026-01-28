# =====================================================
# Stage 1: Build stage
# =====================================================
FROM golang:1.24-alpine AS builder

# Install required build tools
RUN apk add --no-cache git make

# Set working directory
WORKDIR /app

# 1. Copy shared library first
COPY packages/shared/go/ ./packages/shared/go/

# 2. Copy notification-service go.mod and go.sum
COPY service/notification-service/go.mod service/notification-service/go.sum ./service/notification-service/

# 3. Use go mod edit to resolve the shared module locally during build
WORKDIR /app/service/notification-service
RUN go mod edit -replace github.com/task-management/go-shared=../../packages/shared/go

# 4. Download dependencies
RUN go mod download

# 5. Copy notification-service source code
COPY service/notification-service/ ./

# 6. Build the application
# CGO_ENABLED=0 for static binary
# -ldflags="-w -s" to strip debug info and reduce binary size
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.Version=1.0.0" \
    -o /app/notification-service-bin \
    ./cmd/notification

# =====================================================
# Stage 2: Production stage
# =====================================================
FROM alpine:3.19

# Install ca-certificates for HTTPS requests and tzdata for timezone
RUN apk --no-cache add ca-certificates tzdata

# Set timezone (optional, adjust as needed)
ENV TZ=Asia/Ho_Chi_Minh

# Create a non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/notification-service-bin ./notification-service

# Copy config files
COPY --from=builder /app/service/notification-service/configs ./configs

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose HTTP/metrics port
EXPOSE 9093

# Run the application
ENTRYPOINT ["./notification-service"]

# Default arguments (can be overridden)
CMD ["-conf", "./configs"]
