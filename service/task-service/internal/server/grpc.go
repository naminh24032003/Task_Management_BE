package server

import (
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/grpc"

	taskv1 "task-service/api/task/v1"
	"task-service/internal/pkg/auth"
	taskgrpc "task-service/internal/transport/grpc"
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

		// Authenticated endpoints (user must be logged in)
		"/task.v1.TaskService/GetTask":    {RequireAuth: true},
		"/task.v1.TaskService/ListTasks":  {RequireAuth: true},
		"/task.v1.TaskService/CreateTask": {RequireAuth: true},
		"/task.v1.TaskService/UpdateTask": {RequireAuth: true},

		// Admin endpoints (require admin role)
		"/task.v1.TaskService/DeleteTask": {RequireAuth: true, RequireRoles: []string{"admin"}},

		// Manager endpoints (require manager or admin role)
		"/task.v1.TaskService/AssignTask": {RequireAuth: true, RequireRoles: []string{"admin", "manager"}},

		// Permission-based endpoints
		"/task.v1.TaskService/ArchiveTask": {RequireAuth: true, RequirePerms: []string{"tasks:archive"}},
	}

	// Create auth selector middleware
	authSelector := auth.NewAuthSelector(authConfigs)

	var opts = []grpc.ServerOption{
		grpc.Middleware(
			recovery.Recovery(),
			auth.AuthMiddleware(),     // Extract identity from metadata
			authSelector.Middleware(), // Apply auth rules based on endpoint
		),
	}

	// Default configuration
	opts = append(opts, grpc.Address(":50052"))

	srv := grpc.NewServer(opts...)

	// Register gRPC services
	taskv1.RegisterTaskServiceServer(srv, taskService)

	return srv
}
