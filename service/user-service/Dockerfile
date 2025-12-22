
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git make

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.Version=1.0.0" \
    -o /app/bin/user-service \
    ./cmd/user/main.go ./cmd/user/wire_gen.go


# =========================
# Runtime stage
# =========================
FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata busybox-extras

ENV TZ=Asia/Ho_Chi_Minh

RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

WORKDIR /app

COPY --from=builder /app/bin/user-service /app/user-service
COPY --from=builder /app/configs /app/configs

RUN chown -R appuser:appuser /app

USER appuser

# 👉 Chỉ expose gRPC
EXPOSE 50051

# 👉 Health check qua TCP (gRPC-ready)
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD nc -z localhost 50051 || exit 1

ENTRYPOINT ["/app/user-service"]
CMD ["-conf", "/app/configs"]
