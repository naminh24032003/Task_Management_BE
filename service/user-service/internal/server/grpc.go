package server

import (
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/grpc"

	userv1 "user-service/api/user/v1"
	usergrpc "user-service/internal/transport/grpc"
)

// GRPCServerConfig holds gRPC server configuration
type GRPCServerConfig struct {
	Addr    string
	Timeout string
}

// NewGRPCServer creates a gRPC server
func NewGRPCServer(
	logger log.Logger,
	userService *usergrpc.UserService,
) *grpc.Server {
	var opts = []grpc.ServerOption{
		grpc.Middleware(
			recovery.Recovery(),
		),
	}

	// Default configuration
	opts = append(opts, grpc.Address(":50051"))

	srv := grpc.NewServer(opts...)

	// Register gRPC services - Hello anh Minh test
	userv1.RegisterUserServiceServer(srv, userService)

	return srv
}
