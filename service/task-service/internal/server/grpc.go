package server

import (
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	kratosTracing "github.com/go-kratos/kratos/v2/middleware/tracing"
	"github.com/go-kratos/kratos/v2/transport/grpc"

	taskv1 "task-service/api/task/v1"
	"task-service/internal/pkg/auth"
	taskgrpc "task-service/internal/transport/grpc"

	"github.com/task-management/go-shared/middleware"
)

// GRPCServerConfig holds gRPC server configuration
type GRPCServerConfig struct {
	Addr    string
	Timeout string
}

// NewGRPCServer creates a gRPC server with auth middleware
func NewGRPCServer(
	logger log.Logger,
	taskService *taskgrpc.TaskService,
) *grpc.Server {
	// Define endpoint auth configurations
	// Key format: /<package>.<service>/<method>
	authConfigs := map[string]auth.EndpointAuthConfig{
		// Public endpoints (no auth required)
		"/task.v1.TaskService/Hello": {AllowPublic: true},

		// Scope-based endpoints (Phase B2 & E)
		"/task.v1.TaskService/GetTask":          {RequireAuth: true, RequireScopes: []string{"task:read"}},
		"/task.v1.TaskService/ListTasks":        {RequireAuth: true, RequireScopes: []string{"task:read"}},
		"/task.v1.TaskService/CreateTask":       {RequireAuth: true, RequireScopes: []string{"task:write"}},
		"/task.v1.TaskService/UpdateTask":       {RequireAuth: true, RequireScopes: []string{"task:write"}},
		"/task.v1.TaskService/DeleteTask":       {RequireAuth: true, RequireScopes: []string{"task:write"}},
		"/task.v1.TaskService/AssignTask":       {RequireAuth: true, RequireScopes: []string{"task:write"}},
		"/task.v1.TaskService/ArchiveTask":      {RequireAuth: true, RequireScopes: []string{"task:write"}},
		"/task.v1.TaskService/UpdateTaskStatus": {RequireAuth: true, RequireScopes: []string{"task:write"}},
	}

	// Create auth selector middleware
	authSelector := auth.NewAuthSelector(authConfigs)

	var opts = []grpc.ServerOption{
		grpc.Middleware(
			recovery.Recovery(),
			kratosTracing.Server(),                       // OpenTelemetry tracing
			middleware.MetricsMiddleware("task-service"), // Prometheus metrics
			middleware.LoggingMiddleware(logger),         // Structured logging
			auth.AuthMiddleware(),                        // Extract identity from metadata
			authSelector.Middleware(),                    // Apply auth rules based on endpoint
		),
	}

	// Default configuration
	opts = append(opts, grpc.Address(":50052"))

	srv := grpc.NewServer(opts...)

	// Register gRPC services
	taskv1.RegisterTaskServiceServer(srv, taskService)

	return srv
}
