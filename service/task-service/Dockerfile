# =====================================================
# Stage 1: Build stage
# =====================================================
FROM golang:1.23-alpine AS builder

# Install required build tools
RUN apk add --no-cache git make protoc protobuf-dev

# Set working directory
WORKDIR /app

# Copy go.mod and go.sum first (for better layer caching)
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
# CGO_ENABLED=0 for static binary
# -ldflags="-w -s" to strip debug info and reduce binary size
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /app/task-service \
    ./cmd/task

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
COPY --from=builder /app/task-service .

# Copy config files
COPY --from=builder /app/configs ./configs

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose gRPC port and metrics port
EXPOSE 50052
EXPOSE 9091

# Run the application
ENTRYPOINT ["./task-service"]

# Default arguments (can be overridden)
CMD ["-conf", "./configs"]
