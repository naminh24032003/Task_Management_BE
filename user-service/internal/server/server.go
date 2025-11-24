package server

import (
	"user-service/internal/service"

	userv1 "github.com/naminh24032003/task_management_be/shared-proto/gen/go/api/user/v1"
	"google.golang.org/grpc"
)

// NewGRPCServer creates a gRPC server.
func NewGRPCServer(userSvc *service.UserService) *grpc.Server {
	srv := grpc.NewServer()
	userv1.RegisterUserServiceServer(srv, userSvc)
	return srv
}
