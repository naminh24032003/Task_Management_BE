# Multi-stage build for Shared gRPC-Gateway
# This gateway handles HTTP->gRPC transcoding for ALL microservices
FROM golang:1.24-alpine AS builder

WORKDIR /workspace

# Install build tools
RUN apk add --no-cache protobuf protobuf-dev git curl

# Copy all proto files (for ALL services)
COPY packages/proto ./proto

# Install grpc-gateway tools
RUN go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
RUN go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@latest
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Generate gRPC-Gateway code for ALL services
RUN mkdir -p /gen

# Generate for user-service
RUN protoc -I./proto \
    --go_out=/gen --go_opt=paths=source_relative \
    --go_opt=Mgoogle/api/http.proto=google.golang.org/genproto/googleapis/api/httpbody \
    --go_opt=Mgoogle/api/annotations.proto=google.golang.org/genproto/googleapis/api/annotations \
    --go-grpc_out=/gen --go-grpc_opt=paths=source_relative \
    --grpc-gateway_out=/gen --grpc-gateway_opt=paths=source_relative \
    ./proto/user/v1/user.proto

# TODO: Add more services here
# RUN protoc -I./proto \
#     -I/googleapis \
#     --go_out=/gen --go_opt=paths=source_relative \
#     --go-grpc_out=/gen --go-grpc_opt=paths=source_relative \
#     --grpc-gateway_out=/gen --grpc-gateway_opt=paths=source_relative \
#     ./proto/task/v1/task.proto

# Create shared gateway main.go
RUN cat > /workspace/main.go <<'EOF'
package main

import (
    "context"
    "flag"
    "net/http"
    "os"

    "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
    "google.golang.org/grpc/grpclog"

    userpb "grpc-gateway/gen/user/v1"
    // taskpb "grpc-gateway/gen/task/v1"  // TODO: Add when task-service ready
)

var (
    userServiceEndpoint = flag.String("user-service", "localhost:50051", "User gRPC service endpoint")
    // taskServiceEndpoint = flag.String("task-service", "localhost:50052", "Task gRPC service endpoint")
    httpPort = flag.String("http-port", ":8080", "HTTP port")
)

func run() error {
    ctx := context.Background()
    ctx, cancel := context.WithCancel(ctx)
    defer cancel()

    // Create gateway mux
    mux := runtime.NewServeMux()

    opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

    // Register user-service
    grpclog.Infof("📡 Registering User Service: %s", *userServiceEndpoint)
    if err := userpb.RegisterUserServiceHandlerFromEndpoint(ctx, mux, *userServiceEndpoint, opts); err != nil {
        return err
    }

    // TODO: Register task-service
    // grpclog.Infof("📡 Registering Task Service: %s", *taskServiceEndpoint)
    // if err := taskpb.RegisterTaskServiceHandlerFromEndpoint(ctx, mux, *taskServiceEndpoint, opts); err != nil {
    //     return err
    // }

    grpclog.Infof("🚀 Shared gRPC-Gateway listening on %s", *httpPort)
    grpclog.Infof("🔗 Routing:")
    grpclog.Infof("   /healthz → health check")
    grpclog.Infof("   /v1/users/* → %s", *userServiceEndpoint)
    // grpclog.Infof("   /v1/tasks/* → %s", *taskServiceEndpoint)

    // Custom handler with health check
    return http.ListenAndServe(*httpPort, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path == "/healthz" {
            w.WriteHeader(http.StatusOK)
            w.Write([]byte("OK"))
            return
        }
        mux.ServeHTTP(w, r)
    }))
}

func main() {
    flag.Parse()

    // Allow env override
    if endpoint := os.Getenv("USER_SERVICE_ENDPOINT"); endpoint != "" {
        *userServiceEndpoint = endpoint
    }
    // if endpoint := os.Getenv("TASK_SERVICE_ENDPOINT"); endpoint != "" {
    //     *taskServiceEndpoint = endpoint
    // }
    if port := os.Getenv("HTTP_PORT"); port != "" {
        *httpPort = port
    }

    if err := run(); err != nil {
        grpclog.Fatal(err)
    }
}
EOF

# Copy generated code to workspace for building
RUN cp -r /gen ./gen

# Initialize Go module and build
RUN go mod init grpc-gateway && \
    go get github.com/grpc-ecosystem/grpc-gateway/v2/runtime@latest && \
    go get google.golang.org/grpc@latest && \
    go get google.golang.org/protobuf/reflect/protoreflect@latest && \
    go get google.golang.org/protobuf/runtime/protoimpl@latest && \
    go get google.golang.org/genproto/googleapis/api/annotations@latest && \
    CGO_ENABLED=0 GOOS=linux go build -o /grpc-gateway main.go

# ============================================================================
# Runtime stage
# ============================================================================
FROM alpine:latest

RUN apk --no-cache add ca-certificates

COPY --from=builder /grpc-gateway /grpc-gateway

EXPOSE 8080

ENTRYPOINT ["/grpc-gateway"]
CMD ["--user-service=user-service.default.svc.cluster.local:50051"]
