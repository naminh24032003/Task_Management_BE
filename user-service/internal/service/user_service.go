package service

import (
	"context"

	userv1 "github.com/naminh24032003/task_management_be/shared-proto/gen/go/api/user/v1"
)

type UserService struct {
	userv1.UnimplementedUserServiceServer
}

func NewUserService() *UserService {
	return &UserService{}
}

func (s *UserService) Hello(ctx context.Context, req *userv1.HelloRequest) (*userv1.HelloResponse, error) {
	return &userv1.HelloResponse{
		Message: "Hello anh minh dep trai " + req.Name + " from User Service!",
	}, nil
}
