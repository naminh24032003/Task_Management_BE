package grpc

import (
	"context"

	userv1 "user-service/api/user/v1"
)

// UserService implements the gRPC UserService
type UserService struct {
	userv1.UnimplementedUserServiceServer
}

// NewUserService creates a new UserService
func NewUserService() *UserService {
	return &UserService{}
}

// Hello returns a greeting message - test gRPC
func (s *UserService) Hello(ctx context.Context, req *userv1.HelloRequest) (*userv1.HelloResponse, error) {
	name := req.GetName()
	if name == "" {
		name = "World"
	}
	return &userv1.HelloResponse{
		Message: "Hello anh Minh! Greeting from: " + name,
	}, nil
}
