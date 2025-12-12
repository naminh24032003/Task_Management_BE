package server

import (
	"user-service/internal/service"

	userv1 "user-service/api/user/v1"

	"google.golang.org/grpc"
)

// NewGRPCServer creates a gRPC server.
func NewGRPCServer(userSvc *service.UserService) *grpc.Server {
	srv := grpc.NewServer()
	userv1.RegisterUserServiceServer(srv, userSvc)
	return srv
}
