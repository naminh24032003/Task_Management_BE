# Multi-stage build for Shared gRPC-Gateway
FROM golang:1.24-alpine AS builder

WORKDIR /workspace

# Install build tools
RUN apk add --no-cache protobuf protobuf-dev git curl

# Copy all proto files
COPY packages/proto ./proto

# Install grpc-gateway tools
RUN go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
RUN go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@latest
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Generate gRPC-Gateway code
RUN mkdir -p /gen

# Generate for user-service
RUN protoc -I./proto \
    --go_out=/gen --go_opt=paths=source_relative \
    --go-grpc_out=/gen --go-grpc_opt=paths=source_relative \
    --grpc-gateway_out=/gen --grpc-gateway_opt=paths=source_relative \
    ./proto/user/v1/user.proto

# Generate for task-service
RUN protoc -I./proto \
    --go_out=/gen --go_opt=paths=source_relative \
    --go-grpc_out=/gen --go-grpc_opt=paths=source_relative \
    --grpc-gateway_out=/gen --grpc-gateway_opt=paths=source_relative \
    ./proto/task/v1/task.proto

# Create shared gateway main.go
RUN cat > /workspace/main.go <<'EOF'
package main

import (
    "context"
    "flag"
    "net/http"
    "os"
    "log"

    "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"

    userpb "grpc-gateway/gen/user/v1"
    taskpb "grpc-gateway/gen/task/v1"
)

var (
    userServiceEndpoint = flag.String("user-service", "user-service.dev.svc.cluster.local:50051", "User gRPC service endpoint")
    taskServiceEndpoint = flag.String("task-service", "task-service.dev.svc.cluster.local:50052", "Task gRPC service endpoint")
    httpPort = flag.String("http-port", ":8080", "HTTP port")
    useMTLS = flag.Bool("use-mtls", true, "Enable mTLS for gRPC connections")
)

// headerMatcher allows forwarding custom HTTP headers as gRPC metadata
func headerMatcher(key string) (string, bool) {
    switch key {
    case "X-Tenant-Id", "x-tenant-id":
        return "x-tenant-id", true
    case "Authorization", "authorization":
        return "authorization", true
    case "X-Request-Id", "x-request-id":
        return "x-request-id", true
    default:
        return runtime.DefaultHeaderMatcher(key)
    }
}

func run() error {
    ctx := context.Background()
    ctx, cancel := context.WithCancel(ctx)
    defer cancel()

    // Configure ServeMux with header forwarding
    mux := runtime.NewServeMux(
        runtime.WithIncomingHeaderMatcher(headerMatcher),
    )

    var opts []grpc.DialOption

    // In Istio service mesh, mTLS is handled transparently by the sidecar proxy
    // The application connects to services using plaintext, and Istio sidecar
    // automatically encrypts traffic with mTLS between sidecars
    if *useMTLS {
        log.Printf("🔒 Running in Istio mesh - mTLS handled by sidecar proxy")
        log.Printf("📝 Using insecure connection to local Envoy sidecar (127.0.0.1)")
        log.Printf("🔐 Istio sidecar will handle mTLS encryption to backend services")
    } else {
        log.Printf("🔓 Using insecure gRPC connection (development mode)")
    }

    // Always use insecure connection - Istio sidecar handles encryption
    opts = []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

    // Register AuthService handlers (Register, Login, RefreshToken, ValidateToken, Logout)
    log.Printf("📡 Connecting to Auth Service: %s", *userServiceEndpoint)
    if err := userpb.RegisterAuthServiceHandlerFromEndpoint(ctx, mux, *userServiceEndpoint, opts); err != nil {
        return err
    }

    // Register UserService handlers (GetUser, GetMe, UpdateUser, ListUsers, DeleteUser, ChangePassword)
    log.Printf("📡 Connecting to User Service: %s", *userServiceEndpoint)
    if err := userpb.RegisterUserServiceHandlerFromEndpoint(ctx, mux, *userServiceEndpoint, opts); err != nil {
        return err
    }

    log.Printf("📡 Connecting to Task Service: %s", *taskServiceEndpoint)
    if err := taskpb.RegisterTaskServiceHandlerFromEndpoint(ctx, mux, *taskServiceEndpoint, opts); err != nil {
        return err
    }

    log.Printf("🚀 gRPC-Gateway listening on %s", *httpPort)

    // Logging wrapper
    handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        log.Printf("📥 Incoming Request: %s %s", r.Method, r.URL.Path)
        if r.URL.Path == "/healthz" {
            w.WriteHeader(http.StatusOK)
            w.Write([]byte("OK"))
            return
        }
        mux.ServeHTTP(w, r)
    })

    return http.ListenAndServe(*httpPort, handler)
}

func main() {
    flag.Parse()
    if endpoint := os.Getenv("USER_SERVICE_ENDPOINT"); endpoint != "" {
        *userServiceEndpoint = endpoint
    }
    if endpoint := os.Getenv("TASK_SERVICE_ENDPOINT"); endpoint != "" {
        *taskServiceEndpoint = endpoint
    }
    if port := os.Getenv("HTTP_PORT"); port != "" {
        *httpPort = port
    }
    if mtls := os.Getenv("USE_MTLS"); mtls != "" {
        if mtls == "false" || mtls == "0" {
            *useMTLS = false
        } else {
            *useMTLS = true
        }
    }

    log.SetFlags(log.LstdFlags | log.Lshortfile)
    if err := run(); err != nil {
        log.Fatalf("💥 Fatal error: %v", err)
    }
}
EOF

# Copy generated code & build
RUN cp -r /gen ./gen
RUN go mod init grpc-gateway
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o /grpc-gateway main.go

# Runtime stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
COPY --from=builder /grpc-gateway /grpc-gateway
EXPOSE 8080
ENTRYPOINT ["/grpc-gateway"]
