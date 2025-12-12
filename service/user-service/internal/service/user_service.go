package service

import (
	"context"

	userv1 "user-service/api/user/v1"

	"github.com/go-kratos/kratos/v2/transport/http"
)

type UserService struct {
	userv1.UnimplementedUserServiceServer
}

func NewUserService() *UserService {
	return &UserService{}
}

// Hello implements gRPC UserService
func (s *UserService) Hello(ctx context.Context, req *userv1.HelloRequest) (*userv1.HelloResponse, error) {
	return &userv1.HelloResponse{
		Message: "Hello " + req.Name + " from User Service!",
	}, nil
}

// HelloHTTP handles HTTP requests for Hello endpoint
func (s *UserService) HelloHTTP(ctx http.Context) error {
	name := ctx.Vars().Get("name")
	resp, err := s.Hello(ctx, &userv1.HelloRequest{Name: name})
	if err != nil {
		return err
	}
	return ctx.Result(200, resp)
}
