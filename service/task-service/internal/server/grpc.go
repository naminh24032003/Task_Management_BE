package server

import (
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/grpc"

	taskv1 "task-service/api/task/v1"
	taskgrpc "task-service/internal/transport/grpc"
)

// GRPCServerConfig holds gRPC server configuration
type GRPCServerConfig struct {
	Addr    string
	Timeout string
}

// NewGRPCServer creates a gRPC server
func NewGRPCServer(
	logger log.Logger,
	taskService *taskgrpc.TaskService,
) *grpc.Server {
	var opts = []grpc.ServerOption{
		grpc.Middleware(
			recovery.Recovery(),
		),
	}

	// Default configuration
	opts = append(opts, grpc.Address(":50052"))

	srv := grpc.NewServer(opts...)

	// Register gRPC services
	taskv1.RegisterTaskServiceServer(srv, taskService)

	return srv
}
