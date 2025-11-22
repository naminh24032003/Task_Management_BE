package service

import (
	userpb "api/user/v1"
	"context"
)

type UserServiceServer struct {
	userpb.UnimplementedUserServiceServer
}

func (s *UserServiceServer) Hello(ctx context.Context, req *userpb.HelloRequest) (*userpb.HelloReply, error) {
	return &userpb.HelloReply{
		Message: "Hello, " + req.Name + " from user-service!",
	}, nil
}
